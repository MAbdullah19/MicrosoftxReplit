/** Landing search box: detect kind → editable chip → navigate to /s/:key. */
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { SearchIcon, Link2, Phone, Type } from "lucide-react";
import { detectKind, subjectKey, type SubjectKind } from "@shared/subject";
import { STRINGS } from "@shared/strings";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

  const detected = useMemo(() => (q.trim() ? detectKind(q) : null), [q]);
  const kind = kindOverride ?? detected;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim() || !kind) return;
    navigate(`/s/${subjectKey(kind, q)}?kind=${kind}&q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <form onSubmit={submit} className="w-full max-w-xl space-y-3">
      <div className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setKindOverride(null);
          }}
          placeholder={STRINGS.searchPlaceholder}
          aria-label={STRINGS.searchPlaceholder}
          className={cn(large && "min-h-[52px] text-lg")}
        />
        <Button type="submit" size={large ? "lg" : "md"} aria-label="Check">
          <SearchIcon className="h-5 w-5" aria-hidden />
          <span className="hidden sm:inline">Check</span>
        </Button>
      </div>
      {kind && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-fg">Checking as:</span>
          {(Object.keys(KIND_META) as SubjectKind[]).map((k) => {
            const Meta = KIND_META[k];
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKindOverride(k)}
                className={cn(
                  "inline-flex min-h-[36px] items-center gap-1 rounded-full border px-3",
                  k === kind
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-border text-muted-fg hover:bg-muted",
                )}
              >
                <Meta.icon className="h-4 w-4" aria-hidden />
                {Meta.label}
              </button>
            );
          })}
        </div>
      )}
    </form>
  );
}
