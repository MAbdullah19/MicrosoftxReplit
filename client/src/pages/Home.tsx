/** Home — a search box, not a feed (§14.2). No login wall, no modal.
 *
 *  The hero is Aceternity's Spotlight over the ambient grid, with React Bits'
 *  BlurText on the headline and Aceternity's FlipWords cycling the three
 *  subject kinds the product accepts. Below it: a CountUp stat strip, the
 *  mechanism as a BentoGrid, the recently-resolved claims on an
 *  InfiniteMovingCards rail, and the three routes as a Card Hover Effect grid. */
import { useQuery } from "@tanstack/react-query";
import {
  Anchor,
  Bot,
  EyeOff,
  Gavel,
  KeyRound,
  Megaphone,
  Scale,
  Timer,
  UserRound,
} from "lucide-react";
import { STRINGS } from "@shared/strings";
import { SubjectSearch } from "@/components/SubjectSearch";
import { ClaimCard, type ClaimSummary } from "@/components/ClaimCard";
import {
  BentoGrid,
  BentoGridItem,
  BlurText,
  CountUp,
  FlipWords,
  GlareHover,
  HoverEffect,
  InfiniteMovingCards,
  Reveal,
  ShinyText,
  Spotlight,
  TextGenerateEffect,
} from "@/components/fx";

/** Decorative tile headers for the bento — abstract, cheap, and themed to the
 *  step they sit above. No images, so nothing to load. */
function TileGlow({ tone = "brand" }: { tone?: "brand" | "ok" | "bad" | "warn" }) {
  const wash = {
    brand: "from-brand/25 via-brand-2/10",
    ok: "from-ok/25 via-brand-2/10",
    bad: "from-bad/25 via-warn/10",
    warn: "from-warn/25 via-bad/10",
  }[tone];
  return (
    <GlareHover className="min-h-[6rem] flex-1 rounded-xl">
      <div
        className={`h-full min-h-[6rem] w-full rounded-xl bg-gradient-to-br ${wash} to-transparent`}
      />
    </GlareHover>
  );
}

function Stat({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-5 py-4 text-center">
      <p className="tabular text-3xl font-semibold tracking-tight text-fg">
        <CountUp to={value} suffix={suffix} duration={1.4} />
      </p>
      <p className="mt-1 text-sm text-muted-fg">{label}</p>
    </div>
  );
}

