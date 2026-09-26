"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function RatingStars({
  value,
  size = 14,
  showValue = true,
  count,
  className,
}: {
  value: number;
  size?: number;
  showValue?: boolean;
  count?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {showValue && <span className="tnum text-sm font-semibold">{value.toFixed(1)}</span>}
      <span className="inline-flex items-center gap-0.5" aria-label={`Rated ${value} out of 5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            width={size}
            height={size}
            className={cn(
              i <= Math.round(value)
                ? "fill-[oklch(0.72_0.115_75)] text-[oklch(0.72_0.115_75)]"
                : "fill-transparent text-muted-foreground/40",
            )}
          />
        ))}
      </span>
      {count !== undefined && <span className="tnum text-xs text-muted-foreground">({count})</span>}
    </span>
  );
}
