/** Public read path (§14) — no auth, no login wall. */
import { Router } from "express";
import { asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import { claims, evidence, aiSignals, anchors, votes, accounts } from "../../shared/schema";
import { detectKind, normaliseSubject, subjectKey, type SubjectKind } from "../../shared/subject";
import { publicVerdict } from "../../shared/verdict";
import { readSession } from "../session";
import { nullifier } from "../crypto";
import { applyVoterCap } from "../../shared/score";
import { SCORING } from "../../shared/config";

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

/** Claim detail: claim + verdict + evidence + AI signal + anchor status.
 *
 *  Blind until voted (§14.2): a T2 viewer who has NOT voted on an open claim
 *  sees no tally, score, curve or verdict — one `if`, nothing fancier. It
 *  kills the information cascade where everyone copies the first voter. */
publicRouter.get("/claims/:id", async (req, res) => {
  const [c] = await db.select().from(claims).where(eq(claims.id, req.params.id));
  if (!c) return res.status(404).json({ error: "not_found" });

  const session = await readSession(req);
  let hasVoted = false;
  if (session) {
    const [v] = await db
      .select({ n: votes.nullifier })
      .from(votes)
      .where(eq(votes.nullifier, nullifier(session.sub, c.id)));
    hasVoted = !!v;
  }
  const blind = c.status === "open" && !!session && session.tier >= 2 && !hasVoted;

  const [ev, [ai], anchorRows] = await Promise.all([
    db.select().from(evidence).where(eq(evidence.claimId, c.id)).orderBy(desc(evidence.createdAt)),
    db.select().from(aiSignals).where(eq(aiSignals.claimId, c.id)).limit(1),
    c.anchorEpoch != null
      ? db.select().from(anchors).where(eq(anchors.epoch, c.anchorEpoch))
      : Promise.resolve([]),
  ]);

  const numbers = blind
    ? { score: null, alpha: null, beta: null, ciLow: null, ciHigh: null, voterCount: null, verdict: null }
    : {
        score: c.score,
        alpha: c.alpha,
        beta: c.beta,
        ciLow: c.ciLow,
        ciHigh: c.ciHigh,
      };

  res.json({
    blind,
    viewer: session ? { tier: session.tier, hasVoted } : null,
    claim: {
      ...claimSummary(c),
      ...numbers,
      detail: c.detail,
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
          id: ai.id,
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

/** §14.4 — decompose the score into named contributions. Same blind rule. */
publicRouter.get("/claims/:id/explain", async (req, res) => {
  const [c] = await db.select().from(claims).where(eq(claims.id, req.params.id));
  if (!c) return res.status(404).json({ error: "not_found" });

  const session = await readSession(req);
  if (c.status === "open" && session && session.tier >= 2) {
    const [v] = await db
      .select({ n: votes.nullifier })
      .from(votes)
      .where(eq(votes.nullifier, nullifier(session.sub, c.id)));
    if (!v) return res.status(403).json({ error: "vote_first" });
  }

  const claimVotes = await db
    .select()
    .from(votes)
    .where(eq(votes.claimId, c.id))
    .orderBy(asc(votes.createdAt));

  // Map nullifiers to handles by recomputing HMACs over T2 accounts (I3 —
  // votes carry no account reference; this loop is the only way, on purpose).
  const t2 = await db.select().from(accounts).where(eq(accounts.tier, 2));
  const handleOf = new Map<string, string>();
  for (const a of t2) handleOf.set(nullifier(a.pseudonymId, c.id), a.handle);

  const capped = applyVoterCap(claimVotes.map((v) => v.weight));
  const rows = claimVotes.map((v, i) => {
    const bd: any = v.weightBreakdown ?? {};
    return {
      kind: "vote" as const,
      label: handleOf.get(v.nullifier) ?? "former member",
      stance: v.stance,
      reputation: bd.reputation ?? null,
      stakeFactor: bd.stakeFactor ?? null,
      stake: v.stake,
      raw: v.weight,
      applied: capped[i],
      wasCapped: capped[i] < v.weight - 1e-9,
      delta: (v.stance === "support" ? 1 : -1) * capped[i],
    };
  });

  const [ai] = await db.select().from(aiSignals).where(eq(aiSignals.claimId, c.id)).limit(1);
  const aiRow =
    ai && ai.weightContributed > 0 && ai.verdictHint !== "unverifiable"
      ? {
          kind: "ai" as const,
          label: "AI signal",
          stance: ai.verdictHint === "likely_true" ? "support" : "refute",
          model: ai.model,
          promptVersion: ai.promptVersion,
          applied: ai.weightContributed,
          capPercent: SCORING.AI_WEIGHT_CAP * 100,
          delta: (ai.verdictHint === "likely_true" ? 1 : -1) * ai.weightContributed,
        }
      : null;

  res.json({
    start: 0.5,
    rows: aiRow ? [...rows, aiRow] : rows,
    final: { score: c.score, ciLow: c.ciLow, ciHigh: c.ciHigh, alpha: c.alpha, beta: c.beta },
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
