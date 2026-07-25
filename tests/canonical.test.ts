import { describe, it, expect } from "vitest";
import { jcs, dec6, tallyHash, leafHash, type VerdictRecord } from "../shared/canonical";

describe("canonicalisation (§21, I7)", () => {
  it("jcs() output is byte-identical regardless of key insertion order", () => {
    const a = { z: "1", a: "2", m: ["x", "y"], n: 3 };
    const b = { n: 3, m: ["x", "y"], a: "2", z: "1" };
    expect(jcs(a)).toBe(jcs(b));
    expect(jcs(a)).toBe('{"a":"2","m":["x","y"],"n":3,"z":"1"}');
  });

  it('dec6(0.1 + 0.2) === "0.300000"', () => {
    expect(dec6(0.1 + 0.2)).toBe("0.300000");
  });

  it("jcs throws on non-integer numbers — floats must go through dec6()", () => {
    expect(() => jcs({ x: 0.5 })).toThrow(/dec6/);
  });

  it("jcs throws on unsupported values", () => {
    expect(() => jcs({ x: null })).toThrow();
    expect(() => jcs(undefined)).toThrow();
  });

  it("tallyHash is stable", () => {
    expect(tallyHash(3, 1.5, 0.25)).toBe(tallyHash(3, 1.5, 0.25));
    expect(tallyHash(3, 1.5, 0.25)).not.toBe(tallyHash(3, 1.5, 0.26));
  });

  it("leafHash uses the 0x00 domain separator and is deterministic", () => {
    const record: VerdictRecord = {
      v: 1,
      claimId: "00000000-0000-0000-0000-000000000001",
      subjectKey: "ab".repeat(32),
      contentHash: "cd".repeat(32),
      status: "verified",
      score: dec6(0.75),
      ci: [dec6(0.6), dec6(0.9)],
      alpha: dec6(3),
      beta: dec6(1),
      tallyHash: "ef".repeat(32),
      resolvedAt: "2026-07-25T14:03:00Z",
      policyVersion: "attest-mvp-1",
    };
    const h1 = leafHash(record);
    const h2 = leafHash({ ...record });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    // any mutation changes the leaf
    expect(leafHash({ ...record, score: dec6(0.750001) })).not.toBe(h1);
  });
});
