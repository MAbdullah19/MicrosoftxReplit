/** Mounts all routers under /api. Feature routers (enrol, auth, public,
 *  participate, verify, jobs) are added by later milestones. */
import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { features } from "../env";

export const api = Router();

api.get("/health", async (_req, res) => {
  let ledgerHead: number | null = null;
  let latestEpoch: number | null = null;
  try {
    const r = await db.execute(
      sql`select max(seq)::int as head, max(epoch)::int as epoch from forum.ledger_events`,
    );
    const row: any = r.rows?.[0];
    ledgerHead = row?.head ?? null;
    latestEpoch = row?.epoch ?? null;
  } catch {
    // schema not applied yet — health must still answer
  }
  res.json({ ok: true, features, ledgerHead, latestEpoch });
});
