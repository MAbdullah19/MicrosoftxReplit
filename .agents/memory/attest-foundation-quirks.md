---
name: Attest foundation quirks
description: Environment/setup lessons from the skeleton+DB milestone (vite middleware, sha256, vitest, npm firewall)
---

- **Vite middleware mode does NOT serve index.html.** With `server.middlewareMode`, Vite skips its HTML fallback regardless of `appType`. `server/index.ts` must read `client/index.html` and call `vite.transformIndexHtml` in an Express `app.use("*")` fallback. Also pass `hmr: { server }` (the already-listening http server) or the HMR ws grabs its own port and can conflict.
  **Why:** hours lost to `Cannot GET /` from Express's default 404 while `/api` worked fine.
- **Listen before attaching Vite.** `createServer` from vite can take 30s+ cold in this repl; `app.listen` first so the workflow port check and `/api/health` pass immediately.
- **Isomorphic sha256 is pure-JS and synchronous** in `shared/hash.ts` — deliberately not `crypto.subtle` (async foot-gun) nor `node:crypto` (server-only). Browser /verify must agree byte-for-byte; don't "optimise" this.
- **npm firewall blocked `vitest@2.x`**; `vitest@latest` (4.x) works. Vitest 4 picks up `vite.config.ts` (root=client) and finds no tests — a separate `vitest.config.ts` with `include: ["tests/**/*.test.ts"]` is required.
- **Subject URL normalisation keeps a trailing slash before a query string** (`/path/?a=1` stays); only a bare trailing slash is stripped. This is spec-exact — match tests to it, not vice versa.
- **Shared env vars land in `.replit`, which must never be committed.** setEnvVars writes values into `.replit [userenv.shared]`; keep `.replit` in `.gitignore`/untracked or peppers and tokens leak into VCS. **Why:** a completion review caught committed pepper values; they were rotated. RP_ID/RP_ORIGIN derive from `REPLIT_DEV_DOMAIN` in dev; production needs them set explicitly.
- **settle_claim() SQL only settles claim+vote rows.** Per-voter payouts/reputation must happen in the caller's same transaction because vote→voter mapping needs HMAC(PEPPER_VOTE,…), which never enters the DB (I3).

- `tsx watch` must ignore `vite.config.ts.timestamp-*` (dev script now does) — Vite's config bundling writes/unlinks that temp file, which otherwise sends tsx into an endless restart loop so the SPA fallback never stays attached (`Cannot GET /`).
