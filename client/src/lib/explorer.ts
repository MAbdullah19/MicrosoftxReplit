/** Block-explorer base URL.
 *
 *  Deliberately separate from lib/chain.ts: linking to a transaction needs a
 *  string, not a chain client. Keeping this import free of viem is what stops
 *  ~380 KB of RPC machinery being pulled into the main bundle by any page
 *  that merely renders an explorer link (§6 — ship under ~200 KB of JS). */
import { CHAIN } from "@shared/config";

export const EXPLORER_URL: string =
  import.meta.env.VITE_EXPLORER_URL || CHAIN.EXPLORER;
