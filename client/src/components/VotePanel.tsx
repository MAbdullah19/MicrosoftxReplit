/** Cast a weighted vote: stance, confidence slider, stake (§14.2).
 *
 *  The redesign makes the two things a voter has to understand visible while
 *  they choose: the stance control is a real segmented radio (green true / red
 *  false, matching verdict semantics), and the sliders show what the number
 *  means as you drag rather than only after you submit. */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "motion/react";
import { ThumbsUp, ThumbsDown, Coins, Gauge, LockKeyhole, Ticket } from "lucide-react";
import { STRINGS } from "@shared/strings";
import { SCORING } from "@shared/config";
import { apiPost, ApiError } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Segmented, Slider } from "@/components/ui/controls";
import { GlowingEffect } from "@/components/fx";
import { cn } from "@/lib/utils";

/** Plain-language reading of the confidence number, so the slider is not just
 *  a percentage floating in space. */
function confidenceWords(c: number): string {
  if (c <= 0.55) return "Barely leaning — this is close to a coin flip.";
  if (c <= 0.7) return "Fairly sure, but you would not be shocked to be wrong.";
  if (c <= 0.85) return "Confident. You would bet on this.";
  return "Near certain. Being wrong here costs you a lot.";
}

function Gate({ icon: Icon, children }: { icon: typeof LockKeyhole; children: React.ReactNode }) {
  return (
    <Card className="flex items-center gap-3 text-base text-muted-fg">
      <Icon className="h-5 w-5 shrink-0 text-muted-fg" aria-hidden />
      <span>{children}</span>
    </Card>
  );
}

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
      <Gate icon={LockKeyhole}>
        <Link href="/join" className="text-brand underline-offset-2 hover:underline">
          Join with an invite
        </Link>{" "}
        to vote on this claim.
      </Gate>
    );
  if (viewer.tier < 2) return <Gate icon={Ticket}>{STRINGS.errors.tierRequired}</Gate>;
  if (viewer.hasVoted)
    return (
      <Card className="flex items-center gap-3 border-ok/40 bg-ok/5 text-base">
        <ThumbsUp className="h-5 w-5 shrink-0 text-ok" aria-hidden />
        <span className="text-fg">Your vote is in — the tally below now includes it.</span>
      </Card>
    );

  return (
    <Card pad="lg" className="relative space-y-6">
      <GlowingEffect spread={40} borderWidth={2} />

      <div className="relative">
        <CardTitle>Cast your vote</CardTitle>
        <p className="mt-1 text-sm text-muted-fg">
          Blind until you vote — you will see the tally the moment you commit.
        </p>
      </div>

      <div className="relative space-y-2">
        <Segmented
          label="Is this claim true?"
          value={stance}
          onChange={setStance}
          options={[
            {
              value: "support",
              tone: "ok",
              label: (
                <>
                  <ThumbsUp className="h-4 w-4" aria-hidden /> True
                </>
              ),
            },
            {
              value: "refute",
              tone: "bad",
              label: (
                <>
                  <ThumbsDown className="h-4 w-4" aria-hidden /> False
                </>
              ),
            },
          ]}
        />
      </div>

      <div className="relative space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-fg">
            <Gauge className="h-4 w-4" aria-hidden /> How sure are you?
          </span>
          <span className="tabular text-base font-semibold text-fg">
            {Math.round(confidence * 100)}%
          </span>
        </div>
        <Slider
          tone={stance === "refute" ? "bad" : stance === "support" ? "ok" : "brand"}
          min={SCORING.CONFIDENCE_MIN * 100}
          max={SCORING.CONFIDENCE_MAX * 100}
          step={5}
          value={confidence * 100}
          onChange={(e) => setConfidence(Number(e.target.value) / 100)}
          aria-label="Confidence"
        />
        <motion.p
          key={confidenceWords(confidence)}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-muted-fg"
        >
          {confidenceWords(confidence)}
        </motion.p>
      </div>

      <div className="relative space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 text-muted-fg">
            <Coins className="h-4 w-4" aria-hidden /> Points to stake
          </span>
          <span className="tabular text-base font-semibold text-fg">{stake}</span>
        </div>
        <Slider
          min={SCORING.STAKE_MIN}
          max={SCORING.STAKE_MAX}
          step={1}
          value={stake}
          onChange={(e) => setStake(Number(e.target.value))}
          aria-label="Stake"
        />
        <p className="text-sm text-muted-fg">
          Staking more raises your weight on this claim — and your loss if you are wrong.
        </p>
      </div>

      <p className="relative rounded-xl border border-border bg-bg-soft p-3 text-sm leading-relaxed text-muted-fg">
        Honesty pays. Your reputation is graded on calibration, not on agreeing with the crowd —
        hedging at 50% is exactly break-even, and that is a theorem, not a house rule.
      </p>

      {err && (
        <p className="relative text-sm text-bad" role="alert">
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
        className={cn("relative w-full")}
        variant={stance === "refute" ? "danger" : "primary"}
        size="lg"
        disabled={!stance || vote.isPending}
        onClick={() => vote.mutate()}
      >
        {vote.isPending
          ? "Voting…"
          : stance
            ? `Vote ${stance === "support" ? "true" : "false"} at ${Math.round(confidence * 100)}%`
            : "Pick true or false"}
      </Button>
    </Card>
  );
}
