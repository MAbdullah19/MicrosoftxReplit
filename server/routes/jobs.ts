/** Scheduled jobs (§17). Auth: X-Job-Token (timingSafeEqual) or, for live
 *  demos, ?manual=1 behind a T2 session. Both jobs are idempotent. */
import { Router, type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { env } from "../env";
import { readSession } from "../session";
import { nullifier } from "../crypto";
import { accounts, anchors, claims, ledgerEvents, votes } from "../../shared/schema";
import { pAtLeast, pAtMost, payout, updateReputation, applyVoterCap } from "../../shared/score";
import { dec6, leafHash, tallyHash, type VerdictRecord } from "../../shared/canonical";
import { buildTree, rootOf } from "../../shared/merkle";
import { appendLedgerEvent, currentEpoch, epochOf } from "../ledger";
import { submitAnchor } from "../chain";
import { features } from "../env";
import { SCORING, POLICY_VERSION } from "../../shared/config";

export const jobsRouter = Router();

/** §17.1 confidence + participation conditions (stability is time-based). */
export function conditionsHold(alpha: number, beta: number, voterCount: number): boolean {
  if (voterCount < SCORING.MIN_T2_VOTERS) return false;
  return (
    pAtLeast(SCORING.TAU_VERIFY, alpha, beta) >= SCORING.RESOLVE_CONFIDENCE ||
    pAtMost(SCORING.TAU_REFUTE, alpha, beta) >= SCORING.RESOLVE_CONFIDENCE
  );
}

/** Constant-time X-Job-Token check. Exported for the admin router, which
 *  must NOT accept the ?manual=1 session path below — removal is an operator
 *  power, not something any signed-in T2 user may trigger. */
export function tokenOk(req: Request): boolean {
  const given = req.get("X-Job-Token") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(env.JOB_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function jobAuth(req: Request, res: Response, next: NextFunction) {
  if (tokenOk(req)) return next();
  if (req.query.manual === "1") {
    const session = await readSession(req);
    if (session && session.tier >= 2) return next();
  }
  return res.status(401).json({ error: "unauthorised" });
}

/** Settle one claim (§17.2). Runs settle_claim() then does the voter-side
 *  payouts/reputation in the SAME transaction.
 *
 *  Mapping votes to voters WITHOUT a foreign key (I3): the vote row holds
 *  only an HMAC nullifier. We iterate over T2 accounts and recompute
 *  nullifier(pseudonymId, claimId) for each — a few dozen HMACs at beta
 *  scale, instantaneous. Do NOT add an account column to forum.votes to
 *  "optimise" this; that column's absence is the entire privacy property. */
export async function settle(
  claimId: string,
  status: "verified" | "refuted" | "inconclusive",
) {
  await db.transaction(async (tx) => {
    const r = await tx.execute(
      sql`select * from forum.settle_claim(${claimId}::uuid, ${status})`,
    );
    const voteRows = r.rows as Array<{
      nullifier: string;
      stance: "support" | "refute";
      confidence: number;
      stake: number;
      brier: number | null;
    }>;

    // Nullifier → account recompute loop (see comment above).
    const t2 = await tx.select().from(accounts).where(eq(accounts.tier, 2));
    const byNullifier = new Map<string, (typeof t2)[number]>();
    for (const acct of t2) byNullifier.set(nullifier(acct.pseudonymId, claimId), acct);

    for (const v of voteRows) {
      const acct = byNullifier.get(v.nullifier);
      if (!acct) continue; // account gone; stake is forfeit to nobody
      const stake = Number(v.stake);
      if (status === "inconclusive") {
        // Inconclusive settles no one: full stake back, reputation untouched.
        await tx
          .update(accounts)
          .set({ points: acct.points + stake, pointsStaked: Math.max(0, acct.pointsStaked - stake) })
          .where(eq(accounts.pseudonymId, acct.pseudonymId));
        continue;
      }
      const deltaC = Number(v.brier);
      const returned = payout(stake, deltaC);
      const rep = updateReputation(acct.repA, acct.repB, deltaC, true); // damped: crowd graded itself
      await tx
        .update(accounts)
        .set({
          points: acct.points + returned,
          pointsStaked: Math.max(0, acct.pointsStaked - stake),
          repA: rep.a,
          repB: rep.b,
        })
        .where(eq(accounts.pseudonymId, acct.pseudonymId));
    }

    // Ledger event (§17.2.6) with the canonical 6-dp string record (I7).
    const [c] = await tx.select().from(claims).where(eq(claims.id, claimId));
    const claimVotes = await tx.select().from(votes).where(eq(votes.claimId, claimId));
    const cap = applyVoterCap(claimVotes.map((v) => v.weight));
    let wFor = 0;
    let wAgainst = 0;
    claimVotes.forEach((v, i) => {
      if (v.stance === "support") wFor += cap[i];
      else wAgainst += cap[i];
    });
    const record: VerdictRecord = {
      v: 1,
      claimId,
      subjectKey: c.subjectKey,
      contentHash: c.contentHash,
      status,
      score: dec6(c.score),
      ci: [dec6(c.ciLow ?? 0), dec6(c.ciHigh ?? 1)],
      alpha: dec6(c.alpha),
      beta: dec6(c.beta),
      tallyHash: tallyHash(claimVotes.length, wFor, wAgainst),
      resolvedAt: (c.resolvedAt ?? new Date()).toISOString().replace(/\.\d{3}Z$/, "Z"),
      policyVersion: POLICY_VERSION,
    };
    const epoch = currentEpoch();
    await appendLedgerEvent(record, "verdict", epoch, tx);
    await tx.update(claims).set({ anchorEpoch: epoch }).where(eq(claims.id, claimId));
  });
}

/** §17.1 — every 5 minutes (also the DB keep-warm ping).
 *  Exported as a plain function so it is callable from tests and scripts
 *  without going through HTTP. */
export async function runResolveJob() {
  const open = await db.select().from(claims).where(eq(claims.status, "open"));
  const now = Date.now();
  const settled: Array<{ id: string; status: string }> = [];
  let stabilised = 0;

  for (const c of open) {
    // 5. Past the deadline → inconclusive, a legitimate outcome.
    if (now > c.expiresAt.getTime()) {
      await settle(c.id, "inconclusive");
      settled.push({ id: c.id, status: "inconclusive" });
      continue;
    }

    const holds = conditionsHold(c.alpha, c.beta, c.voterCount);
    if (!holds) {
      if (c.stableSince)
        await db.update(claims).set({ stableSince: null }).where(eq(claims.id, c.id));
      continue;
    }
    if (!c.stableSince) {
      await db.update(claims).set({ stableSince: new Date() }).where(eq(claims.id, c.id));
      stabilised++;
      continue;
    }
    // 4. Confidence + participation + ≥30 min stability → settle.
    if (now - c.stableSince.getTime() >= SCORING.STABILITY_MINUTES * 60_000) {
      const verdict =
        pAtLeast(SCORING.TAU_VERIFY, c.alpha, c.beta) >= SCORING.RESOLVE_CONFIDENCE
          ? "verified"
          : "refuted";
      await settle(c.id, verdict);
      settled.push({ id: c.id, status: verdict });
    }
  }

  return { ok: true as const, checked: open.length, stabilised, settled };
}

jobsRouter.post("/resolve", jobAuth, async (_req, res) => {
  res.json(await runResolveJob());
});

/** §17.3 — every 15 minutes. Idempotent and self-healing: it closes EVERY
 *  unanchored past epoch, not just the latest, so a missed tick leaves no
 *  permanent gap. Only epochs strictly before the current one are eligible,
 *  so no event can ever land in an epoch that has already been anchored. */
export async function runAnchorJob() {
  const now = currentEpoch();

  // Every epoch holding events that is not yet confirmed on-chain.
  const pending = await db.execute(sql`
    select distinct le.epoch::bigint as epoch
      from forum.ledger_events le
     where le.epoch < ${now}
       and not exists (
         select 1 from forum.anchors a
          where a.epoch = le.epoch and a.status = 'confirmed')
     order by 1`);

  const processed: Array<Record<string, unknown>> = [];

  for (const row of pending.rows as Array<{ epoch: number | string }>) {
    const epoch = Number(row.epoch);
    const events = await db
      .select()
      .from(ledgerEvents)
      .where(eq(ledgerEvents.epoch, epoch))
      .orderBy(asc(ledgerEvents.seq));
    if (events.length === 0) continue;

    // Leaf = SHA256(0x00 ‖ JCS(payload)). The payload round-trips through
    // jsonb, but JCS sorts keys and every canonical number is already a
    // string (I7), so the bytes are stable.
    const leaves = events.map((e) => leafHash(e.payload as VerdictRecord));
    const root = rootOf(buildTree(leaves));

    // Leaf index is what lets /verify rebuild the path for one claim.
    await db.transaction(async (tx) => {
      for (let i = 0; i < events.length; i++) {
        await tx
          .update(ledgerEvents)
          .set({ leafIndex: i })
          .where(eq(ledgerEvents.seq, events[i].seq));
      }
      await tx.execute(sql`
        insert into forum.anchors (epoch, merkle_root, leaf_count, status)
        values (${epoch}, ${root}, ${leaves.length}, 'pending')
        on conflict (epoch) do update
          set merkle_root = excluded.merkle_root,
              leaf_count  = excluded.leaf_count,
              status      = case when forum.anchors.status = 'confirmed'
                                 then 'confirmed' else 'pending' end`);
    });

    if (!features.chain) {
      // §5.3 degraded mode: the local hash chain still proves internal
      // consistency; /verify shows amber rather than green.
      await db
        .update(anchors)
        .set({ status: "skipped_no_chain" })
        .where(eq(anchors.epoch, epoch));
      processed.push({ epoch, root, leafCount: leaves.length, status: "skipped_no_chain" });
      continue;
    }

    try {
      const receipt = await submitAnchor(epoch, root, leaves.length);
      await db
        .update(anchors)
        .set({
          status: "confirmed",
          txHash: receipt?.txHash || null,
          blockNumber: receipt?.blockNumber || null,
          anchoredAt: new Date(),
        })
        .where(eq(anchors.epoch, epoch));
      processed.push({
        epoch,
        root,
        leafCount: leaves.length,
        status: "confirmed",
        txHash: receipt?.txHash,
        alreadyAnchored: receipt?.alreadyAnchored ?? false,
      });
    } catch (err) {
      // A failed submission must not abort the remaining epochs — the next
      // run retries this one. Never log key material (I11).
      await db.update(anchors).set({ status: "failed" }).where(eq(anchors.epoch, epoch));
      processed.push({ epoch, root, status: "failed", error: String((err as Error).message) });
    }
  }

  return { ok: true as const, currentEpoch: now, processed };
}

jobsRouter.post("/anchor", jobAuth, async (_req, res) => {
  res.json(await runAnchorJob());
});
