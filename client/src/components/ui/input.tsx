import {
  forwardRef,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

const field =
  "w-full rounded-xl border border-border bg-bg-soft px-4 text-base text-fg placeholder:text-muted-fg transition-colors hover:border-border-hi focus:border-brand focus:bg-card disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(field, "min-h-[48px]", className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(field, "min-h-[88px] py-3 leading-relaxed", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

/** Small caps label above a field. Kept here so every form uses one scale. */
export function FieldLabel({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "block text-xs font-medium uppercase tracking-wider text-muted-fg",
        className,
      )}
      {...props}
    />
  );
}
