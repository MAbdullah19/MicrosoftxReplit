/** The AI signal (§15) — visually distinct from human evidence, always
 *  labelled with its model and prompt version, and always disputable.
 *  It is one capped signal among many, never a verdict (I9). */
import { useMutation } from "@tanstack/react-query";
import { Bot, Flag } from "lucide-react";
import { SCORING } from "@shared/config";
import { STRINGS } from "@shared/strings";
import { apiPost } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
    <Card className={unavailable ? "space-y-2 opacity-60" : "space-y-2"}>
      <div className="flex flex-wrap items-center gap-2">
        <Bot className="h-5 w-5 shrink-0 text-muted-fg" aria-hidden />
        <span className="text-base font-semibold">AI signal</span>
        <Badge tone={disputed ? "warn" : "muted"}>
          capped at {Math.round(cap * 100)}%
        </Badge>
        {disputed && (
          <Badge tone="warn">
            disputed ×{signal.disputes}
          </Badge>
        )}
      </div>

      <p className="text-base text-muted-fg">{signal.rationale}</p>

      {signal.redFlags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Red flags">
          {signal.redFlags.map((f) => (
            <li key={f}>
              <Badge tone="warn">{f}</Badge>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-muted-fg tabular-nums">
        {unavailable ? (
          "No signal available for this claim."
        ) : (
          <>
            Model confidence {(signal.confidence * 100).toFixed(0)}% ·{" "}
            {signal.weightContributed > 0
              ? `contributing ${signal.weightContributed.toFixed(2)} weight`
              : "contributing no weight until a human votes"}
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-fg">
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
    </Card>
  );
}
