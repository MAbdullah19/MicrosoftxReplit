# Attest

Anonymous public verification network with on-chain verdict anchoring.
Hackathon MVP built from the spec in `attached_assets/plan_1784970372583.md`
(that document wins over any other source; progress tracked in `context.md`).

## Architecture

- **One process**: Express on port 5000 serves `/api` and the React SPA
  (Vite middleware mode in dev, static `client/dist` in prod).
- **Shared pure modules** in `shared/` are imported by both client and
  server; all tuneable constants live in `shared/config.ts` only.
- **Postgres** (Replit built-in, Neon engine) via `@neondatabase/serverless`
  + Drizzle. Two schemas: `forum` and `enrolment`. SQL functions in `sql/`
  are applied by the idempotent `npm run db:apply-sql`.

## Non-negotiable invariants (spec §2)

I1 random pseudonym UUIDs · I2 no PII columns anywhere · I3 votes keyed by
nullifier, no FK to accounts · I4 all score mutation inside
`forum.vote_and_rescore()` with `FOR UPDATE` · I5 enrolment schema never
references pseudonyms · I6 invite/backup codes stored only as argon2id
hashes · I7 canonical numbers are fixed 6-dp strings · I8 Merkle domain
separators 0x00/0x01 · I9 AI never resolves and has zero weight without a
human vote · I10 no secret fallback defaults · I11 never log IPs/codes/
tokens · I12 "not enough evidence" never renders as safe.

## Commands

`npm run dev` (workflow "Start application"), `npm test`, `npm run db:push`,
`npm run db:apply-sql`.

## User preferences

(none recorded yet)
