/** Server-side chain access (§13.3). Used ONLY by the anchor job.
 *
 *  Users never connect a wallet, never sign anything, and never need ETH —
 *  one operator key writes one 32-byte root per epoch. When the chain keys
 *  are absent every export here is null and the anchor job records
 *  status='skipped_no_chain' (§5.3). Nothing throws; a missing key must never
 *  turn into a 500 on a request path. */
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { env, features } from "./env";
import { ANCHOR_ABI } from "../shared/abi";

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(env.RPC_URL),
});

/** Present only when BOTH the contract address and the anchorer key are set. */
export const anchorerAccount = features.chain
  ? privateKeyToAccount(
      (env.ANCHORER_PRIVATE_KEY!.startsWith("0x")
        ? env.ANCHORER_PRIVATE_KEY!
        : `0x${env.ANCHORER_PRIVATE_KEY}`) as Hex,
    )
  : null;

export const walletClient = anchorerAccount
  ? createWalletClient({
      account: anchorerAccount,
      chain: baseSepolia,
      transport: http(env.RPC_URL),
    })
  : null;

export const contractAddress = features.chain
  ? (env.ANCHOR_CONTRACT_ADDRESS as Hex)
  : null;

/** hex string (no 0x) → bytes32 for viem. */
export const toBytes32 = (hex: string): Hex =>
  (hex.startsWith("0x") ? hex : `0x${hex}`) as Hex;

export type AnchorReceipt = {
  txHash: string;
  blockNumber: number;
  /** true when the epoch was already anchored on-chain — a success, not an
   *  error (§17.3.4): it means a previous run got further than we thought. */
  alreadyAnchored: boolean;
};

/** Submit one epoch's root. Returns null when the chain feature is off. */
export async function submitAnchor(
  epoch: number,
  root: string,
  leafCount: number,
): Promise<AnchorReceipt | null> {
  if (!walletClient || !contractAddress || !anchorerAccount) return null;

  try {
    const hash = await walletClient.writeContract({
      address: contractAddress,
      abi: ANCHOR_ABI,
      functionName: "submitAnchor",
      args: [BigInt(epoch), toBytes32(root), BigInt(leafCount)],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    return {
      txHash: hash,
      blockNumber: Number(receipt.blockNumber),
      alreadyAnchored: false,
    };
  } catch (err) {
    // AlreadyAnchored means the epoch is on-chain already. Read it back and
    // treat that as a confirmed anchor — retrying a job must not "fail".
    if (/AlreadyAnchored/i.test(String(err))) {
      const onChain = await readAnchor(epoch);
      if (onChain && onChain.timestamp > 0n)
        return { txHash: "", blockNumber: 0, alreadyAnchored: true };
    }
    throw err;
  }
}

/** Read an epoch's anchor straight from the contract. */
export async function readAnchor(epoch: number) {
  if (!contractAddress) return null;
  const [root, leafCount, timestamp] = await publicClient.readContract({
    address: contractAddress,
    abi: ANCHOR_ABI,
    functionName: "anchors",
    args: [BigInt(epoch)],
  });
  return { root, leafCount, timestamp };
}
