import { describe, it, expect } from "vitest";
import { makeVerifyTurnstile } from "../server/turnstile-core";

const ok = (success: boolean) =>
  (async () => ({ json: async () => ({ success }) })) as unknown as typeof fetch;

describe("turnstile degraded modes (§5.3, §12.6)", () => {
  it("no key in development → check is skipped", async () => {
    const verify = makeVerifyTurnstile({ secretKey: undefined, nodeEnv: "development" });
    expect(await verify(undefined)).toEqual({ ok: true });
  });

  it("no key in production → 503, never silently disabled", async () => {
    const verify = makeVerifyTurnstile({ secretKey: undefined, nodeEnv: "production" });
    expect(await verify("anything")).toEqual({
      ok: false,
      status: 503,
      error: "turnstile_unconfigured",
    });
  });

  it("key configured but no token → 400 turnstile_required", async () => {
    const verify = makeVerifyTurnstile({ secretKey: "s".repeat(16), nodeEnv: "production" });
    expect(await verify(undefined)).toEqual({
      ok: false,
      status: 400,
      error: "turnstile_required",
    });
  });

  it("key configured + valid token → ok", async () => {
    const verify = makeVerifyTurnstile({
      secretKey: "s".repeat(16),
      nodeEnv: "production",
      fetchFn: ok(true),
    });
    expect(await verify("tok")).toEqual({ ok: true });
  });

  it("key configured + rejected token → 400 turnstile_failed", async () => {
    const verify = makeVerifyTurnstile({
      secretKey: "s".repeat(16),
      nodeEnv: "production",
      fetchFn: ok(false),
    });
    expect(await verify("tok")).toEqual({ ok: false, status: 400, error: "turnstile_failed" });
  });

  it("cloudflare unreachable → 502, not a crash", async () => {
    const boom = (async () => {
      throw new Error("net");
    }) as unknown as typeof fetch;
    const verify = makeVerifyTurnstile({
      secretKey: "s".repeat(16),
      nodeEnv: "production",
      fetchFn: boom,
    });
    expect(await verify("tok")).toEqual({
      ok: false,
      status: 502,
      error: "turnstile_unreachable",
    });
  });
});
