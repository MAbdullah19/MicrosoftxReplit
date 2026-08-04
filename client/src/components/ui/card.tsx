import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva("rounded-2xl transition-colors", {
  variants: {
    variant: {
      default: "border border-border bg-card shadow-card",
      /** Frosted — for anything that floats over the page background. */
      glass: "glass border border-border shadow-card",
      /** Recessed, for read-only content inside another card. */
      well: "border border-border bg-bg-soft",
      /** No shell at all; the caller is supplying one (BackgroundGradient…). */
      bare: "",
    },
    pad: {
      none: "p-0",
      sm: "p-4",
      md: "p-5",
      lg: "p-6 sm:p-7",
    },
  },
  defaultVariants: { variant: "default", pad: "md" },
});

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export function Card({ className, variant, pad, ...props }: CardProps) {
  return <div className={cn(cardVariants({ variant, pad }), className)} {...props} />;
}

/** Section heading inside a card — one place so the scale never drifts. */
export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-base font-semibold tracking-tight text-fg", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm leading-relaxed text-muted-fg", className)} {...props} />;
}
