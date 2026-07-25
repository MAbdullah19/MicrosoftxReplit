/** Public read path (§14) — no auth, no login wall. */
import { Router } from "express";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { claims, evidence, aiSignals, anchors } from "../../shared/schema";
import { detectKind, normaliseSubject, subjectKey, type SubjectKind } from "../../shared/subject";
import { publicVerdict } from "../../shared/verdict";

export const publicRouter = Router();

const KINDS: SubjectKind[] = ["url", "phone", "text"];

function verdictOf(c: typeof claims.$inferSelect) {
  return publicVerdict(
    c.status as any,
    c.subjectKind as SubjectKind,
    c.alpha,
    c.beta,
    c.voterCount,
  );
}

function claimSummary(c: typeof claims.$inferSelect) {
  return {
    id: c.id,
    subjectKind: c.subjectKind,
    subjectValue: c.subjectValue,
    subjectKey: c.subjectKey,
    statement: c.statement,
    status: c.status,
    voterCount: c.voterCount,
    verdict: verdictOf(c),
    resolvedAt: c.resolvedAt,
    createdAt: c.createdAt,
    anchorEpoch: c.anchorEpoch,
  };
}

/** Resolve free text into a subject (server-side twin of the client's detect). */
publicRouter.get("/resolve", (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) return res.status(400).json({ error: "empty_query" });
  const kindParam = String(req.query.kind ?? "");
  const kind = (KINDS as string[]).includes(kindParam) ? (kindParam as SubjectKind) : detectKind(q);
  res.json({ kind, normalised: normaliseSubject(kind, q), subjectKey: subjectKey(kind, q) });
});

/** Subject page payload: all claims sharing the subject key. */
publicRouter.get("/subjects/:key", async (req, res) => {
  const rows = await db
    .select()
    .from(claims)
    .where(eq(claims.subjectKey, req.params.key))
    .orderBy(desc(claims.createdAt));
  if (rows.length === 0) return res.json({ subject: null, claims: [] });
  const { subjectKind, subjectValue } = rows[0];
  res.json({
    subject: { kind: subjectKind, value: subjectValue, key: req.params.key },
    claims: rows.map(claimSummary),
  });
});

/** Claim detail: claim + verdict + evidence + AI signal + anchor status. */
publicRouter.get("/claims/:id", async (req, res) => {
  const [c] = await db.select().from(claims).where(eq(claims.id, req.params.id));
  if (!c) return res.status(404).json({ error: "not_found" });

  const [ev, [ai], anchorRows] = await Promise.all([
    db.select().from(evidence).where(eq(evidence.claimId, c.id)).orderBy(desc(evidence.createdAt)),
    db.select().from(aiSignals).where(eq(aiSignals.claimId, c.id)).limit(1),
    c.anchorEpoch != null
      ? db.select().from(anchors).where(eq(anchors.epoch, c.anchorEpoch))
      : Promise.resolve([]),
  ]);

  res.json({
    claim: {
      ...claimSummary(c),
      detail: c.detail,
      score: c.score,
      alpha: c.alpha,
      beta: c.beta,
      ciLow: c.ciLow,
      ciHigh: c.ciHigh,
      expiresAt: c.expiresAt,
    },
    evidence: ev.map((e) => ({
      id: e.id,
      stance: e.stance,
      body: e.body,
      url: e.url,
      helpful: e.helpful,
      unhelpful: e.unhelpful,
      createdAt: e.createdAt,
    })),
    aiSignal: ai
      ? {
          verdictHint: ai.verdictHint,
          confidence: ai.confidence,
          rationale: ai.rationale,
          redFlags: ai.redFlags,
          weightContributed: ai.weightContributed,
          disputes: ai.disputes,
          model: ai.model,
          promptVersion: ai.promptVersion,
        }
      : null,
    anchor: anchorRows[0] ?? null,
  });
});

/** Recently resolved — 6 cards for the home page. */
publicRouter.get("/recent", async (_req, res) => {
  const rows = await db
    .select()
    .from(claims)
    .where(inArray(claims.status, ["verified", "refuted", "inconclusive"]))
    .orderBy(desc(claims.resolvedAt))
    .limit(6);
  res.json({ claims: rows.map(claimSummary) });
});

/** Open claims — a small list so an empty demo DB still shows life. */
publicRouter.get("/open", async (_req, res) => {
  const rows = await db
    .select()
    .from(claims)
    .where(eq(claims.status, "open"))
    .orderBy(desc(claims.createdAt))
    .limit(6);
  res.json({ claims: rows.map(claimSummary) });
});
