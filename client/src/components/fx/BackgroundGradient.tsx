/** Aceternity UI — "Background Gradient".
 *  https://ui.aceternity.com/components/background-gradient
 *  Ported as-is. Upstream hard-codes a teal/violet/yellow/blue sweep; here the
 *  four radial stops are driven by a `tone` so a resolved verdict glows in its
 *  own colour and a "likely a scam" card never blooms green (I12). */
import type { ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type Tone = "brand" | "ok" | "bad" | "warn";

function sweep(tone: Tone): string {
  const [a, b] =
    tone === "ok"
      ? ["var(--ok)", "var(--brand-2)"]
      : tone === "bad"
        ? ["var(--bad)", "var(--warn)"]
        : tone === "warn"
          ? ["var(--warn)", "var(--bad)"]
          : ["var(--brand)", "var(--brand-2)"];

  return [
    `radial-gradient(circle farthest-side at 0 100%, hsl(${a}), transparent)`,
    `radial-gradient(circle farthest-side at 100% 0, hsl(${b}), transparent)`,
    `radial-gradient(circle farthest-side at 100% 100%, hsl(${a} / 0.7), transparent)`,
    `radial-gradient(circle farthest-side at 0 0, hsl(${b} / 0.7), hsl(var(--bg)))`,
  ].join(", ");
}

export function BackgroundGradient({
  children,
  className,
  containerClassName,
  tone = "brand",
  animate = true,
}: {
  children?: ReactNode;
  className?: string;
  containerClassName?: string;
  tone?: Tone;
  animate?: boolean;
}) {
  const variants = {
    initial: { backgroundPosition: "0 50%" },
    animate: { backgroundPosition: ["0 50%", "100% 50%", "0 50%"] },
  };
  const background = sweep(tone);

  return (
    <div className={cn("group relative p-[2px]", containerClassName)}>
      <motion.div
        variants={animate ? variants : undefined}
        initial={animate ? "initial" : undefined}
        animate={animate ? "animate" : undefined}
        transition={animate ? { duration: 8, repeat: Infinity, repeatType: "reverse" } : undefined}
        style={{ background, backgroundSize: animate ? "400% 400%" : undefined }}
        className="absolute inset-0 z-[1] rounded-[inherit] opacity-40 blur-xl transition duration-500 will-change-transform group-hover:opacity-70"
      />
      <motion.div
        variants={animate ? variants : undefined}
        initial={animate ? "initial" : undefined}
        animate={animate ? "animate" : undefined}
        transition={animate ? { duration: 8, repeat: Infinity, repeatType: "reverse" } : undefined}
        style={{ background, backgroundSize: animate ? "400% 400%" : undefined }}
        className="absolute inset-0 z-[1] rounded-[inherit] will-change-transform"
      />
      <div className={cn("relative z-10 rounded-[inherit]", className)}>{children}</div>
    </div>
  );
}
