/** Server-side cryptography (§11).
 *  Never log the output of generateCode, any raw IP, or any session token (I11). */
import crypto from "node:crypto";
import argon2 from "argon2";
import { env } from "./env";

export const sha256Hex = (s: string | Buffer) =>
  crypto.createHash("sha256").update(s).digest("hex");

/** Invite codes and backup codes (I6). Pepper is env-only, NEVER in the DB. */
export const hashCode = (code: string) =>
  argon2.hash(env.PEPPER_IDENTITY + code, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

export const verifyCode = (hash: string, code: string) =>
  argon2.verify(hash, env.PEPPER_IDENTITY + code);

/** One vote per person per claim, with no account reference on the row (I3). */
export const nullifier = (pseudonymId: string, claimId: string) =>
  crypto.createHmac("sha256", env.PEPPER_VOTE).update(`${pseudonymId}|${claimId}`).digest("hex");

/** Rate-limit key for pre-account actions. Rotated daily — yesterday's key is
 *  unrecoverable, so retention is bounded by construction. NEVER store raw IPs. */
export const ipKey = (ip: string) => {
  const day = new Date().toISOString().slice(0, 10);
  return crypto.createHmac("sha256", env.PEPPER_NET).update(`${day}|${ip}`).digest("hex");
};

/** Human-typeable invite/backup code: 4 groups of 4, Crockford-ish alphabet. */
const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"; // no I, L, O, U, 0, 1
export const generateCode = () =>
  Array.from({ length: 4 }, () =>
    Array.from({ length: 4 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join(""),
  ).join("-");

const ANIMALS = ["fox", "owl", "elk", "koi", "yak", "ibis", "lynx", "crow", "moth", "wren", "seal", "hare"];
export const generateHandle = () =>
  `${ANIMALS[crypto.randomInt(ANIMALS.length)]}-${1000 + crypto.randomInt(9000)}`;
