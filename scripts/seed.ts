/** Seed data (§18): 10 claims — 3 verified, 3 refuted (with ledger events),
 *  4 open (one sitting at 2 votes so it resolves live during the demo) —
 *  plus 6 accounts with varied reputations and one unredeemed invite code.
 *
 *  Content rules: documented phishing patterns and reserved example numbers
 *  only. Nothing defamatory about a named individual; no real phone numbers.
 *
 *  Destructive and idempotent: wipes forum data and reseeds.
 *  Run: npm run seed
 */
import { sql, eq } from "drizzle-orm";
import { db, pool } from "../server/db";
import {
  accounts, claims, evidence, votes, invites, ledgerEvents, anchors,
} from "../shared/schema";
import { subjectKey, normaliseSubject, type SubjectKind } from "../shared/subject";
import { sha256Hex } from "../shared/hash";
import { dec6, jcs, tallyHash, type VerdictRecord } from "../shared/canonical";
import { posterior } from "../shared/score";
import { SCORING, CHAIN, POLICY_VERSION } from "../shared/config";
import { nullifier, hashCode, generateCode } from "../server/crypto";
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
  /** for open claims: how many seed votes to cast (stance, voter idx, conf, stake) */
  seedVotes?: Array<{ voter: number; stance: "support" | "refute"; confidence: number; stake: number }>;
  evidence?: Array<{ stance: "supports" | "refutes" | "context"; body: string; url?: string; author?: number }>;
  resolvedHoursAgo?: number;
};

const SEED_CLAIMS: SeedClaim[] = [
  // ── 3 refuted (scams — the compelling ones) ──────────────────────────
  {
    kind: "url",
    value: "paypa1-secure-login.com",
    statement: "This site pretends to be the PayPal login page to steal passwords.",
    detail: "Sent by SMS claiming a blocked account.",
    status: "refuted",
    resolvedHoursAgo: 26,
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
  },
  // ── 4 open — the FIRST one sits at 2 votes for the live demo ────────
  {
    kind: "url",
    value: "netflix-renew-billing.info",
    statement: "This site poses as Netflix billing renewal to harvest card details.",
    detail: "One vote away from resolving — cast the third vote live.",
    status: "open",
    seedVotes: [
      { voter: 0, stance: "support", confidence: 0.9, stake: 5 },
      { voter: 1, stance: "support", confidence: 0.85, stake: 4 },
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

async function main() {
  console.log("seeding …");

  /* wipe (order matters for FKs) */
  await db.delete(votes);
  await db.delete(evidence);
  await db.delete(ledgerEvents);
  await db.delete(anchors);
  await db.delete(claims);
  await db.delete(invites);
  await db.execute(sql`delete from forum.backup_codes`);
  await db.delete(accounts);
  await db.execute(sql`alter sequence forum.ledger_events_seq_seq restart with 1`).catch(() => {});

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
    const resolvedAt = resolved
      ? new Date(Date.now() - (c.resolvedHoursAgo ?? 24) * HOUR)
      : null;

    // Resolved claims get a plausible settled posterior; open ones start at prior.
    const supportW = c.status === "verified" ? [2.4, 2.1, 1.8] : c.status === "refuted" ? [0.3] : [];
    const refuteW = c.status === "refuted" ? [2.6, 2.2, 1.9] : c.status === "verified" ? [0.2] : [];
    const post = resolved ? posterior(supportW, refuteW) : null;

    const [claim] = await db
      .insert(claims)
      .values({
        subjectKind: c.kind,
        subjectValue: value,
        subjectKey: key,
        statement: c.statement,
        detail: c.detail ?? null,
        contentHash,
        status: c.status,
        alpha: post?.alpha ?? 1,
        beta: post?.beta ?? 1,
        score: post?.score ?? 0.5,
        ciLow: post?.ciLow ?? null,
        ciHigh: post?.ciHigh ?? null,
        voterCount: resolved ? 4 : 0,
        author: accountRows[0].pseudonymId,
        resolvedAt,
        createdAt: new Date(Date.now() - ((c.resolvedHoursAgo ?? 2) + 6) * HOUR),
        expiresAt: new Date(Date.now() + SCORING.CLAIM_TTL_HOURS * HOUR),
      })
      .returning();

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

    /* open-claim votes go through vote_and_rescore (I4) + CI writeback */
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

    /* resolved claims write a ledger event (verdict) via append_ledger_event */
    if (resolved && post && resolvedAt) {
      const epoch = Math.floor(resolvedAt.getTime() / 1000 / (CHAIN.EPOCH_MINUTES * 60));
      const record: VerdictRecord = {
        v: 1,
        claimId: claim.id,
        subjectKey: key,
        contentHash,
        status: c.status as "verified" | "refuted",
        score: dec6(post.score),
        ci: [dec6(post.ciLow), dec6(post.ciHigh)],
        alpha: dec6(post.alpha),
        beta: dec6(post.beta),
        tallyHash: tallyHash(
          4,
          supportW.reduce((a, b) => a + b, 0),
          refuteW.reduce((a, b) => a + b, 0),
        ),
        resolvedAt: resolvedAt.toISOString().replace(/\.\d{3}Z$/, "Z"),
        policyVersion: POLICY_VERSION,
      };
      const payloadHash = sha256Hex(jcs(record));
      await db.execute(sql`
        select forum.append_ledger_event('verdict', ${JSON.stringify(record)}::jsonb,
          ${payloadHash}, ${epoch})`);
      await db.update(claims).set({ anchorEpoch: epoch }).where(eq(claims.id, claim.id));
    }
    console.log(`  claim [${c.status}] ${value}`);
  }

  /* one spare unredeemed invite — write the raw code on a sticky note */
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
