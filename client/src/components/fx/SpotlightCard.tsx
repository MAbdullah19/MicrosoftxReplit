/** React Bits — "Spotlight Card".
 *  https://reactbits.dev/components/spotlight-card
 *  Ported as-is (the CSS-variable-free version: position and opacity in state,
 *  a radial gradient overlay). Upstream's `neutral-900`/`neutral-800` shell is
 *  swapped for the design tokens, and the spotlight colour defaults to the
 *  brand so it tints rather than washes out. */
import { useRef, useState, type PropsWithChildren, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SpotlightCardProps extends PropsWithChildren {
  className?: string;
  /** Any CSS colour. Defaults to the brand at low alpha. */
  spotlightColor?: string;
  children?: ReactNode;
}

export function SpotlightCard({
  children,
  className = "",
  spotlightColor = "hsl(var(--brand) / 0.16)",
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (!divRef.current || isFocused) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onFocus={() => {
        setIsFocused(true);
        setOpacity(1);
      }}
      onBlur={() => {
        setIsFocused(false);
        setOpacity(0);
      }}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-colors duration-300 hover:border-border-hi",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 ease-in-out"
        style={{
          opacity,
          background: `radial-gradient(360px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 70%)`,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
