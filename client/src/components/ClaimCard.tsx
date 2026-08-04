/** Compact claim card: verdict icon + subject + statement + relative time.
 *  Built on React Bits' Spotlight Card so the whole grid lights under the
 *  cursor; the verdict tone drives the spotlight colour, which means a scam
 *  card glows red and a verified one green (I12 — colour reinforces, never
 *  carries alone). */
import { Link } from "wouter";
import { ShieldCheck, ShieldAlert, Search, HelpCircle, Scale, Ban, ArrowUpRight } from "lucide-react";
import { SpotlightCard } from "@/components/fx";
import { Badge } from "@/components/ui/badge";
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
  seeded: boolean;
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

export const TONE_TEXT: Record<string, string> = {
  ok: "text-ok",
  bad: "text-bad",
  warn: "text-warn",
  muted: "text-muted-fg",
  "muted-warn": "text-muted-fg",
};

const TONE_SPOT: Record<string, string> = {
  ok: "hsl(var(--ok) / 0.16)",
  bad: "hsl(var(--bad) / 0.16)",
  warn: "hsl(var(--warn) / 0.16)",
  muted: "hsl(var(--brand) / 0.12)",
  "muted-warn": "hsl(var(--warn) / 0.12)",
};

const TONE_CHIP: Record<string, string> = {
  ok: "bg-ok/10 text-ok",
  bad: "bg-bad/10 text-bad",
  warn: "bg-warn/10 text-warn",
  muted: "bg-muted text-muted-fg",
  "muted-warn": "bg-muted text-muted-fg",
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
  const tone = claim.verdict.tone;

  return (
    <Link href={`/c/${claim.id}`} className="group block h-full">
      <SpotlightCard
        spotlightColor={TONE_SPOT[tone]}
        className="h-full p-5 group-hover:border-border-hi"
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
              TONE_CHIP[tone],
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className={cn("text-sm font-semibold", TONE_TEXT[tone])}>
                {claim.verdict.label}
              </p>
              {claim.seeded && (
                <Badge tone="warn" size="sm">
                  demo
                </Badge>
              )}
            </div>

            <p className="mt-2 line-clamp-2 text-base leading-snug text-fg">{claim.statement}</p>

            <p className="mt-2 truncate font-mono text-xs text-muted-fg">{claim.subjectValue}</p>

            <div className="mt-3 flex items-center gap-2 text-xs text-muted-fg">
              <span className="tabular">
                {claim.voterCount} {claim.voterCount === 1 ? "check" : "checks"}
              </span>
              <span aria-hidden>·</span>
              <span>{relativeTime(claim.resolvedAt ?? claim.createdAt)}</span>
            </div>
          </div>

          <ArrowUpRight
            className="h-4 w-4 shrink-0 text-muted-fg opacity-0 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:opacity-100"
            aria-hidden
          />
        </div>
      </SpotlightCard>
    </Link>
  );
}