export default function Home() {
  const { data } = useQuery<{ claims: ClaimSummary[] }>({ queryKey: ["/recent"] });
  const recent = data?.claims ?? [];

  const resolved = recent.filter((c) => c.resolvedAt).length;
  const open = recent.filter((c) => c.status === "open").length;
  const checks = recent.reduce((a, c) => a + c.voterCount, 0);

  return (
    <main className="w-full">
      {/* ------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden">
        <Spotlight />
        <div className="relative mx-auto flex min-h-[72vh] max-w-6xl flex-col items-center justify-center gap-8 px-4 py-20 text-center sm:px-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-brand" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
            </span>
            <ShinyText text={STRINGS.home.eyebrow} speed={4} />
          </div>

          <div className="space-y-3">
            <BlurText
              as="h1"
              text={STRINGS.home.headline}
              animateBy="letters"
              delay={40}
              className="justify-center text-5xl font-semibold tracking-tight text-fg sm:text-7xl"
            />
            {/* Fixed height: FlipWords absolutely positions its exiting word,
                so without it the line collapses on every swap. */}
            <div className="flex h-12 items-center justify-center text-2xl font-medium text-muted-fg sm:text-3xl">
              <span>Check&nbsp;</span>
              <FlipWords words={[...STRINGS.home.kinds]} className="text-brand" />
            </div>
          </div>

          <TextGenerateEffect
            words={STRINGS.home.lede}
            delay={0.3}
            className="max-w-2xl text-balance text-base leading-relaxed text-muted-fg sm:text-lg"
          />

          <div className="flex w-full justify-center">
            <SubjectSearch large />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ Stats */}
      {recent.length > 0 && (
        <Reveal className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="grid grid-cols-3 gap-3">
            <Stat label={STRINGS.home.stats.openLabel} value={open} />
            <Stat label={STRINGS.home.stats.checkedLabel} value={checks} />
            <Stat label={STRINGS.home.stats.resolvedLabel} value={resolved} />
          </div>
        </Reveal>
      )}

      {/* ------------------------------------------------- Recently resolved */}
      {recent.length > 0 && (
        <section className="mt-20">
          <Reveal className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">
              {STRINGS.home.recentlyResolved}
            </h2>
          </Reveal>
          {/* The rail duplicates its children to loop seamlessly, so it needs
              enough cards to be worth animating; below that, a plain grid. */}
          {recent.length >= 4 ? (
            <InfiniteMovingCards
              className="mx-auto mt-4 max-w-6xl"
              speed="slow"
              items={recent.map((c) => <ClaimCard key={c.id} claim={c} />)}
            />
          ) : (
            <div className="mx-auto mt-4 grid max-w-6xl gap-3 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
              {recent.map((c) => (
                <ClaimCard key={c.id} claim={c} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------------ How it works */}
      <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <Reveal className="mb-8 max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight">{STRINGS.home.howTitle}</h2>
          <p className="mt-2 text-base text-muted-fg">{STRINGS.home.howLede}</p>
        </Reveal>

        <Reveal delay={0.05}>
          <BentoGrid>
            <BentoGridItem
              className="md:col-span-2"
              header={<TileGlow />}
              icon={<Megaphone className="h-5 w-5 text-brand" aria-hidden />}
              title={STRINGS.home.how.reportTitle}
              description={STRINGS.home.how.reportBody}
            />
            <BentoGridItem
              header={<TileGlow tone="ok" />}
              icon={<Scale className="h-5 w-5 text-ok" aria-hidden />}
              title={STRINGS.home.how.voteTitle}
              description={STRINGS.home.how.voteBody}
            />
            <BentoGridItem
              header={<TileGlow tone="warn" />}
              icon={<Bot className="h-5 w-5 text-warn" aria-hidden />}
              title={STRINGS.home.how.weighTitle}
              description={STRINGS.home.how.weighBody}
            />
            <BentoGridItem
              header={<TileGlow />}
              icon={<EyeOff className="h-5 w-5 text-brand" aria-hidden />}
              title={STRINGS.home.how.blindTitle}
              description={STRINGS.home.how.blindBody}
            />
            <BentoGridItem
              header={<TileGlow tone="ok" />}
              icon={<Timer className="h-5 w-5 text-ok" aria-hidden />}
              title={STRINGS.home.how.settleTitle}
              description={STRINGS.home.how.settleBody}
            />
            <BentoGridItem
              className="md:col-span-3"
              header={<TileGlow />}
              icon={<Anchor className="h-5 w-5 text-brand" aria-hidden />}
              title={STRINGS.home.how.anchorTitle}
              description={STRINGS.home.how.anchorBody}
            />
          </BentoGrid>
        </Reveal>
      </section>

      {/* ------------------------------------------------------ Where next */}
      <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-tight">{STRINGS.home.nextTitle}</h2>
        </Reveal>
        <Reveal delay={0.05}>
          <HoverEffect
            className="mt-4"
            items={[
              {
                title: STRINGS.home.routes.verifyTitle,
                description: STRINGS.home.routes.verifyBody,
                link: "/verify",
                icon: <Gavel className="h-5 w-5" aria-hidden />,
              },
              {
                title: STRINGS.home.routes.joinTitle,
                description: STRINGS.home.routes.joinBody,
                link: "/join",
                icon: <KeyRound className="h-5 w-5" aria-hidden />,
              },
              {
                title: STRINGS.home.routes.accountTitle,
                description: STRINGS.home.routes.accountBody,
                link: "/me",
                icon: <UserRound className="h-5 w-5" aria-hidden />,
              },
            ]}
          />
        </Reveal>
      </section>
    </main>
  );
}
