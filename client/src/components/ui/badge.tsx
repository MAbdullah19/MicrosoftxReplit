import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium leading-none",
  {
    variants: {
      tone: {
        ok: "border-ok/30 bg-ok/10 text-ok",
        bad: "border-bad/30 bg-bad/10 text-bad",
        warn: "border-warn/40 bg-warn/10 text-warn",
        muted: "border-border bg-muted text-muted-fg",
        /** Unknown is not safe: a warn border keeps that visible (I12). */
        "muted-warn": "border-warn/60 bg-muted text-muted-fg",
        brand: "border-brand/30 bg-brand/10 text-brand",
        outline: "border-border bg-transparent text-muted-fg",
      },
      size: {
        sm: "px-2 py-0.5 text-[11px]",
        md: "",
      },
    },
    defaultVariants: { tone: "muted", size: "md" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone, size }), className)} {...props} />;
}
