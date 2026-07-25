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
  Schema pushed, `sql/001`–`004` applied, seeded, all 12 suites green against
  it. `scripts/apply-sql.ts` needed its own `dotenv/config`: it deliberately
  does not import `server/env.ts` (it runs before the other secrets matter),
  so it was the one script still expecting a Secrets pane.

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
- **The demo claim's stability clock can only be pre-aged if the resolution
  conditions already hold.** It was seeded two votes short: `runResolveJob()`
  correctly clears `stable_since` on any tick where the conditions fail, so
  the backdated clock was wiped by the first tick, and — separately — no third
  vote from any seeded account could reach `RESOLVE_CONFIDENCE` (a maximal one
  reached P = 0.885 against a 0.90 bar). The claim advertised as "one vote
  away" could not settle at all. It now carries three votes that genuinely
  clear the bar (P = 0.912) with the clock showing the 40 minutes it would
  really have accrued; the live vote is real rather than decisive — supporting
  keeps it settling, refuting drops it to ~0.64 and resets the clock, which is
  worth demonstrating. `tests/resolve.test.ts` pins all of this against
  `SCORING`, so retuning a threshold fails a test instead of the demo.
- **Seeded verdicts share an epoch.** Epoch derives from `resolvedAt`, so
  claims resolved hours apart each got a one-leaf tree whose Merkle proof is
  the empty array — correct, and useless for the one screen the whole design
  builds toward. The three refuted claims now settle a minute apart inside one
  epoch: three leaves, two-step proofs, and an odd leaf count that exercises
  the duplicate-last-node rule (I8).
- **Seed writes AI signals.** Without them `aiSignal` was null on every seeded
  claim and `AiSignalCard` never rendered, so M7 was invisible unless you
  submitted a claim live. Seeding calls `generateAiSignal()` before the seeded
  votes, matching production order (`vote_and_rescore()` reads the signal to
  compute `weight_contributed`). With no `GEMINI_API_KEY` this stores the
  honest "unavailable" fixture — the degraded mode becomes visible rather than
  the feature being absent.
- **vitest `testTimeout` raised to 30s.** The default 5s is a measurement of
  network latency, not correctness: the database suites cross a websocket to
  a remote Neon instance and `runAnchorJob()` makes a round trip per epoch.

## Testing

**85 tests across 12 suites, all green.**

Pure (9 suites, no database): `score`, `merkle`, `canonical`, `subject`,
`turnstile`, `ai`, `epoch`, `verify`, `resolve`. The whole §21 unit checklist
plus AI bounds, epoch boundaries, tamper detection and the resolution
conditions.

Database-backed (`engine`, `recovery`, `anchor`) need `DATABASE_URL`; they run
against Neon and cover vote concurrency, settlement idempotency, hash-chain
linkage and anchor-job idempotency.

Walked end to end against Neon on 2026-07-25: live vote → `runResolveJob()`
settles → ledger event chains onto the previous block hash → all four votes
graded by centred Brier in confidence order (0.90 → Δc 0.480, 0.75 → 0.375) →
payouts and damped reputation applied → `/api/verify/:claimId` returns a
two-step proof to the epoch root.

## Open / next

- [ ] Deploy `AttestAnchorRegistry` to Base Sepolia via Remix (§13.1), set
      `ANCHOR_CONTRACT_ADDRESS` + `VITE_ANCHOR_CONTRACT_ADDRESS` +
      `ANCHORER_PRIVATE_KEY`, fund the anchorer from a faucet, then confirm
      `/verify` goes green rather than amber.
- [ ] `GEMINI_API_KEY` for real AI signals (fixture path works without it).
- [ ] Pick a host to replace Replit; set `RP_ID`/`RP_ORIGIN` to that domain.
- [ ] Scheduled jobs: cron-job.org hitting `/api/jobs/resolve` (5 min) and
      `/api/jobs/anchor` (15 min) with `X-Job-Token`. Note the interaction with
      the demo claim: it is seeded already past the bar and already stable, so
      a resolve tick settles it. Re-run `npm run seed` shortly before demoing,
      or leave the cron off until after.
