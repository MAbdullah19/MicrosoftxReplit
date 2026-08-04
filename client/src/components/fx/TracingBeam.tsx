/** Aceternity UI — "Tracing Beam", adapted.
 *  https://ui.aceternity.com/components/tracing-beam
 *
 *  Upstream ties the beam's gradient to *scroll* progress. On /verify the
 *  interesting progress is not how far you have scrolled, it is how far the
 *  proof has got — so the same SVG-path-with-animated-gradient construction is
 *  driven by a `progress` prop (0–1) instead of `useScroll`. The beam fills as
 *  each check passes, and turns red at the step that fails, which is the whole
 *  point of the screen (§14.5).
 *
 *  The gradient stops, the spring on the y-values and the dot-at-the-top are
 *  upstream's. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useSpring, useTransform, useMotionValue } from "motion/react";
import { cn } from "@/lib/utils";

export function TracingBeam({
  children,
  progress,
  tone = "brand",
  className,
}: {
  children: ReactNode;
  /** 0–1. How much of the beam is lit. */
  progress: number;
  tone?: "brand" | "ok" | "bad" | "warn";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [svgHeight, setSvgHeight] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const node = ref.current;
    const measure = () => setSvgHeight(node.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const raw = useMotionValue(0);
  useEffect(() => {
    raw.set(Math.min(1, Math.max(0, progress)));
  }, [progress, raw]);

  const spring = { stiffness: 500, damping: 90 };
  const y1 = useSpring(useTransform(raw, [0, 1], [0, svgHeight]), spring);
  const y2 = useSpring(useTransform(raw, [0, 1], [0, svgHeight - 40]), spring);

  const lit =
    tone === "ok"
      ? "hsl(var(--ok))"
      : tone === "bad"
        ? "hsl(var(--bad))"
        : tone === "warn"
          ? "hsl(var(--warn))"
          : "hsl(var(--brand))";

  return (
    <motion.div ref={ref} className={cn("relative w-full", className)}>
      <div className="absolute -left-1 top-3 hidden md:block">
        <motion.div
          transition={{ duration: 0.2, delay: 0.4 }}
          animate={{ boxShadow: progress > 0 ? "none" : "rgba(0, 0, 0, 0.24) 0px 3px 8px" }}
          className="ml-[27px] flex h-4 w-4 items-center justify-center rounded-full border border-border shadow-sm"
        >
          <motion.div
            transition={{ duration: 0.2, delay: 0.4 }}
            animate={{ backgroundColor: progress > 0 ? lit : "hsl(var(--muted-fg))" }}
            className="h-2 w-2 rounded-full border border-border"
          />
        </motion.div>

        <svg
          viewBox={`0 0 20 ${svgHeight}`}
          width="20"
          height={svgHeight}
          className="ml-4 block"
          aria-hidden
        >
          <motion.path
            d={`M 1 0 V ${svgHeight}`}
            fill="none"
            stroke="hsl(var(--border))"
            strokeOpacity="1"
            transition={{ duration: 10 }}
          />
          <motion.path
            d={`M 1 0 V ${svgHeight}`}
            fill="none"
            stroke="url(#beam-gradient)"
            strokeWidth="1.5"
            className="motion-reduce:hidden"
            transition={{ duration: 10 }}
          />
          <defs>
            <motion.linearGradient
              id="beam-gradient"
              gradientUnits="userSpaceOnUse"
              x1="0"
              x2="0"
              y1={y1}
              y2={y2}
            >
              <stop stopColor={lit} stopOpacity="0" />
              <stop stopColor={lit} />
              <stop offset="0.325" stopColor={lit} />
              <stop offset="1" stopColor={lit} stopOpacity="0" />
            </motion.linearGradient>
          </defs>
        </svg>
      </div>
      <div className="md:ml-14">{children}</div>
    </motion.div>
  );
}
