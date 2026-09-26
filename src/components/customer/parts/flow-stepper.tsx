"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const FLOW_STEPS = [
  { id: "service", label: "Service" },
  { id: "requirements", label: "Requirements" },
  { id: "match", label: "Match" },
  { id: "slot", label: "Slot" },
  { id: "review", label: "Review & pay" },
  { id: "confirmation", label: "Confirmation" },
] as const;

/**
 * Six-step progress indicator for the booking flow.
 * Completed steps are clickable (jump back); the current step is highlighted.
 * Labels collapse to a "Step X of 6" line on mobile.
 */
export function FlowStepper({
  step,
  onJump,
}: {
  step: number;
  onJump: (step: number) => void;
}) {
  return (
    <nav aria-label="Booking progress">
      <p className="micro-label mb-2 sm:hidden">
        Step {step} of {FLOW_STEPS.length} · {FLOW_STEPS[step - 1].label}
      </p>
      <ol className="flex items-start">
        {FLOW_STEPS.map((s, i) => {
          const idx = i + 1;
          const done = idx < step;
          const current = idx === step;
          const isLast = i === FLOW_STEPS.length - 1;
          return (
            <li key={s.id} className={cn("flex min-w-0 flex-col items-center", !isLast && "flex-1")}>
              <div className="flex w-full items-center">
                <button
                  type="button"
                  disabled={!done}
                  onClick={() => onJump(idx)}
                  aria-current={current ? "step" : undefined}
                  aria-label={`Step ${idx}: ${s.label}${done ? " (completed)" : current ? " (current)" : ""}`}
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                    done && "cursor-pointer border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                    current && "border-primary text-primary",
                    !done && !current && "border-border text-muted-foreground",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.2} /> : <span className="tnum">{idx}</span>}
                </button>
                {!isLast && (
                  <span aria-hidden className={cn("mx-1.5 h-px flex-1 sm:mx-2", done ? "bg-primary/50" : "bg-border")} />
                )}
              </div>
              <span
                className={cn(
                  "mt-1.5 hidden text-center text-[11px] leading-tight sm:block",
                  current ? "font-semibold text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
