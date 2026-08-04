/** React Bits — "Shiny Text".
 *  https://reactbits.dev/text-animations/shiny-text
 *  Ported as-is: a motion value drives `background-position` across a clipped
 *  linear gradient. Defaults re-tinted from #b5b5b5/#ffffff to the muted and
 *  foreground tokens so the shine reads on both themes. */
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useAnimationFrame, useMotionValue, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

export function ShinyText({
  text,
  disabled = false,
  speed = 3,
  className = "",
  color = "hsl(var(--muted-fg))",
  shineColor = "hsl(var(--fg))",
  spread = 120,
  pauseOnHover = false,
  delay = 1.2,
}: {
  text: string;
  disabled?: boolean;
  speed?: number;
  className?: string;
  color?: string;
  shineColor?: string;
  spread?: number;
  pauseOnHover?: boolean;
  delay?: number;
}) {
  const [isPaused, setIsPaused] = useState(false);
  const progress = useMotionValue(0);
  const elapsedRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);

  const animationDuration = speed * 1000;
  const delayDuration = delay * 1000;

  useAnimationFrame((time) => {
    if (disabled || isPaused) {
      lastTimeRef.current = null;
      return;
    }
    if (lastTimeRef.current === null) {
      lastTimeRef.current = time;
      return;
    }
    elapsedRef.current += time - lastTimeRef.current;
    lastTimeRef.current = time;

    const cycleDuration = animationDuration + delayDuration;
    const cycleTime = elapsedRef.current % cycleDuration;
    progress.set(cycleTime < animationDuration ? (cycleTime / animationDuration) * 100 : 100);
  });

  useEffect(() => {
    elapsedRef.current = 0;
    progress.set(0);
  }, [speed, progress]);

  const backgroundPosition = useTransform(progress, (p) => `${150 - p * 2}% center`);

  const onEnter = useCallback(() => pauseOnHover && setIsPaused(true), [pauseOnHover]);
  const onLeave = useCallback(() => pauseOnHover && setIsPaused(false), [pauseOnHover]);

  return (
    <motion.span
      className={cn("inline-block", className)}
      style={{
        backgroundImage: `linear-gradient(${spread}deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
        backgroundSize: "200% auto",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundPosition,
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      {text}
    </motion.span>
  );
}
