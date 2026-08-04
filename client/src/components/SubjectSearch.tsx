/** Landing search box: detect kind → editable chip → navigate to /s/:key.
 *  The primary object on the home page, so it gets the weight: a glowing
 *  focus ring, a magnetised submit, and the detected-kind chips animating in
 *  underneath rather than jumping the layout. */
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { AnimatePresence, motion } from "motion/react";
import { SearchIcon, Link2, Phone, Type, CornerDownLeft } from "lucide-react";
import { detectKind, subjectKey, type SubjectKind } from "@shared/subject";
import { STRINGS } from "@shared/strings";
import { Magnet } from "@/components/fx";
import { cn } from "@/lib/utils";

const KIND_META: Record<SubjectKind, { label: string; icon: typeof Link2 }> = {
  url: { label: "Link", icon: Link2 },
  phone: { label: "Phone number", icon: Phone },
  text: { label: "Claim", icon: Type },
};

export function SubjectSearch({ large = false }: { large?: boolean }) {
  const [, navigate] = useLocation();
  const [q, setQ] = useState("");
  const [kindOverride, setKindOverride] = useState<SubjectKind | null>(null);
  const [focused, setFocused] = useState(false);

  const detected = useMemo(() => (q.trim() ? detectKind(q) : null), [q]);
  const kind = kindOverride ?? detected;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim() || !kind) return;
    navigate(`/s/${subjectKey(kind, q)}?kind=${kind}&q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <form onSubmit={submit} className="w-full max-w-2xl space-y-4">
      <div className="relative">
        {/* Focus bloom. Sits behind the field, so it reads as the field
            lighting up rather than as a second border. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -inset-1 rounded-[1.4rem] bg-gradient-to-r from-brand/40 via-brand-2/30 to-brand/40 opacity-0 blur-lg transition-opacity duration-500",
            focused && "opacity-100",
          )}
        />
        <div
          className={cn(
            "relative flex items-center gap-2 rounded-2xl border border-border bg-card p-2 shadow-card transition-colors duration-300",
            focused && "border-brand/60",
          )}
        >
          <SearchIcon
            className="ml-2 h-5 w-5 shrink-0 text-muted-fg"
            aria-hidden
          />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setKindOverride(null);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={STRINGS.searchPlaceholder}
            aria-label={STRINGS.searchPlaceholder}
            className={cn(
              "min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-muted-fg",
              large ? "min-h-[52px] sm:text-lg" : "min-h-[44px]",
            )}
          />
          <Magnet padding={60} magnetStrength={6} disabled={!large}>
            <button
              type="submit"
              aria-label="Check"
              className={cn(
                "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-brand to-[hsl(var(--brand)/0.82)] px-4 font-medium text-white shadow-[0_1px_0_0_hsl(0_0%_100%/0.2)_inset,0_6px_20px_-8px_hsl(var(--brand)/0.8)] transition-[filter,transform] duration-200 hover:brightness-110 active:scale-[0.98]",
                large && "sm:min-h-[52px] sm:px-6",
              )}
            >
              <span className="hidden sm:inline">Check it</span>
              <CornerDownLeft className="h-4 w-4 sm:hidden" aria-hidden />
              <SearchIcon className="hidden h-4 w-4 sm:inline" aria-hidden />
            </button>
          </Magnet>
        </div>
      </div>

      {/* Reserve the row's height so the chips appearing never shifts the page. */}
      <div className="flex min-h-[36px] flex-wrap items-center gap-2 text-sm">
        <AnimatePresence>
          {kind && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex flex-wrap items-center gap-2"
            >
              <span className="text-muted-fg">Checking as</span>
              {(Object.keys(KIND_META) as SubjectKind[]).map((k) => {
                const Meta = KIND_META[k];
                const selected = k === kind;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKindOverride(k)}
                    aria-pressed={selected}
                    className={cn(
                      "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-3 transition-colors",
                      selected
                        ? "border-brand/50 bg-brand/10 text-brand"
                        : "border-border text-muted-fg hover:border-border-hi hover:text-fg",
                    )}
                  >
                    <Meta.icon className="h-4 w-4" aria-hidden />
                    {Meta.label}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}
