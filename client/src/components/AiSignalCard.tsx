/** The AI signal (§15) — visually distinct from human evidence, always
 *  labelled with its model and prompt version, and always disputable.
 *  It is one capped signal among many, never a verdict (I9).
 *
 *  The redesign makes "not a verdict" a visual fact: a dashed border, a
 *  monospace attribution footer, and an explicit weight bar showing how small
 *  its cap is next to the humans. Nothing about it should read like a banner. */
import { useMutation } from "@tanstack/react-query";
import { Bot, Flag, TriangleAlert } from "lucide-react";
import { SCORING } from "@shared/config";
import { STRINGS } from "@shared/strings";
import { apiPost } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/controls";
import { cn } from "@/lib/utils";

export type AiSignal = {
  id: string;
  verdictHint: "likely_true" | "likely_false" | "unverifiable";
  confidence: number;
  rationale: string;
  redFlags: string[];
  weightContributed: number;
  disputes: number;
  model: string;
  promptVersion: string;
};

export function AiSignalCard({ signal, claimId }: { signal: AiSignal; claimId: string }) {
  const dispute = useMutation({
    mutationFn: () => apiPost(`/ai-signals/${signal.id}/dispute`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/claims", claimId] });
      queryClient.invalidateQueries({ queryKey: ["/claims", claimId, "explain"] });
    },
  });

  const unavailable = signal.rationale === STRINGS.verify.aiUnavailable;
  const disputed = signal.disputes > 0;
  const cap = disputed ? SCORING.AI_DISPUTED_CAP : SCORING.AI_WEIGHT_CAP;

  return (
    <section
      className={cn(
        "rounded-2xl border border-dashed border-border-hi bg-bg-soft p-5",
        unavailable && "opacity-60",
      )}
      aria-label="AI signal"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-warn/10">
          <Bot className="h-4 w-4 text-warn" aria-hidden />
        </span>
        <span className="text-base font-semibold text-fg">AI signal</span>
        <Badge tone="muted" size="sm">
          not a verdict
        </Badge>
        {disputed && (
          <Badge tone="warn" size="sm">
            <TriangleAlert className="h-3 w-3" aria-hidden />
            disputed ×{signal.disputes}
          </Badge>
        )}
      </div>

      <p className="mt-3 text-base leading-relaxed text-muted-fg">{signal.rationale}</p>

      {signal.redFlags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Red flags">
          {signal.redFlags.map((f) => (
            <li key={f}>
              <Badge tone="warn" size="sm">
                {f}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      {!unavailable && (
        <div className="mt-4 space-y-2">
          <div className="flex items-baseline justify-between text-xs text-muted-fg">
            <span>Maximum weight this signal can ever carry</span>
            <span className="tabular font-medium text-fg">{Math.round(cap * 100)}%</span>
          </div>
          <Progress value={cap} tone="warn" label="AI weight cap" />
          <p className="tabular text-xs text-muted-fg">
            Model confidence {(signal.confidence * 100).toFixed(0)}% ·{" "}
            {signal.weightContributed > 0
              ? `currently contributing ${signal.weightContributed.toFixed(2)} weight`
              : "contributing no weight until a human votes"}
          </p>
        </div>
      )}

      {unavailable && (
        <p className="mt-3 text-sm text-muted-fg">No signal available for this claim.</p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <span className="font-mono text-xs text-muted-fg">
          {signal.model} · prompt {signal.promptVersion}
        </span>
        {!unavailable && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => dispute.mutate()}
            disabled={dispute.isPending}
          >
            <Flag className="h-4 w-4" aria-hidden />
            {dispute.isPending ? "Flagging…" : "Dispute this"}
          </Button>
        )}
      </div>
    </section>
  );
}
