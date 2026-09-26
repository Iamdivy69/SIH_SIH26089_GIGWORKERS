"use client";

import { Clock, MapPin, Timer, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/shared";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { useBooking, useSchedule } from "@/hooks/use-api";
import { PageHeader, SectionCard, StatusBadge } from "@/components/shared";
import { JobRowCard, QueryGate } from "../parts";
import { DAY_NAMES, dateShort, duration, money, time, toDate } from "@/lib/format";
import type { Booking } from "@/lib/types";

const DAY_MS = 86400000;

/** Compact schedule chip for the desktop week grid. Fetches locality. */
function ScheduleChip({ booking }: { booking: Booking }) {
  const navigate = useAppStore((s) => s.navigate);
  const detail = useBooking(booking.id);
  const locality = detail.data?.address.locality;
  return (
    <button
      type="button"
      onClick={() => navigate("worker-job", { bookingId: booking.id })}
      className="mt-2 w-full rounded-md border bg-card p-2 text-left transition-colors hover:border-primary/30 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      aria-label={`${booking.title} at ${time(booking.scheduledAt)} — open job`}
    >
      <p className="tnum text-[11px] font-semibold text-primary">{time(booking.scheduledAt)}</p>
      <p className="mt-0.5 line-clamp-2 text-[12px] font-medium leading-tight">{booking.title}</p>
      <p className="mt-1 flex items-center gap-1 text-[10.5px] text-muted-foreground">
        <StatusBadge status={booking.status} dotOnly />
        <span className="tnum">{duration(booking.durationMin)}</span>
        {locality && <span className="truncate">· {locality}</span>}
      </p>
    </button>
  );
}

export function WorkerSchedule() {
  const navigate = useAppStore((s) => s.navigate);
  const q = useSchedule();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Work"
        title="My schedule"
        description="Confirmed and in-progress services for the coming week. Tap any job to open its execution screen."
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("worker-availability")}>
            <Clock className="h-3.5 w-3.5" strokeWidth={1.9} />
            Edit availability
          </Button>
        }
      />
      <QueryGate query={q}>
        {(data) => {
          const windowEnd = todayStart.getTime() + 7 * DAY_MS;
          const inWindow = data.bookings.filter((b) => {
            const t = toDate(b.scheduledAt).getTime();
            return t >= todayStart.getTime() && t < windowEnd;
          });
          const days = Array.from({ length: 7 }, (_, i) => new Date(todayStart.getTime() + i * DAY_MS));
          const byDay = days.map((d) => ({
            date: d,
            jobs: inWindow
              .filter((b) => toDate(b.scheduledAt).toDateString() === d.toDateString())
              .sort((a, b) => +toDate(a.scheduledAt) - +toDate(b.scheduledAt)),
          }));
          const awaiting = data.bookings.filter((b) => b.status === "awaiting_confirmation");
          const activeCount = data.bookings.filter((b) => ["en_route", "arrived", "in_progress"].includes(b.status)).length;
          const bookedMinutes = inWindow
            .filter((b) => !["cancelled", "declined"].includes(b.status))
            .reduce((a, b) => a + b.durationMin, 0);
          const expectedNet = inWindow
            .filter((b) => !["cancelled", "declined"].includes(b.status))
            .reduce((a, b) => a + b.price.workerNetPayout, 0);
          const welfareCredits = inWindow
            .filter((b) => !["cancelled", "declined"].includes(b.status))
            .reduce((a, b) => a + b.price.workerWelfareCredit, 0);

          return (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label="Services this week" value={inWindow.length} sub={`${activeCount} live right now`} />
                <StatTile label="Hours booked" value={duration(bookedMinutes)} sub="Across confirmed slots" />
                <StatTile label="Expected net" value={money(expectedNet)} sub="Cash payout for the week" emphasis />
                <StatTile label="Welfare credits" value={money(welfareCredits)} sub="Added to your fund" />
              </div>

              <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Desktop: 7-day columns */}
                <div className="min-w-0 lg:col-span-2">
                  <div className="hidden gap-3 md:grid md:grid-cols-7">
                    {byDay.map(({ date, jobs }) => {
                      const isToday = date.toDateString() === new Date().toDateString();
                      return (
                        <div
                          key={date.toISOString()}
                          className={cn(
                            "min-h-[190px] rounded-lg border p-2.5",
                            isToday ? "border-primary/40 bg-accent/30" : "bg-card",
                          )}
                        >
                          <p className={cn("micro-label", isToday && "text-primary")}>
                            {DAY_NAMES[date.getDay()]} <span className="tnum">{date.getDate()}</span>
                          </p>
                          {jobs.length === 0 ? (
                            <p className="mt-3 text-xs text-muted-foreground/60">—</p>
                          ) : (
                            jobs.map((b) => <ScheduleChip key={b.id} booking={b} />)
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Mobile: day list */}
                  <div className="space-y-4 md:hidden">
                    {byDay.map(({ date, jobs }) => {
                      const isToday = date.toDateString() === new Date().toDateString();
                      return (
                        <div key={date.toISOString()}>
                          <div className="mb-2 flex items-center justify-between">
                            <p className={cn("text-[13px] font-semibold", isToday && "text-primary")}>
                              {isToday ? "Today" : DAY_NAMES[date.getDay()]} · <span className="tnum">{dateShort(date.toISOString())}</span>
                            </p>
                            <span className="tnum text-xs text-muted-foreground">
                              {jobs.length} job{jobs.length === 1 ? "" : "s"}
                            </span>
                          </div>
                          {jobs.length === 0 ? (
                            <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                              No jobs booked.
                            </p>
                          ) : (
                            <div className="space-y-2.5">
                              {jobs.map((b) => (
                                <JobRowCard key={b.id} booking={b} showCustomer />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Rail */}
                <div className="space-y-6">
                  <SectionCard title="Awaiting settlement" description="Completed services waiting on customer confirmation.">
                    {awaiting.length > 0 ? (
                      <ul className="space-y-2.5">
                        {awaiting.map((b) => (
                          <JobRowCard key={b.id} booking={b} showCustomer />
                        ))}
                      </ul>
                    ) : (
                      <p className="rounded-lg border border-dashed bg-muted/30 px-4 py-5 text-center text-[13px] text-muted-foreground">
                        Nothing pending — all completed services are settled.
                      </p>
                    )}
                  </SectionCard>

                  <SectionCard title="Planning notes">
                    <ul className="space-y-2.5 text-[13px] leading-relaxed text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <Timer className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
                        Leave a 30-minute travel buffer between jobs — it protects your on-time record.
                      </li>
                      <li className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
                        Jobs outside your 6 km service radius are highlighted before you accept them.
                      </li>
                      <li className="flex items-start gap-2">
                        <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
                        Weekend evening shifts (3+ per month) earn the ₹150 incentive bonus approved by member vote.
                      </li>
                    </ul>
                  </SectionCard>
                </div>
              </div>
            </div>
          );
        }}
      </QueryGate>
    </div>
  );
}
