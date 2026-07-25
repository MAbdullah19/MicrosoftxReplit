/** §17.1 resolution conditions — pure arithmetic, no database.
 *
 *  These exist because the seeded demo claim silently stopped being
 *  resolvable: it was seeded two votes short of MIN_T2_VOTERS with a
 *  pre-aged stability clock, and no third vote from any seeded account could
 *  reach RESOLVE_CONFIDENCE. Nothing failed loudly — the demo just never
 *  settled. Anyone retuning SCORING should see these break first.
 *
 *  The vote parameters below mirror the demo claim in scripts/seed.ts; that
 *  array carries a comment pointing back here. Keep the two in step. */
import { describe, it, expect } from "vitest";
import { pAtLeast, pAtMost, applyVoterCap } from "../shared/score";
import { SCORING } from "../shared/config";

/** Weight as forum.vote_and_rescore() computes it: rep × (1 + ln(1 + stake)). */
const weight = (rep: number, stake: number) => rep * (1 + Math.log(1 + stake));

/** alpha = 1 + Σ capped support weights (beta = 1 with no refutals). */
const alphaOf = (supportWeights: number[]) =>
  1 + applyVoterCap(supportWeights).reduce((a, b) => a + b, 0);

/** The confidence + participation half of §17.1 (stability is time-based). */
const conditionsHold = (supportWeights: number[]) =>
  supportWeights.length >= SCORING.MIN_T2_VOTERS &&
  (pAtLeast(SCORING.TAU_VERIFY, alphaOf(supportWeights), 1) >= SCORING.RESOLVE_CONFIDENCE ||
    pAtMost(SCORING.TAU_REFUTE, alphaOf(supportWeights), 1) >= SCORING.RESOLVE_CONFIDENCE);

/** scripts/seed.ts, the netflix-renew-billing claim: reputation × stake. */
const DEMO_VOTES: Array<[rep: number, stake: number]> = [
  [0.88, 10], // owl-2291
  [0.75, 9], //  elk-4402
  [0.62, 8], //  fox-8813
];
const demoWeights = DEMO_VOTES.map(([r, s]) => weight(r, s));

describe("the seeded demo claim can actually settle (§17.1, §25.2)", () => {
  it("clears the confidence bar on its seeded votes alone", () => {
    // A pre-aged stable_since is only legitimate when the conditions already
    // hold — runResolveJob() clears the clock on any tick where they do not,
    // so a claim seeded below the bar can never settle live.
    expect(conditionsHold(demoWeights)).toBe(true);
    expect(pAtLeast(SCORING.TAU_VERIFY, alphaOf(demoWeights), 1)).toBeGreaterThanOrEqual(
      SCORING.RESOLVE_CONFIDENCE,
    );
  });

  it("meets the participation minimum exactly, not by luck", () => {
    expect(DEMO_VOTES).toHaveLength(SCORING.MIN_T2_VOTERS);
  });

  it("still settles after a live supporting vote from a brand-new account", () => {
    // A fresh account is Beta(1,1) → reputation 0.5. Any stake must keep it
    // over the bar, since we cannot script what a demo visitor types.
    for (const stake of [SCORING.STAKE_MIN, 3, 5, SCORING.STAKE_MAX]) {
      expect(conditionsHold([...demoWeights, weight(0.5, stake)])).toBe(true);
    }
  });

  it("drops back below the bar on a live refuting vote, resetting the clock", () => {
    const all = applyVoterCap([...demoWeights, weight(0.5, 5)]);
    const support = all.slice(0, 3).reduce((a, b) => a + b, 0);
    const refute = all[3];
    const p = pAtLeast(SCORING.TAU_VERIFY, 1 + support, 1 + refute);
    expect(p).toBeLessThan(SCORING.RESOLVE_CONFIDENCE);
  });
});

describe("resolution conditions in general", () => {
  it("refuses to settle below MIN_T2_VOTERS however confident the crowd is", () => {
    // Deliberately larger than any real rep × stake can produce, to isolate
    // the participation gate: confidence is overwhelming, the count is not.
    const overwhelming = Array.from({ length: SCORING.MIN_T2_VOTERS - 1 }, () => 50);
    expect(pAtLeast(SCORING.TAU_VERIFY, alphaOf(overwhelming), 1)).toBeGreaterThan(
      SCORING.RESOLVE_CONFIDENCE,
    );
    expect(conditionsHold(overwhelming)).toBe(false);
  });

  it("cannot reach the confidence bar with fewer than three real voters", () => {
    // Belt and braces on the above: at the current constants even two maximal
    // voters (reputation ~1, STAKE_MAX) fall short, so MIN_T2_VOTERS is not
    // the only thing standing between two voters and a verdict.
    const maximal = [weight(1, SCORING.STAKE_MAX), weight(1, SCORING.STAKE_MAX)];
    expect(pAtLeast(SCORING.TAU_VERIFY, alphaOf(maximal), 1)).toBeLessThan(
      SCORING.RESOLVE_CONFIDENCE,
    );
  });

  it("does not settle a claim sitting at the prior — I12", () => {
    // Beta(1,1): "not enough evidence" must never resolve as anything.
    expect(pAtLeast(SCORING.TAU_VERIFY, 1, 1)).toBeLessThan(SCORING.RESOLVE_CONFIDENCE);
    expect(pAtMost(SCORING.TAU_REFUTE, 1, 1)).toBeLessThan(SCORING.RESOLVE_CONFIDENCE);
  });

  it("resolves refutals symmetrically", () => {
    const refuting = [weight(0.88, 10), weight(0.75, 9), weight(0.62, 8)];
    const beta = 1 + applyVoterCap(refuting).reduce((a, b) => a + b, 0);
    expect(pAtMost(SCORING.TAU_REFUTE, 1, beta)).toBeGreaterThanOrEqual(
      SCORING.RESOLVE_CONFIDENCE,
    );
  });
});
