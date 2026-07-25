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
- [x] **M3 — Claims and evidence**: subject normalisation, `POST /api/claims`,
  evidence create/delete (https-only links), `/`, `/s/:subjectKey`, `/c/:id`,
  seed script.
- [x] **M4 — The engine**: `POST /vote` with stake escrow, `vote_and_rescore`
  (I4), CI writeback and stability bookkeeping in one transaction;
  `VotePanel`, blind-until-voted veil, `/explain` + `ScoreWaterfall`,
  `BetaCurve`.
- [x] **M5 — Resolution and reputation**: `POST /api/jobs/resolve`,
  `settle_claim()` + caller-side payouts, centred-Brier deltas, damped
  reputation, ledger event on resolution, `/me` vote history, invite minting.
- [x] **M6 — The chain**: `shared/abi.ts`, `server/chain.ts`,
  `server/ledger.ts`, `POST /api/jobs/anchor`, `GET /api/verify/:claimId`,
  `/verify` page with the live checklist and Tamper button, `AnchorStatus`,
  `contracts/AttestAnchorRegistry.sol` (reference — deployed via Remix).
  **Contract not yet deployed** → runs in the amber degraded mode of §5.3.
- [x] **M7 — AI, polish**: `server/ai-core.ts` (pure) + `server/ai.ts`
  (Gemini call at submission, cached, fixture on any failure),
  `AiSignalCard` + dispute, `POST /api/admin/remove/:claimId` writing a
  `removal` event into the same chain (§20), bundle code-split.

## Environment — no longer Replit

The Replit subscription lapsed. Three things moved:

- **Packages**: `package-lock.json` resolved against
  `package-firewall.replit.local`, which is unreachable. All 570 tarball URLs
  were rewritten to `registry.npmjs.org`; versions and integrity hashes are
  unchanged, so the tree is the one the build was developed against.
- **Secrets**: no Secrets pane, so `server/env.ts` loads a gitignored `.env`
  via dotenv. dotenv never overwrites an already-set variable, so a real host
  still wins and I10 holds.
- **Database**: Neon free tier (the same engine, and the same
  `@neondatabase/serverless` driver the code already used — no code change).

`RP_ID=localhost` / `RP_ORIGIN=http://localhost:5000` for local dev; passkeys
work on localhost without HTTPS. Both must change at deploy time (§24 — RP_ID
mismatch is the #1 cause of `passkey creation failed`).

## Decisions / notes

- `argon2` (native) installed for invite/backup code hashing; swap to
  `@node-rs/argon2` with identical parameters if it ever fails to build.
- `shared/hash.ts` uses one pure-JS synchronous SHA-256 for both server and
  browser so Merkle leaves agree byte-for-byte (avoids the async
  `crypto.subtle` foot-gun).
- `settle_claim()` handles the claim/vote side; per-voter payout and
  reputation writes happen in the caller's same transaction because the
  nullifier mapping needs `PEPPER_VOTE`, which never enters the database.
- **Tamper button targets `score`, not `statement`.** The plan (§14.5) says to
  mutate `record.statement`, but a `VerdictRecord` deliberately carries no
  claim text — nothing readable goes on-chain. `score` is the demo-legible
  field, and `tests/verify.test.ts` pins that *every* field is committed to.
- **Epoch arithmetic lives in `shared/epoch.ts`**, not in `server/ledger.ts`,
  so it is testable without a database connection. `server/ledger.ts`
  re-exports it.
- **AI is split `ai-core.ts` (pure) / `ai.ts` (env + db)**, mirroring the
  existing `turnstile-core.ts` / `turnstile.ts` pattern, so prompt and
  sanitisation logic is unit-testable.
- **Bundle**: `viem` (/verify) and `recharts` (BetaCurve) are lazy-loaded.
  Entry chunk 391 KB raw / 115 KB gzip, down from 1050 KB (§6 asks for
  ~200 KB).
- `runResolveJob()` / `runAnchorJob()` are exported functions; the routes are
  thin wrappers, so jobs are callable from tests and scripts without HTTP.

## Testing

`npm test` — 63 pure tests across 8 suites (no database needed):
`score`, `merkle`, `canonical`, `subject`, `turnstile`, `ai`, `epoch`,
`verify`. Covers the whole §21 unit checklist plus AI bounds, epoch
boundaries and tamper detection.

Database-backed suites (`engine`, `recovery`, `anchor`) need `DATABASE_URL`.

## Open / next

- [ ] Deploy `AttestAnchorRegistry` to Base Sepolia via Remix (§13.1), set
      `ANCHOR_CONTRACT_ADDRESS` + `VITE_ANCHOR_CONTRACT_ADDRESS` +
      `ANCHORER_PRIVATE_KEY`, fund the anchorer from a faucet, then confirm
      `/verify` goes green rather than amber.
- [ ] `GEMINI_API_KEY` for real AI signals (fixture path works without it).
- [ ] Pick a host to replace Replit; set `RP_ID`/`RP_ORIGIN` to that domain.
- [ ] Scheduled jobs: cron-job.org hitting `/api/jobs/resolve` (5 min) and
      `/api/jobs/anchor` (15 min) with `X-Job-Token`.
