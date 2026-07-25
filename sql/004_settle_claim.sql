-- Resolution settlement (§17.2), claim-side. One transaction, FOR UPDATE.
--
-- Split of responsibility: the vote→voter mapping needs HMAC nullifiers
-- (PEPPER_VOTE lives ONLY in the environment, never in the database — I3/I11),
-- so per-voter Brier deltas, payouts and reputation updates are computed by
-- the caller (server/routes/jobs.ts) inside the SAME transaction, using the
-- rows this function returns. Do NOT add an account column to forum.votes to
-- "simplify" this — that column is the whole privacy property.
--
-- p_status: 'verified' | 'refuted' | 'inconclusive'
-- Returns each vote on the claim with its centred Brier delta already
-- written (NULL for inconclusive — inconclusive claims settle no one).
create or replace function forum.settle_claim(
  p_claim_id uuid,
  p_status   text
) returns table (
  nullifier text, stance text, confidence double precision,
  stake int, brier double precision
)
language plpgsql as $$
declare
  v_y int;
begin
  if p_status not in ('verified', 'refuted', 'inconclusive') then
    raise exception 'bad_status' using errcode = '22023';
  end if;

  -- Lock the claim; refuse to settle twice (idempotency guard).
  perform 1 from forum.claims where id = p_claim_id and status = 'open' for update;
  if not found then
    raise exception 'claim_not_open' using errcode = 'P0002';
  end if;

  update forum.claims
     set status = p_status, resolved_at = now()
   where id = p_claim_id;

  if p_status = 'inconclusive' then
    -- Inconclusive settles no one: brier stays NULL, reputation untouched,
    -- stakes are returned in full by the caller.
    update forum.votes set settled_at = now()
     where claim_id = p_claim_id and settled_at is null;
  else
    v_y := case when p_status = 'verified' then 1 else 0 end;
    -- Centred Brier: Δc = (1 − 2(p − y)²) − 0.5, where
    -- p = confidence for 'support', 1 − confidence for 'refute'.
    update forum.votes v
       set settled_at = now(),
           brier = (1 - 2 * pow(
                     (case when v.stance = 'support' then v.confidence
                           else 1 - v.confidence end) - v_y, 2)) - 0.5
     where v.claim_id = p_claim_id and v.settled_at is null;
  end if;

  return query
    select v.nullifier, v.stance, v.confidence, v.stake, v.brier
      from forum.votes v where v.claim_id = p_claim_id;
end $$;
