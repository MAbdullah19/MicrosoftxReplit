/** React Bits — "Gradient Text".
 *  https://reactbits.dev/text-animations/gradient-text
 *  Ported as-is (animation-frame driven `background-position` with yoyo).
 *  Rendered as a `span` rather than upstream's `div`, so it can sit inline in
 *  a heading; upstream's `cursor-pointer` is dropped because this is text, not
 *  a control. Default colours are the brand ramp. */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useAnimationFrame, useMotionValue, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

export function GradientText({
  children,
  className = "",
  colors = ["hsl(var(--fg))", "hsl(var(--brand))", "hsl(var(--brand-2))"],
  animationSpeed = 9,
  direction = "horizontal",
  pauseOnHover = false,
  yoyo = true,
}: {
  children: ReactNode;
  className?: string;
  colors?: string[];
  animationSpeed?: number;
  direction?: "horizontal" | "vertical";
  pauseOnHover?: boolean;
  yoyo?: boolean;
}) {
  const [isPaused, setIsPaused] = useState(false);
  const progress = useMotionValue(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const animationDuration = animationSpeed * 1000;

  useAnimationFrame((time) => {
    if (isPaused) {
      lastTimeRef.current = null;
      return;
    }
    if (lastTimeRef.current === null) {
      lastTimeRef.current = time;
      return;
    }
    elapsedRef.current += time - lastTimeRef.current;
    lastTimeRef.current = time;

    if (yoyo) {
      const fullCycle = animationDuration * 2;
      const cycleTime = elapsedRef.current % fullCycle;
      progress.set(
        cycleTime < animationDuration
          ? (cycleTime / animationDuration) * 100
          : 100 - ((cycleTime - animationDuration) / animationDuration) * 100,
      );
    } else {
      progress.set((elapsedRef.current / animationDuration) * 100);
    }
  });

  useEffect(() => {
    elapsedRef.current = 0;
    progress.set(0);
  }, [animationSpeed, yoyo, progress]);

  const backgroundPosition = useTransform(progress, (p) =>
    direction === "horizontal" ? `${p}% 50%` : `50% ${p}%`,
  );

  const onEnter = useCallback(() => pauseOnHover && setIsPaused(true), [pauseOnHover]);
  const onLeave = useCallback(() => pauseOnHover && setIsPaused(false), [pauseOnHover]);

  const gradientColors = [...colors, colors[0]].join(", ");

  return (
    <motion.span
      className={cn("inline-block bg-clip-text text-transparent", className)}
      style={{
        backgroundImage: `linear-gradient(${
          direction === "horizontal" ? "to right" : "to bottom"
        }, ${gradientColors})`,
        backgroundSize: direction === "horizontal" ? "300% 100%" : "100% 300%",
        backgroundRepeat: "repeat",
        WebkitBackgroundClip: "text",
        backgroundPosition,
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {children}
    </motion.span>
  );
}
