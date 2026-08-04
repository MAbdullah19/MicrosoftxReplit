# Attest — UI/UX redesign plan

Companion to `context.md`. That file tracks what the product *does*; this one
tracks what it *looks and feels like*, and where each borrowed component came
from. Update as the redesign lands.

Source libraries (from `ui-improv.md`), all free / MIT:

- **React Bits** — <https://reactbits.dev/> (source pulled from
  `github.com/DavidHDev/react-bits`, `src/ts-tailwind/…`)
- **Aceternity UI** — <https://ui.aceternity.com/> (source pulled from the
  shadcn registry endpoints, `ui.aceternity.com/registry/<name>.json`)
- **21st.dev** — <https://21st.dev/> (shadcn-flavoured patterns; the primitives
  in `components/ui/` follow its conventions — cva variants, `cn()` merge,
  forwardRef)

Every ported file carries a header comment naming its origin. Ports are
faithful; the only systematic change is that hard-coded palette values
(`bg-black`, `neutral-800`, `#3275F8`, …) are swapped for this project's CSS
variables so the whole page reads as one system rather than a component zoo.

---

## 1. Direction

The product asks a stranger to trust a verdict *without trusting us*. The
interface has to look like an instrument, not a social feed: quiet chrome,
loud verdicts, and a visible chain of reasoning.

- **Dark-first.** `<html class="dark">` was already set but the palette was a
  light theme with a dark override bolted on. Now dark is the designed state
  and light is the derived one, with a real toggle.
- **One accent, three semantics.** Violet is the interactive/brand colour.
  Green / amber / red belong to *verdicts only* — never to buttons, links or
  decoration — so colour keeps meaning (§I12: icon + word + colour, never
  colour alone).
- **Minimal, not bare.** Generous space, one type scale, few borders. Motion
  is used to explain (a proof filling in, a score counting up), not to decorate.
- **Interaction has weight.** Hover, focus and click all produce feedback:
  spotlight follow, magnet pull, click sparks, border glow.

## 2. Tokens

`client/src/index.css` — HSL triples so Tailwind can apply opacity.

| token | dark | role |
|---|---|---|
| `--bg` | `228 24% 5%` | page |
| `--bg-soft` | `228 22% 7%` | inset wells |
| `--card` | `228 20% 9%` | surface |
| `--card-hi` | `228 18% 13%` | hover / raised |
| `--border` | `228 14% 17%` | hairline |
| `--border-hi` | `228 14% 26%` | hover hairline |
| `--fg` | `220 20% 97%` | text |
| `--muted-fg` | `222 12% 63%` | secondary text |
| `--brand` | `258 90% 66%` | interactive |
| `--brand-2` | `199 89% 58%` | gradient partner |
| `--ok` / `--warn` / `--bad` | `152 62% 45%` / `38 95% 56%` / `357 79% 62%` | verdicts |

Type: **Inter** (display + UI) and **JetBrains Mono** (hashes, IDs, codes),
loaded from Google Fonts with a full system fallback stack so an offline demo
degrades to system UI rather than to Times. Numeric UI is `tabular-nums`
throughout.

Radii `lg 12px / xl 16px / 2xl 20px / 3xl 28px`. Two shadows only: a hairline
`shadow-card` and a brand `shadow-glow` for the focused/active state.

## 3. Borrowed components

Living in `client/src/components/fx/`. Each is a real port, not a lookalike.

### From Aceternity UI

| component | file | used on |
|---|---|---|
| Spotlight (new) | `Spotlight.tsx` | home hero, verify hero |
| Glowing Effect | `GlowingEffect.tsx` | verdict banner, stat tiles |
| Meteors | `Meteors.tsx` | verify success card |
| Bento Grid | `BentoGrid.tsx` | home "how it works" |
| Hover Border Gradient | `HoverBorderGradient.tsx` | primary CTAs |
| Moving Border | `MovingBorder.tsx` | anchored-on-chain badge |
| Flip Words | `FlipWords.tsx` | home headline |
| Text Generate Effect | `TextGenerateEffect.tsx` | hero subhead |
| Infinite Moving Cards | `InfiniteMovingCards.tsx` | recently-resolved rail |
| Background Gradient | `BackgroundGradient.tsx` | resolved-verdict hero |
| Background Beams | `BackgroundBeams.tsx` | verify page, 404 |
| Card Hover Effect | `HoverEffect.tsx` | home route grid |
| Tracing Beam *(adapted)* | `TracingBeam.tsx` | verify checklist |

