/** Seed data (§18): 10 claims — 3 verified, 3 refuted (with ledger events),
 *  4 open (one sitting at the resolution threshold so it settles live) —
 *  plus 6 accounts with varied reputations and one unredeemed invite code.
 *
 *  Content rules: documented phishing patterns and reserved example numbers
 *  only. Nothing defamatory about a named individual; no real phone numbers.
 *
 *  Every verdict here is produced by the same two SQL functions production
 *  uses — vote_and_rescore() then settle_claim() — so the resolved claims
 *  carry real vote rows, real Brier deltas and a real §14.4 waterfall. No
 *  posterior is written by hand.
 *
 *  Destructive and idempotent: wipes the fixture and reseeds. Accounts you
 *  enrolled with a real passkey, and unredeemed invites, are left alone.
 *  Run: npm run seed
 */
import { sql, eq } from "drizzle-orm";
import { db, pool } from "../server/db";
import {
  accounts, aiSignals, claims, evidence, votes, invites, ledgerEvents, anchors,
} from "../shared/schema";
import { subjectKey, normaliseSubject, type SubjectKind } from "../shared/subject";
import { sha256Hex } from "../shared/hash";
import { dec6, tallyHash, type VerdictRecord } from "../shared/canonical";
import { posterior, applyVoterCap } from "../shared/score";
import { SCORING, CHAIN, POLICY_VERSION } from "../shared/config";
import { nullifier, hashCode, generateCode } from "../server/crypto";
import { appendLedgerEvent } from "../server/ledger";
import { runAnchorJob } from "../server/routes/jobs";
import { generateAiSignal } from "../server/ai";
import { epochOf, epochStart } from "../shared/epoch";
import crypto from "node:crypto";

const HOUR = 3600_000;

/* ── 6 seed accounts, reputations 0.35 → 0.88 (rep seeded directly, §18) ── */
const SEED_ACCOUNTS = [
  { handle: "owl-2291", repA: 22, repB: 3 },   // R ≈ 0.88
  { handle: "elk-4402", repA: 15, repB: 5 },   // R ≈ 0.75
  { handle: "fox-8813", repA: 8, repB: 5 },    // R ≈ 0.62
  { handle: "koi-1147", repA: 6, repB: 6 },    // R = 0.50
  { handle: "wren-6634", repA: 5, repB: 7 },   // R ≈ 0.42
  { handle: "moth-9021", repA: 7, repB: 13 },  // R = 0.35
];

type SeedClaim = {
  kind: SubjectKind;
  value: string;
  statement: string;
  detail?: string;
  status: "verified" | "refuted" | "open" | "inconclusive";
  /** Votes to cast through vote_and_rescore (stance, voter idx, conf, stake).
   *  Resolved claims need these as much as open ones: the §14.4 waterfall,
   *  /me vote history and the ledger's tallyHash are all computed FROM the
   *  vote rows, so a resolved claim seeded with a posterior but no votes
   *  renders an empty explanation. Every resolved claim's set below clears
   *  its own resolution bar — see the note above SEED_CLAIMS. */
  seedVotes?: Array<{ voter: number; stance: "support" | "refute"; confidence: number; stake: number }>;
  evidence?: Array<{ stance: "supports" | "refutes" | "context"; body: string; url?: string; author?: number }>;
  resolvedHoursAgo?: number;
  /** Resolved claims sharing an `epochSlot` settle inside ONE 15-minute epoch,
   *  so that epoch's Merkle tree has several leaves. See `resolvedAtFor`. */
  epochSlot?: number;
  /** Backdate stable_since so the claim can settle the moment the resolution
   *  conditions are met, instead of waiting out STABILITY_MINUTES. See the
   *  comment at the demo claim below for why this is seed data, not a hack
   *  in the engine. */
  stableSinceMinutesAgo?: number;
};

