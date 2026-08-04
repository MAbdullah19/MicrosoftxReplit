/** React Bits — "Glare Hover".
 *  https://reactbits.dev/animations/glare-hover
 *  Ported as-is (the two-layer background trick: a diagonal gradient whose
 *  `background-position` is snapped then transitioned). Upstream forces fixed
 *  width/height and its own border/background; here it is a transparent
 *  wrapper, so it can be laid over a card that already has a shell. */
import { useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function GlareHover({
  children,
  glareColor = "hsl(var(--fg))",
  glareOpacity = 0.14,
  glareAngle = -45,
  glareSize = 250,
  transitionDuration = 700,
  playOnce = false,
  className = "",
  style = {},
}: {
  children?: ReactNode;
  glareColor?: string;
  glareOpacity?: number;
  glareAngle?: number;
  glareSize?: number;
  transitionDuration?: number;
  playOnce?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const rgba = glareColor.startsWith("hsl(")
    ? glareColor.replace(/\)$/, ` / ${glareOpacity})`)
    : glareColor;

  const animateIn = () => {
    const el = overlayRef.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.backgroundPosition = "-100% -100%, 0 0";
    // Force a reflow so the snapped position is committed before the
    // transition is re-enabled; without it the browser coalesces both writes.
    void el.offsetHeight;
    el.style.transition = `${transitionDuration}ms ease`;
    el.style.backgroundPosition = "100% 100%, 0 0";
  };

  const animateOut = () => {
    const el = overlayRef.current;
    if (!el) return;
    el.style.transition = playOnce ? "none" : `${transitionDuration}ms ease`;
    el.style.backgroundPosition = "-100% -100%, 0 0";
  };

  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={style}
      onMouseEnter={animateIn}
      onMouseLeave={animateOut}
    >
      <div
        ref={overlayRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background: `linear-gradient(${glareAngle}deg, transparent 60%, ${rgba} 70%, transparent 100%)`,
          backgroundSize: `${glareSize}% ${glareSize}%, 100% 100%`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "-100% -100%, 0 0",
        }}
      />
      {children}
    </div>
  );
}
