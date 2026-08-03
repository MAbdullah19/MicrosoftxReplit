/** §14.4 — the explainable-AI waterfall. Plain flex divs, no chart library.
 *  Each row shows the actual multiplication; capped rows are labelled. */
import { useQuery } from "@tanstack/react-query";
import { Bot } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ExplainRow =
  | {
      kind: "vote";
      label: string;
      /** Vote cast by a seeded demo account rather than a person. */
      seeded: boolean;
      stance: "support" | "refute";
      reputation: number | null;
      stakeFactor: number | null;
      stake: number;
      raw: number;
      applied: number;
      wasCapped: boolean;
      delta: number;
    }
  | {
      kind: "ai";
      label: string;
      stance: "support" | "refute";
      model: string;
      promptVersion: string;
      applied: number;
      capPercent: number;
      delta: number;
    };

type ExplainPayload = {
  start: number;
  rows: ExplainRow[];
  final: { score: number; ciLow: number | null; ciHigh: number | null };
};

export function ScoreWaterfall({ claimId }: { claimId: string }) {
  const { data, error } = useQuery<ExplainPayload>({
    queryKey: ["/claims", claimId, "explain"],
    retry: false,
  });
  if (error || !data) return null;

  const maxDelta = Math.max(0.5, ...data.rows.map((r) => Math.abs(r.delta)));

  return (
    <Card className="space-y-3">
      <h3 className="text-base font-semibold">How was this decided?</h3>

      <Row label="Starting point (we know nothing)" value="0.500" />

      {data.rows.map((r, i) => (
        <div key={i} className="space-y-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              {r.kind === "ai" && <Bot className="h-4 w-4 text-muted-fg" aria-hidden />}
              <span className="font-medium">{r.label}</span>
              <span className="text-muted-fg">{r.stance === "support" ? "supports" : "refutes"}</span>
              {r.kind === "vote" && r.seeded && <Badge tone="warn">demo account</Badge>}
              {r.kind === "vote" && r.wasCapped && <Badge tone="warn">capped</Badge>}
              {r.kind === "ai" && <Badge tone="muted">capped at {r.capPercent}% · {r.model} {r.promptVersion}</Badge>}
            </span>
            <span className="tabular-nums text-muted-fg">
              {r.kind === "vote" && r.reputation != null && r.stakeFactor != null
                ? `R ${r.reputation.toFixed(2)} × stake 1+ln(1+${r.stake})=${r.stakeFactor.toFixed(2)} → `
                : ""}
              <span className={cn("font-medium", r.delta >= 0 ? "text-ok" : "text-bad")}>
                {r.delta >= 0 ? "+" : "−"}
                {Math.abs(r.delta).toFixed(2)}
              </span>
            </span>
          </div>
          <div className="flex h-2 w-full rounded bg-muted">
            <div
              className={cn("h-2 rounded", r.delta >= 0 ? "bg-ok" : "bg-bad")}
              style={{ width: `${(Math.abs(r.delta) / maxDelta) * 100}%` }}
            />
          </div>
        </div>
      ))}

      <div className="border-t border-border pt-2">
        <Row
          label="Final"
          value={
            data.final.ciLow != null
              ? `${data.final.score.toFixed(3)}  [${data.final.ciLow.toFixed(2)} – ${data.final.ciHigh!.toFixed(2)}]`
              : data.final.score.toFixed(3)
          }
          strong
        />
      </div>
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between text-sm", strong && "text-base font-semibold")}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