/* Every resolved claim below is seeded as OPEN, voted on through
 * forum.vote_and_rescore(), then put through forum.settle_claim() — the same
 * two functions production uses. Nothing here hand-writes a posterior.
 *
 * That means each vote set has to genuinely clear §17.1: three or more voters
 * and P(θ ≥ 0.75) ≥ 0.90 (or P(θ ≤ 0.25) ≥ 0.90 to refute). The margins are
 * thinner than they look, because the Beta(1,1) prior keeps a tail on the
 * losing side — three unanimous high-stake voters land at ≈0.91, barely over.
 *
 * The paypa1 claim is the deliberate exception: it carries a dissenting vote,
 * so the waterfall has a bar pointing the other way. Overcoming one 0.59-weight
 * dissenter needs five near-maximal voters to reach 0.9151. That cost is the
 * engine being honest about small samples, not a tuning accident — do not
 * "fix" it by shrinking the dissent.
 *
 * If you change a reputation in SEED_ACCOUNTS, a stake, or a threshold in
 * shared/config.ts, re-check these. A claim whose set no longer clears the bar
 * still seeds — settle_claim() does not re-test the conditions — it just
 * quietly becomes a verdict the engine would not have reached. */
const SEED_CLAIMS: SeedClaim[] = [
  // ── 3 refuted (scams — the compelling ones) ──────────────────────────
  {
    kind: "url",
    value: "paypa1-secure-login.com",
    statement: "This site pretends to be the PayPal login page to steal passwords.",
    detail: "Sent by SMS claiming a blocked account.",
    status: "refuted",
    resolvedHoursAgo: 26,
    epochSlot: 1,
    // The one contested claim: moth-9021 (R = 0.35) held out. P(θ ≤ 0.25)
    // still reaches 0.9151, but only because five voters went near-maximal.
    seedVotes: [
      { voter: 0, stance: "refute", confidence: 0.95, stake: 10 },
      { voter: 1, stance: "refute", confidence: 0.9, stake: 10 },
      { voter: 2, stance: "refute", confidence: 0.88, stake: 10 },
      { voter: 3, stance: "refute", confidence: 0.85, stake: 10 },
      { voter: 4, stance: "refute", confidence: 0.8, stake: 10 },
      { voter: 5, stance: "support", confidence: 0.55, stake: 1 },
    ],
    evidence: [
      { stance: "supports", body: "The domain uses the digit 1 instead of the letter l — a classic look-alike trick. Registered 11 days ago.", author: 0 },
      { stance: "supports", body: "The page asks for card number AND online banking PIN. PayPal never asks for a PIN.", author: 1 },
    ],
  },
  {
    kind: "url",
    value: "hbl-verify-account.net",
    statement: "This site imitates HBL bank to collect account credentials.",
    status: "refuted",
    resolvedHoursAgo: 50,
    epochSlot: 1,
    seedVotes: [
      { voter: 2, stance: "refute", confidence: 0.9, stake: 9 },
      { voter: 0, stance: "refute", confidence: 0.88, stake: 8 },
      { voter: 3, stance: "refute", confidence: 0.8, stake: 8 },
      { voter: 1, stance: "refute", confidence: 0.85, stake: 7 },
    ],
    evidence: [
      { stance: "supports", body: "Not the bank's real domain (hbl.com). Uses a free TLS cert issued 3 days ago and hides its registrant.", author: 2 },
    ],
  },
  {
    kind: "phone",
    value: "+92 300 5550123",
    statement: "Callers from this number claim you won a Jeep prize draw and ask for a release fee.",
    detail: "Reserved-range example number used for the demo.",
    status: "refuted",
    resolvedHoursAgo: 8,
    epochSlot: 1,
    seedVotes: [
      { voter: 0, stance: "refute", confidence: 0.95, stake: 8 },
      { voter: 3, stance: "refute", confidence: 0.85, stake: 9 },
      { voter: 1, stance: "refute", confidence: 0.9, stake: 7 },
      { voter: 5, stance: "refute", confidence: 0.7, stake: 3 },
    ],
    evidence: [
      { stance: "supports", body: "Prize-fee fraud pattern: you cannot win a draw you never entered, and real prizes never require an upfront fee.", author: 0 },
      { stance: "context", body: "Multiple reports describe the same script word for word.", author: 3 },
    ],
  },
  // ── 3 verified ───────────────────────────────────────────────────────
  {
    kind: "url",
    value: "sbp.org.pk",
    statement: "This is the real website of the State Bank of Pakistan.",
    status: "verified",
    resolvedHoursAgo: 72,
    seedVotes: [
      { voter: 1, stance: "support", confidence: 0.95, stake: 10 },
      { voter: 0, stance: "support", confidence: 0.92, stake: 10 },
      { voter: 2, stance: "support", confidence: 0.9, stake: 9 },
      { voter: 3, stance: "support", confidence: 0.85, stake: 8 },
    ],
    evidence: [
      { stance: "supports", body: "Long-established government domain, consistent registration history, referenced by official press releases.", author: 1 },
    ],
  },
  {
    kind: "text",
    value: "banks never ask for your full PIN by phone",
    statement: "Banks never ask for your full PIN or password over the phone.",
    status: "verified",
    resolvedHoursAgo: 30,
    seedVotes: [
      { voter: 2, stance: "support", confidence: 0.9, stake: 8 },
      { voter: 0, stance: "support", confidence: 0.95, stake: 9 },
      { voter: 3, stance: "support", confidence: 0.85, stake: 8 },
      { voter: 5, stance: "support", confidence: 0.75, stake: 4 },
    ],
    evidence: [
      { stance: "supports", body: "Every major bank's fraud page states this. Anyone asking for a full PIN by phone is not your bank.", author: 2 },
    ],
  },
  {
    kind: "url",
    value: "https://www.wikipedia.org",
    statement: "This is the legitimate Wikipedia site, not a phishing clone.",
    status: "verified",
    resolvedHoursAgo: 100,
    // No evidence rows — the one claim that settled on votes alone, so the
    // claim page shows what an empty evidence list looks like.
    seedVotes: [
      { voter: 0, stance: "support", confidence: 0.95, stake: 10 },
      { voter: 1, stance: "support", confidence: 0.9, stake: 9 },
      { voter: 3, stance: "support", confidence: 0.85, stake: 8 },
      { voter: 4, stance: "support", confidence: 0.8, stake: 6 },
    ],
  },
  // ── 4 open — the FIRST one sits at 2 votes for the live demo ────────
  {
    kind: "url",
    value: "netflix-renew-billing.info",
    statement: "This site poses as Netflix billing renewal to harvest card details.",
    detail: "Already past the confidence bar and stable — add your vote, then settle it.",
    status: "open",
    // §17.1 makes a claim settle only once the confidence and participation
    // conditions have HELD CONTINUOUSLY for 30 minutes. That is right for
    // production — it stops a burst of votes flipping a verdict — but it
    // cannot fit inside a 5-minute demo, so §25.2 allows seeding a claim that
    // has already done the waiting.
    //
    // The clock can only be pre-aged for a claim whose conditions actually
    // hold. runResolveJob() clears stable_since on any tick where they do not
    // (jobs.ts), so a claim seeded *below* the bar has its backdated clock
    // wiped by the very next tick and can never settle live. These three votes
    // therefore put the claim genuinely over the bar — P(θ ≥ 0.75) = 0.912
    // against a 0.90 requirement — with the clock showing the 40 minutes it
    // would really have accrued. `/api/jobs/resolve?manual=1` then settles it
    // on demand.
    //
    // A live fourth vote is real, not decoration: supporting pushes P to 0.93+
    // and the claim still settles, while refuting drops it to ~0.64, which
    // correctly resets the clock. Both are worth showing.
    //
    // tests/resolve.test.ts pins these three votes against SCORING. Change
    // them, or the thresholds, and it fails rather than the demo failing.
    stableSinceMinutesAgo: 40,
    seedVotes: [
      { voter: 0, stance: "support", confidence: 0.9, stake: 10 },
      { voter: 1, stance: "support", confidence: 0.85, stake: 9 },
      { voter: 2, stance: "support", confidence: 0.8, stake: 8 },
    ],
    evidence: [
      { stance: "supports", body: "Netflix does not use .info domains and never links billing from SMS.", author: 0 },
    ],
  },
  {
    kind: "phone",
    value: "+92 300 5550188",
    statement: "This number sends SMS claiming to be a courier asking for a customs fee.",
    status: "open",
    seedVotes: [{ voter: 4, stance: "support", confidence: 0.7, stake: 2 }],
    evidence: [
      { stance: "context", body: "Courier-fee smishing is a documented pattern; the real courier never texts payment links.", author: 4 },
    ],
  },
  {
    kind: "url",
    value: "free-easypaisa-bonus.xyz",
    statement: "This site promises free mobile-wallet bonus credit in exchange for your wallet PIN.",
    status: "open",
    evidence: [
      { stance: "supports", body: "No wallet gives bonus credit for your PIN. Entering a PIN here hands over the account.", author: 5 },
    ],
  },
  {
    kind: "text",
    value: "you can be fined for using a vpn",
    statement: "Ordinary personal VPN use leads to fines for individuals.",
    status: "open",
  },
];

