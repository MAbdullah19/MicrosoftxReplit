/** Anchor registry ABI (§13.2). Inlined deliberately — the contract is
 *  deployed outside this repo (Remix, §13.1), so there is no build step here
 *  to generate it from. Shared because the browser reads `anchors()` directly
 *  from the public RPC during /verify, without going through our API. */
export const ANCHOR_ABI = [
  {
    type: "function",
    name: "anchors",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint64" }],
    outputs: [
      { name: "root", type: "bytes32" },
      { name: "leafCount", type: "uint64" },
      { name: "timestamp", type: "uint64" },
    ],
  },
  {
    type: "function",
    name: "latestEpoch",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint64" }],
  },
  {
    type: "function",
    name: "anchorer",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
  {
    type: "function",
    name: "submitAnchor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "epoch", type: "uint64" },
      { name: "root", type: "bytes32" },
      { name: "leafCount", type: "uint64" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "verify",
    stateMutability: "view",
    inputs: [
      { name: "epoch", type: "uint64" },
      { name: "leaf", type: "bytes32" },
      { name: "proof", type: "bytes32[]" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;
