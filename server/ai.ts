/** AI evidence signal (§15) — env- and db-bound half. Pure logic (prompt,
 *  schema, sanitisation) lives in ai-core.ts and is unit-tested there.
 *
 *  ONE Gemini call per claim, at submission time, cached in forum.ai_signals
 *  forever. Never on page render — that is how you hit the free-tier rate
 *  limit during a demo.
 *
 *  The AI is evidence, never judge (I9). It cannot resolve a claim, cannot
 *  reject a submission, and contributes ZERO weight until at least one human
 *  has voted. Its weight_contributed is computed by vote_and_rescore(). */
import { db } from "./db";
import { aiSignals } from "../shared/schema";
import { env, features } from "./env";
import { AI_PROMPT_VERSION } from "../shared/config";
import type { SubjectKind } from "../shared/subject";
import {
  AI_ENDPOINT,
  AI_FIXTURE,
  AI_MODEL,
  AI_RESPONSE_SCHEMA,
  AI_TIMEOUT_MS,
  buildPrompt,
  parseGeminiBody,
  type AiResult,
} from "./ai-core";

async function callGemini(prompt: string): Promise<AiResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch(`${AI_ENDPOINT}?key=${env.GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
          responseSchema: AI_RESPONSE_SCHEMA,
        },
      }),
    });
    if (!res.ok) throw new Error(`gemini_http_${res.status}`);
    return parseGeminiBody(await res.json());
  } finally {
    clearTimeout(timer);
  }
}

/** Produce and store the signal for a claim. Never throws: a claim submission
 *  must never fail because of the AI (§15.3). Safe to call fire-and-forget. */
export async function generateAiSignal(
  claimId: string,
  kind: SubjectKind,
  subject: string,
  statement: string,
  detail: string | null,
): Promise<void> {
  let result = AI_FIXTURE;
  let model = "none";

  if (features.ai) {
    try {
      result = await callGemini(buildPrompt(kind, subject, statement, detail));
      model = AI_MODEL;
    } catch (err) {
      // 429, timeout, malformed JSON, schema mismatch — all land here and all
      // degrade to the fixture. Log the reason, never the key (I11).
      console.warn(`[ai] signal fell back to fixture: ${(err as Error).message}`);
      result = AI_FIXTURE;
      model = `${AI_MODEL}-unavailable`;
    }
  }

  try {
    await db.insert(aiSignals).values({
      claimId,
      verdictHint: result.verdictHint,
      confidence: result.confidence,
      rationale: result.rationale,
      redFlags: result.redFlags,
      // Stays 0 until a human votes — vote_and_rescore() owns this number (I9).
      weightContributed: 0,
      model,
      promptVersion: AI_PROMPT_VERSION,
    });
  } catch (err) {
    console.warn(`[ai] could not store signal: ${(err as Error).message}`);
  }
}
