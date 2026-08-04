/** The controls the redesign needs that the project did not have: a segmented
 *  choice, a range slider with a filled track, a progress bar, a skeleton and
 *  a copy button. All 21st.dev-flavoured — cva where it earns it, `cn()`
 *  everywhere, native elements underneath so keyboard and AT behaviour is the
 *  browser's rather than ours. */
import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ Segmented */

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  /** Tints the selected pill — used so "False" is never brand-violet. */
  tone?: "brand" | "ok" | "bad";
};

const SEG_TONE = {
  brand: "bg-brand text-white",
  ok: "bg-ok text-white",
  bad: "bg-bad text-white",
} as const;

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  label,
}: {
  options: SegmentedOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("grid gap-1 rounded-xl border border-border bg-bg-soft p-1", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-all duration-200",
              selected
                ? cn(SEG_TONE[o.tone ?? "brand"], "shadow-sm")
                : "text-muted-fg hover:bg-card-hi hover:text-fg",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------------- Slider */

/** A native range whose track is filled up to the thumb. The fill is a
 *  gradient painted on the input's own background, so there is no second
 *  element to keep in sync and the control stays fully keyboard-native. */
export function Slider({
  className,
  tone = "brand",
  min = 0,
  max = 100,
  value,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { tone?: "brand" | "ok" | "bad" }) {
  const pct =
    ((Number(value) - Number(min)) / Math.max(1e-9, Number(max) - Number(min))) * 100;
  const color =
    tone === "ok" ? "var(--ok)" : tone === "bad" ? "var(--bad)" : "var(--brand)";

  return (
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      className={cn(
        "h-11 w-full cursor-pointer appearance-none bg-transparent",
        // Track
        "[&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full",
        "[&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-transparent",
        // Thumb
        "[&::-webkit-slider-thumb]:mt-[-6px] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-bg [&::-webkit-slider-thumb]:bg-fg [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform hover:[&::-webkit-slider-thumb]:scale-110",
        "[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-bg [&::-moz-range-thumb]:bg-fg",
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(to right, hsl(${color}) 0%, hsl(${color}) ${pct}%, hsl(var(--border)) ${pct}%, hsl(var(--border)) 100%)`,
        backgroundSize: "100% 8px",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        borderRadius: "999px",
      }}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------- Progress */

export function Progress({
  value,
  tone = "brand",
  className,
  label,
}: {
  /** 0–1 */
  value: number;
  tone?: "brand" | "ok" | "bad" | "warn";
  className?: string;
  label?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const bar =
    tone === "ok" ? "bg-ok" : tone === "bad" ? "bg-bad" : tone === "warn" ? "bg-warn" : "bg-brand";

  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-700 ease-out", bar)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------- Skeleton */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-lg bg-muted",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer after:bg-gradient-to-r after:from-transparent after:via-fg/[0.06] after:to-transparent",
        className,
      )}
    />
  );
}

/* ----------------------------------------------------------------- CopyButton */

export function CopyButton({
  text,
  className,
  label = "Copy",
}: {
  text: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          /* clipboard blocked — the value is on screen and selectable */
        }
      }}
      className={cn(
        "inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm text-muted-fg transition-colors hover:border-border-hi hover:text-fg",
        className,
      )}
    >
      {copied ? (
        <Check className="h-4 w-4 text-ok" aria-hidden />
      ) : (
        <Copy className="h-4 w-4" aria-hidden />
      )}
      {copied ? "Copied" : label}
    </button>
  );
}
