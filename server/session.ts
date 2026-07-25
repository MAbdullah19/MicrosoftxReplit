/** Stateless JWT session cookies (§12.3). No sessions table, no PII in the
 *  token — the pseudonym is already meaningless (I1). Tokens are never
 *  logged (I11). */
import { SignJWT, jwtVerify } from "jose";
import type { Request, Response, NextFunction } from "express";
import { env } from "./env";

const key = new TextEncoder().encode(env.SESSION_SECRET);

export const SESSION_COOKIE = "attest_session";
const CHALLENGE_COOKIE = "attest_chal";

const cookieBase = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export interface Session {
  sub: string; // pseudonymId
  tier: number;
}

export async function issueSession(res: Response, pseudonymId: string, tier: number) {
  const token = await new SignJWT({ tier })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(pseudonymId)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
  res.cookie(SESSION_COOKIE, token, { ...cookieBase, maxAge: 7 * 24 * 3600 * 1000 });
}

export function clearSession(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieBase);
}

export async function readSession(req: Request): Promise<Session | null> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    if (typeof payload.sub !== "string") return null;
    return { sub: payload.sub, tier: Number(payload.tier ?? 1) };
  } catch {
    return null;
  }
}

/** WebAuthn challenge lives in a short-lived signed cookie, not a table
 *  (§12.2) — 5-minute JWT, httpOnly, SameSite=Lax. */
export async function setChallenge(res: Response, challenge: string) {
  const token = await new SignJWT({ c: challenge })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
  res.cookie(CHALLENGE_COOKIE, token, { ...cookieBase, maxAge: 5 * 60 * 1000 });
}

export async function takeChallenge(req: Request, res: Response): Promise<string | null> {
  const token = req.cookies?.[CHALLENGE_COOKIE];
  res.clearCookie(CHALLENGE_COOKIE, cookieBase);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key);
    return typeof payload.c === "string" ? payload.c : null;
  } catch {
    return null;
  }
}

declare global {
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const s = await readSession(req);
  if (!s) return res.status(401).json({ error: "not_authenticated" });
  req.session = s;
  next();
}

export async function requireT2(req: Request, res: Response, next: NextFunction) {
  const s = await readSession(req);
  if (!s) return res.status(401).json({ error: "not_authenticated" });
  if (s.tier < 2) return res.status(403).json({ error: "tier_required", needed: 2 });
  req.session = s;
  next();
}
