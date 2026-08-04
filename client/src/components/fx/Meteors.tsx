/** Aceternity UI — "Meteors".
 *  https://ui.aceternity.com/components/meteors
 *  Ported as-is, re-tinted to the brand, and gated on reduced-motion: this one
 *  is pure decoration, so someone who asked for stillness gets nothing rather
 *  than twenty frozen dots. */
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/lib/theme";

export function Meteors({ number = 20, className }: { number?: number; className?: string }) {
  const reduced = usePrefersReducedMotion();
  if (reduced) return null;

  const meteors = new Array(number).fill(true);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {meteors.map((_, idx) => {
        // Evenly distribute across an 800px range, centred (Aceternity's maths).
        const position = idx * (800 / number) - 400;
        return (
          <span
            key={`meteor-${idx}`}
            className={cn(
              "animate-meteor-effect absolute h-0.5 w-0.5 rotate-[45deg] rounded-[9999px] bg-brand shadow-[0_0_0_1px_hsl(var(--fg)/0.06)]",
              "before:absolute before:top-1/2 before:h-px before:w-[50px] before:-translate-y-1/2 before:transform before:bg-gradient-to-r before:from-brand before:to-transparent before:content-['']",
              className,
            )}
            style={{
              top: "-40px",
              left: `${position}px`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${Math.floor(Math.random() * 5 + 5)}s`,
            }}
          />
        );
      })}
    </div>
  );
}
