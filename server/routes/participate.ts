/** Authenticated write path: create claims, add evidence, vote (§14, §9.6).
 *  Text and URLs only — no image uploads, by design (§20). */
import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { readSession, type Session } from "../session";
import { checkRate, retryAfterSeconds } from "../ratelimit";
import { nullifier } from "../crypto";
import { claims, evidence, accounts, aiSignals, invites } from "../../shared/schema";
import { normaliseSubject, subjectKey, type SubjectKind } from "../../shared/subject";
import { sha256Hex } from "../../shared/hash";
import { posterior } from "../../shared/score";
import { SCORING, RATE_LIMITS } from "../../shared/config";
import { generateAiSignal } from "../ai";
import { hashCode, generateCode } from "../crypto";
import { conditionsHold } from "./jobs";

export const participateRouter = Router();

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = await readSession(req);
  if (!session) return res.status(401).json({ error: "not_authenticated" });
  req.session = session;
  next();
}

export async function requireT2(req: Request, res: Response, next: NextFunction) {
  const session = await readSession(req);
  if (!session) return res.status(401).json({ error: "not_authenticated" });
  if (session.tier < 2) return res.status(403).json({ error: "tier_required" });
  req.session = session;
  next();
}

const rateLimited = (res: Response, action: keyof typeof RATE_LIMITS) =>
  res.status(429).json({ error: "rate_limited", retryAfterSeconds: retryAfterSeconds(action) });

/* ── claims ─────────────────────────────────────────────────────────── */

const createClaimSchema = z.object({
  subjectKind: z.enum(["url", "phone", "text"]),
  subjectValue: z.string().min(1).max(500),
  statement: z.string().min(10).max(500),
  detail: z.string().max(2000).optional(),
});

participateRouter.post("/claims", requireAuth, async (req, res) => {
  const session = req.session!;
  const parsed = createClaimSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "invalid_input", detail: parsed.error.flatten() });
  if (!(await checkRate(session.sub, "create_claim"))) return rateLimited(res, "create_claim");

  const { subjectKind, subjectValue, statement, detail } = parsed.data;
  const kind = subjectKind as SubjectKind;
  const value = normaliseSubject(kind, subjectValue);
  const [row] = await db
    .insert(claims)
    .values({
      subjectKind: kind,
      subjectValue: value,
      subjectKey: subjectKey(kind, subjectValue),
      statement,
      detail: detail ?? null,
      contentHash: sha256Hex(`${statement}\n${detail ?? ""}`),
      expiresAt: new Date(Date.now() + SCORING.CLAIM_TTL_HOURS * 3600_000),
      author: session.sub,
    })
    .returning();

  // One AI call per claim, at submission time, cached forever (§15). Detached
  // on purpose: the AI is evidence, not a gate, so it must never delay or fail
  // a submission. generateAiSignal never throws.
  void generateAiSignal(row.id, kind, value, statement, detail ?? null);

  res.status(201).json({ id: row.id, subjectKey: row.subjectKey });
});

/* ── evidence ───────────────────────────────────────────────────────── */

const evidenceSchema = z.object({
  stance: z.enum(["supports", "refutes", "context"]),
  body: z.string().min(3).max(2000),
  // https:// only — anything else (javascript:, data:, http:) is rejected (§20)
  url: z
    .string()
    .max(500)
    .url()
    .refine((u) => {
      try {
        return new URL(u).protocol === "https:";
      } catch {
        return false;
      }
    }, "https_only")
    .optional(),
});

participateRouter.post("/claims/:id/evidence", requireAuth, async (req, res) => {
  const session = req.session!;
  const parsed = evidenceSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "invalid_input", detail: parsed.error.flatten() });
  if (!(await checkRate(session.sub, "add_evidence"))) return rateLimited(res, "add_evidence");

  const [c] = await db
    .select({ id: claims.id, status: claims.status })
    .from(claims)
    .where(eq(claims.id, req.params.id));
  if (!c) return res.status(404).json({ error: "not_found" });
  if (c.status !== "open") return res.status(409).json({ error: "claim_not_open" });

  const { stance, body, url } = parsed.data;
  const [row] = await db
    .insert(evidence)
    .values({
      claimId: c.id,
      stance,
      body,
      url: url ?? null,
      author: session.sub,
      contentHash: sha256Hex(`${stance}\n${body}\n${url ?? ""}`),
    })
    .returning();
  res.status(201).json({ id: row.id });
});

participateRouter.delete("/evidence/:id", requireAuth, async (req, res) => {
  const session = req.session!;
  const [row] = await db.select().from(evidence).where(eq(evidence.id, req.params.id));
  if (!row) return res.status(404).json({ error: "not_found" });
  if (row.author !== session.sub) return res.status(403).json({ error: "not_author" });
  await db.delete(evidence).where(eq(evidence.id, row.id));
  res.json({ ok: true });
});

/* ── voting (§9.6 caller responsibility) ────────────────────────────── */

const voteSchema = z.object({
  claimId: z.string().uuid(),
  stance: z.enum(["support", "refute"]),
  confidence: z.number().min(SCORING.CONFIDENCE_MIN).max(SCORING.CONFIDENCE_MAX),
  stake: z.number().int().min(SCORING.STAKE_MIN).max(SCORING.STAKE_MAX),
});

