/** Single source of truth for every tuneable constant.
 *  No magic number appears anywhere else in the codebase. */

export const SCORING = {
  // ── vote weight ────────────────────────────────────────────
  STAKE_MIN: 1,
  STAKE_MAX: 10,
  CONFIDENCE_MIN: 0.05,
  CONFIDENCE_MAX: 0.95,
  /** Nominal per-voter share cap. See score.ts applyVoterCap() for the
   *  small-n correction — a hard 15% is unsatisfiable below 7 voters. */
  VOTER_CAP: 0.15,
  /** Minimum voters before VOTER_CAP can bind at all. */
  VOTER_CAP_MIN_N: 14,

  // ── reputation ─────────────────────────────────────────────
  REP_DECAY: 0.98, // γ
  REP_PRIOR_A: 1,
  REP_PRIOR_B: 1,
  /** Damping when the crowd grades itself (no external ground truth). */
  CROWD_GRADED_DAMPING: 0.5,

  // ── resolution ─────────────────────────────────────────────
  TAU_VERIFY: 0.75,
  TAU_REFUTE: 0.25,
  RESOLVE_CONFIDENCE: 0.9, // P(θ ≥ τ) must reach this
  MIN_T2_VOTERS: 3,
  STABILITY_MINUTES: 30,
  CLAIM_TTL_HOURS: 24,

  // ── points ─────────────────────────────────────────────────
  STARTING_POINTS: 10,
  /** Payout multiplier applied to stake: clamp(1 + 2*(Δ - 0.5), 0, 2). */
  PAYOUT_SPREAD: 2,

  // ── AI ─────────────────────────────────────────────────────
  AI_WEIGHT_CAP: 0.15, // ≤15% of TOTAL weight incl. itself
  AI_DISPUTED_CAP: 0.05,
  AI_BASE_WEIGHT: 1.0,

  // ── invites ────────────────────────────────────────────────
  INVITE_TTL_DAYS: 30,
  INVITE_MINT_MIN_REP: 0.6,
  INVITE_MINT_PER_USER: 2,
} as const;

export const RATE_LIMITS = {
  create_claim: { limit: 5, windowMinutes: 60 },
  add_evidence: { limit: 20, windowMinutes: 60 },
  vote: { limit: 30, windowMinutes: 60 },
  enrol: { limit: 10, windowMinutes: 60 },
} as const;

export const CHAIN = {
  EPOCH_MINUTES: 15,
  CHAIN_ID: 84532,
  EXPLORER: "https://sepolia.basescan.org",
} as const;

export const POLICY_VERSION = "attest-mvp-1";
export const AI_PROMPT_VERSION = "p1";
