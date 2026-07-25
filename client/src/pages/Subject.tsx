/** Subject page — the canonical shareable page (§14.2). */
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useSearch, Link } from "wouter";
import { Link2, Phone, Type, Plus } from "lucide-react";
import { STRINGS } from "@shared/strings";
import { apiPost, ApiError } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { VerdictBanner } from "@/components/VerdictBanner";
import { ClaimCard, relativeTime, type ClaimSummary } from "@/components/ClaimCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

const KIND_ICON: Record<string, typeof Link2> = { url: Link2, phone: Phone, text: Type };

type SubjectPayload = {
  subject: { kind: string; value: string; key: string } | null;
  claims: ClaimSummary[];
};

function ClaimForm({
  subjectKind,
  subjectValue,
  subjectKeyStr,
  onDone,
}: {
  subjectKind: string;
  subjectValue: string;
  subjectKeyStr: string;
  onDone: () => void;
}) {
  const [statement, setStatement] = useState("");
  const [detail, setDetail] = useState("");
  const create = useMutation({
    mutationFn: () =>
      apiPost<{ id: string }>("/claims", {
        subjectKind,
        subjectValue,
        statement,
        detail: detail || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/subjects", subjectKeyStr] });
      onDone();
    },
  });
  const err = create.error as ApiError | null;

  return (
    <Card className="space-y-3">
      <h3 className="text-base font-semibold">Report this {subjectKind === "text" ? "claim" : subjectKind === "phone" ? "phone number" : "link"}</h3>
      <Textarea
        rows={2}
        value={statement}
        onChange={(e) => setStatement(e.target.value)}
        placeholder='What are people saying? e.g. "This site pretends to be a bank login page."'
        aria-label="Statement"
      />
      <Input
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="Optional detail — where you saw it, what happened"
        aria-label="Detail"
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
          ) : (
            "Could not create the report. Statements need at least 10 characters."
          )}
        </p>
      )}
      <Button
        onClick={() => create.mutate()}
        disabled={statement.trim().length < 10 || create.isPending}
      >
        {create.isPending ? "Reporting…" : "Report it"}
      </Button>
    </Card>
  );
}

export default function Subject() {
  const [, params] = useRoute("/s/:subjectKey");
  const search = useSearch();
  const key = params?.subjectKey ?? "";
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading } = useQuery<SubjectPayload>({
    queryKey: ["/subjects", key],
    enabled: !!key,
  });

  // When no claims exist yet, the subject value/kind come from the search box.
  const fallback = useMemo(() => {
    const sp = new URLSearchParams(search);
    return { kind: sp.get("kind") ?? "text", value: sp.get("q") ?? "" };
  }, [search]);

  if (isLoading) return <main className="mx-auto max-w-3xl px-4 py-10">Loading…</main>;

  const subject = data?.subject ?? (fallback.value ? { kind: fallback.kind, value: fallback.value, key } : null);
  const claimList = data?.claims ?? [];
  const primary = claimList[0];
  const resolved = claimList.filter((c) => c.resolvedAt);
  const KindIcon = KIND_ICON[subject?.kind ?? "text"] ?? Type;
  const totalCheckers = claimList.reduce((a, c) => a + c.voterCount, 0);

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      {subject && (
        <div className="flex items-center gap-2">
          <Badge tone="brand">
            <KindIcon className="h-4 w-4" aria-hidden />
            {subject.kind === "url" ? "Link" : subject.kind === "phone" ? "Phone number" : "Claim"}
          </Badge>
          <span className="tabular break-all text-base font-medium">{subject.value}</span>
        </div>
      )}

      {primary ? (
        <>
          <VerdictBanner
            verdict={primary.verdict}
            sub={STRINGS.claim.peopleChecked(totalCheckers)}
          />
          <div className="flex flex-wrap gap-2">
            <Link href={`/c/${primary.id}`}>
              <Button variant="secondary">See the evidence</Button>
            </Link>
            <Link href={`/c/${primary.id}`}>
              <Button variant="secondary">How was this decided?</Button>
            </Link>
            <Link href={`/verify?claim=${primary.id}`}>
              <Button variant="secondary">Verify it yourself</Button>
            </Link>
          </div>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Reports about this subject</h2>
            <div className="grid gap-3">
              {claimList.map((c) => (
                <ClaimCard key={c.id} claim={c} />
              ))}
            </div>
          </section>

          {resolved.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xl font-semibold">Verdict history</h2>
              <ul className="space-y-1 text-base text-muted-fg">
                {resolved.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <span>{c.verdict.label}</span>
                    <span>·</span>
                    <span>{relativeTime(c.resolvedAt)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      ) : (
        <VerdictBanner
          verdict={{
            kind: "not_enough_evidence",
            label: STRINGS.verdict.notEnoughEvidence,
            tone: subject?.kind === "text" ? "muted" : "muted-warn",
          }}
          sub="Nobody has reported this yet."
        />
      )}

      {subject &&
        (showForm ? (
          <ClaimForm
            subjectKind={subject.kind}
            subjectValue={subject.value}
            subjectKeyStr={key}
            onDone={() => setShowForm(false)}
          />
        ) : (
          <Button variant={primary ? "secondary" : "primary"} onClick={() => setShowForm(true)}>
            <Plus className="h-5 w-5" aria-hidden />
            {primary ? "Add a report" : STRINGS.home.beFirst}
          </Button>
        ))}
    </main>
  );
}
