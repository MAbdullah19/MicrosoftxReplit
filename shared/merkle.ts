/** Merkle tree (I8): leaves use domain separator 0x00 (see canonical.leafHash),
 *  internal nodes 0x01. Odd node counts duplicate the last node. */
import { sha256HexBytes, concat, hexBytes } from "./hash";

const NODE = 0x01;

export function buildTree(leaves: string[]): string[][] {
  if (leaves.length === 0) return [[]];
  const levels: string[][] = [leaves];
  while (levels[levels.length - 1].length > 1) {
    const prev = levels[levels.length - 1];
    const next: string[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      const l = prev[i];
      const r = i + 1 < prev.length ? prev[i + 1] : prev[i]; // duplicate the last (I8)
      next.push(sha256HexBytes(concat([NODE], hexBytes(l), hexBytes(r))));
    }
    levels.push(next);
  }
  return levels;
}

export const rootOf = (levels: string[][]) => levels[levels.length - 1][0];

export function proofFor(levels: string[][], index: number): string[] {
  const proof: string[] = [];
  let idx = index;
  for (let lv = 0; lv < levels.length - 1; lv++) {
    const level = levels[lv];
    const sib = idx % 2 === 0 ? Math.min(idx + 1, level.length - 1) : idx - 1;
    proof.push(level[sib]);
    idx = Math.floor(idx / 2);
  }
  return proof;
}

/** Must produce byte-identical results to the Solidity verify() (§13.2). */
export function verifyProof(leaf: string, proof: string[], index: number, root: string) {
  let h = leaf;
  for (let i = 0; i < proof.length; i++) {
    h =
      ((index >> i) & 1) === 0
        ? sha256HexBytes(concat([NODE], hexBytes(h), hexBytes(proof[i])))
        : sha256HexBytes(concat([NODE], hexBytes(proof[i]), hexBytes(h)));
  }
  return h === root;
}
