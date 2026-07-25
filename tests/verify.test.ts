/** The /verify argument, tested without a browser (§14.5).
 *
 *  These assertions ARE the product claim: a record that has been altered by
 *  even one character must stop hashing to its published leaf, and its proof
 *  must stop reaching the anchored root. If these ever pass while the record
 *  is tampered, the whole trust story is false. */
import { describe, it, expect } from "vitest";
import { dec6, jcs, leafHash, tallyHash, type VerdictRecord, type RemovalRecord } from "../shared/canonical";
import { buildTree, rootOf, proofFor, verifyProof } from "../shared/merkle";

function record(overrides: Partial<VerdictRecord> = {}): VerdictRecord {
  return {
    v: 1,
    claimId: "11111111-2222-3333-4444-555555555555",
    subjectKey: "ab".repeat(32),
    contentHash: "cd".repeat(32),
    status: "refuted",
    score: dec6(0.087312),
    ci: [dec6(0.031), dec6(0.194)],
    alpha: dec6(1.42),
    beta: dec6(14.9),
    tallyHash: tallyHash(4, 1.42, 14.9),
    resolvedAt: "2026-07-25T14:03:00Z",
    policyVersion: "attest-mvp-1",
    ...overrides,
  };
}

describe("verify: leaf recomputation", () => {
  it("an untampered record hashes to its published leaf", () => {
    const r = record();
    const published = leafHash(r);
    // the browser rebuilds the record object from JSON — key order differs
    const roundTripped = JSON.parse(JSON.stringify(r)) as VerdictRecord;
    expect(leafHash(roundTripped)).toBe(published);
  });

  it("changing ONE digit of the score changes the leaf (the Tamper button)", () => {
    const r = record();
    const published = leafHash(r);
    const bumped = r.score.slice(0, -1) + "9";
    expect(bumped).not.toBe(r.score);
    expect(leafHash({ ...r, score: bumped })).not.toBe(published);
  });

  it("every field is committed to — no field can be altered silently", () => {
    const r = record();
    const base = leafHash(r);
    const mutations: Array<Partial<VerdictRecord>> = [
      { status: "verified" },
      { claimId: "00000000-0000-0000-0000-000000000000" },
      { subjectKey: "ff".repeat(32) },
      { contentHash: "ff".repeat(32) },
      { ci: [dec6(0.0311), dec6(0.194)] },
      { alpha: dec6(1.43) },
      { beta: dec6(14.91) },
      { tallyHash: "ff".repeat(32) },
      { resolvedAt: "2026-07-25T14:03:01Z" },
      { policyVersion: "attest-mvp-2" },
    ];
    for (const m of mutations) {
      expect(leafHash({ ...r, ...m })).not.toBe(base);
    }
  });
});

describe("verify: proof against the anchored root", () => {
  const epochRecords = Array.from({ length: 5 }, (_, i) =>
    record({ claimId: `1111111${i}-2222-3333-4444-555555555555`, score: dec6(i / 10) }),
  );
  const leaves = epochRecords.map(leafHash);
  const levels = buildTree(leaves);
  const root = rootOf(levels);

  it("each record in the epoch proves membership", () => {
    epochRecords.forEach((r, i) => {
      expect(verifyProof(leafHash(r), proofFor(levels, i), i, root)).toBe(true);
    });
  });

  it("a tampered record fails the proof at its own index", () => {
    const i = 2;
    const tampered = { ...epochRecords[i], score: dec6(0.999) };
    expect(verifyProof(leafHash(tampered), proofFor(levels, i), i, root)).toBe(false);
  });

  it("a valid leaf presented at the wrong index fails", () => {
    expect(verifyProof(leaves[1], proofFor(levels, 1), 3, root)).toBe(false);
  });

  it("a proof does not verify against a different root", () => {
    const otherRoot = rootOf(buildTree([...leaves].reverse()));
    expect(verifyProof(leaves[0], proofFor(levels, 0), 0, otherRoot)).toBe(false);
  });
});

describe("removal records are anchored like verdicts (§20)", () => {
  const removal: RemovalRecord = {
    v: 1,
    kind: "removal",
    claimId: "99999999-8888-7777-6666-555555555555",
    subjectKey: "ab".repeat(32),
    contentHash: "cd".repeat(32),
    reason: "illegal content",
    removedAt: "2026-07-25T15:00:00Z",
    policyVersion: "attest-mvp-1",
  };

  it("canonicalises and hashes like any other leaf", () => {
    expect(jcs(removal)).toBe(jcs(JSON.parse(JSON.stringify(removal))));
    expect(leafHash(removal)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("sits in the same tree as verdicts, so operator power is countable", () => {
    const leaves = [leafHash(record()), leafHash(removal)];
    const levels = buildTree(leaves);
    expect(verifyProof(leaves[1], proofFor(levels, 1), 1, rootOf(levels))).toBe(true);
  });

  it("a removal is not confusable with a verdict of the same claim", () => {
    const asVerdict = record({ claimId: removal.claimId });
    expect(leafHash(removal)).not.toBe(leafHash(asVerdict));
  });
});
