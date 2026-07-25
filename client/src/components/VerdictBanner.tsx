/** Layer-1 plain-language answer. I12: icon + text + colour, never colour
 *  alone; "not enough evidence" never renders as safe. */
import { ShieldCheck, ShieldAlert, Search, HelpCircle, Scale, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

export type VerdictView = {
  kind:
    | "likely_true"
    | "likely_false"
    | "leaning_true"
    | "leaning_false"
    | "not_enough_evidence"
    | "unresolved"
    | "removed";
  label: string;
  tone: "ok" | "bad" | "warn" | "muted" | "muted-warn";
};

const ICONS: Record<VerdictView["kind"], typeof ShieldCheck> = {
  likely_true: ShieldCheck,
  likely_false: ShieldAlert,
  leaning_true: Search,
  leaning_false: Search,
  not_enough_evidence: HelpCircle,
  unresolved: Scale,
  removed: Ban,
};

const TONE_TEXT: Record<VerdictView["tone"], string> = {
  ok: "text-ok",
  bad: "text-bad",
  warn: "text-warn",
  muted: "text-muted-fg",
  "muted-warn": "text-muted-fg",
};

const TONE_BORDER: Record<VerdictView["tone"], string> = {
  ok: "border-ok/40",
  bad: "border-bad/40",
  warn: "border-warn/50",
  muted: "border-border",
  "muted-warn": "border-warn/60", // warn border: unknown is not safe (I12)
};

export function VerdictBanner({
  verdict,
  sub,
  className,
}: {
  verdict: VerdictView;
  sub?: string;
  className?: string;
}) {
  const Icon = ICONS[verdict.kind];
  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-4 rounded-xl border-2 bg-card p-5",
        TONE_BORDER[verdict.tone],
        className,
      )}
    >
      <Icon className={cn("h-10 w-10 shrink-0", TONE_TEXT[verdict.tone])} aria-hidden />
      <div>
        <p className={cn("text-xl font-semibold", TONE_TEXT[verdict.tone])}>{verdict.label}</p>
        {sub && <p className="text-base text-muted-fg">{sub}</p>}
      </div>
    </div>
  );
}
