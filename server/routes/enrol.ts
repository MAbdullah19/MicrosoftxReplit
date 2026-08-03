/** Enrolment: WebAuthn registration + one-time invite redemption (§12.2).
 *  No email, no phone, no name — ever (I2). Invite/backup codes are never
 *  logged and stored only as argon2id hashes (I6, I11). */
import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { sql } from "drizzle-orm";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { db } from "../db";
import { accounts, backupCodes } from "../../shared/schema";
import { env } from "../env";
import { hashCode, verifyCode, generateCode, generateHandle, ipKey } from "../crypto";
import { setChallenge, takeChallenge, issueSession } from "../session";
import { checkRate, retryAfterSeconds } from "../ratelimit";
import { verifyTurnstile } from "../turnstile";
import { SCORING } from "../../shared/config";

export const enrolRouter = Router();

enrolRouter.post("/begin", async (req, res) => {
  if (!(await checkRate(ipKey(req.ip ?? "unknown"), "enrol"))) {
    return res
      .status(429)
      .json({ error: "rate_limited", retryAfterSeconds: retryAfterSeconds("enrol") });
  }

  const turnstile = await verifyTurnstile(req.body?.turnstileToken);
  if (!turnstile.ok) return res.status(turnstile.status).json({ error: turnstile.error });

  const options = await generateRegistrationOptions({
    rpName: env.RP_NAME,
    rpID: env.RP_ID,
    // Ephemeral random user name — never an identity (I1/I2).
    userName: `attest-${crypto.randomBytes(6).toString("hex")}`,
    attestationType: "none",
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });

  await setChallenge(res, options.challenge);
  res.json(options);
});

const finishSchema = z.object({
  credential: z.any(),
  inviteCode: z.string().trim().min(1).optional(),
});

enrolRouter.post("/finish", async (req, res) => {
  const parsed = finishSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "bad_request" });
  const { credential, inviteCode } = parsed.data;

  const expectedChallenge = await takeChallenge(req, res);
  if (!expectedChallenge) return res.status(400).json({ error: "challenge_expired" });

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge,
      expectedOrigin: env.RP_ORIGIN,
      expectedRPID: env.RP_ID,
    });
  } catch (err) {
    // The library's message names the exact mismatch — origin, RP ID, challenge
    // or algorithm. Without it a 400 here is unactionable in production. The
    // message carries no secret: it quotes public ceremony values only (I11).
    console.warn("[enrol] webauthn verification threw:", (err as Error)?.message);
    return res.status(400).json({ error: "webauthn_failed" });
  }
  if (!verification.verified || !verification.registrationInfo) {
    console.warn("[enrol] webauthn verification returned unverified");
    return res.status(400).json({ error: "webauthn_failed" });
  }
  const { credential: cred } = verification.registrationInfo;

  // Generate backup codes up front; hash inside the transaction.
  const rawBackupCodes = Array.from({ length: 8 }, () => generateCode());

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Optional invite redemption → tier 2. argon2 is salted, so there is
      //    no lookup-by-hash: fetch unredeemed, non-expired invites (a handful
      //    at beta scale) and verify each. Above a few hundred invites, add a
      //    fast non-secret prefix index (§12.2).
      let tier = 1;
      if (inviteCode) {
        const { rows } = await tx.execute(sql`
          select id, code_hash from enrolment.invites
          where redeemed_at is null and not revoked and expires_at > now()
          for update`);
        let matched: string | null = null;
        for (const row of rows as { id: string; code_hash: string }[]) {
          if (await verifyCode(row.code_hash, inviteCode)) {
            matched = row.id;
            break;
          }
        }
        if (!matched) throw new InviteError();
        await tx.execute(
          sql`update enrolment.invites set redeemed_at = now() where id = ${matched}`,
        );
        tier = 2;
      }

      // 2. Account: pseudonym_id defaulted by the DB — gen_random_uuid(), I1.
      const [account] = await tx
        .insert(accounts)
        .values({
          handle: generateHandle(),
          tier,
          passkeyId: cred.id,
          passkeyPubkey: Buffer.from(cred.publicKey),
          passkeyCounter: cred.counter,
          points: SCORING.STARTING_POINTS,
        })
        .returning({
          pseudonymId: accounts.pseudonymId,
          handle: accounts.handle,
          tier: accounts.tier,
        });

      // 3. Backup codes — argon2id hashes only (I6).
      const hashes = await Promise.all(rawBackupCodes.map((c) => hashCode(c)));
      await tx
        .insert(backupCodes)
        .values(hashes.map((codeHash) => ({ pseudonymId: account.pseudonymId, codeHash })));

      return account;
    });

    // 4. Session cookie.
    await issueSession(res, result.pseudonymId, result.tier);
    // Plaintext backup codes are returned ONCE and never persisted or logged.
    res.json({ handle: result.handle, tier: result.tier, backupCodes: rawBackupCodes });
  } catch (e) {
    if (e instanceof InviteError) {
      return res.status(400).json({ error: "invite_invalid" });
    }
    // Unique violation on passkey_id → this passkey already has an account.
    if ((e as any)?.code === "23505") {
      return res.status(409).json({ error: "passkey_exists" });
    }
    throw e;
  }
});

class InviteError extends Error {}
