/** Operator removal (§20).
 *
 *  "No central authority decides truth" does not mean "no operator removes
 *  illegal content". CSAM, terrorist material and doxxing are not matters of
 *  crowd opinion. But the exercise of that power is itself written into the
 *  same hash chain and anchored like every verdict — so removals are publicly
 *  auditable and countable. That turns the obvious weakness into a feature.
 *
 *  No admin UI by design: a curl command is enough for the MVP, and a UI is
 *  another attack surface for a power that should be rare and logged. */
import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { claims } from "../../shared/schema";
import { appendLedgerEvent, currentEpoch } from "../ledger";
import { POLICY_VERSION } from "../../shared/config";
import type { RemovalRecord } from "../../shared/canonical";
import { tokenOk } from "./jobs";

export const adminRouter = Router();

const removeSchema = z.object({
  /** Recorded in the chain so the reason is as auditable as the removal. */
  reason: z.string().min(3).max(200),
});

adminRouter.post("/remove/:claimId", async (req, res) => {
  if (!tokenOk(req)) return res.status(401).json({ error: "unauthorised" });

  const parsed = removeSchema.safeParse(req.body ?? {});
  if (!parsed.success)
    return res.status(400).json({ error: "invalid_input", detail: parsed.error.flatten() });

  const { claimId } = req.params;
  const [claim] = await db.select().from(claims).where(eq(claims.id, claimId));
  if (!claim) return res.status(404).json({ error: "not_found" });
  if (claim.status === "removed") return res.status(409).json({ error: "already_removed" });

  const removedAt = new Date();
  // The record commits to the ORIGINAL content hash, so the chain proves what
  // was removed without the removed text ever going on-chain.
  const record: RemovalRecord = {
    v: 1,
    kind: "removal",
    claimId,
    subjectKey: claim.subjectKey,
    contentHash: claim.contentHash,
    reason: parsed.data.reason,
    removedAt: removedAt.toISOString().replace(/\.\d{3}Z$/, "Z"),
    policyVersion: POLICY_VERSION,
  };

  const epoch = currentEpoch();
  await db.transaction(async (tx) => {
    // Tombstone replaces the body; the claim row survives so the subject page
    // can say honestly that something was here and was removed.
    await tx
      .update(claims)
      .set({
        status: "removed",
        statement: "[removed by an operator]",
        detail: parsed.data.reason,
        resolvedAt: removedAt,
        anchorEpoch: epoch,
      })
      .where(eq(claims.id, claimId));
    await appendLedgerEvent(record, "removal", epoch, tx);
  });

  res.json({ ok: true, claimId, epoch, record });
});
