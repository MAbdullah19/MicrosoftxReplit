/** Internal status → public label (§14.3). Fixed vocabulary; never improvised.
 *  I12: "not enough evidence yet" must never render as safe — icon + text +
 *  colour, never colour alone, and a WARNING treatment for url/phone subjects. */
import { SCORING } from "./config";
import { pAtLeast, pAtMost } from "./score";
import type { SubjectKind } from "./subject";
import { STRINGS } from "./strings";

export type ClaimStatus =
  | "open"
  | "verified"
  | "refuted"
  | "inconclusive"
  | "removed";

export type VerdictView = {
  /** stable key for icon/colour mapping in the client */
  kind:
    | "likely_true"
    | "likely_false"
    | "leaning_true"
    | "leaning_false"
    | "not_enough_evidence"
    | "unresolved"
    | "removed";
  label: string;
  /** semantic colour token — the client must ALWAYS pair it with icon + word */
  tone: "ok" | "bad" | "warn" | "muted" | "muted-warn";
};

export function publicVerdict(
  status: ClaimStatus,
  subjectKind: SubjectKind,
  alpha: number,
  beta: number,
  voterCount: number,
): VerdictView {
  const scammable = subjectKind === "url" || subjectKind === "phone";
  switch (status) {
    case "verified":
      return { kind: "likely_true", label: STRINGS.verdict.likelyTrue, tone: "ok" };
    case "refuted":
      return {
        kind: "likely_false",
        label: scammable ? STRINGS.verdict.likelyScam : STRINGS.verdict.likelyFalse,
        tone: "bad",
      };
    case "inconclusive":
      return { kind: "unresolved", label: STRINGS.verdict.unresolved, tone: "muted" };
    case "removed":
      return { kind: "removed", label: STRINGS.verdict.removed, tone: "muted" };
    case "open": {
      // below the participation floor → early state; unknown is not safe (I12)
      if (voterCount < SCORING.MIN_T2_VOTERS) {
        return {
          kind: "not_enough_evidence",
          label: STRINGS.verdict.notEnoughEvidence,
          tone: scammable ? "muted-warn" : "muted",
        };
      }
      const pVerify = pAtLeast(SCORING.TAU_VERIFY, alpha, beta);
      const pRefute = pAtMost(SCORING.TAU_REFUTE, alpha, beta);
      if (pVerify >= 0.5)
        return { kind: "leaning_true", label: STRINGS.verdict.leaningTrue, tone: "warn" };
      if (pRefute >= 0.5)
        return { kind: "leaning_false", label: STRINGS.verdict.leaningFalse, tone: "warn" };
      return {
        kind: "not_enough_evidence",
        label: STRINGS.verdict.notEnoughEvidence,
        tone: scammable ? "muted-warn" : "muted",
      };
    }
  }
}
