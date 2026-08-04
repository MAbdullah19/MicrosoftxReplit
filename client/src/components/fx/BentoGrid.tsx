/** Aceternity UI — "Bento Grid".
 *  https://ui.aceternity.com/components/bento-grid
 *  Ported as-is; neutral-200/white/black swapped for the design tokens, and the
 *  hover translate kept because it is what gives the grid its life. */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function BentoGrid({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto grid grid-cols-1 gap-4 md:auto-rows-[15rem] md:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function BentoGridItem({
  className,
  title,
  description,
  header,
  icon,
}: {
  className?: string;
  title?: ReactNode;
  description?: ReactNode;
  header?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "group/bento row-span-1 flex flex-col justify-between gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition duration-300 hover:border-border-hi hover:shadow-glow",
        className,
      )}
    >
      {header}
      <div className="transition duration-300 group-hover/bento:translate-x-1">
        {icon}
        <div className="mb-1 mt-3 font-semibold text-fg">{title}</div>
        <div className="text-sm leading-relaxed text-muted-fg">{description}</div>
      </div>
    </div>
  );
}
