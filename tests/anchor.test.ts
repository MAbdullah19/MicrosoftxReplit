/** Anchoring and verification against the real database (§21 integration).
 *
 *  Runs with the chain feature OFF, which is the honest default until the
 *  contract is deployed: epochs reach 'skipped_no_chain' and the local hash
 *  chain still has to be internally consistent. The Merkle maths itself is
 *  identical either way — what a deployed contract adds is a third party who
 *  can contradict us, not different arithmetic.
 *
 *  Creates and removes its own rows. */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql, eq } from "drizzle-orm";
import crypto from "node:crypto";
import { db, pool } from "../server/db";
import { accounts, anchors, claims, ledgerEvents, votes } from "../shared/schema";
import { nullifier } from "../server/crypto";
import { runAnchorJob, settle } from "../server/routes/jobs";
import { appendLedgerEvent, epochStart } from "../server/ledger";
import { leafHash, dec6, tallyHash, type VerdictRecord } from "../shared/canonical";
import { buildTree, rootOf, proofFor, verifyProof } from "../shared/merkle";
import { epochOf } from "../shared/epoch";

const tag = `anchor-test-${Date.now()}`;
let claimId: string;
let voters: Array<{ pseudonymId: string; repA: number; repB: number }> = [];
/** A past epoch, so the job is allowed to close it (only epochs < now). */
const PAST_EPOCH = epochOf(Date.now()) - 4;

async function mkAccount(handle: string, repA: number, repB: number) {
  const [row] = await db
    .insert(accounts)
    .values({
      handle,
      tier: 2,
      passkeyId: `${tag}-${handle}`,
      passkeyPubkey: crypto.randomBytes(16),
      repA,
      repB,
      points: 100,
    })
    .returning();
  return row;
}

beforeAll(async () => {
  voters = [
    await mkAccount(`${tag}-a`, 9, 1),
    await mkAccount(`${tag}-b`, 6, 2),
    await mkAccount(`${tag}-c`, 4, 4),
  ];

  const [claim] = await db
    .insert(claims)
    .values({
      subjectKind: "url",
      subjectValue: `https://${tag}.example`,
      subjectKey: crypto.randomBytes(32).toString("hex"),
      statement: "anchor test claim — safe to delete",
      contentHash: crypto.randomBytes(32).toString("hex"),
      expiresAt: new Date(Date.now() + 3600_000),
    })
    .returning();
  claimId = claim.id;

  // Three refuting votes so the claim can settle as 'refuted'.
  for (const v of voters) {
    await db.execute(sql`
      select * from forum.vote_and_rescore(
        ${nullifier(v.pseudonymId, claimId)}, ${claimId}::uuid, 'refute',
        ${0.9}, ${4}, ${v.repA}, ${v.repB})`);
  }
});

afterAll(async () => {
  await db.delete(votes).where(eq(votes.claimId, claimId));
  await db.execute(sql`delete from forum.ledger_events where payload->>'claimId' = ${claimId}`);
  await db.execute(
    sql`delete from forum.ledger_events where payload->>'subjectKey' like ${`${tag}%`}`,
  );
  await db.delete(anchors).where(eq(anchors.epoch, PAST_EPOCH));
  await db.delete(claims).where(eq(claims.id, claimId));
  for (const v of voters)
    await db.delete(accounts).where(eq(accounts.pseudonymId, v.pseudonymId));
  await pool.end();
});

