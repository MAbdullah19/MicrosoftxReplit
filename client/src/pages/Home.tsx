/** Home — a search box, not a feed (§14.2). No login wall, no modal. */
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { STRINGS } from "@shared/strings";
import { SubjectSearch } from "@/components/SubjectSearch";
import { ClaimCard, type ClaimSummary } from "@/components/ClaimCard";

export default function Home() {
  const { data } = useQuery<{ claims: ClaimSummary[] }>({ queryKey: ["/recent"] });
  const recent = data?.claims ?? [];

  return (
    <main className="mx-auto max-w-3xl px-4 pb-16">
      <section className="flex min-h-[55vh] flex-col items-center justify-center gap-6 text-center">
        <ShieldCheck className="h-14 w-14 text-brand" aria-hidden />
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{STRINGS.productName}</h1>
          <p className="text-base text-muted-fg">{STRINGS.tagline}</p>
        </div>
        <SubjectSearch large />
      </section>

      {recent.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">{STRINGS.home.recentlyResolved}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {recent.map((c) => (
              <ClaimCard key={c.id} claim={c} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
