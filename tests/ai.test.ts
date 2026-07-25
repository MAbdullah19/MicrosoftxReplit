/** The AI is evidence, never judge (I9). These tests pin the bounds that keep
 *  a misbehaving or hostile model from exceeding that role. */
import { describe, it, expect } from "vitest";
import {
  sanitiseAiResult,
  parseGeminiBody,
  buildPrompt,
  AI_FIXTURE,
} from "../server/ai-core";
import { aiWeight } from "../shared/score";
import { SCORING } from "../shared/config";

describe("ai signal sanitisation (§15.3)", () => {
  it("clamps confidence into [0, 1]", () => {
    expect(sanitiseAiResult({ confidence: 5 }).confidence).toBe(1);
    expect(sanitiseAiResult({ confidence: -3 }).confidence).toBe(0);
    expect(sanitiseAiResult({ confidence: 0.42 }).confidence).toBe(0.42);
  });

  it("treats NaN and non-numeric confidence as zero", () => {
    expect(sanitiseAiResult({ confidence: NaN }).confidence).toBe(0);
    expect(sanitiseAiResult({ confidence: "0.9" }).confidence).toBe(0);
  });

  it("rejects an unlisted verdict hint, falling back to unverifiable", () => {
    expect(sanitiseAiResult({ verdictHint: "definitely_a_scam" }).verdictHint).toBe(
      "unverifiable",
    );
    expect(sanitiseAiResult({ verdictHint: "likely_false" }).verdictHint).toBe("likely_false");
  });

  it("truncates rationale to 200 chars and redFlags to 4 items of 40 chars", () => {
    const out = sanitiseAiResult({
      rationale: "x".repeat(500),
      redFlags: ["a".repeat(80), "b", "c", "d", "e", "f"],
    });
    expect(out.rationale).toHaveLength(200);
    expect(out.redFlags).toHaveLength(4);
    expect(out.redFlags[0]).toHaveLength(40);
  });

  it("drops non-string red flags rather than rendering objects", () => {
    const out = sanitiseAiResult({ redFlags: ["real", { evil: true }, 42, null] });
    expect(out.redFlags).toEqual(["real"]);
  });

  it("empty or missing rationale falls back to the fixture text", () => {
    expect(sanitiseAiResult({}).rationale).toBe(AI_FIXTURE.rationale);
    expect(sanitiseAiResult({ rationale: "   " }).rationale).toBe(AI_FIXTURE.rationale);
  });

  it("parseGeminiBody throws on a malformed envelope so the caller can fall back", () => {
    expect(() => parseGeminiBody({})).toThrow(/gemini_no_text/);
    expect(() => parseGeminiBody({ candidates: [{ content: { parts: [{ text: "{" }] } }] })).toThrow();
  });

  it("parseGeminiBody sanitises a well-formed response", () => {
    const body = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  verdictHint: "likely_false",
                  confidence: 1.4,
                  rationale: "The web address uses a digit in place of a letter.",
                  redFlags: ["lookalike domain"],
                }),
              },
            ],
          },
        },
      ],
    };
    const out = parseGeminiBody(body);
    expect(out.verdictHint).toBe("likely_false");
    expect(out.confidence).toBe(1);
    expect(out.redFlags).toEqual(["lookalike domain"]);
  });
});

describe("ai prompt (§15.2)", () => {
  it("states the AI is not the judge and forbids naming a person guilty", () => {
    const p = buildPrompt("url", "example.com", "This is a scam.", null);
    expect(p).toMatch(/You are NOT the judge/);
    expect(p).toMatch(/Never state a person is guilty of a crime/);
  });

  it("renders an absent detail as (none) rather than 'null'", () => {
    expect(buildPrompt("text", "s", "claim", null)).toMatch(/DETAIL: \(none\)/);
    expect(buildPrompt("text", "s", "claim", "  ")).toMatch(/DETAIL: \(none\)/);
    expect(buildPrompt("text", "s", "claim", "context here")).toMatch(/DETAIL: context here/);
  });
});

describe("ai weight cap (I9, §9.4)", () => {
  it("contributes nothing at all before any human vote", () => {
    expect(aiWeight(0, 1.0, false)).toBe(0);
  });

  it("never exceeds 15% of the total including itself", () => {
    for (const human of [0.5, 1, 10, 100]) {
      const w = aiWeight(human, 1.0, false);
      expect(w / (human + w)).toBeLessThanOrEqual(SCORING.AI_WEIGHT_CAP + 1e-9);
    }
  });

  it("a disputed signal is capped at 5% instead", () => {
    const human = 10;
    const w = aiWeight(human, 1.0, true);
    expect(w / (human + w)).toBeLessThanOrEqual(SCORING.AI_DISPUTED_CAP + 1e-9);
  });
});
