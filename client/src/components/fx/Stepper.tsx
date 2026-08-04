/** React Bits — "Stepper".
 *  https://reactbits.dev/components/stepper
 *  Ported: `StepIndicator`, `StepConnector` and the path-drawing `CheckIcon`
 *  are upstream's, with the hard-coded #5227FF / #222 / neutral-600 replaced by
 *  design tokens.
 *
 *  What is *not* ported is upstream's content carousel and Back/Continue
 *  footer. /join cannot be a free-navigation wizard: the passkey ceremony is a
 *  browser dialog you cannot step back through, and the backup codes are shown
 *  exactly once (§14). So this exports the rail alone, and the page keeps
 *  driving its own state. */
import { motion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";

type Status = "inactive" | "active" | "complete";

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.1, type: "tween", ease: "easeOut", duration: 0.3 }}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function StepIndicator({ step, status }: { step: number; status: Status }) {
  return (
    <motion.div animate={status} initial={false} className="relative shrink-0">
      <motion.div
        variants={{
          inactive: {
            scale: 1,
            backgroundColor: "hsl(var(--muted))",
            color: "hsl(var(--muted-fg))",
          },
          active: { scale: 1.06, backgroundColor: "hsl(var(--brand))", color: "hsl(var(--bg))" },
          complete: { scale: 1, backgroundColor: "hsl(var(--ok))", color: "hsl(var(--bg))" },
        }}
        transition={{ duration: 0.3 }}
        className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
      >
        {status === "complete" ? (
          <CheckIcon className="h-4 w-4" />
        ) : status === "active" ? (
          <div className="h-2.5 w-2.5 rounded-full bg-current" />
        ) : (
          <span>{step}</span>
        )}
      </motion.div>
    </motion.div>
  );
}

function StepConnector({ isComplete }: { isComplete: boolean }) {
  const lineVariants: Variants = {
    incomplete: { width: 0 },
    complete: { width: "100%" },
  };
  return (
    <div className="relative mx-2 h-0.5 flex-1 overflow-hidden rounded bg-border">
      <motion.div
        className="absolute left-0 top-0 h-full bg-ok"
        variants={lineVariants}
        initial={false}
        animate={isComplete ? "complete" : "incomplete"}
        transition={{ duration: 0.4 }}
      />
    </div>
  );
}

/** `current` is 1-based; a value greater than `steps.length` marks it all done. */
export function StepRail({
  steps,
  current,
  className,
}: {
  steps: string[];
  current: number;
  className?: string;
}) {
  return (
    <div className={cn("w-full", className)}>
      <ol className="flex w-full items-center">
        {steps.map((label, index) => {
          const stepNumber = index + 1;
          const status: Status =
            current === stepNumber ? "active" : current < stepNumber ? "inactive" : "complete";
          return (
            <li
              key={label}
              className={cn("flex items-center", index < steps.length - 1 && "flex-1")}
              aria-current={status === "active" ? "step" : undefined}
            >
              <StepIndicator step={stepNumber} status={status} />
              {index < steps.length - 1 && <StepConnector isComplete={current > stepNumber} />}
            </li>
          );
        })}
      </ol>
      <div className="mt-2 flex w-full justify-between text-xs">
        {steps.map((label, index) => (
          <span
            key={label}
            className={cn(
              "shrink-0",
              current === index + 1 ? "font-medium text-fg" : "text-muted-fg",
              index === 0 && "text-left",
              index === steps.length - 1 && "text-right",
            )}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
