/** Claim detail (§14.2). Voting panel, curve, waterfall land with the engine
 *  milestone; this page renders statement, verdict, evidence, AI placeholder. */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Bot, Anchor, Plus } from "lucide-react";
import { STRINGS } from "@shared/strings";
import { apiPost, ApiError } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { VerdictBanner, type VerdictView } from "@/components/VerdictBanner";
import { EvidenceList, type EvidenceItem } from "@/components/EvidenceList";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

type ClaimPayload = {
  claim: {
    id: string;
    subjectKind: string;
    subjectValue: string;
    subjectKey: string;
    statement: string;
    detail: string | null;
    status: string;
    voterCount: number;
    verdict: VerdictView;
    score: number;
    ciLow: number | null;
    ciHigh: number | null;
    resolvedAt: string | null;
    anchorEpoch: number | null;
  };
  evidence: EvidenceItem[];
  aiSignal: {
    verdictHint: string;
    confidence: number;
    rationale: string;
    weightContributed: number;
    model: string;
  } | null;
  anchor: { status: string; txHash: string | null } | null;
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

  const { claim, evidence, aiSignal, anchor } = data;

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <Link href={`/s/${claim.subjectKey}`} className="inline-block">
        <Badge tone="brand" className="break-all">{claim.subjectValue}</Badge>
      </Link>

      <h1 className="text-3xl font-semibold leading-tight">{claim.statement}</h1>
      {claim.detail && <p className="text-base text-muted-fg">{claim.detail}</p>}

      <VerdictBanner
        verdict={claim.verdict}
        sub={STRINGS.claim.peopleChecked(claim.voterCount)}
      />

      {anchor && (
        <Card className="flex items-center gap-3">
          <Anchor className="h-6 w-6 text-brand" aria-hidden />
          <div className="text-base">
            {anchor.status === "confirmed" ? (
              <>Anchored on-chain. <Link href={`/verify?claim=${claim.id}`} className="text-brand underline-offset-2 hover:underline">Verify it yourself</Link></>
            ) : (
              STRINGS.verify.localOnly
            )}
          </div>
        </Card>
      )}

      {aiSignal && (
        <Card className="space-y-2">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-muted-fg" aria-hidden />
            <span className="text-base font-semibold">AI signal</span>
            <Badge tone="muted">capped at 15%</Badge>
          </div>
          <p className="text-base text-muted-fg">{aiSignal.rationale}</p>
        </Card>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Evidence</h2>
        <EvidenceList items={evidence} />
        {claim.status === "open" && <EvidenceForm claimId={claim.id} />}
      </section>
    </main>
  );
}
