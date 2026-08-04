/** Layer-1 plain-language answer. I12: icon + text + colour, never colour
 *  alone; "not enough evidence" never renders as safe.
 *
 *  The `hero` variant wraps the banner in Aceternity's Background Gradient,
 *  tinted by verdict tone — it is the single loudest object on a subject page,
 *  and the tone-driven glow is what makes a scam verdict read as a scam from
 *  across the room. */
import { ShieldCheck, ShieldAlert, Search, HelpCircle, Scale, Ban } from "lucide-react";
import { BackgroundGradient, GlowingEffect } from "@/components/fx";
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

const TONE_HALO: Record<VerdictView["tone"], string> = {
  ok: "bg-ok/10",
  bad: "bg-bad/10",
  warn: "bg-warn/10",
  muted: "bg-muted",
  "muted-warn": "bg-warn/10",
};

/** BackgroundGradient/GlowingEffect only accept the four real tones; the two
 *  muted verdicts borrow `warn`, because unknown must never bloom brand. */
function glowTone(tone: VerdictView["tone"]): "brand" | "ok" | "bad" | "warn" {
  if (tone === "ok" || tone === "bad" || tone === "warn") return tone;
  return "warn";
}

export function VerdictBanner({
  verdict,
  sub,
  hero = false,
  className,
}: {
  verdict: VerdictView;
  sub?: string;
  /** Full-bleed treatment for the top of a subject page. */
  hero?: boolean;
  className?: string;
}) {
  const Icon = ICONS[verdict.kind];

  const inner = (
    <div
      role="status"
      className={cn(
        "relative flex items-center gap-4 overflow-hidden rounded-2xl border bg-card p-5 sm:gap-5 sm:p-6",
        TONE_BORDER[verdict.tone],
        className,
      )}
    >
      {!hero && <GlowingEffect tone={glowTone(verdict.tone)} spread={40} borderWidth={2} />}
      <span
        className={cn(
          "relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl sm:h-16 sm:w-16",
          TONE_HALO[verdict.tone],
        )}
      >
        <Icon className={cn("h-8 w-8 sm:h-9 sm:w-9", TONE_TEXT[verdict.tone])} aria-hidden />
      </span>
      <div className="relative min-w-0">
        <p
          className={cn(
            "text-xl font-semibold tracking-tight sm:text-2xl",
            TONE_TEXT[verdict.tone],
          )}
        >
          {verdict.label}
        </p>
        {sub && <p className="mt-1 text-base text-muted-fg">{sub}</p>}
      </div>
    </div>
  );

  if (!hero) return inner;

  return (
    <BackgroundGradient tone={glowTone(verdict.tone)} containerClassName="rounded-3xl">
      <div className="rounded-[calc(1.75rem-2px)] bg-bg p-1">{inner}</div>
    </BackgroundGradient>
  );
}
