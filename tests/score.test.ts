import { describe, it, expect } from "vitest";
import {
  rawWeight,
  applyVoterCap,
  posterior,
  aiWeight,
  pTrue,
  brier,
  payout,
  updateReputation,
} from "../shared/score";

describe("score math (§21)", () => {
  it("brier(0.5, y) === 0 for both outcomes — hedging is exactly break-even", () => {
    expect(brier(0.5, 0)).toBe(0);
    expect(brier(0.5, 1)).toBe(0);
  });

  it("payout(5, brier(0.95, 1)) === 10 and payout(5, brier(0.95, 0)) === 0", () => {
    expect(payout(5, brier(0.95, 1))).toBe(10);
    expect(payout(5, brier(0.95, 0))).toBe(0);
  });

  it("worked examples from §9.5", () => {
    expect(brier(0.95, 1)).toBeCloseTo(0.495, 6);
    expect(brier(0.95, 0)).toBeCloseTo(-1.305, 6);
    expect(brier(0.6, 1)).toBeCloseTo(0.18, 6);
    expect(payout(5, brier(0.6, 1))).toBe(7);
  });

  it("applyVoterCap with 3 equal weights returns them unchanged", () => {
    expect(applyVoterCap([2, 2, 2])).toEqual([2, 2, 2]);
  });

  it("applyVoterCap with 20 weights caps the largest at 15% of the total", () => {
    const weights = [100, ...Array(19).fill(1)];
    const capped = applyVoterCap(weights);
    const total = capped.reduce((a, b) => a + b, 0);
    expect(capped[0]).toBeLessThanOrEqual(total * 0.15 + 1e-9);
    // others untouched
    expect(capped.slice(1)).toEqual(Array(19).fill(1));
  });

  it("aiWeight(0, 0.9, false) === 0 (I9 — AI alone never moves a score)", () => {
    expect(aiWeight(0, 0.9, false)).toBe(0);
  });

  it("aiWeight is capped at 15% of total including itself", () => {
    const human = 10;
    const w = aiWeight(human, 1.0, false);
    expect(w / (human + w)).toBeLessThanOrEqual(0.15 + 1e-9);
  });

  it("posterior: Beta(1,1) prior gives score 0.5 with no votes", () => {
    const p = posterior([], []);
    expect(p.alpha).toBe(1);
    expect(p.beta).toBe(1);
    expect(p.score).toBe(0.5);
    expect(p.ciLow).toBeCloseTo(0.05, 4);
    expect(p.ciHigh).toBeCloseTo(0.95, 4);
  });

  it("rawWeight: w = R · (1 + ln(1 + s))", () => {
    const { reputation, stakeFactor, raw } = rawWeight(1, 1, 5);
    expect(reputation).toBe(0.5);
    expect(stakeFactor).toBeCloseTo(1 + Math.log(6), 9);
    expect(raw).toBeCloseTo(0.5 * (1 + Math.log(6)), 9);
  });

  it("pTrue flips for refute stance", () => {
    expect(pTrue("support", 0.8)).toBe(0.8);
    expect(pTrue("refute", 0.8)).toBeCloseTo(0.2, 9);
  });

  it("updateReputation: hedge (Δc = 0) is decay only", () => {
    const { a, b } = updateReputation(2, 3, 0, true);
    expect(a).toBeCloseTo(0.98 * 2, 9);
    expect(b).toBeCloseTo(0.98 * 3, 9);
  });
});