/* Epoch is derived from resolvedAt, so claims resolved hours apart each get an
 * epoch to themselves — a one-leaf Merkle tree, whose proof is the empty array.
 * That is arithmetically correct and demonstrates nothing: /verify's whole
 * point is walking a leaf up to a root through sibling hashes, and with one
 * leaf there are no siblings. So the three refuted claims share a slot and
 * settle a minute apart inside one epoch. Three leaves is the deliberate
 * choice — an odd count also exercises the duplicate-last-node rule (I8). */
const slotEpoch = new Map<number, number>();
const slotCount = new Map<number, number>();

function resolvedAtFor(c: SeedClaim): Date {
  const nominal = new Date(Date.now() - (c.resolvedHoursAgo ?? 24) * HOUR);
  if (c.epochSlot == null) return nominal;
  // The first claim in a slot fixes the epoch; the rest join it.
  if (!slotEpoch.has(c.epochSlot)) slotEpoch.set(c.epochSlot, epochOf(nominal));
  const n = slotCount.get(c.epochSlot) ?? 0;
  slotCount.set(c.epochSlot, n + 1);
  // A minute apart: distinct, ordered timestamps that stay inside the epoch.
  return new Date(epochStart(slotEpoch.get(c.epochSlot)!).getTime() + n * 60_000);
}

