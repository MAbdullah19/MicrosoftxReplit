/** Cloudflare Turnstile verification bound to the validated env (§5.3, §12.6).
 *  dev without key → skip (logged once at boot in env.ts).
 *  prod without key → reject with 503. */
import { env } from "./env";
import { makeVerifyTurnstile } from "./turnstile-core";

export type { TurnstileResult } from "./turnstile-core";

export const verifyTurnstile = makeVerifyTurnstile({
  secretKey: env.TURNSTILE_SECRET_KEY,
  nodeEnv: env.NODE_ENV,
});