describe("settlement writes a verdict into the hash chain (§17.2)", () => {
  it("settles the claim and appends exactly one ledger event", async () => {
    await settle(claimId, "refuted");

    const [c] = await db.select().from(claims).where(eq(claims.id, claimId));
    expect(c.status).toBe("refuted");
    expect(c.resolvedAt).not.toBeNull();
    expect(c.anchorEpoch).not.toBeNull();

    const events = await db.execute(
      sql`select * from forum.ledger_events where payload->>'claimId' = ${claimId}`,
    );
    expect(events.rows).toHaveLength(1);
  });

  it("grades confident-correct voters up: refuted claim, refute votes", async () => {
    // y = 0 (refuted), p_true = 1 - 0.9 = 0.1 → Δc = (1 − 2·0.01) − 0.5 = +0.48
    const rows = await db.select().from(votes).where(eq(votes.claimId, claimId));
    expect(rows).toHaveLength(3);
    for (const v of rows) expect(Number(v.brier)).toBeCloseTo(0.48, 2);

    // Points rose above the 100 they started with, minus the 4 staked.
    for (const v of voters) {
      const [a] = await db.select().from(accounts).where(eq(accounts.pseudonymId, v.pseudonymId));
      expect(a.points).toBeGreaterThan(96);
      // reputation moved toward "right": a grew, b only decayed
      expect(a.repA).toBeGreaterThan(v.repA * 0.98);
      expect(a.repB).toBeCloseTo(v.repB * 0.98, 6);
    }
  });

  it("the chain links: each block hash commits to the previous one", async () => {
    const chain = await db.execute(
      sql`select seq, prev_hash, block_hash from forum.ledger_events order by seq`,
    );
    const rows = chain.rows as Array<{ prev_hash: string; block_hash: string }>;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].prev_hash).toBe("0".repeat(64));
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].prev_hash).toBe(rows[i - 1].block_hash);
    }
  });
});

describe("anchor job (§17.3)", () => {
  /** Seed two verdict events into a PAST epoch so the job may close it. */
  beforeAll(async () => {
    for (let i = 0; i < 2; i++) {
      const record: VerdictRecord = {
        v: 1,
        claimId: crypto.randomUUID(),
        subjectKey: `${tag}-seeded-${i}`,
        contentHash: "ab".repeat(32),
        status: "verified",
        score: dec6(0.9 - i / 10),
        ci: [dec6(0.7), dec6(0.99)],
        alpha: dec6(9),
        beta: dec6(1),
        tallyHash: tallyHash(3, 8, 1),
        resolvedAt: epochStart(PAST_EPOCH).toISOString().replace(/\.\d{3}Z$/, "Z"),
        policyVersion: "attest-mvp-1",
      };
      await appendLedgerEvent(record, "verdict", PAST_EPOCH);
    }
  });

  it("closes the past epoch and records a root over its events", async () => {
    const result = await runAnchorJob();
    const mine = result.processed.find((p) => p.epoch === PAST_EPOCH);
    expect(mine).toBeDefined();
    expect(mine!.leafCount).toBe(2);

    const [row] = await db.select().from(anchors).where(eq(anchors.epoch, PAST_EPOCH));
    expect(row).toBeDefined();
    expect(row.leafCount).toBe(2);
    // Chain keys are absent in test, so this is the documented degraded mode.
    expect(row.status).toBe("skipped_no_chain");
  });

  it("writes a leaf index onto every event in the epoch", async () => {
    const events = await db
      .select()
      .from(ledgerEvents)
      .where(eq(ledgerEvents.epoch, PAST_EPOCH))
      .orderBy(ledgerEvents.seq);
    events.forEach((e, i) => expect(e.leafIndex).toBe(i));
  });

  it("the stored root matches a tree rebuilt from the ledger", async () => {
    const events = await db
      .select()
      .from(ledgerEvents)
      .where(eq(ledgerEvents.epoch, PAST_EPOCH))
      .orderBy(ledgerEvents.seq);
    const leaves = events.map((e) => leafHash(e.payload as VerdictRecord));
    const [row] = await db.select().from(anchors).where(eq(anchors.epoch, PAST_EPOCH));
    expect(row.merkleRoot).toBe(rootOf(buildTree(leaves)));

    // And every event proves membership — this is what /verify walks.
    const levels = buildTree(leaves);
    leaves.forEach((leaf, i) => {
      expect(verifyProof(leaf, proofFor(levels, i), i, row.merkleRoot)).toBe(true);
    });
  });

  it("running it twice back to back does not change the anchor", async () => {
    const [before] = await db.select().from(anchors).where(eq(anchors.epoch, PAST_EPOCH));
    await runAnchorJob();
    const [after] = await db.select().from(anchors).where(eq(anchors.epoch, PAST_EPOCH));
    expect(after.merkleRoot).toBe(before.merkleRoot);
    expect(after.leafCount).toBe(before.leafCount);

    const rows = await db.select().from(anchors).where(eq(anchors.epoch, PAST_EPOCH));
    expect(rows).toHaveLength(1);
  });

  it("never closes the current epoch — events could still arrive in it", async () => {
    const now = epochOf(Date.now());
    const result = await runAnchorJob();
    for (const p of result.processed) expect(Number(p.epoch)).toBeLessThan(now);
  });
});
