"use client";

import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PersonAvatar, PriceTotal, StatusBadge } from "@/components/shared";
import { dateTimeLabel } from "@/lib/format";
import type { Booking, Worker } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Booking list card — used on Bookings tabs and the home recent strip. */
export function BookingCard({
  booking,
  worker,
  onView,
  compact,
  className,
}: {
  booking: Booking;
  worker?: Worker;
  onView: () => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-primary/30 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <PersonAvatar name={worker?.name ?? "Member"} size={compact ? "sm" : "md"} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate text-[14px] font-semibold leading-tight">{booking.title}</h3>
            <StatusBadge status={booking.status} />
          </div>
          <p className="mt-1 truncate text-[13px] text-muted-foreground">
            {worker ? `${worker.name} · ${worker.tradeTitle}` : "Member"}
          </p>
          <p className="tnum mt-0.5 text-xs text-muted-foreground">{dateTimeLabel(booking.scheduledAt)}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
        <div className="text-left sm:text-right">
          <p className="micro-label mb-0.5 hidden sm:block">Total</p>
          <PriceTotal price={booking.price} />
        </div>
        <Button variant="outline" size="sm" onClick={onView} aria-label={`View booking ${booking.reference}`}>
          View
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.9} />
        </Button>
      </div>
    </article>
  );
}
