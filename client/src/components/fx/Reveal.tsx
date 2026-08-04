/** React Bits — "Animated Content" / "Fade Content", expressed with `motion`.
 *  https://reactbits.dev/animations/animated-content
 *
 *  Same props and the same behaviour (slide in from a direction, optional
 *  blur and scale, once-only, threshold and delay). Upstream implements both
 *  on GSAP + ScrollTrigger; adding a second animation runtime for two scroll
 *  reveals is not worth ~70 KB when `motion` is already in the tree for the
 *  rest of the library, so this is the `whileInView` equivalent. See
 *  design-plan.md §3. */
import type { ReactNode } from "react";
import { motion } from "motion/react";

export function Reveal({
  children,
  distance = 24,
  direction = "vertical",
  reverse = false,
  duration = 0.6,
  delay = 0,
  scale = 1,
  blur = false,
  threshold = 0.15,
  once = true,
  className,
}: {
  children: ReactNode;
  distance?: number;
  direction?: "vertical" | "horizontal";
  reverse?: boolean;
  duration?: number;
  delay?: number;
  scale?: number;
  blur?: boolean;
  threshold?: number;
  once?: boolean;
  className?: string;
}) {
  const offset = reverse ? -distance : distance;
  const axis = direction === "horizontal" ? "x" : "y";

  return (
    <motion.div
      className={className}
      initial={{
        opacity: 0,
        [axis]: offset,
        scale,
        ...(blur ? { filter: "blur(8px)" } : {}),
      }}
      whileInView={{
        opacity: 1,
        [axis]: 0,
        scale: 1,
        ...(blur ? { filter: "blur(0px)" } : {}),
      }}
      viewport={{ once, amount: threshold }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