### From React Bits

| component | file | used on |
|---|---|---|
| Spotlight Card | `SpotlightCard.tsx` | claim cards, evidence, panels |
| Count Up | `CountUp.tsx` | scores, tallies, reputation |
| Decrypted Text | `DecryptedText.tsx` | hashes / roots on verify |
| Shiny Text | `ShinyText.tsx` | eyebrow labels |
| Gradient Text | `GradientText.tsx` | wordmark, hero |
| Blur Text | `BlurText.tsx` | page headings |
| Click Spark | `ClickSpark.tsx` | app-wide click feedback |
| Magnet | `Magnet.tsx` | hero CTA |
| Star Border | `StarBorder.tsx` | invite / mint buttons |
| Electric Border | `ElectricBorder.tsx` | verify success card |
| Glare Hover | `GlareHover.tsx` | bento tiles |
| Stepper | `Stepper.tsx` | /join enrolment flow |
| Animated Content | `Reveal.tsx` | scroll reveals |

**One deliberate substitution.** React Bits ships `AnimatedContent` and
`FadeContent` on GSAP + ScrollTrigger. Adding GSAP for two scroll reveals is
not worth ~70 KB when `motion` is already in the tree for the rest of the
library, so `Reveal.tsx` is the same component expressed with
`whileInView`/`viewport`. Same API surface (`distance`, `direction`, `delay`,
`blur`, `once`), no second animation runtime.

## 4. Dependency

One new package: **`motion`** (Framer Motion v12 under its current name). Both
libraries depend on it — Aceternity lists it for 14 of the 20 components
fetched, React Bits for 8. Bundle impact is tracked in §7.

Not added: `gsap` (avoided, see above), `ogl` / `three` (WebGL backgrounds are
overkill for a trust product and hostile on mobile data — §6 of the plan asks
the checker path to stay light), `@tabler/icons-react` (the project already has
`lucide-react`).

## 5. Screens

- **Shell** — sticky glass header, wordmark in `GradientText`, nav with a
  shared-layout active pill, theme toggle, mobile sheet. Ambient page
  background: fixed dot-grid with a radial mask plus a brand aurora blur.
  Footer with the honest "no accounts, no tracking" line. `ClickSpark` wraps
  the whole app.
- **Home** — full-bleed hero: `Spotlight`, `BlurText` headline with
  `FlipWords` on the subject kind, the search box promoted to the primary
  object on the page with a `HoverBorderGradient` submit and `Magnet` pull.
  Below: a three-up stat strip on `CountUp`, a `BentoGrid` explaining the
  mechanism, and the recently-resolved claims on an `InfiniteMovingCards`
  rail.
- **Subject** — verdict hero on `BackgroundGradient` + `GlowingEffect`, the
  three next-step actions as real buttons, reports in `SpotlightCard`s, and
  the verdict history as a proper vertical timeline.
- **Claim** — statement as the page title, verdict banner, `BetaCurve` in a
  framed well, redesigned vote panel (segmented stance control, gradient-fill
  sliders, live payoff hint), waterfall rebuilt as diverging bars from a
  centre line, evidence split into for/against/context columns, AI card
  visually quarantined (dashed border, monospace attribution) so it never
  reads as a verdict.
- **Verify** — the showpiece. `BackgroundBeams` behind a `TracingBeam`
  checklist whose beam fills as each step passes. Hashes render with
  `DecryptedText` so the reader watches them resolve. Success gets
  `ElectricBorder` + `Meteors`; tampering gets the existing shake, a red
  wash, and a character-level hash diff.
- **Join** — `Stepper` across invite → passkey → backup codes, so the flow
  states what it is up front.
