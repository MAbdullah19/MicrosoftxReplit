/** Pure Turnstile verification factory — no env import so unit tests can run
 *  without a full environment (§5.3, §12.6). */
export type TurnstileResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

interface TurnstileDeps {
  secretKey: string | undefined;
  nodeEnv: "development" | "production";
  fetchFn?: typeof fetch;
}

export function makeVerifyTurnstile({ secretKey, nodeEnv, fetchFn = fetch }: TurnstileDeps) {
  return async function verifyTurnstile(token: string | undefined): Promise<TurnstileResult> {
    if (!secretKey) {
      if (nodeEnv === "production") {
        // Never silently disable a bot gate in prod.
        return { ok: false, status: 503, error: "turnstile_unconfigured" };
      }
      return { ok: true }; // development degraded mode
    }
    if (!token) return { ok: false, status: 400, error: "turnstile_required" };
    try {
      const resp = await fetchFn("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret: secretKey, response: token }),
      });
      const data = (await resp.json()) as { success?: boolean };
      return data.success ? { ok: true } : { ok: false, status: 400, error: "turnstile_failed" };
    } catch {
      return { ok: false, status: 502, error: "turnstile_unreachable" };
    }
  };
}
