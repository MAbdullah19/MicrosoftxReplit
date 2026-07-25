import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "min-h-[44px] w-full rounded-lg border border-border bg-card px-4 text-base placeholder:text-muted-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-lg border border-border bg-card px-4 py-3 text-base placeholder:text-muted-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
