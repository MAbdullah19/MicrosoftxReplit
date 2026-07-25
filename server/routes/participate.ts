/** Authenticated write path: create claims, add evidence (§14).
 *  Text and URLs only — no image uploads, by design (§20).
 *
 *  NOTE: session reading duplicates the contract in spec §12.3
 *  (cookie `attest_session`, jose HS256, payload { sub, tier }) so this
 *  module works before the identity milestone merges. Once
 *  `server/session.ts` lands, switch these helpers to import from it. */
import { Router, type Request, type Response, type NextFunction } from "express";
import { jwtVerify } from "jose";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "../db";
import { env } from "../env";
import { claims, evidence } from "../../shared/schema";
import { normaliseSubject, subjectKey, type SubjectKind } from "../../shared/subject";
import { sha256Hex } from "../../shared/hash";
import { SCORING, RATE_LIMITS } from "../../shared/config";

export const participateRouter = Router();

type Session = { pseudonymId: string; tier: number };
const SECRET = new TextEncoder().encode(env.SESSION_SECRET);

async function readSession(req: Request): Promise<Session | null> {
  const token = req.cookies?.attest_session;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (typeof payload.sub !== "string") return null;
    return { pseudonymId: payload.sub, tier: Number(payload.tier ?? 1) };
  } catch {
    return null;
  }
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const session = await readSession(req);
  if (!session) return res.status(401).json({ error: "not_authenticated" });
  (req as any).session = session;
  next();
}

/** Fixed-window Postgres rate limiter (spec §12.6), keyed on the pseudonym. */
async function checkRate(key: string, action: keyof typeof RATE_LIMITS) {
  const { limit, windowMinutes } = RATE_LIMITS[action];
  const { rows } = await db.execute(sql`
    insert into enrolment.rate_limits (key, action, count, window_start)
    values (${key}, ${action}, 1, now())
    on conflict (key, action) do update set
      count = case when enrolment.rate_limits.window_start < now() - (${windowMinutes} || ' minutes')::interval
                   then 1 else enrolment.rate_limits.count + 1 end,
      window_start = case when enrolment.rate_limits.window_start < now() - (${windowMinutes} || ' minutes')::interval
                   then now() else enrolment.rate_limits.window_start end
    returning count`);
  return Number((rows[0] as any).count) <= limit;
}

const rateLimited = (res: Response) =>
  res.status(429).json({ error: "rate_limited", retryAfterSeconds: 60 });

const createClaimSchema = z.object({
  subjectKind: z.enum(["url", "phone", "text"]),
  subjectValue: z.string().min(1).max(500),
  statement: z.string().min(10).max(500),
  detail: z.string().max(2000).optional(),
});

participateRouter.post("/claims", requireAuth, async (req, res) => {
  const session: Session = (req as any).session;
  const parsed = createClaimSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "invalid_input", detail: parsed.error.flatten() });
  if (!(await checkRate(session.pseudonymId, "create_claim"))) return rateLimited(res);

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
      author: session.pseudonymId,
    })
    .returning();
  res.status(201).json({ id: row.id, subjectKey: row.subjectKey });
});

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
  const session: Session = (req as any).session;
  const parsed = evidenceSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "invalid_input", detail: parsed.error.flatten() });
  if (!(await checkRate(session.pseudonymId, "add_evidence"))) return rateLimited(res);

  const [c] = await db.select({ id: claims.id, status: claims.status })
    .from(claims).where(eq(claims.id, req.params.id));
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
      author: session.pseudonymId,
      contentHash: sha256Hex(`${stance}\n${body}\n${url ?? ""}`),
    })
    .returning();
  res.status(201).json({ id: row.id });
});

participateRouter.delete("/evidence/:id", requireAuth, async (req, res) => {
  const session: Session = (req as any).session;
  const [row] = await db.select().from(evidence).where(eq(evidence.id, req.params.id));
  if (!row) return res.status(404).json({ error: "not_found" });
  if (row.author !== session.pseudonymId) return res.status(403).json({ error: "not_author" });
  await db.delete(evidence).where(eq(evidence.id, row.id));
  res.json({ ok: true });
});
