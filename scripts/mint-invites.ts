/** Admin invite CLI: `npm run invite:mint -- [count]` (default 5).
 *  Prints the raw codes ONCE to stdout; only argon2id hashes hit the DB (I6).
 *  issued_by is 'admin' — never a pseudonym (I5). */
import { db, pool } from "../server/db";
import { invites } from "../shared/schema";
import { hashCode, generateCode } from "../server/crypto";
import { SCORING } from "../shared/config";

const count = Math.max(1, Math.min(100, Number(process.argv[2] ?? 5)));

const expiresAt = new Date(Date.now() + SCORING.INVITE_TTL_DAYS * 24 * 3600 * 1000);

const codes: string[] = [];
for (let i = 0; i < count; i++) {
  const code = generateCode();
  await db.insert(invites).values({
    codeHash: await hashCode(code),
    issuedBy: "admin",
    expiresAt,
  });
  codes.push(code);
}

console.log(`Minted ${count} invite code(s), valid ${SCORING.INVITE_TTL_DAYS} days:\n`);
for (const c of codes) console.log(`  ${c}`);
console.log("\nThese are shown once and stored only as hashes. Copy them now.");

await pool.end();
