/** Where a resolved claim's verdict sits in the ledger and on the chain.
 *  Amber, never green, when the epoch is only in our local ledger — an
 *  unanchored verdict is internally consistent but not yet falsifiable by a
 *  stranger, and the copy must not blur that (§5.3). */
import { Link } from "wouter";
import { Anchor, ExternalLink, TriangleAlert } from "lucide-react";
import { STRINGS } from "@shared/strings";
import { EXPLORER_URL } from "@/lib/explorer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type AnchorView = {
  status: string;
  txHash: string | null;
  blockNumber: number | null;
} | null;

export function AnchorStatus({
  anchor,
  claimId,
  epoch,
}: {
  anchor: AnchorView;
  claimId: string;
  epoch: number | null;
}) {
  const confirmed = anchor?.status === "confirmed";

  return (
    <Card className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {confirmed ? (
          <Anchor className="h-6 w-6 shrink-0 text-brand" aria-hidden />
        ) : (
          <TriangleAlert className="h-6 w-6 shrink-0 text-warn" aria-hidden />
        )}
        <span className="text-base font-semibold">
          {confirmed ? "Anchored on Base Sepolia" : "In our ledger, not yet on-chain"}
        </span>
        {epoch != null && <Badge tone="muted">epoch {epoch}</Badge>}
      </div>

      <p className="text-base text-muted-fg">
        {confirmed
          ? "This verdict's hash is committed inside a Merkle root published on a public blockchain. Anyone can check it without trusting us."
          : STRINGS.verify.localOnly}
      </p>

      <div className="flex flex-wrap gap-3 text-base">
        <Link
          href={`/verify?claim=${claimId}`}
          className="text-brand underline-offset-2 hover:underline"
        >
          Verify it yourself
        </Link>
        {confirmed && anchor?.txHash && (
          <a
            className="inline-flex items-center gap-1 text-brand underline-offset-2 hover:underline"
            href={`${EXPLORER_URL}/tx/${anchor.txHash}`}
            target="_blank"
            rel="noreferrer"
          >
            See the transaction <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        )}
      </div>
    </Card>
  );
}
