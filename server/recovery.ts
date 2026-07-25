/** Backup-code redemption (§12.5). Single-use is enforced atomically: the
 *  consuming UPDATE requires `used_at IS NULL` and the caller only proceeds
 *  when exactly one row was claimed — concurrent attempts with the same code
 *  cannot both win. */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "./db";
import { backupCodes } from "../shared/schema";
import { verifyCode } from "./crypto";

/** Returns true iff `code` matched an unused backup code for this pseudonym
 *  AND this call was the one that consumed it. */
export async function consumeBackupCode(pseudonymId: string, code: string): Promise<boolean> {
  const unused = await db
    .select({ codeHash: backupCodes.codeHash })
    .from(backupCodes)
    .where(and(eq(backupCodes.pseudonymId, pseudonymId), isNull(backupCodes.usedAt)));

  for (const row of unused) {
    if (await verifyCode(row.codeHash, code)) {
      // Conditional consume: only one concurrent request can flip used_at.
      const claimed = await db
        .update(backupCodes)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(backupCodes.pseudonymId, pseudonymId),
            eq(backupCodes.codeHash, row.codeHash),
            isNull(backupCodes.usedAt),
          ),
        )
        .returning({ codeHash: backupCodes.codeHash });
      return claimed.length === 1;
    }
  }
  return false;
}
