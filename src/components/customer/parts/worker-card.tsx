"use client";

import { MapPin, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PersonAvatar, RatingStars, MatchBadge, StatusBadge } from "@/components/shared";
import { availableToday } from "../constants";
import type { Worker } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Member directory card — used by Discover results (full) and the home
 * "Recommended for you" strip (compact, with match badge).
 */
export function WorkerCard({
  worker,
  score,
  reason,
  onView,
  onBook,
  compact,
  className,
}: {
  worker: Worker;
  /** match score, when the card comes from the recommendation engine */
  score?: number;
  reason?: string;
  onView: () => void;
  onBook: () => void;
  compact?: boolean;
  className?: string;
}) {
  const today = availableToday(worker);
  return (
    <article
      className={cn(
        "flex flex-col rounded-lg border bg-card p-5 transition-colors hover:border-primary/30",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <PersonAvatar name={worker.name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate text-[15px] font-semibold leading-tight">{worker.name}</h3>
            <StatusBadge status="verified" label="Verified" />
            {typeof score === "number" && <MatchBadge score={score} size="sm" />}
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{worker.tradeTitle}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            <RatingStars value={worker.rating} count={worker.reviewCount} />
            <span className="tnum">{worker.completedJobs} services</span>
          </div>
        </div>
      </div>

      {!compact && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" strokeWidth={1.9} />
              {worker.locality} · <span className="tnum">{worker.distanceKm} km</span>
            </span>
            {today && (
              <span className="inline-flex items-center gap-1 font-medium text-success-deep">
                <BadgeCheck className="h-3.5 w-3.5" strokeWidth={1.9} /> Available today
              </span>
            )}
          </div>
          <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">{worker.baseRateNote}</p>
        </>
      )}

      {reason && <p className="mt-2.5 text-[13px] leading-snug text-muted-foreground">{reason}</p>}

      <div className="mt-4 flex items-center gap-2 border-t pt-4">
        <Button variant="outline" size="sm" className="flex-1" onClick={onView}>
          View profile
        </Button>
        <Button size="sm" className="flex-1" onClick={onBook}>
          Book
        </Button>
      </div>
    </article>
  );
}
