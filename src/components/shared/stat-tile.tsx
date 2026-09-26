"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * StatTile — the house KPI tile. Typographic, disciplined:
 * micro label → large tabular value → supporting line / delta.
 * Optional right-aligned accessory (sparkline, badge, action).
 */
export function StatTile({
  label,
  value,
  sub,
  delta,
  deltaTone = "neutral",
  accessory,
  className,
  emphasis,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  delta?: string;
  deltaTone?: "up" | "down" | "neutral";
  accessory?: ReactNode;
  className?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card px-5 py-4",
        emphasis && "border-primary/25 bg-primary-muted",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="micro-label">{label}</p>
          <p className={cn("tnum mt-1.5 font-semibold tracking-tight", emphasis ? "text-2xl" : "text-[22px]")}>{value}</p>
          {(sub || delta) && (
            <p className="mt-1 flex items-start gap-1.5 text-xs leading-snug text-muted-foreground">
              {delta && (
                <span
                  className={cn(
                    "tnum pt-px font-medium",
                    deltaTone === "up" && "text-success-deep",
                    deltaTone === "down" && "text-destructive",
                  )}
                >
                  {delta}
                </span>
              )}
              {sub && <span className="line-clamp-2 min-w-0">{sub}</span>}
            </p>
          )}
        </div>
        {accessory && <div className="shrink-0">{accessory}</div>}
      </div>
    </div>
  );
}

/** A quiet stat for inline rows / sidebars — no card chrome. */
export function StatInline({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="micro-label">{label}</p>
      <p className="tnum mt-0.5 text-lg font-semibold tracking-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
