"use client";

import { Check, CheckCircle2, Clock, Info, Lock, MapPin, CircleDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import {
  useBooking,
  useBookingStatus,
  useCaptureEvidence,
  useChecklistToggle,
  useCompleteBooking,
  useJobAction,
} from "@/hooks/use-api";
import {
  AlertBanner,
  EmptyState,
  EvidenceTile,
  PageHeader,
  PersonAvatar,
  RatingStars,
  SectionCard,
  StatusBadge,
  StatusTimeline,
  WorkerPayoutCard,
} from "@/components/shared";
import { ContactActions, QueryGate, RequirementLine, simulatedToast } from "../parts";
import { dateShort, dateTimeLabel, duration, money, time } from "@/lib/format";
import type { Booking, BookingStatus } from "@/lib/types";

const EXECUTION_STEPS = ["Accepted", "On the way", "Arrived", "In progress", "Completed"];

function stepIndex(status: BookingStatus): number {
  switch (status) {
    case "confirmed":
      return 0;
    case "en_route":
      return 1;
    case "arrived":
      return 2;
    case "in_progress":
      return 3;
    case "awaiting_confirmation":
    case "completed":
      return 4;
    default:
      return -1;
  }
}

/** Timestamps for completed steps, recovered from the booking timeline. */
function stepTimes(booking: Booking): (string | undefined)[] {
  const find = (label: string) => {
    const ev = [...booking.timeline].reverse().find((e) => e.label === label);
    return ev ? time(ev.at) : undefined;
  };
  return [
    find("Worker accepted") ?? find("Request accepted from open pool"),
    find("On the way"),
    find("Arrived at location"),
    find("Service in progress"),
    find("Service completed"),
  ];
}

function Stepper({ current, times, lastLabel }: { current: number; times: (string | undefined)[]; lastLabel?: string }) {
  return (
    <ol className="flex" aria-label="Execution progress">
      {EXECUTION_STEPS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="min-w-0 flex-1 last:flex-none">
            <div className="flex items-center">
              {i > 0 && <span className={cn("h-0.5 flex-1", i <= current ? "bg-primary" : "bg-border")} aria-hidden />}
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-semibold",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary",
                  !done && !active && "border-border bg-card text-muted-foreground",
                )}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : i + 1}
              </span>
              {i < EXECUTION_STEPS.length - 1 && <span className={cn("h-0.5 flex-1", done ? "bg-primary" : "bg-border")} aria-hidden />}
            </div>
            <div className="mt-1.5 px-0.5 text-center">
              <p className={cn("text-[11px] font-medium leading-tight", active ? "text-foreground" : "text-muted-foreground")}>
                {i === EXECUTION_STEPS.length - 1 && lastLabel ? lastLabel : label}
              </p>
              {times[i] && <p className="tnum mt-0.5 text-[10px] text-muted-foreground">{times[i]}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function WorkerJobScreen({ bookingId }: { bookingId: string }) {
  const navigate = useAppStore((s) => s.navigate);
  const q = useBooking(bookingId);
  const statusMutation = useBookingStatus();
  const checklistMutation = useChecklistToggle();
  const evidenceMutation = useCaptureEvidence();
  const completeMutation = useCompleteBooking();
  const jobAction = useJobAction();

  return (
    <QueryGate query={q}>
      {({ booking, customer, address, review }) => {
        const step = stepIndex(booking.status);
        const times = stepTimes(booking);
        const checklistDone = booking.checklist.filter((c) => c.done).length;
        const checklistTotal = booking.checklist.length;
        const hasBefore = booking.evidence.some((e) => e.phase === "before");
        const hasAfter = booking.evidence.some((e) => e.phase === "after");
        const checklistUnlocked = booking.status === "in_progress";
        const beforeUnlocked = ["arrived", "in_progress", "awaiting_confirmation", "completed"].includes(booking.status);
        const afterUnlocked = ["in_progress", "awaiting_confirmation", "completed"].includes(booking.status);
        const allDone = checklistDone === checklistTotal && hasBefore && hasAfter;
        const paymentNote =
          booking.paymentStatus === "settled"
            ? "Payment settled to your account."
            : booking.paymentStatus === "authorized"
              ? "Customer's payment is held securely — released on completion and confirmation."
              : "Payment status updated by the platform.";

        return (
          <div className="space-y-6">
            <PageHeader
              onBack={() => navigate("worker-jobs")}
              eyebrow={`Service execution · ${booking.reference}`}
              title={booking.title}
              description={
                <span className="tnum">
                  {dateTimeLabel(booking.scheduledAt)} · {duration(booking.durationMin)} · payout {money(booking.price.workerNetPayout)} net
                </span>
              }
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={booking.status} />
                  <ContactActions name={customer.name} />
                </div>
              }
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Main column */}
              <div className="space-y-6 lg:col-span-2">
                <SectionCard title="Execution flow" description="Advance the status as you work — the customer is notified at every step.">
                  {booking.status === "pending_acceptance" ? (
                    <div className="space-y-4">
                      <AlertBanner
                        severity="warning"
                        title="This request is waiting for your response"
                        detail={`${customer.name} requested this service and their payment is already held securely. Accept to confirm the slot.`}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" onClick={() => jobAction.mutate({ id: booking.id, action: "accept" })} disabled={jobAction.isPending}>
                          {jobAction.isPending ? "Accepting…" : "Accept job"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          onClick={() => jobAction.mutate({ id: booking.id, action: "decline" })}
                          disabled={jobAction.isPending}
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  ) : booking.status === "cancelled" || booking.status === "declined" ? (
                    <AlertBanner
                      severity="warning"
                      title={booking.status === "cancelled" ? "This booking was cancelled" : "You declined this job"}
                      detail={booking.cancellationReason ?? "The customer has been informed. No payout is due."}
                    />
                  ) : (
                    <div className="space-y-5">
                      <Stepper current={step} times={times} lastLabel={booking.status === "awaiting_confirmation" ? "Awaiting customer" : undefined} />

                      {booking.status === "confirmed" && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 px-4 py-3">
                          <p className="text-[13px] text-muted-foreground">Headed out? Let {customer.name.split(" ")[0]} know you're on the way.</p>
                          <Button size="sm" onClick={() => statusMutation.mutate({ id: booking.id, status: "en_route" })} disabled={statusMutation.isPending}>
                            I'm on the way
                          </Button>
                        </div>
                      )}
                      {booking.status === "en_route" && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 px-4 py-3">
                          <p className="text-[13px] text-muted-foreground">Customer notified that you're on the way. Mark arrival at {" "}
                            {address.locality}.
                          </p>
                          <Button size="sm" onClick={() => statusMutation.mutate({ id: booking.id, status: "arrived" })} disabled={statusMutation.isPending}>
                            Mark arrival
                          </Button>
                        </div>
                      )}
                      {booking.status === "arrived" && (
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 px-4 py-3">
                          <p className="text-[13px] text-muted-foreground">Capture the before photo, then start the service and checklist.</p>
                          <Button size="sm" onClick={() => statusMutation.mutate({ id: booking.id, status: "in_progress" })} disabled={statusMutation.isPending}>
                            Start service
                          </Button>
                        </div>
                      )}
                      {booking.status === "in_progress" && (
                        <div className="rounded-md border border-primary/25 bg-accent/50 px-4 py-3.5">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-[13px] font-medium">Ready to complete the service?</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                All checklist items and both photos are validated by the platform before completion.
                              </p>
                            </div>
                            <Button size="sm" onClick={() => completeMutation.mutate(booking.id)} disabled={completeMutation.isPending}>
                              {completeMutation.isPending ? "Completing…" : "Complete service"}
                            </Button>
                          </div>
                          <ul className="mt-3 space-y-1.5">
                            <RequirementLine done={checklistDone === checklistTotal}>
                              Checklist complete ({checklistDone}/{checklistTotal})
                            </RequirementLine>
                            <RequirementLine done={hasBefore}>Before-service photo</RequirementLine>
                            <RequirementLine done={hasAfter}>After-service photo</RequirementLine>
                          </ul>
                          {allDone && (
                            <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-[oklch(0.45_0.10_155)]">
                              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.9} />
                              All requirements met — ready to complete.
                            </p>
                          )}
                        </div>
                      )}
                      {booking.status === "awaiting_confirmation" && (
                        <AlertBanner
                          severity="info"
                          title="Waiting for customer confirmation"
                          detail={`${customer.name} has been notified. Payment settles when they confirm — or automatically 24 hours after completion. Your payout for this job: ${money(booking.price.workerNetPayout)} net + ${money(booking.price.workerWelfareCredit)} welfare credit.`}
                        />
                      )}
                      {booking.status === "completed" && (
                        <div className="rounded-md border border-[oklch(0.88_0.05_155)] bg-[oklch(0.965_0.02_155)] px-4 py-3.5">
                          <p className="flex items-center gap-2 text-[13px] font-medium text-[oklch(0.40_0.09_155)]">
                            <CheckCircle2 className="h-4 w-4" strokeWidth={1.9} />
                            Payment settled — {money(booking.price.workerNetPayout)} added to your available balance
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-[oklch(0.40_0.09_155)]/80">
                            Plus {money(booking.price.workerWelfareCredit)} credited to your welfare fund. Full breakdown in Earnings.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </SectionCard>

                <SectionCard
                  title="Job requirements & checklist"
                  description="The cooperative's standard procedure for this service."
                >
                  <div className="space-y-4">
                    <div>
                      <p className="micro-label">Customer's description</p>
                      <p className="mt-1 text-sm leading-relaxed">{booking.description}</p>
                    </div>
                    {booking.customerNotes && (
                      <div>
                        <p className="micro-label">Note from customer</p>
                        <p className="mt-1 rounded-md bg-muted/50 px-3 py-2 text-[13px] leading-relaxed text-muted-foreground">
                          {booking.customerNotes}
                        </p>
                      </div>
                    )}
                    <Separator />
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="micro-label">Checklist</p>
                        <p className="tnum text-xs font-medium">
                          {checklistDone}/{checklistTotal} done
                        </p>
                      </div>
                      <Progress value={(checklistDone / Math.max(1, checklistTotal)) * 100} className="mt-2 h-1.5" />
                      <ul className="mt-3 space-y-1">
                        {booking.checklist.map((item) => (
                          <li key={item.id}>
                            <label
                              className={cn(
                                "flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 transition-colors",
                                checklistUnlocked ? "hover:bg-muted/60" : "cursor-not-allowed opacity-70",
                              )}
                            >
                              <Checkbox
                                checked={item.done}
                                disabled={!checklistUnlocked || checklistMutation.isPending}
                                onCheckedChange={(v) => checklistMutation.mutate({ id: booking.id, itemId: item.id, done: v === true })}
                                aria-label={item.label}
                              />
                              <span className={cn("text-[13px]", item.done && "text-muted-foreground line-through")}>{item.label}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                      {!checklistUnlocked && (
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Lock className="h-3 w-3" strokeWidth={1.9} />
                          Unlocks when the service is in progress.
                        </p>
                      )}
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Evidence — before & after" description="Shared with the customer with your completion note. Both photos are required.">
                  <div className="space-y-2.5">
                    <EvidenceTile
                      phase="before"
                      label="Fault or work area before you begin"
                      evidence={booking.evidence.find((e) => e.phase === "before")}
                      onCapture={() =>
                        evidenceMutation.mutate({ id: booking.id, phase: "before", label: "Before — recorded in app" })
                      }
                      disabled={!beforeUnlocked || evidenceMutation.isPending}
                    />
                    <EvidenceTile
                      phase="after"
                      label="Completed work after the service"
                      evidence={booking.evidence.find((e) => e.phase === "after")}
                      onCapture={() => evidenceMutation.mutate({ id: booking.id, phase: "after", label: "After — recorded in app" })}
                      disabled={!afterUnlocked || evidenceMutation.isPending}
                    />
                    <p className="flex items-start gap-1.5 pt-1 text-xs leading-relaxed text-muted-foreground">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
                      Photo capture is simulated in this prototype — timestamps are recorded exactly as a real upload would.
                    </p>
                  </div>
                </SectionCard>
              </div>

              {/* Right rail */}
              <div className="space-y-6">
                <SectionCard title="Customer & location">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <PersonAvatar name={customer.name} size="lg" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{customer.name}</p>
                        <p className="text-xs text-muted-foreground">Member since {dateShort(customer.memberSince)}</p>
                      </div>
                    </div>
                    <div className="rounded-md border bg-muted/30 p-3">
                      <p className="micro-label">Service address</p>
                      <p className="mt-1 text-[13px] leading-relaxed">
                        {address.label} — {address.line}
                        <br />
                        {address.locality}, {address.city} {address.pincode}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2.5"
                        onClick={() => simulatedToast("Opening navigation", "Route to the service address opened in your maps app.")}
                      >
                        <MapPin className="h-3.5 w-3.5" strokeWidth={1.9} />
                        Navigate to address
                      </Button>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="micro-label">Payment</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <StatusBadge status={booking.paymentStatus} />
                        </div>
                      </div>
                      <p className="max-w-[170px] text-right text-xs leading-relaxed text-muted-foreground">{paymentNote}</p>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Your payout for this job" description="Same booking — your side of the bill.">
                  <WorkerPayoutCard price={booking.price} />
                </SectionCard>

                <SectionCard title="Activity" description={`Reference ${booking.reference}`}>
                  <div className="max-h-[420px] overflow-y-auto scroll-slim pr-1">
                    <StatusTimeline events={[...booking.timeline].reverse()} />
                  </div>
                </SectionCard>

                {review && (
                  <SectionCard title="Customer feedback">
                    <div className="space-y-2">
                      <RatingStars value={review.rating} count={undefined} />
                      <p className="text-[13px] leading-relaxed text-muted-foreground">"{review.comment}"</p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" strokeWidth={1.9} />
                        {review.customerName} · {dateShort(review.createdAt)}
                      </p>
                    </div>
                  </SectionCard>
                )}
              </div>
            </div>

            {booking.status === "awaiting_confirmation" && (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <CircleDashed className="h-3.5 w-3.5" strokeWidth={1.9} />
                Settlement runs automatically 24 hours after completion if the customer does not respond — no action needed from you.
              </p>
            )}
          </div>
        );
      }}
    </QueryGate>
  );
}

/* Keeps the empty-state import used for a degenerate case (no booking id). */
export function WorkerJobMissing() {
  const navigate = useAppStore((s) => s.navigate);
  return (
    <EmptyState
      title="Job not found"
      description="This job is no longer available."
      action={
        <Button variant="outline" size="sm" onClick={() => navigate("worker-jobs")}>
          Back to jobs
        </Button>
      }
    />
  );
}
