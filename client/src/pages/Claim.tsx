/** Claim detail (§14.2). Statement, verdict, the reasoning, the evidence.
 *
 *  Reading order is deliberate: the demo warning sits above everything, then
 *  the verdict, then how it was reached, then what people actually said. A
 *  reader who stops after the first screen must never have been misled. */
import { lazy, Suspense, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Plus, EyeOff, FlaskConical, ArrowLeft, X } from "lucide-react";
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
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea, FieldLabel } from "@/components/ui/input";
import { Segmented, Skeleton } from "@/components/ui/controls";
import { Reveal } from "@/components/fx";

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
    seeded: boolean;
  };
  evidence: EvidenceItem[];
  aiSignal: AiSignal | null;
  anchor: AnchorView;
};

function EvidenceForm({ claimId, onCancel }: { claimId: string; onCancel: () => void }) {
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
      onCancel();
    },
  });
  const err = add.error as ApiError | null;

  return (
    <Card pad="lg" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <CardTitle>Add evidence</CardTitle>
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Cancel">
          <X className="h-5 w-5" aria-hidden />
        </Button>
      </div>

      <Segmented
        label="Does this support or refute the claim?"
        value={stance}
        onChange={setStance}
        options={[
          { value: "supports", tone: "ok", label: "Supports" },
          { value: "refutes", tone: "bad", label: "Refutes" },
          { value: "context", tone: "brand", label: "Context" },
        ]}
      />

      <div className="space-y-2">
        <FieldLabel htmlFor="evidence-body">What did you see?</FieldLabel>
        <Textarea
          id="evidence-body"
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Plain words help."
        />
      </div>

      <div className="space-y-2">
        <FieldLabel htmlFor="evidence-url">Link (optional)</FieldLabel>
        <Input
          id="evidence-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          inputMode="url"
          className="font-mono text-sm"
        />
      </div>

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
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);

  const { data, isLoading, error } = useQuery<ClaimPayload>({
    queryKey: ["/claims", id],
    enabled: !!id,
  });

  if (isLoading)
    return (
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-10 sm:px-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </main>
    );

  if (error || !data)
    return (
      <main className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
        <p className="text-lg text-muted-fg">This claim does not exist.</p>
        <Link href="/">
          <Button variant="secondary" className="mt-4">
            <ArrowLeft className="h-5 w-5" aria-hidden /> Back to search
          </Button>
        </Link>
      </main>
    );

  const { claim, evidence, aiSignal, anchor, blind, viewer } = data;

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      {/* ------------------------------------------------------- Statement */}
      <Reveal distance={12} className="space-y-4">
        <Link href={`/s/${claim.subjectKey}`} className="inline-flex">
          <Badge tone="brand" className="max-w-full font-mono">
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">{claim.subjectValue}</span>
          </Badge>
        </Link>

        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          {claim.statement}
        </h1>
        {claim.detail && (
          <p className="text-lg leading-relaxed text-muted-fg">{claim.detail}</p>
        )}
      </Reveal>

      {/* Above the verdict, deliberately. A reader who stops after the banner
          must still have been told this verdict was not produced by the public. */}
      {claim.seeded && (
        <Card pad="lg" className="flex items-start gap-4 border-2 border-warn bg-warn/[0.04]">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-warn/15">
            <FlaskConical className="h-6 w-6 text-warn" aria-hidden />
          </span>
          <div className="space-y-1">
            <p className="text-lg font-semibold text-warn">{STRINGS.claim.demoTitle}</p>
            <p className="text-base leading-relaxed text-muted-fg">{STRINGS.claim.demoBody}</p>
          </div>
        </Card>
      )}

      {/* --------------------------------------------------------- Verdict */}
      {blind ? (
        // Blind until voted (§14.2): kills the copy-the-first-voter cascade.
        <Card
          pad="lg"
          className="relative flex items-center gap-4 overflow-hidden border-dashed border-border-hi"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/[0.06] to-transparent"
            aria-hidden
          />
          <span className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-muted">
            <EyeOff className="h-7 w-7 text-muted-fg" aria-hidden />
          </span>
          <div className="relative">
            <p className="text-lg font-semibold text-fg">{STRINGS.claim.voteFirst}</p>
            <p className="mt-0.5 text-sm text-muted-fg">
              Seeing the tally first would just make you copy it.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-5">
          {claim.verdict && (
            <VerdictBanner
              verdict={claim.verdict}
              sub={STRINGS.claim.peopleChecked(claim.voterCount)}
            />
          )}
          {claim.alpha != null &&
            claim.beta != null &&
            claim.score != null &&
            claim.voterCount > 0 && (
              <Suspense fallback={<Skeleton className="h-64 w-full rounded-2xl" />}>
                <BetaCurve
                  alpha={claim.alpha}
                  beta={claim.beta}
                  ciLow={claim.ciLow}
                  ciHigh={claim.ciHigh}
                  score={claim.score}
                />
              </Suspense>
            )}
        </div>
      )}

      {/* ------------------------------------------------------------ Vote */}
      {claim.status === "open" && <VotePanel claimId={claim.id} viewer={viewer} />}

      {/* ------------------------------------------------------ Reasoning */}
      {!blind && claim.voterCount > 0 && <ScoreWaterfall claimId={claim.id} />}

      {claim.status !== "open" && (
        <AnchorStatus anchor={anchor} claimId={claim.id} epoch={claim.anchorEpoch} />
      )}

      {aiSignal && <AiSignalCard signal={aiSignal} claimId={claim.id} />}

      {/* -------------------------------------------------------- Evidence */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold tracking-tight">Evidence</h2>
          {claim.status === "open" && !showEvidenceForm && (
            <Button variant="secondary" size="sm" onClick={() => setShowEvidenceForm(true)}>
              <Plus className="h-4 w-4" aria-hidden /> Add evidence
            </Button>
          )}
        </div>

        {showEvidenceForm && claim.status === "open" && (
          <EvidenceForm claimId={claim.id} onCancel={() => setShowEvidenceForm(false)} />
        )}

        <EvidenceList items={evidence} />
      </section>
    </main>
  );
}
