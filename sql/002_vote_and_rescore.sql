-- I4: ALL score mutation happens here, in one transaction, with FOR UPDATE
-- on the claim row. JavaScript computes nothing that touches
-- claims.alpha/beta/score. Caller computes CI (jstat) and writes it back
-- in the SAME transaction, then commits once.
create or replace function forum.vote_and_rescore(
  p_nullifier  text,
  p_claim_id   uuid,
  p_stance     text,          -- 'support' | 'refute'
  p_confidence double precision,
  p_stake      int,
  p_rep_a      double precision,
  p_rep_b      double precision
) returns table (
  alpha double precision, beta double precision,
  score double precision, voter_count int, weight double precision
)
language plpgsql as $$
declare
  v_reputation   double precision;
  v_stake_factor double precision;
  v_raw          double precision;
  v_cap          double precision;
  v_total        double precision;
  v_n            int;
  v_sup          double precision;
  v_ref          double precision;
begin
  -- 1. Lock the claim. Everything below is serialised per claim.
  perform 1 from forum.claims where id = p_claim_id and status = 'open' for update;
  if not found then
    raise exception 'claim_not_open' using errcode = 'P0002';
  end if;

  -- 2. Compute this voter's raw weight.
  v_reputation   := p_rep_a / (p_rep_a + p_rep_b);
  v_stake_factor := 1 + ln(1 + p_stake);
  v_raw          := v_reputation * v_stake_factor;

  -- 3. Insert. The PRIMARY KEY is the nullifier — duplicate votes are
  --    rejected by the DATABASE, not by an application-level SELECT.
  --    (The reference project's check was TOCTOU-racy.)
  insert into forum.votes
    (nullifier, claim_id, stance, confidence, stake, weight, weight_breakdown)
  values
    (p_nullifier, p_claim_id, p_stance, p_confidence, p_stake, v_raw,
     jsonb_build_object('reputation', v_reputation,
                        'stakeFactor', v_stake_factor,
                        'raw', v_raw));

  -- 4. Recompute the whole claim from scratch. Never incremental — an
  --    incremental update cannot express the per-voter cap correctly.
  select count(*) into v_n from forum.votes vv where vv.claim_id = p_claim_id;
  v_cap := greatest(0.15, 2.0 / greatest(v_n, 1));

  -- 4a. Water-fill the cap: find the fixed point T = Σ min(w_i, cap·T).
  --     Seed with the raw sum and iterate downward; each pass can only
  --     shrink T, and a handful of passes converge for any realistic n.
  select coalesce(sum(vv.weight), 0) into v_total
    from forum.votes vv where vv.claim_id = p_claim_id;
  for i in 1..40 loop
    declare v_next double precision;
    begin
      select coalesce(sum(least(vv.weight, v_total * v_cap)), 0) into v_next
        from forum.votes vv where vv.claim_id = p_claim_id;
      exit when abs(v_next - v_total) < 1e-12;
      v_total := v_next;
    end;
  end loop;

  -- 4b. Capped sums per side.
  select coalesce(sum(least(vv.weight, v_total * v_cap)), 0) into v_sup
    from forum.votes vv where vv.claim_id = p_claim_id and vv.stance = 'support';
  select coalesce(sum(least(vv.weight, v_total * v_cap)), 0) into v_ref
    from forum.votes vv where vv.claim_id = p_claim_id and vv.stance = 'refute';

  -- 5. Add the AI signal, capped at 15% of the total including itself.
  declare
    v_human double precision := v_sup + v_ref;
    v_ai_w  double precision := 0;
    v_hint  text; v_ai_conf double precision; v_disp int;
  begin
    select verdict_hint, confidence, disputes into v_hint, v_ai_conf, v_disp
      from forum.ai_signals where claim_id = p_claim_id
      order by created_at desc limit 1;
    if v_hint is not null and v_human > 0 then
      v_ai_w := least(v_ai_conf,
                      (case when v_disp > 0 then 0.05/0.95 else 0.15/0.85 end) * v_human);
      if    v_hint = 'likely_true'  then v_sup := v_sup + v_ai_w;
      elsif v_hint = 'likely_false' then v_ref := v_ref + v_ai_w;
      end if;
      update forum.ai_signals set weight_contributed = v_ai_w
        where claim_id = p_claim_id;
    end if;
  end;

  -- 6. Persist the posterior. CI is computed in JS (jstat) and written back
  --    by the caller in the SAME transaction.
  update forum.claims c
     set alpha = 1 + v_sup,
         beta  = 1 + v_ref,
         score = (1 + v_sup) / (2 + v_sup + v_ref),
         voter_count = v_n
   where c.id = p_claim_id;

  return query
    select c.alpha, c.beta, c.score, c.voter_count, v_raw
      from forum.claims c where c.id = p_claim_id;
end $$;
