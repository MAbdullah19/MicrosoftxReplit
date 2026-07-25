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
(middleware mode in dev, static `client/dist` in production), Postgres
(Replit built-in, Neon engine) via Drizzle, Tailwind.

## Develop

```bash
npm run dev          # serves SPA + API on :5000
npm test             # unit tests (score math, merkle, canonicalisation, subject)
npm run db:push      # push Drizzle schema
npm run db:apply-sql # apply sql/*.sql (idempotent)
```

Copy `.env.example` to configure. Required secrets have **no fallback
defaults** — the server crashes loudly at boot if one is missing (I10).

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

## Honest limitations

- One `anchorer` key signs anchors today. Roadmap: multi-sig → threshold
  signature → permissionless anchoring with a bond.
- The crowd grades itself in the MVP (no automated ground truth), so
  reputation updates are damped by 0.5.
- Missing optional keys (Turnstile, Gemini, chain) put the app in documented
  degraded modes — see `GET /api/health`.
