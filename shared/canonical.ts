/** Canonical verdict records (I7). All canonical numbers are STRINGS. */
import { sha256Hex, sha256HexBytes, concat, utf8 } from "./hash";

export type VerdictRecord = {
  v: 1;
  claimId: string;
  subjectKey: string;
  contentHash: string;
  status: "verified" | "refuted" | "inconclusive";
  score: string; // fixed 6 dp STRING
  ci: [string, string]; // fixed 6 dp STRINGS
  alpha: string; // fixed 6 dp STRING
  beta: string; // fixed 6 dp STRING
  tallyHash: string;
  resolvedAt: string; // RFC 3339 UTC, SECOND precision: 2026-07-25T14:03:00Z
  policyVersion: string;
};

/** Fixed 6-dp decimal string. THE ONLY way a number enters a canonical record. */
export const dec6 = (n: number) => n.toFixed(6);

/** RFC 8785 (JCS) subset: keys sorted by UTF-16 code unit, no whitespace,
 *  values restricted to string | integer | string[]. Anything else throws. */
export function jcs(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isInteger(value)) throw new Error("jcs: non-integer number — use dec6()");
    return String(value);
  }
  if (Array.isArray(value)) return "[" + value.map(jcs).join(",") + "]";
  if (value && typeof value === "object") {
    const keys = Object.keys(value as object).sort(); // JS sorts by UTF-16 code unit
    return (
      "{" +
      keys.map((k) => JSON.stringify(k) + ":" + jcs((value as any)[k])).join(",") +
      "}"
    );
  }
  throw new Error("jcs: unsupported value");
}

export const tallyHash = (nVoters: number, weightFor: number, weightAgainst: number) =>
  sha256Hex(jcs({ nVoters, weightAgainst: dec6(weightAgainst), weightFor: dec6(weightFor) }));

/** leaf = SHA256(0x00 ‖ JCS(record)) — leaf domain separator (I8). */
export const leafHash = (r: VerdictRecord) =>
  sha256HexBytes(concat([0x00], utf8(jcs(r))));
