/** Evidence split for / against / context. Text and URLs only.
 *  Grouped rather than interleaved: a reader scanning for the counter-argument
 *  should not have to filter it out of a chronological stream. */
import { ThumbsUp, ThumbsDown, InfoIcon, ExternalLink } from "lucide-react";
import { SpotlightCard } from "@/components/fx";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/components/ClaimCard";
import { cn } from "@/lib/utils";

export type EvidenceItem = {
  id: string;
  stance: "supports" | "refutes" | "context";
  body: string;
  url: string | null;
  helpful: number;
  unhelpful: number;
  createdAt: string;
};

const STANCE = {
  supports: {
    label: "Supports",
    tone: "ok" as const,
    icon: ThumbsUp,
    spot: "hsl(var(--ok) / 0.12)",
  },
  refutes: {
    label: "Refutes",
    tone: "bad" as const,
    icon: ThumbsDown,
    spot: "hsl(var(--bad) / 0.12)",
  },
  context: {
    label: "Context",
    tone: "muted" as const,
    icon: InfoIcon,
    spot: "hsl(var(--brand) / 0.1)",
  },
};

const ORDER = ["supports", "refutes", "context"] as const;

/** Defence in depth: never render a live link unless the protocol is https. */
function isHttps(u: string): boolean {
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
}

function EvidenceCard({ item }: { item: EvidenceItem }) {
  const meta = STANCE[item.stance] ?? STANCE.context;
  return (
    <SpotlightCard spotlightColor={meta.spot} className="p-4">
      <div className="flex items-center justify-between gap-2">
        <Badge tone={meta.tone} size="sm">
          <meta.icon className="h-3.5 w-3.5" aria-hidden />
          {meta.label}
        </Badge>
        <span className="text-xs text-muted-fg">{relativeTime(item.createdAt)}</span>
      </div>

      <p className="mt-3 text-base leading-relaxed text-fg">{item.body}</p>

      {item.url && !isHttps(item.url) && (
        <p className="mt-2 hash text-xs text-muted-fg">{item.url}</p>
      )}
      {item.url && isHttps(item.url) && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mt-2 inline-flex items-start gap-1.5 hash text-xs text-brand underline-offset-2 hover:underline"
        >
          <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {item.url}
        </a>
      )}
    </SpotlightCard>
  );
}

export function EvidenceList({ items }: { items: EvidenceItem[] }) {
  if (items.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <p className="text-base text-muted-fg">No evidence yet.</p>
        <p className="mt-1 text-sm text-muted-fg">
          Be the first to say what you saw — plain words help.
        </p>
      </div>
    );

  const groups = ORDER.map((stance) => ({
    stance,
    meta: STANCE[stance],
    items: items.filter((i) => i.stance === stance),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g.stance} className="space-y-3">
          <h3
            className={cn(
              "flex items-center gap-2 text-sm font-semibold uppercase tracking-wider",
              g.meta.tone === "ok"
                ? "text-ok"
                : g.meta.tone === "bad"
                  ? "text-bad"
                  : "text-muted-fg",
            )}
          >
            <g.meta.icon className="h-4 w-4" aria-hidden />
            {g.meta.label}
            <span className="tabular font-normal text-muted-fg">({g.items.length})</span>
          </h3>
          <ul className="space-y-3">
            {g.items.map((e) => (
              <li key={e.id}>
                <EvidenceCard item={e} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
