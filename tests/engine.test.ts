/** Integration tests for the scoring engine (§21): concurrency safety of
 *  vote_and_rescore (I4) and idempotency of settlement. Runs against the
 *  real dev database — creates and removes its own rows. */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { sql, eq } from "drizzle-orm";
import { db, pool } from "../server/db";
import { accounts, claims, votes } from "../shared/schema";
import { nullifier } from "../server/crypto";
import crypto from "node:crypto";

let claimId: string;
let voterA: { pseudonymId: string; repA: number; repB: number };
let voterB: { pseudonymId: string; repA: number; repB: number };

async function mkAccount(handle: string, repA: number, repB: number) {
  const [row] = await db
    .insert(accounts)
    .values({
      handle,
      tier: 2,
      passkeyId: `test-${handle}`,
      passkeyPubkey: crypto.randomBytes(16),
      repA,
      repB,
      points: 100,
    })
    .returning();
  return row;
}

async function mkClaim() {
  const [row] = await db
    .insert(claims)
    .values({
      subjectKind: "text",
      subjectValue: `engine test ${Date.now()}`,
      subjectKey: crypto.randomBytes(32).toString("hex"),
      statement: "engine test claim — safe to delete",
      contentHash: crypto.randomBytes(32).toString("hex"),
      expiresAt: new Date(Date.now() + 3600_000),
    })
    .returning();
  return row.id;
}

const castVote = (n: string, claim: string, stance: string, rep: [number, number]) =>
  db.execute(sql`
    select * from forum.vote_and_rescore(
      ${n}, ${claim}::uuid, ${stance}, ${0.9}, ${3}, ${rep[0]}, ${rep[1]})`);

beforeAll(async () => {
  voterA = await mkAccount(`t-a-${Date.now() % 1e6}`, 8, 2);
  voterB = await mkAccount(`t-b-${Date.now() % 1e6}`, 3, 3);
  claimId = await mkClaim();
});

afterAll(async () => {
  await db.delete(votes).where(eq(votes.claimId, claimId));
  await db.execute(sql`delete from forum.ledger_events where payload->>'claimId' = ${claimId}`);
  await db.delete(claims).where(eq(claims.id, claimId));
  await db.delete(accounts).where(eq(accounts.pseudonymId, voterA.pseudonymId));
  await db.delete(accounts).where(eq(accounts.pseudonymId, voterB.pseudonymId));
  await pool.end();
});

describe("vote_and_rescore concurrency (I4)", () => {
  it("two simultaneous votes from ONE account → exactly one row", async () => {
    const n = nullifier(voterA.pseudonymId, claimId);
    const results = await Promise.allSettled([
      castVote(n, claimId, "support", [voterA.repA, voterA.repB]),
      castVote(n, claimId, "support", [voterA.repA, voterA.repB]),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    // duplicate key on the nullifier PK — surfaced to HTTP as 409 already_voted
    expect(String(failed[0].reason)).toMatch(/duplicate key|23505/);

    const rows = await db.select().from(votes).where(eq(votes.claimId, claimId));
    expect(rows).toHaveLength(1);
  });

  it("votes from DIFFERENT accounts are both counted and move the score", async () => {
    const before = await db.select().from(claims).where(eq(claims.id, claimId));
    const n = nullifier(voterB.pseudonymId, claimId);
    const r = await castVote(n, claimId, "support", [voterB.repA, voterB.repB]);
    const row: any = r.rows[0];
    expect(Number(row.voter_count)).toBe(2);
    expect(Number(row.alpha)).toBeGreaterThan(before[0].alpha);
    const rows = await db.select().from(votes).where(eq(votes.claimId, claimId));
    expect(rows).toHaveLength(2);
  });
});

describe("settlement idempotency (§17.2)", () => {
  it("settle_claim succeeds once, then refuses (claim_not_open)", async () => {
    const first = await db.execute(
      sql`select * from forum.settle_claim(${claimId}::uuid, 'verified')`,
    );
    expect(first.rows.length).toBe(2); // both votes returned with brier set
    // p = 0.9, y = 1 → Δc = (1 − 2·(0.1)²) − 0.5 = 0.48
    for (const v of first.rows as any[]) expect(Number(v.brier)).toBeCloseTo(0.48, 2);

    await expect(
      db.execute(sql`select * from forum.settle_claim(${claimId}::uuid, 'verified')`),
    ).rejects.toThrow(/claim_not_open/);
  });
});
