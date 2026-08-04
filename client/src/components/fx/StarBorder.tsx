/** React Bits — "Star Border".
 *  https://reactbits.dev/animations/star-border
 *  Ported as-is; the two `star-movement-*` keyframes upstream documents in a
 *  comment are in `tailwind.config.ts`. Upstream's black-to-gray inner face is
 *  swapped for the card token, and the inner padding is reduced because this
 *  wraps ordinary buttons here rather than a hero CTA. */
import type { ComponentPropsWithoutRef, CSSProperties, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

type StarBorderProps<T extends ElementType> = ComponentPropsWithoutRef<T> & {
  as?: T;
  className?: string;
  innerClassName?: string;
  children?: ReactNode;
  color?: string;
  speed?: CSSProperties["animationDuration"];
  thickness?: number;
};

export function StarBorder<T extends ElementType = "button">({
  as,
  className = "",
  innerClassName = "",
  color = "hsl(var(--brand))",
  speed = "6s",
  thickness = 1,
  children,
  ...rest
}: StarBorderProps<T>) {
  const Component = (as || "button") as ElementType;

  return (
    <Component
      className={cn("relative inline-block overflow-hidden rounded-full", className)}
      {...rest}
      style={{ padding: `${thickness}px 0`, ...(rest as { style?: CSSProperties }).style }}
    >
      <div
        className="animate-star-movement-bottom absolute bottom-[-11px] right-[-250%] z-0 h-1/2 w-[300%] rounded-full opacity-70"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      />
      <div
        className="animate-star-movement-top absolute left-[-250%] top-[-10px] z-0 h-1/2 w-[300%] rounded-full opacity-70"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      />
      <div
        className={cn(
          "relative z-[1] flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-border bg-card px-5 text-center text-base font-medium text-fg",
          innerClassName,
        )}
      >
        {children}
      </div>
    </Component>
  );
}
