/** Append-only hash chain (§10.3).
 *
 *  h_n = SHA256(h_{n-1} ‖ n ‖ type ‖ payloadHash ‖ t), serialised by an
 *  advisory lock inside forum.append_ledger_event() so `seq` and `prev_hash`
 *  can never interleave. Everything here is a thin typed wrapper over that
 *  function — the ordering guarantee lives in Postgres, not in JavaScript. */
import { sql } from "drizzle-orm";
import { db } from "./db";
import { jcs } from "../shared/canonical";
import { sha256Hex } from "../shared/hash";

// Epoch arithmetic is pure and shared (shared/epoch.ts); re-exported here so
// callers that already import the ledger do not need a second import.
export { epochOf, currentEpoch, epochStart } from "../shared/epoch";
import { currentEpoch } from "../shared/epoch";

export type LedgerEventType = "verdict" | "removal";

/** Minimal shape of a drizzle transaction handle — lets callers append inside
 *  their own transaction so a settlement and its ledger event commit together. */
type Executor = Pick<typeof db, "execute">;

/** Append one event. `payload` is canonicalised with JCS before hashing so the
 *  payload hash is reproducible by anyone holding the same record (I7). */
export async function appendLedgerEvent(
  payload: unknown,
  type: LedgerEventType = "verdict",
  epoch: number = currentEpoch(),
  executor: Executor = db,
): Promise<number> {
  const payloadHash = sha256Hex(jcs(payload));
  const r = await executor.execute(sql`
    select forum.append_ledger_event(
      ${type}, ${JSON.stringify(payload)}::jsonb, ${payloadHash}, ${epoch}
    ) as seq`);
  return Number((r.rows[0] as { seq: number | string }).seq);
}
