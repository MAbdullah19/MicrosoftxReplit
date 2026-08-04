/** shadcn/21st.dev-style primitive: cva variants + `cn()` merge + forwardRef.
 *  Targets stay ≥44 px (§6); focus lands on the shared ring from index.css. */
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "relative inline-flex min-h-[44px] select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-base font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        /** The one gradient button. Used sparingly — one per screen. */
        primary:
          "bg-gradient-to-b from-brand to-[hsl(var(--brand)/0.82)] text-white shadow-[0_1px_0_0_hsl(0_0%_100%/0.18)_inset,0_6px_20px_-8px_hsl(var(--brand)/0.7)] hover:brightness-110",
        secondary:
          "border border-border bg-card text-fg hover:border-border-hi hover:bg-card-hi",
        ghost: "text-muted-fg hover:bg-card-hi hover:text-fg",
        danger:
          "bg-gradient-to-b from-bad to-[hsl(var(--bad)/0.82)] text-white shadow-[0_1px_0_0_hsl(0_0%_100%/0.18)_inset] hover:brightness-110",
        /** Verdict-tinted outline, for "I agree / I disagree" style choices. */
        ok: "border border-ok/40 bg-ok/10 text-ok hover:bg-ok/20",
        bad: "border border-bad/40 bg-bad/10 text-bad hover:bg-bad/20",
        link: "min-h-0 rounded px-0 text-brand underline-offset-4 hover:underline",
      },
      size: {
        sm: "min-h-[36px] gap-1.5 rounded-lg px-3 text-sm",
        md: "px-4 py-2",
        lg: "min-h-[52px] px-6 text-lg",
        icon: "w-11 px-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";

export { buttonVariants };
