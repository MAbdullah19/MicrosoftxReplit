/** Login (usernameless WebAuthn, §12.4), logout, backup-code recovery
 *  (§12.5) and /me. Counter regression is rejected — cloned-authenticator
 *  signal. */
import { Router } from "express";
import { z } from "zod";
import { eq, and, desc, inArray, isNull } from "drizzle-orm";
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { db } from "../db";
import { accounts, backupCodes, claims, votes } from "../../shared/schema";
import { env } from "../env";
import { ipKey, nullifier } from "../crypto";
import { consumeBackupCode } from "../recovery";
import { setChallenge, takeChallenge, issueSession, clearSession, requireAuth } from "../session";
import { checkRate, retryAfterSeconds } from "../ratelimit";

export const authRouter = Router();

authRouter.post("/begin", async (_req, res) => {
  // Usernameless: no allowCredentials — the authenticator picks the resident key.
  const options = await generateAuthenticationOptions({
    rpID: env.RP_ID,
    userVerification: "preferred",
  });
  await setChallenge(res, options.challenge);
  res.json(options);
});

authRouter.post("/finish", async (req, res) => {
  const expectedChallenge = await takeChallenge(req, res);
  if (!expectedChallenge) return res.status(400).json({ error: "challenge_expired" });

  const credential = req.body?.credential;
  if (!credential?.id) return res.status(400).json({ error: "bad_request" });

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.passkeyId, credential.id));
  if (!account) return res.status(401).json({ error: "unknown_credential" });

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: env.RP_ORIGIN,
      expectedRPID: env.RP_ID,
      credential: {
        id: account.passkeyId,
        publicKey: new Uint8Array(account.passkeyPubkey),
        counter: account.passkeyCounter,
      },
      // Mirrors the "preferred" policy in /begin, as in enrolment — otherwise
      // an account enrolled without UV could never sign in again.
      requireUserVerification: false,
    });
  } catch {
    return res.status(401).json({ error: "webauthn_failed" });
  }
  if (!verification.verified) return res.status(401).json({ error: "webauthn_failed" });

  // Reject counter regression — a cloned authenticator replays old counters.
  const { newCounter } = verification.authenticationInfo;
  if (account.passkeyCounter > 0 && newCounter > 0 && newCounter <= account.passkeyCounter) {
    return res.status(401).json({ error: "counter_regression" });
  }
  await db
    .update(accounts)
    .set({ passkeyCounter: newCounter })
    .where(eq(accounts.pseudonymId, account.pseudonymId));

  await issueSession(res, account.pseudonymId, account.tier);
  res.json({ handle: account.handle, tier: account.tier });
});

/** Recovery: backup codes only — single-use, argon2id-hashed (§12.5).
 *  There is no email. Do not add email recovery. */
const recoverSchema = z.object({
  handle: z.string().trim().min(1),
  backupCode: z.string().trim().min(1),
});

authRouter.post("/recover", async (req, res) => {
  if (!(await checkRate(ipKey(req.ip ?? "unknown"), "enrol"))) {
    return res
      .status(429)
      .json({ error: "rate_limited", retryAfterSeconds: retryAfterSeconds("enrol") });
  }
  const parsed = recoverSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "bad_request" });
  const { handle, backupCode } = parsed.data;

  const [account] = await db.select().from(accounts).where(eq(accounts.handle, handle));
  if (!account) return res.status(401).json({ error: "recovery_failed" });

  // Atomic single-use consume — only the winning concurrent request gets a
  // session (see server/recovery.ts).
  if (await consumeBackupCode(account.pseudonymId, backupCode)) {
    await issueSession(res, account.pseudonymId, account.tier);
    return res.json({ handle: account.handle, tier: account.tier });
  }
  res.status(401).json({ error: "recovery_failed" });
});

authRouter.post("/logout", (_req, res) => {
  clearSession(res);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const [account] = await db
    .select({
      handle: accounts.handle,
      tier: accounts.tier,
      repA: accounts.repA,
      repB: accounts.repB,
      points: accounts.points,
      pointsStaked: accounts.pointsStaked,
      invitesMinted: accounts.invitesMinted,
      createdAt: accounts.createdAt,
    })
    .from(accounts)
    .where(eq(accounts.pseudonymId, req.session!.sub));
  if (!account) {
    clearSession(res);
    return res.status(401).json({ error: "not_authenticated" });
  }
  const backupRemaining = (
    await db
      .select({ codeHash: backupCodes.codeHash })
      .from(backupCodes)
      .where(and(eq(backupCodes.pseudonymId, req.session!.sub), isNull(backupCodes.usedAt)))
  ).length;
  res.json({ ...account, reputation: account.repA / (account.repA + account.repB), backupRemaining });
});

/** Your own vote history (§14.2): stance, confidence, outcome, Brier delta.
 *
 *  forum.votes has no foreign key to an account (I3), so there is no join to
 *  make here — we recompute nullifier(pseudonym, claimId) for each claim and
 *  look up those keys. That is the privacy property working as designed, and
 *  it costs a few dozen HMACs at beta scale. Do NOT add an account column to
 *  votes to make this a join; that column is the whole point. */
authRouter.get("/me/votes", requireAuth, async (req, res) => {
  const me = req.session!.sub;

  const allClaims = await db
    .select({
      id: claims.id,
      statement: claims.statement,
      status: claims.status,
      subjectKind: claims.subjectKind,
      subjectValue: claims.subjectValue,
      resolvedAt: claims.resolvedAt,
    })
    .from(claims);

  const byNullifier = new Map(allClaims.map((c) => [nullifier(me, c.id), c]));
  if (byNullifier.size === 0) return res.json({ votes: [] });

  const mine = await db
    .select()
    .from(votes)
    .where(inArray(votes.nullifier, [...byNullifier.keys()]))
    .orderBy(desc(votes.createdAt));

  res.json({
    votes: mine.map((v) => {
      const claim = byNullifier.get(v.nullifier)!;
      return {
        claimId: claim.id,
        statement: claim.statement,
        subjectKind: claim.subjectKind,
        subjectValue: claim.subjectValue,
        status: claim.status,
        stance: v.stance,
        confidence: v.confidence,
        stake: v.stake,
        /** centred Brier Δc — null while open, and null forever if the claim
         *  settled inconclusive (those settle no one) */
        brier: v.brier,
        settledAt: v.settledAt,
        createdAt: v.createdAt,
      };
    }),
  });
});
