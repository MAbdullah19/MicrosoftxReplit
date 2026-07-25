import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-medium",
  {
    variants: {
      tone: {
        ok: "border-ok/30 bg-ok/10 text-ok",
        bad: "border-bad/30 bg-bad/10 text-bad",
        warn: "border-warn/40 bg-warn/10 text-warn",
        muted: "border-border bg-muted text-muted-fg",
        "muted-warn": "border-warn/60 bg-muted text-muted-fg",
        brand: "border-brand/30 bg-brand/10 text-brand",
      },
    },
    defaultVariants: { tone: "muted" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
