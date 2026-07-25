/** Compact claim card: verdict icon + subject + statement + relative time. */
import { Link } from "wouter";
import { ShieldCheck, ShieldAlert, Search, HelpCircle, Scale, Ban } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { VerdictView } from "@/components/VerdictBanner";

export type ClaimSummary = {
  id: string;
  subjectKind: string;
  subjectValue: string;
  subjectKey: string;
  statement: string;
  status: string;
  voterCount: number;
  verdict: VerdictView;
  resolvedAt: string | null;
  createdAt: string;
};

const ICONS: Record<string, typeof ShieldCheck> = {
  likely_true: ShieldCheck,
  likely_false: ShieldAlert,
  leaning_true: Search,
  leaning_false: Search,
  not_enough_evidence: HelpCircle,
  unresolved: Scale,
  removed: Ban,
};

const TONE: Record<string, string> = {
  ok: "text-ok",
  bad: "text-bad",
  warn: "text-warn",
  muted: "text-muted-fg",
  "muted-warn": "text-muted-fg",
};

export function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return "just now";
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

export function ClaimCard({ claim }: { claim: ClaimSummary }) {
  const Icon = ICONS[claim.verdict.kind] ?? HelpCircle;
  return (
    <Link href={`/c/${claim.id}`}>
      <Card className="flex cursor-pointer items-start gap-3 transition-colors hover:bg-muted">
        <Icon className={cn("mt-1 h-6 w-6 shrink-0", TONE[claim.verdict.tone])} aria-hidden />
        <div className="min-w-0">
          <p className={cn("text-sm font-medium", TONE[claim.verdict.tone])}>
            {claim.verdict.label}
          </p>
          <p className="truncate text-sm text-muted-fg">{claim.subjectValue}</p>
          <p className="line-clamp-2 text-base">{claim.statement}</p>
          <p className="mt-1 text-sm text-muted-fg">
            {relativeTime(claim.resolvedAt ?? claim.createdAt)}
          </p>
        </div>
      </Card>
    </Link>
  );
}
