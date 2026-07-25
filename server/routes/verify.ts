/** §14.5 — everything a stranger needs to check a verdict WITHOUT trusting us.
 *
 *  We hand over the record, the leaf, and the Merkle path. We deliberately do
 *  NOT hand over the authoritative root: the browser reads that straight from
 *  the public RPC (client/src/lib/chain.ts). If this endpoint lied about any
 *  field, the recomputed root would stop matching the chain and the check
 *  would go red — which is the entire point of the product. */
import { Router } from "express";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { anchors, claims, ledgerEvents } from "../../shared/schema";
import { leafHash, type VerdictRecord } from "../../shared/canonical";
import { buildTree, proofFor, rootOf } from "../../shared/merkle";
import { CHAIN } from "../../shared/config";
import { env, features } from "../env";

export const verifyRouter = Router();

verifyRouter.get("/:claimId", async (req, res) => {
  const { claimId } = req.params;

  const [claim] = await db.select().from(claims).where(eq(claims.id, claimId));
  if (!claim) return res.status(404).json({ error: "not_found" });

  // The verdict event for this claim. Ledger payloads are canonical records,
  // so we can match on the claimId inside the jsonb.
  const found = await db.execute(sql`
    select seq, epoch, leaf_index, payload
      from forum.ledger_events
     where event_type = 'verdict' and payload->>'claimId' = ${claimId}
     order by seq desc limit 1`);
  const event = found.rows[0] as
    | { seq: number; epoch: number | string; leaf_index: number | null; payload: VerdictRecord }
    | undefined;
  if (!event)
    return res.status(409).json({ error: "not_resolved", status: claim.status });

  const epoch = Number(event.epoch);

  // Rebuild that epoch's tree from the ledger. Index comes from leaf_index
  // when the anchor job has run, else from position in seq order — the two
  // agree by construction because the job writes indices in the same order.
  const siblings = await db
    .select()
    .from(ledgerEvents)
    .where(eq(ledgerEvents.epoch, epoch))
    .orderBy(asc(ledgerEvents.seq));

  const leaves = siblings.map((e) => leafHash(e.payload as VerdictRecord));
  const index =
    event.leaf_index ?? siblings.findIndex((e) => Number(e.seq) === Number(event.seq));
  const levels = buildTree(leaves);

  const [anchor] = await db.select().from(anchors).where(eq(anchors.epoch, epoch));

  res.json({
    record: event.payload,
    leaf: leafHash(event.payload),
    epoch,
    index,
    proof: proofFor(levels, index),
    /** Our own computed root — for display and for the local-ledger fallback
     *  only. The green path compares against the chain, never against this. */
    localRoot: rootOf(levels),
    anchor: anchor
      ? {
          status: anchor.status,
          merkleRoot: anchor.merkleRoot,
          leafCount: anchor.leafCount,
          txHash: anchor.txHash,
          blockNumber: anchor.blockNumber,
          anchoredAt: anchor.anchoredAt,
        }
      : null,
    chain: {
      enabled: features.chain,
      contractAddress: env.ANCHOR_CONTRACT_ADDRESS ?? null,
      chainId: CHAIN.CHAIN_ID,
      explorer: CHAIN.EXPLORER,
    },
  });
});
