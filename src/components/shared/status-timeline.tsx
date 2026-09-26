"use client";

import { ReactNode } from "react";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BookingEvent } from "@/lib/types";

export function StatusTimeline({ events, className, dense }: { events: BookingEvent[]; className?: string; dense?: boolean }) {
  return (
    <ol className={cn("relative space-y-0", className)}>
      {events.map((ev, i) => {
        const isLast = i === events.length - 1;
        return (
          <li key={ev.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast && <span className="absolute left-[5px] top-4 h-full w-px bg-border" aria-hidden />}
            <span
              className={cn(
                "relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2",
                isLast ? "border-primary bg-primary" : "border-border bg-card",
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className={cn("text-[13px] font-medium", !isLast && "text-foreground/80")}>{ev.label}</p>
                <time className="tnum shrink-0 text-[11px] text-muted-foreground" dateTime={ev.at}>
                  {relativeTime(ev.at)}
                </time>
              </div>
              {ev.detail && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{ev.detail}</p>}
              {ev.by && !dense && <p className="mt-0.5 text-[11px] text-muted-foreground/80">by {ev.by}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
