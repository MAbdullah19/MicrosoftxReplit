# Attest — build context

Tracks progress against the implementation plan
(`attached_assets/plan_1784970372583.md`). Update at each milestone.

## Status

- [x] **M0 — Skeleton**: single Express process + Vite middleware mode,
  Tailwind, `/api/health` returns `{ ok, features, ledgerHead, latestEpoch }`,
  fail-fast `server/env.ts` (I10), `.gitignore` covers `.env*`, placeholder
  App shell, workflow on port 5000.
- [x] **M1 — Database**: all 10 tables across `forum` + `enrolment` schemas
  (Drizzle push), `sql/001`–`004` applied via idempotent
  `scripts/apply-sql.ts` — `vote_and_rescore()` (I4), `append_ledger_event()`
  hash chain, `settle_claim()`. Shared modules (`config`, `hash`, `subject`,
  `score`, `canonical`, `merkle`, `verdict`, `strings`) with unit tests per
  §21.
- [x] **M2 — Identity**: WebAuthn enrolment/login (`/api/enrol/*`,
  `/api/auth/*`) with challenge in a 5-min signed cookie, one-time invite
  redemption (argon2id, `FOR UPDATE`, I5/I6), random pseudonym + handle,
  8 single-use backup codes shown once, stateless JWT session cookie,
  Postgres rate limiter, Turnstile (dev no-op / prod 503),
  counter-regression rejection on login, `/join` + `/me` pages,
  `scripts/mint-invites.ts`. E2E-tested with a virtual authenticator:
  enrol+invite, logout/login, invite reuse fails, guest enrol, recovery.
- [ ] **M3 — Claims and evidence**: public pages, seed script.
- [ ] **M4 — The engine**: voting endpoints, blind-until-voted, waterfall.
- [ ] **M5 — Resolution and reputation**: jobs/resolve, settlement payouts.
- [ ] **M6 — The chain**: anchoring + browser verification.
- [ ] **M7 — AI, polish, demo prep.**

## Decisions / notes

- `argon2` (native) installed for invite/backup code hashing; swap to
  `@node-rs/argon2` with identical parameters if it ever fails to build.
- `shared/hash.ts` uses one pure-JS synchronous SHA-256 for both server and
  browser so Merkle leaves agree byte-for-byte (avoids the async
  `crypto.subtle` foot-gun).
- `RP_ID` / `RP_ORIGIN` derive from `REPLIT_DEV_DOMAIN` in development only;
  production requires explicit values. Secrets have no fallbacks (I10).
- `settle_claim()` handles the claim/vote side; per-voter payout and
  reputation writes happen in the caller's same transaction because the
  nullifier mapping needs `PEPPER_VOTE`, which never enters the database.
