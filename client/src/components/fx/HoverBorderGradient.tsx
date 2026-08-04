/** Aceternity UI — "Hover Border Gradient".
 *  https://ui.aceternity.com/components/hover-border-gradient
 *  Ported as-is. The travelling highlight is re-tinted from Aceternity's
 *  #3275F8 to the brand, and the hard-coded `bg-black` inner faces become
 *  `bg-card` so the button works on both themes. */
import { useEffect, useState, type ElementType, type HTMLAttributes, type PropsWithChildren } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type Direction = "TOP" | "LEFT" | "BOTTOM" | "RIGHT";

export function HoverBorderGradient({
  children,
  containerClassName,
  className,
  as: Tag = "button",
  duration = 1,
  clockwise = true,
  ...props
}: PropsWithChildren<
  {
    as?: ElementType;
    containerClassName?: string;
    className?: string;
    duration?: number;
    clockwise?: boolean;
  } & HTMLAttributes<HTMLElement>
>) {
  const [hovered, setHovered] = useState(false);
  const [direction, setDirection] = useState<Direction>("TOP");

  const rotateDirection = (current: Direction): Direction => {
    const directions: Direction[] = ["TOP", "LEFT", "BOTTOM", "RIGHT"];
    const i = directions.indexOf(current);
    const next = clockwise
      ? (i - 1 + directions.length) % directions.length
      : (i + 1) % directions.length;
    return directions[next];
  };

  const movingMap: Record<Direction, string> = {
    TOP: "radial-gradient(20.7% 50% at 50% 0%, hsl(var(--fg)) 0%, hsl(var(--fg) / 0) 100%)",
    LEFT: "radial-gradient(16.6% 43.1% at 0% 50%, hsl(var(--fg)) 0%, hsl(var(--fg) / 0) 100%)",
    BOTTOM: "radial-gradient(20.7% 50% at 50% 100%, hsl(var(--fg)) 0%, hsl(var(--fg) / 0) 100%)",
    RIGHT: "radial-gradient(16.2% 41.2% at 100% 50%, hsl(var(--fg)) 0%, hsl(var(--fg) / 0) 100%)",
  };

  const highlight =
    "radial-gradient(75% 181% at 50% 50%, hsl(var(--brand)) 0%, hsl(var(--brand-2) / 0) 100%)";

  useEffect(() => {
    if (hovered) return;
    const interval = setInterval(
      () => setDirection((prev) => rotateDirection(prev)),
      duration * 1000,
    );
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hovered, duration]);

  return (
    <Tag
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        "relative flex h-min w-fit flex-col flex-nowrap content-center items-center justify-center gap-10 overflow-visible rounded-full bg-border p-px decoration-clone transition duration-500 hover:bg-border-hi",
        containerClassName,
      )}
      {...props}
    >
      <div
        className={cn(
          "z-10 w-auto rounded-[inherit] bg-card px-5 py-3 text-fg",
          className,
        )}
      >
        {children}
      </div>
      <motion.div
        className="absolute inset-0 z-0 flex-none overflow-hidden rounded-[inherit]"
        style={{ filter: "blur(2px)", position: "absolute", width: "100%", height: "100%" }}
        initial={{ background: movingMap[direction] }}
        animate={{
          background: hovered ? [movingMap[direction], highlight] : movingMap[direction],
        }}
        transition={{ ease: "linear", duration }}
      />
      <div className="absolute inset-px z-[1] flex-none rounded-[inherit] bg-card" />
    </Tag>
  );
}