- **Me** — dashboard: identity header, four stat tiles on `CountUp` +
  `GlowingEffect`, invite minting on `StarBorder`, vote history as graded rows.
- **404** — `BackgroundBeams` and a way back.

## 6. Accessibility held from the current build

Non-negotiable, and re-checked after every screen:

- Verdict = icon **+** word **+** colour. Never colour alone (I12).
- "Not enough evidence" never renders green or as reassurance.
- Every interactive target ≥ 44 px.
- `prefers-reduced-motion` kills all of it: the global rule already collapses
  animation/transition durations, and the canvas effects (`ClickSpark`,
  `ElectricBorder`, `Meteors`) check the media query and render nothing.
- Focus rings are visible on every control, on both themes.
- All copy still comes from `@shared/strings`.

## 7. Performance

Two things were changed away from upstream because this app mounts them
globally rather than on a demo page:

- **`ClickSpark` parks itself.** Upstream runs its rAF loop forever, clearing
  the full canvas every frame whether or not a spark exists. Mounted at the app
  root that is a permanent idle cost, so the loop now starts on click and stops
  when the last spark expires.
- **`BackgroundBeams` draws 28 animated beams, not 50.** Each beam is its own
  `<linearGradient>` driven by motion, and on /verify they share a thread with
  the SHA-256 the page is running. 28 is visually indistinguishable.

Beyond that: `Magnet` disables itself on coarse pointers, and every canvas
effect returns `null` under `prefers-reduced-motion`.

## 8. Bundle

`npm run build`, after the redesign:

| chunk | raw | gzip | when |
|---|---|---|---|
| `react` (vendor) | 133.9 KB | 43.1 KB | first paint |
| `motion` (vendor) | 148.1 KB | 49.2 KB | first paint |
| `index` (app) | 309.3 KB | 86.5 KB | first paint |
| `index.css` | 46.4 KB | 8.9 KB | first paint |
| **first paint total** | **637.7 KB** | **187.7 KB** | |
| `Verify` | 291.3 KB | 90.9 KB | lazy — /verify only |
| `BetaCurve` | 377.5 KB | 104.9 KB | lazy — claims with a posterior |

Before the redesign the entry chunk was 391 KB raw / 115 KB gzip. The honest
accounting of the +247 KB raw / +73 KB gzip:

- **~148 KB raw / 49 KB gzip is `motion` itself** — the animation runtime both
  component libraries are built on. This is the price of the brief, not
  incidental bloat.
- **~99 KB raw / 24 KB gzip is app code** — 24 ported effect components, six
  rebuilt pages, and the new `ui/` primitives.

`react` and `motion` are now split into their own chunks. That does not shrink
the first visit; it means a copy change no longer invalidates ~280 KB of
vendor code in every returning visitor's cache.

**This is worth flagging rather than burying:** §6 of the plan asks for a
~200 KB entry chunk and this build is 637 KB raw. It was already over at
391 KB before any of this. Lazy-loading `/verify` and `BetaCurve` keeps the
*checker* path — the one that matters on mobile data — off the heavy chunks,
and both remain lazy. If the budget needs to be met properly, the lever is
`LazyMotion` + `domAnimation` (roughly −40 KB raw), which costs the shared
`layoutId` transitions on the nav pill and the home route grid.

Tree-shaking through the `fx/` barrel was verified: `Meteors` and `TracingBeam`
appear only in the `Verify` chunk, not the entry chunk.

## 9. Status

- [x] Tokens, Tailwind config, fonts
- [x] `fx/` ports (24 components)
- [x] `ui/` primitives rebuilt
- [x] Shell: header, footer, background, click spark
- [x] Home
- [x] Subject
- [x] Claim
- [x] Verify
- [x] Join / Me / 404
- [x] `tsc --noEmit` clean
- [x] `npm run build` clean
- [x] Dev server boots, `GET /` → 200

Tests: the 9 pure suites (71 tests) all pass. The three database-backed suites
were not touched by this work; `tests/anchor.test.ts` fails on `main` with the
redesign stashed, so those failures pre-date it and belong to the shared Neon
instance's state, not to the UI.
