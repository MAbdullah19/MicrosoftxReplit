/** Subject page — the canonical shareable page (§14.2).
 *  One verdict at the top, loud and tone-glowed, then what to do about it,
 *  then everything that has been reported about this subject. */
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useSearch, Link } from "wouter";
import { Link2, Phone, Type, Plus, FileSearch, HelpCircle, ShieldCheck, X } from "lucide-react";
import { STRINGS } from "@shared/strings";
import { apiPost, ApiError } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { VerdictBanner } from "@/components/VerdictBanner";
import { ClaimCard, relativeTime, TONE_TEXT, type ClaimSummary } from "@/components/ClaimCard";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea, FieldLabel } from "@/components/ui/input";
import { Skeleton, CopyButton } from "@/components/ui/controls";
import { Reveal } from "@/components/fx";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<string, typeof Link2> = { url: Link2, phone: Phone, text: Type };
const KIND_LABEL: Record<string, string> = {
  url: "Link",
  phone: "Phone number",
  text: "Claim",
};

type SubjectPayload = {
  subject: { kind: string; value: string; key: string } | null;
  claims: ClaimSummary[];
};

function ClaimForm({
  subjectKind,
  subjectValue,
  subjectKeyStr,
  onDone,
  onCancel,
}: {
  subjectKind: string;
  subjectValue: string;
  subjectKeyStr: string;
  onDone: () => void;
  onCancel: () => void;
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
  const tooShort = statement.trim().length < 10;

  return (
    <Card pad="lg" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardTitle>
            Report this{" "}
            {subjectKind === "text" ? "claim" : subjectKind === "phone" ? "number" : "link"}
          </CardTitle>
          <p className="mt-1 text-sm text-muted-fg">
            Say what people are claiming, in plain words. Others will check it.
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Cancel">
          <X className="h-5 w-5" aria-hidden />
        </Button>
      </div>

      <div className="space-y-2">
        <FieldLabel htmlFor="statement">What is being claimed?</FieldLabel>
        <Textarea
          id="statement"
          rows={3}
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          placeholder='e.g. "This site pretends to be a bank login page."'
        />
        <p className={cn("text-xs", tooShort && statement ? "text-warn" : "text-muted-fg")}>
          {statement.trim().length}/10 characters minimum
        </p>
      </div>

      <div className="space-y-2">
        <FieldLabel htmlFor="detail">Detail (optional)</FieldLabel>
        <Input
          id="detail"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          placeholder="Where you saw it, what happened"
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
          ) : (
            "Could not create the report. Statements need at least 10 characters."
          )}
        </p>
      )}

      <Button onClick={() => create.mutate()} disabled={tooShort || create.isPending}>
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

  if (isLoading) {
    return (
      <main className="mx-auto max-w-4xl space-y-5 px-4 py-10 sm:px-6">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-11 w-80" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </main>
    );
  }

  const subject =
    data?.subject ?? (fallback.value ? { kind: fallback.kind, value: fallback.value, key } : null);
  const claimList = data?.claims ?? [];
  const primary = claimList[0];
  const resolved = claimList.filter((c) => c.resolvedAt);
  const KindIcon = KIND_ICON[subject?.kind ?? "text"] ?? Type;
  const totalCheckers = claimList.reduce((a, c) => a + c.voterCount, 0);

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-10 sm:px-6">
      {/* -------------------------------------------------- Subject identity */}
      {subject && (
        <Reveal distance={12} className="space-y-3">
          <Badge tone="brand">
            <KindIcon className="h-3.5 w-3.5" aria-hidden />
            {KIND_LABEL[subject.kind] ?? "Claim"}
          </Badge>
          <div className="flex items-start gap-3">
            <h1 className="min-w-0 flex-1 break-all font-mono text-xl leading-snug text-fg sm:text-2xl">
              {subject.value}
            </h1>
            <CopyButton text={subject.value} className="mt-1 shrink-0" />
          </div>
        </Reveal>
      )}

      {/* ------------------------------------------------------- The verdict */}
      <Reveal distance={16} delay={0.05}>
        {primary ? (
          <VerdictBanner
            hero
            verdict={primary.verdict}
            sub={STRINGS.claim.peopleChecked(totalCheckers)}
          />
        ) : (
          <VerdictBanner
            hero
            verdict={{
              kind: "not_enough_evidence",
              label: STRINGS.verdict.notEnoughEvidence,
              tone: subject?.kind === "text" ? "muted" : "muted-warn",
            }}
            sub="Nobody has reported this yet."
          />
        )}
      </Reveal>

      {/* -------------------------------------------------------- Next steps */}
      {primary && (
        <Reveal distance={12} delay={0.1} className="flex flex-wrap gap-2">
          <Link href={`/c/${primary.id}`}>
            <Button variant="secondary">
              <FileSearch className="h-5 w-5" aria-hidden /> See the evidence
            </Button>
          </Link>
          <Link href={`/c/${primary.id}`}>
            <Button variant="secondary">
              <HelpCircle className="h-5 w-5" aria-hidden /> How was this decided?
            </Button>
          </Link>
          <Link href={`/verify?claim=${primary.id}`}>
            <Button variant="secondary">
              <ShieldCheck className="h-5 w-5" aria-hidden /> Verify it yourself
            </Button>
          </Link>
        </Reveal>
      )}

      {/* ----------------------------------------------------------- Reports */}
      {primary && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Reports about this subject</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {claimList.map((c, i) => (
              <Reveal key={c.id} distance={12} delay={i * 0.04}>
                <ClaimCard claim={c} />
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* --------------------------------------------------- Verdict history */}
      {resolved.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Verdict history</h2>
          <ol className="relative space-y-4 border-l border-border pl-6">
            {resolved.map((c) => (
              <li key={c.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-bg",
                    c.verdict.tone === "ok"
                      ? "bg-ok"
                      : c.verdict.tone === "bad"
                        ? "bg-bad"
                        : "bg-muted-fg",
                  )}
                  aria-hidden
                />
                <Link href={`/c/${c.id}`} className="group block">
                  <p
                    className={cn(
                      "text-base font-medium group-hover:underline",
                      TONE_TEXT[c.verdict.tone],
                    )}
                  >
                    {c.verdict.label}
                  </p>
                  <p className="text-sm text-muted-fg">{relativeTime(c.resolvedAt)}</p>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ------------------------------------------------------- Add a report */}
      {subject &&
        (showForm ? (
          <ClaimForm
            subjectKind={subject.kind}
            subjectValue={subject.value}
            subjectKeyStr={key}
            onDone={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        ) : (
          <Button
            variant={primary ? "secondary" : "primary"}
            size={primary ? "md" : "lg"}
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-5 w-5" aria-hidden />
            {primary ? "Add a report" : STRINGS.home.beFirst}
          </Button>
        ))}
    </main>
  );
}
