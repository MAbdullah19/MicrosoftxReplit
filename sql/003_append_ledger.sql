-- Hash chain: h_n = SHA256(h_{n-1} || n || type || payloadHash || t)
-- Serialised with an advisory lock so seq and prev_hash cannot interleave.
-- Requires pgcrypto (created in 001_schemas.sql).
create or replace function forum.append_ledger_event(
  p_type text, p_payload jsonb, p_payload_hash text, p_epoch bigint
) returns bigint language plpgsql as $$
declare
  v_prev text; v_seq bigint; v_ts timestamptz := now(); v_block text;
begin
  perform pg_advisory_xact_lock(hashtext('attest_ledger'));
  select block_hash into v_prev from forum.ledger_events order by seq desc limit 1;
  v_prev := coalesce(v_prev, repeat('0', 64));
  v_seq  := nextval(pg_get_serial_sequence('forum.ledger_events', 'seq'));
  v_block := encode(digest(
      v_prev || v_seq::text || p_type || p_payload_hash ||
      to_char(v_ts at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'sha256'), 'hex');
  insert into forum.ledger_events
    (seq, prev_hash, event_type, payload, payload_hash, block_hash, epoch, created_at)
  values (v_seq, v_prev, p_type, p_payload, p_payload_hash, v_block, p_epoch, v_ts);
  return v_seq;
end $$;
