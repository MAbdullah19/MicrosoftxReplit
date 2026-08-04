/** Aceternity UI — "Background Beams".
 *  https://ui.aceternity.com/components/background-beams
 *
 *  Same geometry, same gradients, same motion as upstream — but the 50 cubic
 *  paths are generated rather than pasted. Upstream ships ~9 KB of literal
 *  path data, and the family is strictly arithmetic: every path is the one
 *  before it translated by (+7, −8). `beamPath()` below reproduces the exact
 *  same `d` strings from that rule, which keeps the look and drops the weight
 *  on a page whose real job is running hashes in the browser (§6).
 *
 *  Stop colours are re-tinted from Aceternity's #18CCFC/#6344F5/#AE48FF to the
 *  project's brand-2 → brand ramp. */
import { memo } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/theme";

/** Upstream's first path, parameterised: x += 7, y −= 8 per index. */
function beamPath(i: number): string {
  const x = -380 + 7 * i;
  const y = -189 - 8 * i;
  return (
    `M${x} ${y}C${x} ${y} ${x + 68} ${y + 405} ${x + 532} ${y + 532}` +
    `C${x + 996} ${y + 659} ${x + 1064} ${y + 1064} ${x + 1064} ${y + 1064}`
  );
}

export const BackgroundBeams = memo(function BackgroundBeams({
  className,
  // Upstream draws 50. Each animated beam is its own <linearGradient> being
  // driven by motion, so this is the knob that decides whether /verify stays
  // smooth while it is also hashing in the same thread. 28 reads the same.
  count = 28,
}: {
  className?: string;
  count?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const paths = Array.from({ length: count }, (_, i) => beamPath(i));

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 flex h-full w-full items-center justify-center [mask-repeat:no-repeat] [mask-size:40px]",
        className,
      )}
      aria-hidden
    >
      <svg
        className="pointer-events-none absolute z-0 h-full w-full"
        width="100%"
        height="100%"
        viewBox="0 0 696 316"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* The static family underneath, barely visible — it is what gives the
            animated beams something to travel along. */}
        {paths.map((d, i) => (
          <path
            key={`bg-${i}`}
            d={d}
            stroke="hsl(var(--fg))"
            strokeOpacity="0.05"
            strokeWidth="0.5"
          />
        ))}

        {!reduced &&
          paths.map((d, i) => (
            <path
              key={`beam-${i}`}
              d={d}
              stroke={`url(#beamGradient-${i})`}
              strokeOpacity="0.45"
              strokeWidth="0.5"
            />
          ))}

        {!reduced && (
          <defs>
            {paths.map((_, i) => (
              <motion.linearGradient
                id={`beamGradient-${i}`}
                key={`grad-${i}`}
                initial={{ x1: "0%", x2: "0%", y1: "0%", y2: "0%" }}
                animate={{
                  x1: ["0%", "100%"],
                  x2: ["0%", "95%"],
                  y1: ["0%", "100%"],
                  y2: ["0%", `${93 + Math.random() * 8}%`],
                }}
                transition={{
                  duration: Math.random() * 10 + 10,
                  ease: "easeInOut",
                  repeat: Infinity,
                  delay: Math.random() * 10,
                }}
              >
                <stop stopColor="hsl(var(--brand-2))" stopOpacity="0" />
                <stop stopColor="hsl(var(--brand-2))" />
                <stop offset="32.5%" stopColor="hsl(var(--brand))" />
                <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity="0" />
              </motion.linearGradient>
            ))}
          </defs>
        )}
      </svg>
    </div>
  );
});
