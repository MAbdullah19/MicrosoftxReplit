/** Evidence split for / against / context. Text and URLs only. */
import { ThumbsUp, ThumbsDown, InfoIcon, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  supports: { label: "Supports", tone: "ok" as const, icon: ThumbsUp },
  refutes: { label: "Refutes", tone: "bad" as const, icon: ThumbsDown },
  context: { label: "Context", tone: "muted" as const, icon: InfoIcon },
};

export function EvidenceList({ items }: { items: EvidenceItem[] }) {
  if (items.length === 0)
    return <p className="text-base text-muted-fg">No evidence yet.</p>;
  return (
    <ul className="space-y-3">
      {items.map((e) => {
        const meta = STANCE[e.stance] ?? STANCE.context;
        return (
          <li key={e.id}>
            <Card className="space-y-2">
              <Badge tone={meta.tone}>
                <meta.icon className="h-4 w-4" aria-hidden />
                {meta.label}
              </Badge>
              <p className="text-base leading-relaxed">{e.body}</p>
              {e.url && (
                <a
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 break-all text-sm text-brand underline-offset-2 hover:underline"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                  {e.url}
                </a>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
