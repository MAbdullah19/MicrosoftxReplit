/** Where a resolved claim's verdict sits in the ledger and on the chain.
 *  Amber, never green, when the epoch is only in our local ledger — an
 *  unanchored verdict is internally consistent but not yet falsifiable by a
 *  stranger, and the copy must not blur that (§5.3).
 *
 *  Confirmed gets Aceternity's Moving Border chip. It is the one permanently
 *  animating element in the product, and it marks the one claim the product
 *  actually makes: this is on a public chain now. */
import { Link } from "wouter";
import { Anchor, ExternalLink, ShieldCheck, TriangleAlert } from "lucide-react";
import { STRINGS } from "@shared/strings";
import { EXPLORER_URL } from "@/lib/explorer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MovingBorderChip } from "@/components/fx";
import { cn } from "@/lib/utils";

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
    <Card
      pad="lg"
      className={cn("space-y-4", confirmed ? "border-brand/30" : "border-warn/40 bg-warn/[0.03]")}
    >
      <div className="flex flex-wrap items-center gap-3">
        {confirmed ? (
          <MovingBorderChip>
            <Anchor className="h-4 w-4 text-brand" aria-hidden />
            <span className="font-medium">Anchored on Base Sepolia</span>
          </MovingBorderChip>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full border border-warn/40 bg-warn/10 px-3 py-1.5 text-sm font-medium text-warn">
            <TriangleAlert className="h-4 w-4" aria-hidden />
            In our ledger, not yet on-chain
          </span>
        )}
        {epoch != null && (
          <Badge tone="muted" className="font-mono">
            epoch {epoch}
          </Badge>
        )}
        {confirmed && anchor?.blockNumber != null && (
          <Badge tone="muted" className="font-mono">
            block {anchor.blockNumber}
          </Badge>
        )}
      </div>

      <p className="text-base leading-relaxed text-muted-fg">
        {confirmed
          ? "This verdict's hash is committed inside a Merkle root published on a public blockchain. Anyone can check it without trusting us."
          : STRINGS.verify.localOnly}
      </p>

      <div className="flex flex-wrap gap-3 text-base">
        <Link
          href={`/verify?claim=${claimId}`}
          className="inline-flex items-center gap-1.5 text-brand underline-offset-4 hover:underline"
        >
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Verify it yourself
        </Link>
        {confirmed && anchor?.txHash && (
          <a
            className="inline-flex items-center gap-1.5 text-brand underline-offset-4 hover:underline"
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
