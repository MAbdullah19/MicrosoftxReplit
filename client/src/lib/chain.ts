/** Browser chain access (§13.3) — READ ONLY.
 *
 *  Users never connect a wallet, never sign anything, and never need ETH.
 *  This client exists so /verify can read the anchored Merkle root straight
 *  from the public Base Sepolia RPC instead of from our API. That is the
 *  whole trust argument: if our server lied, this read would disagree. */
import { createPublicClient, http, type Hex } from "viem";
import { baseSepolia } from "viem/chains";
import { ANCHOR_ABI } from "@shared/abi";

const RPC_URL = import.meta.env.VITE_RPC_URL || "https://sepolia.base.org";
const CONTRACT = import.meta.env.VITE_ANCHOR_CONTRACT_ADDRESS as string | undefined;

/** Null until the contract is deployed and its address configured (§13.1). */
export const contractAddress: Hex | null =
  CONTRACT && /^0x[0-9a-fA-F]{40}$/.test(CONTRACT) ? (CONTRACT as Hex) : null;

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL),
});

export type OnChainAnchor = {
  root: string;
  leafCount: number;
  timestamp: number;
};

/** Read one epoch's anchor from the public RPC. Returns null when the chain
 *  feature is off, or when the epoch has never been anchored. */
export async function readAnchorFromChain(epoch: number): Promise<OnChainAnchor | null> {
  if (!contractAddress) return null;
  const [root, leafCount, timestamp] = await publicClient.readContract({
    address: contractAddress,
    abi: ANCHOR_ABI,
    functionName: "anchors",
    args: [BigInt(epoch)],
  });
  if (Number(timestamp) === 0) return null;
  return { root, leafCount: Number(leafCount), timestamp: Number(timestamp) };
}
