"use client";

import { ChevronRight, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PersonAvatar, PriceTotal, StatusBadge } from "@/components/shared";
import { dateTimeLabel } from "@/lib/format";
import type { Booking, Worker } from "@/lib/types";
import { cn } from "@/lib/utils";
import { recurrenceLabel } from "../constants";

/** Amber chip marking a standing-order (recurring) booking. */
export function StandingOrderChip({ recurrence, className }: { recurrence: Booking["recurrence"]; className?: string }) {
  if (!recurrence) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border border-[oklch(0.90_0.06_80)] bg-[oklch(0.965_0.035_85)] px-1.5 py-0.5 text-[11px] font-medium text-[oklch(0.45_0.10_65)]",
        className,
      )}
    >
      <Repeat className="h-3 w-3" strokeWidth={1.9} aria-hidden />
      Standing · {recurrenceLabel(recurrence).toLowerCase()}
    </span>
  );
}

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
            <StandingOrderChip recurrence={booking.recurrence} />
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
