/** Cast a weighted vote: stance, confidence slider, stake (§14.2). */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { STRINGS } from "@shared/strings";
import { SCORING } from "@shared/config";
import { apiPost, ApiError } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function VotePanel({
  claimId,
  viewer,
}: {
  claimId: string;
  viewer: { tier: number; hasVoted: boolean } | null;
}) {
  const [stance, setStance] = useState<"support" | "refute" | null>(null);
  const [confidence, setConfidence] = useState(0.75);
  const [stake, setStake] = useState(3);

  const vote = useMutation({
    mutationFn: () => apiPost("/vote", { claimId, stance, confidence, stake }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/claims", claimId] });
      queryClient.invalidateQueries({ queryKey: ["/claims", claimId, "explain"] });
    },
  });
  const err = vote.error as ApiError | null;

  if (!viewer)
    return (
      <Card className="text-base text-muted-fg">
        <Link href="/join" className="text-brand underline-offset-2 hover:underline">
          Join with an invite
        </Link>{" "}
        to vote on this claim.
      </Card>
    );
  if (viewer.tier < 2)
    return <Card className="text-base text-muted-fg">{STRINGS.errors.tierRequired}</Card>;
  if (viewer.hasVoted)
    return <Card className="text-base text-muted-fg">Your vote is in — the tally below now includes it.</Card>;

  return (
    <Card className="space-y-4">
      <h3 className="text-base font-semibold">Cast your vote</h3>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={stance === "support" ? "primary" : "secondary"}
          onClick={() => setStance("support")}
        >
          <ThumbsUp className="h-5 w-5" aria-hidden /> True
        </Button>
        <Button
          variant={stance === "refute" ? "danger" : "secondary"}
          onClick={() => setStance("refute")}
        >
          <ThumbsDown className="h-5 w-5" aria-hidden /> False
        </Button>
      </div>

      <label className="block space-y-1">
        <span className="flex justify-between text-sm text-muted-fg">
          <span>How sure are you?</span>
          <span className="tabular-nums font-medium text-fg">{Math.round(confidence * 100)}%</span>
        </span>
        <input
          type="range"
          min={SCORING.CONFIDENCE_MIN * 100}
          max={SCORING.CONFIDENCE_MAX * 100}
          step={5}
          value={confidence * 100}
          onChange={(e) => setConfidence(Number(e.target.value) / 100)}
          className="h-11 w-full accent-[hsl(var(--brand))]"
          aria-label="Confidence"
        />
        <span className="text-sm text-muted-fg">
          Honesty pays: your reputation is graded by how well-calibrated you are, not by agreeing
          with the crowd.
        </span>
      </label>

      <label className="block space-y-1">
        <span className="flex justify-between text-sm text-muted-fg">
          <span>Points to stake</span>
          <span className="tabular-nums font-medium text-fg">{stake}</span>
        </span>
        <input
          type="range"
          min={SCORING.STAKE_MIN}
          max={SCORING.STAKE_MAX}
          step={1}
          value={stake}
          onChange={(e) => setStake(Number(e.target.value))}
          className="h-11 w-full accent-[hsl(var(--brand))]"
          aria-label="Stake"
        />
      </label>

      {err && (
        <p className="text-sm text-bad" role="alert">
          {err.code === "already_voted"
            ? STRINGS.errors.alreadyVoted
            : err.code === "insufficient_points"
              ? "Not enough points for that stake."
              : err.code === "claim_not_open"
                ? "This claim is already resolved."
                : err.code === "rate_limited"
                  ? STRINGS.errors.rateLimited
                  : "Could not record the vote."}
        </p>
      )}

      <Button
        className={cn("w-full")}
        disabled={!stance || vote.isPending}
        onClick={() => vote.mutate()}
      >
        {vote.isPending ? "Voting…" : stance ? `Vote ${stance === "support" ? "true" : "false"}` : "Pick true or false"}
      </Button>
    </Card>
  );
}
