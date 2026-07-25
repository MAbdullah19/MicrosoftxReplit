/** Integration test against the dev database: backup codes are single-use
 *  even under concurrent redemption attempts (§12.5). */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, pool } from "../server/db";
import { accounts, backupCodes } from "../shared/schema";
import { hashCode, generateCode, generateHandle } from "../server/crypto";
import { consumeBackupCode } from "../server/recovery";

let pseudonymId: string;
const code = generateCode();

beforeAll(async () => {
  const [acc] = await db
    .insert(accounts)
    .values({
      handle: `test-${generateHandle()}`,
      tier: 1,
      passkeyId: `test-${crypto.randomUUID()}`,
      passkeyPubkey: Buffer.from([1, 2, 3]),
    })
    .returning({ pseudonymId: accounts.pseudonymId });
  pseudonymId = acc.pseudonymId;
  await db.insert(backupCodes).values({ pseudonymId, codeHash: await hashCode(code) });
}, 30_000);

afterAll(async () => {
  await db.delete(accounts).where(eq(accounts.pseudonymId, pseudonymId)); // cascades
  await pool.end();
});

describe("backup-code recovery is single-use", () => {
  it("only one of two concurrent redemptions of the same code succeeds", async () => {
    const results = await Promise.all([
      consumeBackupCode(pseudonymId, code),
      consumeBackupCode(pseudonymId, code),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  }, 30_000);

  it("a consumed code cannot be used again", async () => {
    expect(await consumeBackupCode(pseudonymId, code)).toBe(false);
  }, 30_000);

  it("a wrong code never succeeds", async () => {
    expect(await consumeBackupCode(pseudonymId, "AAAA-AAAA-AAAA-AAAA")).toBe(false);
  }, 30_000);
});
