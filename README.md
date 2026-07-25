# Attest

Anonymous public verification network with on-chain verdict anchoring.

A public website where anyone can check whether a phone number, website, or
claim is trustworthy — no account needed to read. To vote you need a passkey
plus a one-time invite code: no email, no phone, no name, ever. Votes are
weighted by Bayesian reputation and graded by the Brier proper scoring rule.
Resolved verdicts are hashed into a Merkle tree whose root is anchored on
Base Sepolia, so a stranger can verify a verdict in their own browser without
trusting our server.

## Stack

One Node.js 20 / Express process serving both the API and the Vite React SPA
(middleware mode in dev, static `client/dist` in production), Postgres (Neon)
via Drizzle, Tailwind.

## Develop

```bash
cp .env.example .env  # then fill in DATABASE_URL and the five secrets
npm install
npm run db:push       # push Drizzle schema
npm run db:apply-sql  # apply sql/*.sql (idempotent)
npm run seed          # 10 demo claims + a spare invite code
npm run dev           # serves SPA + API on :5000
npm test              # see Testing below
```

`npm start` uses POSIX `NODE_ENV=... ` prefix syntax, which is fine on the
Linux host but not in PowerShell. To run the production build on Windows:
`npm run build; $env:NODE_ENV="production"; node dist/server.js`.

Generate each secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Required secrets have **no fallback defaults** — the server crashes loudly at
boot if one is missing (I10). Optional keys (Turnstile, Gemini, chain) are
absent-safe: each switches on a documented degraded mode, surfaced at
`GET /api/health`.

Passkeys work on `localhost` without HTTPS. When you deploy, set `RP_ID` to
the bare host and `RP_ORIGIN` to the full origin — a mismatch is the single
most common cause of `passkey creation failed`.

## Testing

```bash
npm test          # all 12 suites, 85 tests — needs DATABASE_URL
npx vitest run tests/{score,merkle,canonical,subject,turnstile,ai,epoch,verify,resolve}.test.ts
                  # the 9 pure suites, 71 tests, no database
```

Pure suites cover the scoring math, Merkle round-trips (1/2/3/5/8 leaves —
3 and 5 exercise odd-node duplication), JCS canonicalisation, subject-key
equivalence, AI output bounds, epoch boundaries, tamper detection, and the
resolution conditions. Database suites cover vote concurrency (two
simultaneous votes from one account produce one row and a 409), settlement
idempotency, hash-chain linkage, and anchor-job idempotency.

## Deploying the anchor contract

`contracts/AttestAnchorRegistry.sol` is committed for reference and is **not**
built here — no Solidity toolchain belongs in this repo. Deploy it once, by
hand:

1. Open [remix.ethereum.org](https://remix.ethereum.org), paste the contract,
   compile with Solidity 0.8.24.
2. Deploy to **Base Sepolia** (chain 84532) via Injected Provider, with the
   constructor argument set to the anchorer wallet address.
3. Set `ANCHOR_CONTRACT_ADDRESS`, `VITE_ANCHOR_CONTRACT_ADDRESS` and
   `ANCHORER_PRIVATE_KEY` (**testnet wallet only**), and fund the anchorer
   from a Base Sepolia faucet.

Until then `POST /api/jobs/anchor` marks epochs `skipped_no_chain` and
`/verify` shows amber — verified against the local hash chain, not yet
falsifiable against a public one.

## Scheduled jobs

Both are idempotent `POST`s authenticated by an `X-Job-Token` header, and both
are also reachable as `?manual=1` behind a T2 session so a demo never waits on
an external scheduler.

| Job | Cadence | Does |
|---|---|---|
| `/api/jobs/resolve` | 5 min | settles claims that clear confidence + participation + stability; also keeps the database warm |
| `/api/jobs/anchor` | 15 min | closes every unanchored past epoch, so a missed tick self-heals |

## Layout

- `shared/` — pure modules imported by both client and server: config,
  scoring, canonical (JCS) serialisation, Merkle, subject normalisation,
  verdict vocabulary, strings.
- `server/` — Express bootstrap, validated env, db client, crypto, routes.
- `client/` — React SPA (wouter, TanStack Query, Tailwind).
- `sql/` — schemas plus the SQL functions `vote_and_rescore()` (all score
  mutation, serialised per claim with `FOR UPDATE`), `append_ledger_event()`
  (hash chain) and `settle_claim()`.
- `scripts/` — `apply-sql.ts`, seeding, invite minting.
- `contracts/` — the anchor registry, for reading and for deploying by hand.

## Privacy properties, stated as structure

These are enforced by the schema and the code, not by policy:

- `pseudonym_id` is `crypto.randomUUID()` — never derived from any input. A
  hash of an enumerable value is not anonymity.
- There is **no email, phone, or name column anywhere**. "We have no PII" is
  structurally true.
- `forum.votes` has **no foreign key to `forum.accounts`**; its primary key is
  an HMAC nullifier. Dumping the votes table reveals nothing about who voted.
  Mapping a vote back to a voter requires `PEPPER_VOTE`, which lives only in
  the environment — which is why settlement, `/me` history and the waterfall
  all recompute HMACs instead of joining. Do not "optimise" that into a
  column; its absence is the property.
- The `enrolment` schema stores no reference to any pseudonym, so nobody —
  including the operator — can link an invite to the account that redeemed it.
- Invite and backup codes are stored only as argon2id hashes.

## Honest limitations

- One `anchorer` key signs anchors today. Roadmap: multi-sig → threshold
  signature → permissionless anchoring with a bond.
- The crowd grades itself in the MVP (no automated ground truth), so
  reputation updates are damped by 0.5. We say this rather than implying
  external verification we do not perform.
- The AI signal is capped at 15% of total weight, contributes nothing until a
  human has voted, and can never resolve a claim or reject a submission.
- Losing your passkey and your backup codes means losing the account. That is
  the honest cost of having no identity on file; there is no email recovery
  because there is no email.
- Operator removal exists for illegal content, but every removal is written
  into the same hash chain and anchored like a verdict — so the operator's
  use of that power is publicly countable.
- Missing optional keys (Turnstile, Gemini, chain) put the app in documented
  degraded modes — see `GET /api/health`.
