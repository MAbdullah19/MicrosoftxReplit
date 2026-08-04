/** Aceternity UI — "Card Hover Effect".
 *  https://ui.aceternity.com/components/card-hover-effect
 *  Ported as-is: the shared `layoutId="hoverBackground"` panel that slides
 *  between cards is the whole trick, and it is kept. Items take an icon and
 *  route through wouter's `Link` instead of a bare anchor, so the SPA does not
 *  reload on an internal hop. */
import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

export type HoverItem = {
  title: string;
  description: string;
  link: string;
  icon?: ReactNode;
};

export function HoverEffect({
  items,
  className,
}: {
  items: HoverItem[];
  className?: string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-3", className)}>
      {items.map((item, idx) => (
        <Link
          href={item.link}
          key={item.link}
          className="group relative block h-full w-full p-2"
          onMouseEnter={() => setHoveredIndex(idx)}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <AnimatePresence>
            {hoveredIndex === idx && (
              <motion.span
                className="absolute inset-0 block h-full w-full rounded-2xl bg-card-hi"
                layoutId="hoverBackground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.15 } }}
                exit={{ opacity: 0, transition: { duration: 0.15, delay: 0.2 } }}
              />
            )}
          </AnimatePresence>
          <div className="relative z-20 h-full w-full overflow-hidden rounded-2xl border border-border bg-card p-5 transition-colors group-hover:border-border-hi">
            {item.icon && <div className="mb-3 text-brand">{item.icon}</div>}
            <h4 className="font-semibold tracking-tight text-fg">{item.title}</h4>
            <p className="mt-2 text-sm leading-relaxed text-muted-fg">{item.description}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
