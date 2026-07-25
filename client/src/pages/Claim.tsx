/** Claim detail (§14.2). Voting panel, curve, waterfall land with the engine
 *  milestone; this page renders statement, verdict, evidence, AI placeholder. */
import { lazy, Suspense, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Plus, EyeOff } from "lucide-react";
import { STRINGS } from "@shared/strings";
import { apiPost, ApiError } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { VerdictBanner, type VerdictView } from "@/components/VerdictBanner";
import { EvidenceList, type EvidenceItem } from "@/components/EvidenceList";
import { VotePanel } from "@/components/VotePanel";
import { ScoreWaterfall } from "@/components/ScoreWaterfall";
// recharts is only needed once a claim actually has a posterior to draw.
const BetaCurve = lazy(() =>
  import("@/components/BetaCurve").then((m) => ({ default: m.BetaCurve })),
);
import { AiSignalCard, type AiSignal } from "@/components/AiSignalCard";
import { AnchorStatus, type AnchorView } from "@/components/AnchorStatus";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

type ClaimPayload = {
  blind: boolean;
  viewer: { tier: number; hasVoted: boolean } | null;
  claim: {
    id: string;
    subjectKind: string;
    subjectValue: string;
    subjectKey: string;
    statement: string;
    detail: string | null;
    status: string;
    voterCount: number;
    verdict: VerdictView | null;
    score: number | null;
    alpha: number | null;
    beta: number | null;
    ciLow: number | null;
    ciHigh: number | null;
    resolvedAt: string | null;
    anchorEpoch: number | null;
  };
  evidence: EvidenceItem[];
  aiSignal: AiSignal | null;
  anchor: AnchorView;
};

function EvidenceForm({ claimId }: { claimId: string }) {
  const [stance, setStance] = useState<"supports" | "refutes" | "context">("supports");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const add = useMutation({
    mutationFn: () =>
      apiPost(`/claims/${claimId}/evidence`, { stance, body, url: url || undefined }),
    onSuccess: () => {
      setBody("");
      setUrl("");
      queryClient.invalidateQueries({ queryKey: ["/claims", claimId] });
    },
  });
  const err = add.error as ApiError | null;

  return (
    <Card className="space-y-3">
      <h3 className="text-base font-semibold">Add evidence</h3>
      <div className="flex gap-2">
        {(["supports", "refutes", "context"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={stance === s ? "primary" : "secondary"}
            onClick={() => setStance(s)}
          >
            {s === "supports" ? "Supports" : s === "refutes" ? "Refutes" : "Context"}
          </Button>
        ))}
      </div>
      <Textarea
        rows={2}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What did you see? Plain words help."
        aria-label="Evidence"
      />
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Optional link (https://…)"
        aria-label="Evidence link"
        inputMode="url"
      />
      {err && (
        <p className="text-sm text-bad" role="alert">
          {err.status === 401 ? (
            <>
              {STRINGS.errors.notAuthenticated}{" "}
              <Link href="/join" className="underline">
                Join with an invite
              </Link>
            </>
          ) : err.code === "rate_limited" ? (
            STRINGS.errors.rateLimited
          ) : err.code === "claim_not_open" ? (
            "This claim is already resolved."
          ) : (
            "Could not add evidence. Links must start with https://"
          )}
        </p>
      )}
      <Button onClick={() => add.mutate()} disabled={body.trim().length < 3 || add.isPending}>
        <Plus className="h-5 w-5" aria-hidden />
        {add.isPending ? "Adding…" : "Add it"}
      </Button>
    </Card>
  );
}

export default function Claim() {
  const [, params] = useRoute("/c/:id");
  const id = params?.id ?? "";
  const { data, isLoading, error } = useQuery<ClaimPayload>({
    queryKey: ["/claims", id],
    enabled: !!id,
  });

  if (isLoading) return <main className="mx-auto max-w-3xl px-4 py-10">Loading…</main>;
  if (error || !data)
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-base text-muted-fg">This claim does not exist.</p>
      </main>
    );

  const { claim, evidence, aiSignal, anchor, blind, viewer } = data;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link href={`/s/${claim.subjectKey}`} className="inline-block">
        <Badge tone="brand" className="break-all">{claim.subjectValue}</Badge>
      </Link>

      <h1 className="text-3xl font-semibold leading-tight">{claim.statement}</h1>
      {claim.detail && <p className="text-base text-muted-fg">{claim.detail}</p>}

      {blind ? (
        // Blind until voted (§14.2): kills the copy-the-first-voter cascade.
        <Card className="flex items-center gap-4 border-2 p-5">
          <EyeOff className="h-8 w-8 shrink-0 text-muted-fg" aria-hidden />
          <p className="text-lg font-semibold text-muted-fg">{STRINGS.claim.voteFirst}</p>
        </Card>
      ) : (
        <>
          {claim.verdict && (
            <VerdictBanner
              verdict={claim.verdict}
              sub={STRINGS.claim.peopleChecked(claim.voterCount)}
            />
          )}
          {claim.alpha != null && claim.beta != null && claim.score != null && claim.voterCount > 0 && (
            <Suspense fallback={<div className="h-40" />}>
              <BetaCurve
                alpha={claim.alpha}
                beta={claim.beta}
                ciLow={claim.ciLow}
                ciHigh={claim.ciHigh}
                score={claim.score}
              />
            </Suspense>
          )}
        </>
      )}

      {claim.status === "open" && <VotePanel claimId={claim.id} viewer={viewer} />}

      {!blind && claim.voterCount > 0 && <ScoreWaterfall claimId={claim.id} />}

      {claim.status !== "open" && (
        <AnchorStatus anchor={anchor} claimId={claim.id} epoch={claim.anchorEpoch} />
      )}

      {aiSignal && <AiSignalCard signal={aiSignal} claimId={claim.id} />}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Evidence</h2>
        <EvidenceList items={evidence} />
        {claim.status === "open" && <EvidenceForm claimId={claim.id} />}
      </section>
    </main>
  );
}
