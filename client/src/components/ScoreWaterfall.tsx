/** §14.4 — the explainable-AI waterfall.
 *
 *  Rebuilt as diverging bars from a centre line: refutes grow left in red,
 *  supports grow right in green, so the shape of the argument is legible
 *  before a single number is read. Still plain divs — no chart library on a
 *  page that already lazy-loads recharts for the posterior. */
import { useQuery } from "@tanstack/react-query";
import { Bot, UserRound } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Reveal, CountUp } from "@/components/fx";
import { Skeleton } from "@/components/ui/controls";
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
  const { data, error, isLoading } = useQuery<ExplainPayload>({
    queryKey: ["/claims", claimId, "explain"],
    retry: false,
  });

  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (error || !data) return null;

  const maxDelta = Math.max(0.5, ...data.rows.map((r) => Math.abs(r.delta)));

  return (
    <Card pad="lg" className="space-y-5">
      <div>
        <CardTitle>How was this decided?</CardTitle>
        <p className="mt-1 text-sm text-muted-fg">
          Every input, with the arithmetic that produced its weight. Nothing is hidden.
        </p>
      </div>

      {/* Starting point */}
      <div className="flex items-baseline justify-between rounded-xl border border-border bg-bg-soft px-4 py-3 text-sm">
        <span className="text-muted-fg">Starting point — we know nothing</span>
        <span className="tabular font-medium text-fg">{data.start.toFixed(3)}</span>
      </div>

      {/* Diverging bars. The centre line is 0; refutes go left, supports right. */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-fg">
          <span className="text-bad">← refutes</span>
          <span className="text-ok">supports →</span>
        </div>

        {data.rows.map((r, i) => {
          const positive = r.delta >= 0;
          const width = (Math.abs(r.delta) / maxDelta) * 50; // % of full width
          return (
            <Reveal key={i} distance={8} delay={i * 0.05} className="space-y-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  {r.kind === "ai" ? (
                    <Bot className="h-4 w-4 shrink-0 text-warn" aria-hidden />
                  ) : (
                    <UserRound className="h-4 w-4 shrink-0 text-muted-fg" aria-hidden />
                  )}
                  <span className="font-medium text-fg">{r.label}</span>
                  {r.kind === "vote" && r.seeded && (
                    <Badge tone="warn" size="sm">
                      demo account
                    </Badge>
                  )}
                  {r.kind === "vote" && r.wasCapped && (
                    <Badge tone="warn" size="sm">
                      capped
                    </Badge>
                  )}
                  {r.kind === "ai" && (
                    <Badge tone="muted" size="sm">
                      capped at {r.capPercent}% · {r.model} {r.promptVersion}
                    </Badge>
                  )}
                </span>
                <span className="tabular text-xs text-muted-fg">
                  {r.kind === "vote" && r.reputation != null && r.stakeFactor != null && (
                    <>
                      R {r.reputation.toFixed(2)} × stake 1+ln(1+{r.stake})=
                      {r.stakeFactor.toFixed(2)} →{" "}
                    </>
                  )}
                  <span className={cn("text-sm font-semibold", positive ? "text-ok" : "text-bad")}>
                    {positive ? "+" : "−"}
                    {Math.abs(r.delta).toFixed(2)}
                  </span>
                </span>
              </div>

              <div className="relative h-2.5 w-full rounded-full bg-muted">
                {/* Centre tick */}
                <span
                  className="absolute left-1/2 top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2 bg-border-hi"
                  aria-hidden
                />
                <div
                  className={cn(
                    "absolute top-0 h-2.5 transition-[width] duration-700 ease-out",
                    positive ? "left-1/2 rounded-r-full bg-ok" : "right-1/2 rounded-l-full bg-bad",
                  )}
                  style={{ width: `${width}%` }}
                />
              </div>
            </Reveal>
          );
        })}
      </div>

      {/* Final */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border pt-4">
        <span className="text-base font-semibold text-fg">Final</span>
        <span className="tabular text-lg font-semibold text-fg">
          <CountUp to={data.final.score} decimals={3} duration={1.2} />
          {data.final.ciLow != null && (
            <span className="ml-2 text-sm font-normal text-muted-fg">
              [{data.final.ciLow.toFixed(2)} – {data.final.ciHigh!.toFixed(2)}]
            </span>
          )}
        </span>
      </div>
    </Card>
  );
}
