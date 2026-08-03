# Attest — remaining steps

Everything in the codebase is done: M0–M7 complete, 85 tests across 12 suites
green against Neon, the whole engine walked end to end on the real database.
What is left is **deployment configuration**, not building.

Four things, in the order they should be done. Thing 1 blocks Thing 4 (Turnstile
needs a real hostname) and makes Thing 3 useful, so don't reorder it.

| # | Thing | Time | Blocks a demo? |
|---|---|---|---|
| 1 | [Pick a host and deploy](#1--pick-a-host-and-deploy) | 30–45 min | **Yes** — nothing is public without it |
| 2 | [Deploy the anchor contract](#2--deploy-the-anchor-contract) | 30–60 min (faucet is the slow part) | No — `/verify` runs amber |
| 3 | [Two scheduled jobs](#3--two-scheduled-jobs) | 10 min | No — `?manual=1` covers a demo |
| 4 | [Optional API keys](#4--optional-api-keys) | 15 min | **Turnstile: yes**, see §4.2 |

Current `.env` state: all five required secrets set, database set, chain
read-side (RPC/chain-id/explorer) set. Empty: `TURNSTILE_SECRET_KEY`,
`GEMINI_API_KEY`, `ANCHOR_CONTRACT_ADDRESS`, `ANCHORER_PRIVATE_KEY`,
`VITE_ANCHOR_CONTRACT_ADDRESS`. Missing entirely: `VITE_TURNSTILE_SITE_KEY`.

---

## 1 — Pick a host and deploy

### 1.0 Read this before you start

Three facts that will cost you an hour each if you learn them the hard way.

**Passkeys are bound to the domain.** A passkey registered on `localhost` will
**not** work on `attest.onrender.com`. That's WebAuthn working correctly, not a
bug. After deploying you must enrol a fresh account on the live domain. Keep a
spare invite code for this — `npm run invite:mint` produces more.

**`VITE_*` variables are baked in at build time, not read at runtime.** Setting
`VITE_ANCHOR_CONTRACT_ADDRESS` on the host and restarting does nothing; the
value has to be present when `vite build` runs, and you must rebuild to change
it. On Render/Railway, environment variables are available to the build step, so
just set them before the first deploy — but remember a *change* means a rebuild,
not a restart.

**Never regenerate the peppers.** `PEPPER_VOTE` is the HMAC key for every vote
nullifier; change it and every existing vote becomes unmappable to its voter, so
settlement pays nobody. `PEPPER_IDENTITY` is the same story for identity.
Copy the exact values from your local `.env` to the host.

### 1.1 Choose the host

**Recommended: Render (free web service).** Reasons specific to this project:
its free tier idles a service after ~15 minutes without traffic, and you're
adding a 5-minute cron in Thing 3 anyway — that cron keeps both the web service
and the Neon database warm, so the two problems cancel out. It also builds from
a GitHub repo with no config file needed.

Alternatives, both fine: **Railway** (no idling, trial credit, then paid) and
**Fly.io** (no idling on the free allowance, but needs a `Dockerfile`/`fly.toml`
and a CLI). If you already have one set up, use it — the steps below are the
same apart from where you paste things.

### 1.2 Push the repo to GitHub

The host builds from a repo. Your work is committed on `master`.

```powershell
git remote -v                      # is there already a remote?
git remote add origin https://github.com/<you>/attest.git
git push -u origin master
```

Before pushing, confirm no secrets are tracked. `.env` is gitignored, but check:

```powershell
git ls-files | Select-String -Pattern "^\.env"
```

The only line this should print is `.env.example`. If it prints `.env`, stop and
run `git rm --cached .env` before pushing.

### 1.3 Create the service

On [render.com](https://render.com) → **New** → **Web Service** → connect the repo.

| Field | Value |
|---|---|
| Runtime | Node |
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Instance type | Free |
| Region | pick the one closest to your Neon region |

`npm start` is `NODE_ENV=production node dist/server.js`. That POSIX prefix
syntax fails in PowerShell but is correct on the Linux host, so use it as-is
here. (Locally, use `npm run build; $env:NODE_ENV="production"; node dist/server.js`.)

You do **not** need to set `PORT` — `server/env.ts` defaults it to 5000 but
accepts whatever the host injects, and Render injects one.

### 1.4 Set the environment variables

In the service's **Environment** tab. Copy the values from your local `.env`
exactly — do not regenerate anything.

Required (the server refuses to boot without these — I10, no fallback defaults):

```
DATABASE_URL       <same as local>
SESSION_SECRET     <same as local>
PEPPER_IDENTITY    <same as local>
PEPPER_VOTE        <same as local>
PEPPER_NET         <same as local>
JOB_TOKEN          <same as local>
RP_NAME            Attest
```

Domain-dependent — these are the two you must **change**:

```
RP_ID              attest-xxxx.onrender.com        (bare host, no https://, no trailing slash, no port)
RP_ORIGIN          https://attest-xxxx.onrender.com  (full origin, no trailing slash)
```

You won't know the hostname until the service is created, so create it first,
read the URL off the dashboard, then fill these in and redeploy.

Public build-time values (safe to expose — they end up in the JS bundle):

```
VITE_RPC_URL       https://sepolia.base.org
VITE_CHAIN_ID      84532
VITE_EXPLORER_URL  https://sepolia.basescan.org
```

Leave the four optional keys unset for now; Things 2 and 4 fill them in.

### 1.5 Deploy and verify

Watch the deploy log. A successful boot prints exactly this, and the three
`[degraded]` lines are expected at this stage:

```
[degraded] turnstile disabled
[degraded] ai disabled — fixture signals only
[degraded] chain disabled — anchors marked skipped_no_chain
attest listening on http://0.0.0.0:<port> (production)
```

Then check health from your machine:

```powershell
curl.exe -s https://<your-host>/api/health
```

Expect `{"ok":true,"features":{"turnstile":false,"ai":false,"chain":false},"ledgerHead":N,"latestEpoch":M}`.
`ledgerHead` being non-null proves the database connection works from the host.

### 1.6 Post-deploy checks, in this order

1. Open `https://<your-host>/` — the feed should list the seeded claims.
2. Open a claim → the Beta curve, evidence and AI card render.
3. **Read §4.2 before trying to enrol.** In production without
   `TURNSTILE_SECRET_KEY`, enrolment returns 503. Either set Turnstile now, or
   accept that nobody can join until you do.
4. Mint yourself a fresh invite for the live domain:
   ```powershell
   npm run invite:mint
   ```
   (This runs locally against the same Neon database, so the code works on the
   deployed site.)
5. `/join` on the live domain → register a passkey → confirm you land on `/me`.
6. Vote on the netflix demo claim to confirm the write path works end to end.

### 1.7 If it goes wrong

| Symptom | Cause |
|---|---|
| `passkey creation failed` | `RP_ID` mismatch. It must be the bare hostname — no scheme, no port, no trailing slash — and `RP_ORIGIN` must be the exact origin the browser shows. This is the #1 cause. |
| `FATAL: invalid environment` + a field list | A required var is missing or under 16 chars. The log names the field. |
| Boot succeeds, every page 500s | `DATABASE_URL` wrong, or Neon is blocking the host's region. |
| First request after idling takes ~50s | Render free tier cold start. Thing 3's cron fixes this. |
| `/verify` shows amber | Expected until Thing 2. |

---

## 2 — Deploy the anchor contract

This is the step you deferred when the faucet gated you. Nothing else depends on
it — the app runs in the documented amber mode meanwhile — but green `/verify`
is the demo's centrepiece, so it's worth the effort.

### 2.1 Safety rules, non-negotiable

- Use a **dedicated MetaMask account that will never hold real money.** Its
  private key goes into an environment variable, which is a lower security bar
  than a wallet.
- **Never type your 12-word recovery phrase into any website, chat, or form.**
  Nothing legitimate ever asks for it — that request *is* the scam. You will
  export a *private key* for one account, which is a different thing.
- Never paste the private key into a chat, a commit, or a screenshot.
- Turn **off** MetaMask's "Show conversion on test networks" — testnet ETH has no
  value and displaying a dollar figure for it invites confusion.

### 2.2 Create the anchorer account

1. MetaMask → account menu → **Add account** → name it `attest-anchorer`.
2. Switch network to **Base Sepolia**. If it isn't listed, enable "Show test
   networks" in Settings → Advanced, or add it manually:
   - Network name: Base Sepolia
   - RPC URL: `https://sepolia.base.org`
   - Chain ID: `84532`
   - Currency: ETH
   - Explorer: `https://sepolia.basescan.org`
3. Copy the account's **address** (`0x…`). You need it twice below.

### 2.3 Get Base Sepolia ETH

You need very little — each anchor writes 32 bytes plus two integers. **0.01 ETH
covers hundreds of anchors.** Faucet eligibility rules change often, so work down
this list until one gives you something:

1. **Coinbase Developer Platform faucet** — sign in with a CDP account, select
   Base Sepolia, claim. Usually the lowest-friction route for Base specifically.
2. **Superchain faucet** (`app.optimism.io/faucet`) — supports Base Sepolia;
   may require a Coinbase/Farcaster/GitHub attestation instead of a balance.
3. **Alchemy or QuickNode faucet** — these commonly require a small *mainnet* ETH
   balance on the requesting address. If you have one, this is fast; if not, skip.
4. **Ethereum Sepolia → bridge.** Get Sepolia ETH from a faucet that doesn't
   gate on balance (Google Cloud's Web3 faucet has been the reliable one), then
   bridge it to Base Sepolia at [bridge.base.org](https://bridge.base.org) in
   testnet mode. Slower, but it works when the direct faucets refuse you.

**Do not buy LINK** to satisfy the Chainlink faucet's gate, and don't buy mainnet
ETH to satisfy Alchemy's. Spending real money to unlock a testnet faucet for a
hackathon demo is a bad trade — the amber mode is a legitimate fallback.

Confirm the balance shows in MetaMask on Base Sepolia before continuing.

### 2.4 Compile and deploy in Remix

1. Open [remix.ethereum.org](https://remix.ethereum.org).
2. In **File explorer**, create `AttestAnchorRegistry.sol` and paste the entire
   contents of `contracts/AttestAnchorRegistry.sol` from this repo.
3. **Solidity compiler** tab → select compiler **0.8.24** → **Compile**. Expect
   no errors (warnings are fine).
4. **Deploy & run transactions** tab:
   - Environment: **Injected Provider — MetaMask**
   - Confirm the banner reads **Base Sepolia (84532)**. If it says anything else,
     switch networks in MetaMask and reselect.
   - Account: the `attest-anchorer` address.
   - Contract: `AttestAnchorRegistry`.
   - Next to the orange **Deploy** button there's a field for the constructor
     argument `_anchorer`. **Paste the anchorer address there.**

   ⚠️ **This is the one step that silently ruins everything.** `submitAnchor()`
   reverts with `NotAuthorised` unless `msg.sender == anchorer`. If you deploy
   with the wrong address — or leave it blank — the anchor job will fail every
   run and the only fix is redeploying. The address in the constructor must be
   the same account whose private key you put in `ANCHORER_PRIVATE_KEY`.
5. Click **Deploy**, confirm in MetaMask, wait for the receipt.
6. Copy the **deployed contract address** from the "Deployed Contracts" panel.

Sanity check before leaving Remix: expand the deployed contract and click the
blue `anchorer` button. It must return your anchorer address.

### 2.5 Export the private key

MetaMask → the `attest-anchorer` account → three dots → **Account details** →
**Show private key** → enter your password → copy.

`server/chain.ts` accepts it with or without the `0x` prefix, so either is fine.

### 2.6 Set the variables

Locally, in `.env`:

```
ANCHOR_CONTRACT_ADDRESS=0x<deployed address>
VITE_ANCHOR_CONTRACT_ADDRESS=0x<the same address>
ANCHORER_PRIVATE_KEY=<the exported key>
```

Both address variables get the **same value**. The unprefixed one is read by the
server's anchor job; the `VITE_` one is compiled into the browser bundle so
`/verify` can read the contract directly.

On the host, set the same three — then **trigger a rebuild, not just a restart**,
because `VITE_ANCHOR_CONTRACT_ADDRESS` is baked in at build time (§1.0).

### 2.7 Verify it worked

After restart, the boot log should be missing the chain line:

```
[degraded] turnstile disabled
[degraded] ai disabled — fixture signals only
attest listening on …
```

Then:

```powershell
curl.exe -s https://<your-host>/api/health
```

`features.chain` must now be `true`.

Now fire the anchor job by hand:

```powershell
curl.exe -s -X POST https://<your-host>/api/jobs/anchor -H "X-Job-Token: <your JOB_TOKEN>"
```

**Every epoch you anchored while the chain was off will now be picked up.** The
job's pending query skips only epochs whose status is `confirmed`, and those old
ones are `skipped_no_chain` — so they get retried and anchored for real. That
self-healing is deliberate. Expect a response like:

```json
{"ok":true,"currentEpoch":1983xxx,"processed":[{"epoch":1983213,"root":"…","leafCount":3,"status":"confirmed","txHash":"0x…","alreadyAnchored":false}]}
```

Paste the `txHash` into [sepolia.basescan.org](https://sepolia.basescan.org) to
see it on a public explorer. Then open `/verify` for one of the three refuted
claims — the checklist should go **green**, and the **Tamper** button should turn
it red.

### 2.8 If it goes wrong

| Symptom | Cause |
|---|---|
| `status:"failed"`, error mentions `NotAuthorised` | Constructor got the wrong address (§2.4 step 4). Redeploy. |
| `status:"failed"`, error mentions funds/gas | Anchorer has no Base Sepolia ETH. Back to §2.3. |
| `features.chain` still false | One of the two server-side vars is empty. Both `ANCHOR_CONTRACT_ADDRESS` *and* `ANCHORER_PRIVATE_KEY` are required to flip the flag. |
| Health is green but `/verify` is still amber | You restarted instead of rebuilding — the browser bundle still has no contract address. |
| `alreadyAnchored: true` | Not an error. The epoch was already on-chain; the job is idempotent and reports it as a success. |

---

## 3 — Two scheduled jobs

Both endpoints are idempotent `POST`s. The anchor job is self-healing: it closes
*every* unanchored past epoch, not just the latest, so a missed tick leaves no
permanent gap.

### 3.1 ⚠️ Do this after your demo, or re-seed before it

The netflix demo claim is seeded **already past the confidence bar with a
pre-aged 40-minute stability clock**. The very first resolve tick will settle it —
and the live vote you were going to cast in front of judges loses its moment.

Pick one:

- **Leave the cron off** until after the demo, and use `?manual=1` (§3.5) to
  settle the claim on cue. This is the simplest and what the demo script assumes.
- Or **re-run `npm run seed` shortly before demoing** to reset the clock.

### 3.2 Set up the jobs on cron-job.org

Sign up at [cron-job.org](https://cron-job.org), then **Create cronjob** twice.

**Job A — resolve**

| Field | Value |
|---|---|
| Title | attest-resolve |
| URL | `https://<your-host>/api/jobs/resolve` |
| Schedule | Every **5** minutes |
| Request method | **POST** |
| Header | `X-Job-Token: <your JOB_TOKEN>` |

**Job B — anchor**

| Field | Value |
|---|---|
| Title | attest-anchor |
| URL | `https://<your-host>/api/jobs/anchor` |
| Schedule | Every **15** minutes |
| Request method | **POST** |
| Header | `X-Job-Token: <your JOB_TOKEN>` |

The header is added under "Advanced" → "Headers" on most cron-job.org layouts.
The method **must** be POST — a GET returns the SPA's HTML, not the job.

Don't shorten the anchor cadence below 15 minutes: epochs are 15 minutes wide and
the job only touches epochs strictly in the past, so a faster tick does no extra
work.

The resolve job doubles as a keep-warm ping for both Neon and (on a free host)
the web service itself. That's why it's the 5-minute one.

### 3.3 Test each job before trusting the schedule

```powershell
$t = "<your JOB_TOKEN>"
curl.exe -s -X POST https://<your-host>/api/jobs/resolve -H "X-Job-Token: $t"
curl.exe -s -X POST https://<your-host>/api/jobs/anchor  -H "X-Job-Token: $t"
```

Expected shapes:

```json
{"ok":true,"checked":4,"stabilised":0,"settled":[]}
{"ok":true,"currentEpoch":1983xxx,"processed":[]}
```

`{"error":"unauthorised"}` means the token doesn't match — it's compared with
`timingSafeEqual`, so a trailing space or newline fails it.

### 3.4 Alternative if you'd rather not use cron-job.org

A GitHub Actions workflow on a schedule works, with `JOB_TOKEN` in repo secrets.
Note that GitHub's scheduler is best-effort and often runs late — fine for this
app (both jobs self-heal), but don't expect punctual 5-minute ticks.

### 3.5 The manual path for the demo

Both jobs also accept `?manual=1` when you're signed in with a T2 session — so
you can settle the demo claim on cue from the browser without waiting for a
scheduler, and without pasting a token into a URL:

```
POST /api/jobs/resolve?manual=1
```

Note the admin removal endpoint deliberately does **not** accept this path —
removal is an operator power, not something any signed-in user may trigger.

---

## 4 — Optional API keys

Both are genuinely optional in the sense that the code never crashes without
them. But §4.2 will break your live demo if you ignore it, so read that one.

### 4.1 GEMINI_API_KEY — real AI signals

Without it, every claim gets an honest fixture signal (`verdictHint:
"unverifiable"`, confidence 0, "AI analysis unavailable") and the card renders
greyed out saying so. That's a defensible degraded mode — but a real signal
demonstrates M7 properly.

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and
   create an API key (free tier is enough — the model is `gemini-2.5-flash`).
2. Set `GEMINI_API_KEY=<key>` locally and on the host. Server-side only; it is
   **not** a `VITE_` variable and must never reach the browser.
3. Restart. The boot log should lose the `[degraded] ai disabled` line, and
   `/api/health` should show `features.ai: true`.

**Then re-seed.** One Gemini call happens per claim *at submission time* and the
result is cached in `forum.ai_signals` forever — never on page render, which is
what keeps you under the free-tier rate limit. Your seeded claims already have
fixture signals cached, so they will **not** be upgraded automatically:

```powershell
npm run seed
```

Verify by opening any claim — the AI card should now carry a real hint and
rationale instead of "unavailable". If Gemini 429s, that's the free-tier
per-minute limit; the code falls back to the fixture rather than failing.

### 4.2 TURNSTILE — ⚠️ required in production for anyone to join

This one is not optional in practice. In production, with no
`TURNSTILE_SECRET_KEY`, `verifyTurnstile()` returns **503 `turnstile_unconfigured`**
— deliberately, because silently disabling a bot gate in production is worse than
failing loudly. The effect: **`/join` returns 503 and nobody can enrol on your
deployed site.** Login for existing accounts is unaffected, since only the
enrolment route is gated.

So if a judge is going to create an account on the live site, you must set this.

1. Cloudflare dashboard → **Turnstile** → **Add site**.
2. Domain: your deployed hostname (e.g. `attest-xxxx.onrender.com`). Widget mode:
   Managed.
3. Copy **both** keys. You need each of them, in different places:

   ```
   TURNSTILE_SECRET_KEY=<secret key>          # server-side, keep private
   VITE_TURNSTILE_SITE_KEY=<site key>         # public, compiled into the bundle
   ```

   **`VITE_TURNSTILE_SITE_KEY` is not currently in your `.env` at all** — add the
   line, don't just fill a blank.
4. Set both on the host and **rebuild** (the `VITE_` one is build-time, §1.0).
5. Verify: `/api/health` shows `features.turnstile: true`, and the widget appears
   on `/join` above the button. The Join button stays disabled until the widget
   returns a token — that's `Join.tsx` refusing to submit without one.

Local development is unaffected either way: without a secret key in dev mode the
check is a no-op, logged once at boot.

---

## Pre-demo checklist

Run through this on the live domain, an hour before, not five minutes before.

- [ ] `GET /api/health` → `ok: true`, and `features` shows what you expect
- [ ] Feed loads; a claim page renders curve, evidence and AI card
- [ ] `/join` works with a fresh invite code and a **new** passkey on this domain
      (localhost passkeys don't carry over)
- [ ] You can vote on the netflix claim from that new account
- [ ] `POST /api/jobs/resolve?manual=1` settles it, and the verdict appears
- [ ] `/verify` on a resolved claim shows a real Merkle proof; Tamper turns it red
- [ ] Cron is **off** (or you re-seeded within the last few minutes) — §3.1
- [ ] A spare invite code is written down somewhere you can read it out loud
- [ ] If the chain is live: the anchor tx opens on sepolia.basescan.org

If the chain isn't deployed, say so plainly during the demo — amber means
"verified against our hash chain, not yet falsifiable against a public one".
That's a documented degraded mode, and stating a limitation is stronger than
letting someone discover it.
