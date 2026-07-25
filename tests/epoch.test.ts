/** Epoch bucketing (§10.3). The anchor job's idempotency rests entirely on
 *  "only close epochs strictly less than the current one", so the boundary
 *  behaviour here is load-bearing. */
import { describe, it, expect } from "vitest";
import { epochOf, currentEpoch, epochStart, EPOCH_SECONDS } from "../shared/epoch";
import { CHAIN } from "../shared/config";

describe("epoch arithmetic", () => {
  it("uses the configured cadence", () => {
    expect(EPOCH_SECONDS).toBe(CHAIN.EPOCH_MINUTES * 60);
  });

  it("is constant within an epoch and increments exactly at the boundary", () => {
    const start = epochStart(1_000_000);
    expect(epochOf(start)).toBe(1_000_000);
    expect(epochOf(new Date(start.getTime() + 1000))).toBe(1_000_000);
    expect(epochOf(new Date(start.getTime() + (EPOCH_SECONDS - 1) * 1000))).toBe(1_000_000);
    expect(epochOf(new Date(start.getTime() + EPOCH_SECONDS * 1000))).toBe(1_000_001);
  });

  it("epochStart round-trips", () => {
    for (const e of [0, 1, 12345, 1_800_000]) expect(epochOf(epochStart(e))).toBe(e);
  });

  it("accepts a Date or a millisecond number identically", () => {
    const now = Date.now();
    expect(epochOf(now)).toBe(epochOf(new Date(now)));
  });

  it("currentEpoch is the epoch containing now", () => {
    const e = currentEpoch();
    const start = epochStart(e).getTime();
    expect(Date.now()).toBeGreaterThanOrEqual(start);
    expect(Date.now()).toBeLessThan(start + EPOCH_SECONDS * 1000);
  });
});