participateRouter.post("/vote", requireT2, async (req, res) => {
  const session = req.session!;
  const parsed = voteSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "invalid_input", detail: parsed.error.flatten() });
  if (!(await checkRate(session.sub, "vote"))) return rateLimited(res, "vote");

  const { claimId, stance, confidence, stake } = parsed.data;
  const n = nullifier(session.sub, claimId);

  try {
    const result = await db.transaction(async (tx) => {
      // Stake escrow: take the points up front, inside the same transaction.
      const [acct] = await tx
        .select()
        .from(accounts)
        .where(eq(accounts.pseudonymId, session.sub))
        .for("update");
      if (!acct) throw Object.assign(new Error("no_account"), { http: 401 });
      if (acct.points < stake) throw Object.assign(new Error("insufficient_points"), { http: 400 });
      await tx
        .update(accounts)
        .set({ points: acct.points - stake, pointsStaked: acct.pointsStaked + stake })
        .where(eq(accounts.pseudonymId, session.sub));

      // ALL score mutation happens in Postgres (I4). No JS read-modify-write.
      const r = await tx.execute(sql`
        select * from forum.vote_and_rescore(
          ${n}, ${claimId}::uuid, ${stance}, ${confidence}, ${stake},
          ${acct.repA}, ${acct.repB})`);
      const row: any = r.rows[0];
      const alpha = Number(row.alpha);
      const beta = Number(row.beta);

      // Caller computes the credible interval (jstat) in the SAME transaction.
      const p = posterior([alpha - 1], [beta - 1]);
      await tx.update(claims).set({ ciLow: p.ciLow, ciHigh: p.ciHigh }).where(eq(claims.id, claimId));

      // Stability bookkeeping (§17.1): start/clear the 30-minute clock.
      const holds = conditionsHold(alpha, beta, Number(row.voter_count));
      const [c] = await tx
        .select({ stableSince: claims.stableSince })
        .from(claims)
        .where(eq(claims.id, claimId));
      if (holds && !c.stableSince) {
        await tx.update(claims).set({ stableSince: new Date() }).where(eq(claims.id, claimId));
      } else if (!holds && c.stableSince) {
        await tx.update(claims).set({ stableSince: null }).where(eq(claims.id, claimId));
      }

      return {
        alpha,
        beta,
        score: Number(row.score),
        voterCount: Number(row.voter_count),
        ciLow: p.ciLow,
        ciHigh: p.ciHigh,
      };
    });
    res.status(201).json(result);
  } catch (err: any) {
    // Unique violation on the nullifier PK = duplicate vote (I3/I4).
    if (err?.code === "23505" || /duplicate key/.test(String(err?.message)))
      return res.status(409).json({ error: "already_voted" });
    if (err?.code === "P0002" || /claim_not_open/.test(String(err?.message)))
      return res.status(409).json({ error: "claim_not_open" });
    if (err?.http) return res.status(err.http).json({ error: err.message });
    throw err;
  }
});

/* ── AI dispute (§15.3) ─────────────────────────────────────────────── */

/** Disputing an AI signal drops its cap from 15% to 5% on the next rescore
 *  and flags the card. Anyone signed in may dispute — the AI is the one actor
 *  here that cannot answer back, so the bar to challenge it stays low. */
participateRouter.post("/ai-signals/:id/dispute", requireAuth, async (req, res) => {
  const [row] = await db
    .update(aiSignals)
    .set({ disputes: sql`${aiSignals.disputes} + 1` })
    .where(eq(aiSignals.id, req.params.id))
    .returning({ id: aiSignals.id, disputes: aiSignals.disputes });
  if (!row) return res.status(404).json({ error: "not_found" });
  res.json({ ok: true, disputes: row.disputes });
});

/* ── invite minting (§5.4) ──────────────────────────────────────────── */

/** A T2 user with earned reputation may mint a bounded number of invites.
 *  issued_by is the literal string 'user' — NEVER a pseudonym, so the
 *  enrolment schema still holds no link to any account (I5). The raw code is
 *  returned once and never persisted or logged (I6/I11). */
participateRouter.post("/invites/mint", requireT2, async (req, res) => {
  const session = req.session!;
  const [acct] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.pseudonymId, session.sub));
  if (!acct) return res.status(401).json({ error: "not_authenticated" });

  const reputation = acct.repA / (acct.repA + acct.repB);
  if (reputation < SCORING.INVITE_MINT_MIN_REP)
    return res.status(403).json({
      error: "reputation_too_low",
      needed: SCORING.INVITE_MINT_MIN_REP,
      have: reputation,
    });
  if (acct.invitesMinted >= SCORING.INVITE_MINT_PER_USER)
    return res.status(403).json({ error: "mint_limit_reached", limit: SCORING.INVITE_MINT_PER_USER });

  const code = generateCode();
  const codeHash = await hashCode(code);

  // Increment under a row lock so two parallel mints cannot both pass the cap.
  const minted = await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ invitesMinted: accounts.invitesMinted })
      .from(accounts)
      .where(eq(accounts.pseudonymId, session.sub))
      .for("update");
    if (locked.invitesMinted >= SCORING.INVITE_MINT_PER_USER) return false;
    await tx.insert(invites).values({
      codeHash,
      issuedBy: "user",
      expiresAt: new Date(Date.now() + SCORING.INVITE_TTL_DAYS * 24 * 3600_000),
    });
    await tx
      .update(accounts)
      .set({ invitesMinted: locked.invitesMinted + 1 })
      .where(eq(accounts.pseudonymId, session.sub));
    return true;
  });
  if (!minted)
    return res.status(403).json({ error: "mint_limit_reached", limit: SCORING.INVITE_MINT_PER_USER });

  // Shown once. Never logged.
  res.status(201).json({ code, remaining: SCORING.INVITE_MINT_PER_USER - acct.invitesMinted - 1 });
});
