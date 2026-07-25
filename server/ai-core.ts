/** Pure half of the AI signal (§15) — prompt, response schema, and the
 *  coercion that keeps a misbehaving model inside documented bounds.
 *  No env, no db, no network: everything here is unit-testable.
 *  (Same split as turnstile-core.ts / turnstile.ts.) */
import { STRINGS } from "../shared/strings";
import type { SubjectKind } from "../shared/subject";

export const AI_MODEL = "gemini-2.5-flash";
export const AI_ENDPOINT =
  `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent`;
export const AI_TIMEOUT_MS = 8_000;

export type AiVerdictHint = "likely_true" | "likely_false" | "unverifiable";

export type AiResult = {
  verdictHint: AiVerdictHint;
  confidence: number;
  rationale: string;
  redFlags: string[];
};

/** §5.3 — what we store when the AI is unavailable for any reason. The 15%
 *  cap means nothing structural breaks; the card renders greyed out. */
export const AI_FIXTURE: AiResult = {
  verdictHint: "unverifiable",
  confidence: 0,
  rationale: STRINGS.verify.aiUnavailable,
  redFlags: [],
};

export const AI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    verdictHint: { type: "STRING", enum: ["likely_true", "likely_false", "unverifiable"] },
    confidence: { type: "NUMBER" },
    rationale: { type: "STRING" },
    redFlags: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["verdictHint", "confidence", "rationale", "redFlags"],
} as const;

/** AI_PROMPT_VERSION is bumped on ANY edit to this text, so a stored signal
 *  always says which prompt produced it. */
export function buildPrompt(
  kind: SubjectKind,
  subject: string,
  statement: string,
  detail: string | null,
): string {
  return `You are an evidence-gathering assistant for a public fact-checking platform.
You are NOT the judge. Your output is one capped signal among many, and human
voters can and will overrule you.

Analyse the claim below and return JSON only.

SUBJECT KIND: ${kind}
SUBJECT: ${subject}
CLAIM: ${statement}
DETAIL: ${detail && detail.trim() ? detail : "(none)"}

Rules:
- Use ONLY what is in the text above plus general world knowledge. You have no
  web access. If you cannot assess it, return "unverifiable" with confidence 0.
- "confidence" is your probability that verdictHint is correct, 0.0 to 1.0.
  Be conservative. Above 0.8 requires a near-certain structural giveaway
  (for example an obvious lookalike domain).
- "rationale" is ONE plain sentence, at most 30 words, written for a general
  audience with no technical background. No jargon, no hedging boilerplate.
- "redFlags" is 0 to 4 short noun phrases, each at most 5 words.
  Examples: "urgency language", "lookalike domain", "unverifiable payout claim".
- Never mention that you are an AI model. Never give advice or instructions.
- Never state a person is guilty of a crime. Describe the message, not the human.`;
}

/** Coerce whatever came back into the documented bounds (§15.3). A model that
 *  ignores the schema must not be able to inject an unbounded string, an
 *  out-of-range confidence, or an unlisted verdict hint. */
export function sanitiseAiResult(raw: unknown): AiResult {
  const o = raw as Partial<AiResult> | null;
  const verdictHint: AiVerdictHint =
    o?.verdictHint === "likely_true" || o?.verdictHint === "likely_false"
      ? o.verdictHint
      : "unverifiable";
  const confRaw = typeof o?.confidence === "number" ? o.confidence : 0;
  const confidence = Number.isFinite(confRaw) ? Math.min(1, Math.max(0, confRaw)) : 0;
  const rationale =
    typeof o?.rationale === "string" && o.rationale.trim()
      ? o.rationale.trim().slice(0, 200)
      : AI_FIXTURE.rationale;
  const redFlags = Array.isArray(o?.redFlags)
    ? o.redFlags
        .filter((f): f is string => typeof f === "string")
        .slice(0, 4)
        .map((f) => f.slice(0, 40))
    : [];
  return { verdictHint, confidence, rationale, redFlags };
}

/** Parse a Gemini generateContent response body into a result. Throws on
 *  anything unusable so the caller can fall back to the fixture. */
export function parseGeminiBody(body: unknown): AiResult {
  const text = (body as any)?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") throw new Error("gemini_no_text");
  return sanitiseAiResult(JSON.parse(text));
}