async function main() {
  console.log("seeding …");

  /* Wipe the fixture (order matters for FKs).
   *
   * All forum content goes: claims, votes, evidence, AI signals, ledger and
   * anchors. The fixture owns those outright.
   *
   * Accounts and invites do NOT go wholesale. NEXT-STEPS §3.1 tells you to
   * re-seed shortly before a demo to reset the netflix stability clock — and
   * by then you have a real passkey account and real unredeemed invites on the
   * live domain. A blanket `delete from accounts` would destroy both, leaving
   * you re-enrolling minutes before you present. So the wipe is scoped to rows
   * this script created: seeded accounts are exactly those carrying a `seed-`
   * sentinel in passkey_id instead of a real credential id. */
  await db.delete(votes);
  await db.delete(aiSignals);
  await db.delete(evidence);
  await db.delete(ledgerEvents);
  await db.delete(anchors);
  await db.delete(claims);
  await db.execute(sql`
    delete from forum.backup_codes
     where pseudonym_id in (
       select pseudonym_id from forum.accounts where passkey_id like 'seed-%')`);
  const wiped = await db
    .delete(accounts)
    .where(sql`${accounts.passkeyId} like 'seed-%'`)
    .returning({ handle: accounts.handle });
  // Survivors had stakes escrowed against claims that no longer exist. Nobody
  // can settle those, so return the points rather than stranding them.
  await db.execute(sql`
    update forum.accounts
       set points = points + points_staked, points_staked = 0
     where points_staked > 0`);
  await db.execute(sql`alter sequence forum.ledger_events_seq_seq restart with 1`).catch(() => {});
  if (wiped.length) console.log(`  wiped ${wiped.length} seeded account(s)`);

  /* accounts */
  const accountRows = await db
    .insert(accounts)
    .values(
      SEED_ACCOUNTS.map((a) => ({
        handle: a.handle,
        tier: 2,
        passkeyId: `seed-${a.handle}`,
        passkeyPubkey: crypto.randomBytes(32),
        repA: a.repA,
        repB: a.repB,
        points: SCORING.STARTING_POINTS,
      })),
    )
    .returning();
  console.log(`  ${accountRows.length} accounts`);

  /* claims */
  for (const c of SEED_CLAIMS) {
    const value = normaliseSubject(c.kind, c.value);
    const key = subjectKey(c.kind, c.value);
    const contentHash = sha256Hex(`${c.statement}\n${c.detail ?? ""}`);
    const resolved = c.status === "verified" || c.status === "refuted";
    const resolvedAt = resolved ? resolvedAtFor(c) : null;
    // Always six hours of deliberation before a verdict, measured from the
    // verdict itself — a slotted claim's resolvedAt is not `now − hoursAgo`.
    const createdAt = resolvedAt
      ? new Date(resolvedAt.getTime() - 6 * HOUR)
      : new Date(Date.now() - ((c.resolvedHoursAgo ?? 2) + 6) * HOUR);

    // EVERY claim is born open at the Beta(1,1) prior, including the ones that
    // end up resolved — vote_and_rescore() and settle_claim() both refuse a
    // claim that is not open, and every posterior below is their output rather
    // than a number written here. alpha/beta/score/ci/voter_count are left at
    // the prior; the vote loop overwrites them.
    const [claim] = await db
      .insert(claims)
      .values({
        subjectKind: c.kind,
        subjectValue: value,
        subjectKey: key,
        statement: c.statement,
        detail: c.detail ?? null,
        contentHash,
        status: "open",
        author: accountRows[0].pseudonymId,
        createdAt,
        expiresAt: new Date(Date.now() + SCORING.CLAIM_TTL_HOURS * HOUR),
      })
      .returning();

    /* AI signal, before any vote — in production it is generated at submission,
     * and vote_and_rescore() reads it to compute weight_contributed (I9). Seed
     * it in the same order or the seeded votes would score against a signal
     * that did not exist yet. Without GEMINI_API_KEY this stores the honest
     * "unavailable" fixture rather than nothing, so the card still renders and
     * says so; with a key it stores real signals. */
    await generateAiSignal(claim.id, c.kind, value, c.statement, c.detail ?? null);

    /* evidence */
    for (const e of c.evidence ?? []) {
      await db.insert(evidence).values({
        claimId: claim.id,
        stance: e.stance,
        body: e.body,
        url: e.url ?? null,
        author: accountRows[e.author ?? 0].pseudonymId,
        contentHash: sha256Hex(`${e.stance}\n${e.body}\n${e.url ?? ""}`),
      });
    }

    /* votes go through vote_and_rescore (I4) + CI writeback */
    for (const v of c.seedVotes ?? []) {
      const voter = accountRows[v.voter];
      const n = nullifier(voter.pseudonymId, claim.id);
      const r = await db.execute(sql`
        select * from forum.vote_and_rescore(
          ${n}, ${claim.id}::uuid, ${v.stance}, ${v.confidence}, ${v.stake},
          ${voter.repA}, ${voter.repB})`);
      // CI writeback: caller computes the interval from the returned posterior.
      const row: any = r.rows[0];
      const p = posterior([Number(row.alpha) - 1], [Number(row.beta) - 1]);
      await db.update(claims).set({ ciLow: p.ciLow, ciHigh: p.ciHigh }).where(eq(claims.id, claim.id));
    }

    /* backdated stability clock, for the live-resolution demo claim */
    if (c.stableSinceMinutesAgo != null) {
      await db
        .update(claims)
        .set({ stableSince: new Date(Date.now() - c.stableSinceMinutesAgo * 60_000) })
        .where(eq(claims.id, claim.id));
    }

    /* Settle the resolved ones through forum.settle_claim() — the same
     * function the resolve job calls. It writes each vote's centred Brier
     * delta and settled_at, which is what /me history and the §14.4 waterfall
     * read back.
     *
     * What the seed deliberately does NOT replay is the voter-side half of
     * settle() in server/routes/jobs.ts: the point payouts and reputation
     * updates. SEED_ACCOUNTS states its reputations directly (§18) to get a
     * spread from 0.35 to 0.88 in one step; running six settlements over them
     * would drag every account toward the middle and undo that. Seeded points
     * stay at STARTING_POINTS for the same reason. Live votes are unaffected —
     * they go through the real route, which escrows and pays out properly. */
    if (resolved && resolvedAt) {
      await db.execute(
        sql`select * from forum.settle_claim(${claim.id}::uuid, ${c.status})`,
      );
      // settle_claim() stamps resolved_at = now(); backdate it to the epoch
      // this claim is supposed to have settled in, before the record is built.
      await db.update(claims).set({ resolvedAt }).where(eq(claims.id, claim.id));

      // Verdict record built from the claim row and the vote rows, exactly as
      // settle() does it — nothing here is a parallel implementation.
      const [row] = await db.select().from(claims).where(eq(claims.id, claim.id));
      const claimVotes = await db.select().from(votes).where(eq(votes.claimId, claim.id));
      const capped = applyVoterCap(claimVotes.map((v) => v.weight));
      let wFor = 0;
      let wAgainst = 0;
      claimVotes.forEach((v, i) => {
        if (v.stance === "support") wFor += capped[i];
        else wAgainst += capped[i];
      });
      const record: VerdictRecord = {
        v: 1,
        claimId: claim.id,
        subjectKey: key,
        contentHash,
        status: c.status as "verified" | "refuted",
        score: dec6(row.score),
        ci: [dec6(row.ciLow ?? 0), dec6(row.ciHigh ?? 1)],
        alpha: dec6(row.alpha),
        beta: dec6(row.beta),
        tallyHash: tallyHash(claimVotes.length, wFor, wAgainst),
        resolvedAt: resolvedAt.toISOString().replace(/\.\d{3}Z$/, "Z"),
        policyVersion: POLICY_VERSION,
      };
      // Backdated epoch, not currentEpoch(): these verdicts are hours old, and
      // the anchor job only closes epochs strictly in the past.
      const epoch = Math.floor(resolvedAt.getTime() / 1000 / (CHAIN.EPOCH_MINUTES * 60));
      await appendLedgerEvent(record, "verdict", epoch);
      await db.update(claims).set({ anchorEpoch: epoch }).where(eq(claims.id, claim.id));

      console.log(
        `  claim [${c.status}] ${value}  score=${row.score.toFixed(3)} ` +
          `n=${claimVotes.length} epoch=${epoch}`,
      );
      continue;
    }
    console.log(`  claim [${c.status}] ${value}`);
  }

  /* Anchor the seeded verdicts (§18: the resolved claims come with ledger
   * events AND anchors). Their epochs are hours in the past, so the job is
   * allowed to close them. Without chain keys these land as
   * 'skipped_no_chain' and /verify shows amber — with keys they go on-chain
   * and /verify goes green. */
  const anchored = await runAnchorJob();
  console.log(`\n  anchored ${anchored.processed.length} epoch(s)`);
  for (const p of anchored.processed) console.log(`    epoch ${p.epoch} → ${p.status}`);

  /* One more unredeemed invite — write the raw code on a sticky note. Existing
   * invites are not wiped (see the note at the top of main), so this adds to
   * whatever you already have rather than replacing it. */
  const code = generateCode();
  await db.insert(invites).values({
    codeHash: await hashCode(code),
    issuedBy: "admin",
    expiresAt: new Date(Date.now() + SCORING.INVITE_TTL_DAYS * 24 * HOUR),
  });

  console.log("\nseed complete.");
  console.log(`SPARE INVITE CODE (shown once, write it down): ${code}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
