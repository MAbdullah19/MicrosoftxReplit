import { describe, it, expect } from "vitest";
import { buildTree, rootOf, proofFor, verifyProof } from "../shared/merkle";
import { sha256HexBytes, concat, hexBytes, sha256Hex } from "../shared/hash";

const leaf = (i: number) => sha256Hex(`leaf-${i}`);

describe("merkle (§21)", () => {
  for (const n of [1, 2, 3, 5, 8]) {
    it(`round-trips ${n} leaves through buildTree → proofFor → verifyProof`, () => {
      const leaves = Array.from({ length: n }, (_, i) => leaf(i));
      const levels = buildTree(leaves);
      const root = rootOf(levels);
      for (let i = 0; i < n; i++) {
        const proof = proofFor(levels, i);
        expect(verifyProof(leaves[i], proof, i, root)).toBe(true);
        // a wrong leaf must fail
        expect(verifyProof(leaf(999), proof, i, root)).toBe(false);
      }
    });
  }

  it("verifyProof agrees with a hand-computed 3-leaf tree", () => {
    const [a, b, c] = [leaf(0), leaf(1), leaf(2)];
    const node = (l: string, r: string) =>
      sha256HexBytes(concat([0x01], hexBytes(l), hexBytes(r)));
    const ab = node(a, b);
    const cc = node(c, c); // odd count duplicates the last node (I8)
    const root = node(ab, cc);

    const levels = buildTree([a, b, c]);
    expect(rootOf(levels)).toBe(root);
    expect(verifyProof(a, [b, cc], 0, root)).toBe(true);
    expect(verifyProof(b, [a, cc], 1, root)).toBe(true);
    expect(verifyProof(c, [c, ab], 2, root)).toBe(true);
  });

  it("internal nodes use domain separator 0x01, distinct from leaves", () => {
    const [a, b] = [leaf(0), leaf(1)];
    const withLeafSep = sha256HexBytes(concat([0x00], hexBytes(a), hexBytes(b)));
    const root = rootOf(buildTree([a, b]));
    expect(root).not.toBe(withLeafSep);
  });
});
