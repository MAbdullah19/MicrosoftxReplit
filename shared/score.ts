/** The scoring engine — the intellectual core. Implemented exactly per spec §9. */
import jstatPkg from "jstat";
import { SCORING } from "./config";

// jstat ships CJS; the object we need is the `jStat` export.
const jStat: any = (jstatPkg as any).jStat ?? jstatPkg;

/* ── 9.1 vote weight: w = R · (1 + ln(1 + s)) ─────────────────────── */

export function rawWeight(repA: number, repB: number, stake: number) {
  const reputation = repA / (repA + repB); // R ∈ (0,1)
  const stakeFactor = 1 + Math.log(1 + stake); // concave — doubling stake ≠ doubling influence
  return { reputation, stakeFactor, raw: reputation * stakeFactor };
}

/* ── 9.2 per-voter cap with the small-n correction ────────────────── */
/** Effective cap is max(0.15, 2/n): a flat 15% cap is mathematically
 *  unsatisfiable below 7 voters. Iterative water-filling. */
export function applyVoterCap(weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const cap = Math.max(SCORING.VOTER_CAP, 2 / n);
  const w = [...weights];
  for (let iter = 0; iter < 32; iter++) {
    const total = w.reduce((a, b) => a + b, 0);
    if (total <= 0) return w;
    const max = total * cap;
    let changed = false;
    for (let i = 0; i < n; i++) {
      if (w[i] > max + 1e-12) {
        w[i] = max;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return w;
}

/* ── 9.3 posterior, score, credible interval ──────────────────────── */

export function posterior(supportW: number[], refuteW: number[]) {
  const alpha = 1 + supportW.reduce((a, b) => a + b, 0);
  const beta = 1 + refuteW.reduce((a, b) => a + b, 0);
  const score = alpha / (alpha + beta);
  const ciLow = jStat.beta.inv(0.05, alpha, beta);
  const ciHigh = jStat.beta.inv(0.95, alpha, beta);
  return { alpha, beta, score, ciLow, ciHigh };
}

/** P(θ ≥ τ) from the Beta posterior. */
export const pAtLeast = (tau: number, a: number, b: number) =>
  1 - jStat.beta.cdf(tau, a, b);
export const pAtMost = (tau: number, a: number, b: number) =>
  jStat.beta.cdf(tau, a, b);

/* ── 9.4 AI weight — capped at 15% of total including itself ──────── */

export function aiWeight(humanTotal: number, confidence: number, disputed: boolean) {
  if (humanTotal <= 0) return 0; // I9 — AI alone never moves a score
  const c = disputed ? SCORING.AI_DISPUTED_CAP : SCORING.AI_WEIGHT_CAP;
  return Math.min(confidence * SCORING.AI_BASE_WEIGHT, (c / (1 - c)) * humanTotal);
}

/* ── 9.5 Brier scoring, reputation, payout ────────────────────────── */

/** p_true = the voter's stated probability that the claim is TRUE. */
export function pTrue(stance: "support" | "refute", confidence: number) {
  return stance === "support" ? confidence : 1 - confidence;
}

/** Centred Brier. Range [-1.5, +0.5]. Hedging at p=0.5 → exactly 0. */
export function brier(p: number, y: 0 | 1) {
  return 1 - 2 * (p - y) ** 2 - 0.5;
}

/** Points returned for a stake. clamp(1 + 2Δc, 0, 2) × stake. */
export function payout(stake: number, deltaC: number) {
  const m = Math.min(2, Math.max(0, 1 + SCORING.PAYOUT_SPREAD * deltaC));
  return Math.round(stake * m);
}

/** Reputation update. `damped` = true when the crowd graded itself. */
export function updateReputation(a: number, b: number, deltaC: number, damped: boolean) {
  const d = damped ? deltaC * SCORING.CROWD_GRADED_DAMPING : deltaC;
  return {
    a: SCORING.REP_DECAY * a + Math.max(0, d),
    b: SCORING.REP_DECAY * b + Math.max(0, -d),
  };
}
