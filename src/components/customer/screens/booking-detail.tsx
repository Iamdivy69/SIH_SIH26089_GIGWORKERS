"use client";

import { useRef, useState } from "react";
import {
  CalendarClock,
  CalendarPlus,
  Camera,
  MessageSquare,
  Phone,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  AlertBanner,
  BookingChat,
  CustomerPriceLines,
  ErrorState,
  MatchBadge,
  PageHeader,
  PaymentAllocation,
  PersonAvatar,
  RatingStars,
  SectionCard,
  StatusBadge,
  StatusTimeline,
} from "@/components/shared";
import { useBooking, useCancelBooking, useConfirmBooking, useRateBooking } from "@/hooks/use-api";
import { useAppStore } from "@/store/app-store";
import { dateTimeLabel, dateShort, duration, money, relativeTime } from "@/lib/format";
import type { Booking } from "@/lib/types";
import { addressById, addressLine, nextOccurrenceAt, recurrenceLabel } from "../constants";
import { RatingInput } from "../parts/rating-input";
import { StandingOrderChip } from "../parts/booking-card";

function statusMessage(booking: Booking, worker?: { name: string }): { severity: "info" | "warning"; title: string; detail: string } {
  const name = worker?.name ?? "your member";
  const slot = dateTimeLabel(booking.scheduledAt);
  switch (booking.status) {
    case "pending_acceptance":
      return {
        severity: "info",
        title: `Waiting for ${name} to accept`,
        detail: "Most members respond within 15 minutes. Your payment is only held — it settles after you confirm the completed service.",
      };
    case "confirmed":
      return {
        severity: "info",
        title: `${name} has confirmed`,
        detail: `Visit scheduled for ${slot}. You'll be notified here when the member is on the way.`,
      };
    case "en_route":
      return { severity: "info", title: `${name} is on the way`, detail: "You can call or message from this page at any time." };
    case "arrived":
      return { severity: "info", title: `${name} has arrived`, detail: "Work will begin after a quick on-site check of the issue." };
    case "in_progress":
      return {
        severity: "info",
        title: "Work in progress",
        detail: `${name} is working through the shared service checklist. Before/after photos are recorded for transparency.`,
      };
    case "awaiting_confirmation":
      return {
        severity: "warning",
        title: "Work complete — your confirmation is needed",
        detail: "Confirm the service to release payment to your member. You can also rate the service in the same step.",
      };
    case "completed":
      return {
        severity: "info",
        title: "Service completed",
        detail: booking.paymentStatus === "settled"
          ? "Payment has been settled to your member. Your invoice is available in Payments & invoices."
          : "Payment will settle to your member shortly.",
      };
    case "cancelled":
      return {
        severity: "warning",
        title: "Booking cancelled",
        detail: `${booking.cancellationReason ?? "Cancelled by you"} · the held amount is refunded to your original payment method (simulated).`,
      };
    case "declined":
      return {
        severity: "warning",
        title: "Request declined",
        detail: "The member could not take this job. You can rebook the same service — we'll match another verified member near you.",
      };
  }
}

export function BookingDetailScreen({ bookingId }: { bookingId: string }) {
  const navigate = useAppStore((s) => s.navigate);
  const { data, isLoading, isError, refetch } = useBooking(bookingId);
  const cancelBooking = useCancelBooking();
  const confirmBooking = useConfirmBooking();
  const rateBooking = useRateBooking();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [rating, setRating] = useState(0);
  const [ratingTags, setRatingTags] = useState<string[]>([]);
  const [ratingComment, setRatingComment] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-20 rounded-lg border bg-card" />
        <LoadingBlock />
      </div>
    );
  }
  if (isError || !data) {
    return <ErrorState message="This booking could not be loaded." onRetry={() => refetch()} />;
  }

  const { booking, worker, review } = data;
  const address = addressById(booking.addressId);
  const msg = statusMessage(booking, worker);
  const cancellable = ["pending_acceptance", "confirmed"].includes(booking.status);
  const canConfirm = booking.status === "awaiting_confirmation";
  const canRate = booking.status === "completed" && !review;
  /* When the next standing-order occurrence is auto-scheduled (+7/+30 days, same time). */
  const nextVisit = booking.recurrence ? nextOccurrenceAt(booking) : null;
  const nextVisitLabel = nextVisit ? dateTimeLabel(nextVisit) : "—";

  const resetRating = () => {
    setRating(0);
    setRatingTags([]);
    setRatingComment("");
  };

  return (
    <div>
      <PageHeader
        eyebrow={`Booking ${booking.reference} · ${dateTimeLabel(booking.scheduledAt)}`}
        title={booking.title}
        description={`${worker.name} · ${worker.tradeTitle}`}
        onBack={() => navigate("customer-bookings")}
        actions={
          <>
            <StatusBadge status={booking.status} />
            {cancellable && (
              <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    Cancel booking
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{booking.recurrence ? "End standing order & cancel booking?" : "Cancel this booking?"}</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3">
                        {booking.recurrence && (
                          <span className="block rounded-md border border-[oklch(0.90_0.06_80)] bg-[oklch(0.965_0.035_85)] px-3 py-2 text-[13px] font-medium text-[oklch(0.45_0.10_65)]">
                            This also ends the standing order series — no further {recurrenceLabel(booking.recurrence).toLowerCase()} visits will be scheduled.
                          </span>
                        )}
                        <span className="block">
                          {worker.name} will be notified and the slot released. The held amount of{" "}
                          <span className="tnum font-semibold text-foreground">{money(booking.price.customerTotal)}</span> is
                          refunded to your payment method (simulated in this prototype).
                        </span>
                        <Textarea
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          placeholder="Reason (optional) — shared with the member and the support team."
                          rows={3}
                          aria-label="Cancellation reason"
                        />
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep booking</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-white hover:bg-destructive/90"
                      onClick={() => cancelBooking.mutate({ id: booking.id, reason: cancelReason.trim() || undefined })}
                    >
                      {booking.recurrence ? "End standing order" : "Cancel booking"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        }
      />

      <div className="space-y-6">
        <AlertBanner severity={msg.severity} title={msg.title} detail={msg.detail} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Main column */}
          <div className="min-w-0 space-y-6">
            <SectionCard
              title="Your service member"
              actions={typeof booking.matchScore === "number" ? <MatchBadge score={booking.matchScore} size="sm" /> : undefined}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => navigate("customer-worker", { workerId: worker.id })}
                  className="flex min-w-0 items-center gap-3 rounded-md p-1 text-left transition-colors hover:bg-muted/50"
                >
                  <PersonAvatar name={worker.name} size="lg" />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold">{worker.name}</span>
                    <span className="block truncate text-[13px] text-muted-foreground">{worker.tradeTitle}</span>
                    <RatingStars value={worker.rating} count={worker.reviewCount} className="mt-1" />
                  </span>
                </button>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast(`Calling ${worker.name}…`, { description: "Contact is simulated in this prototype." })}
                  >
                    <Phone className="h-3.5 w-3.5" strokeWidth={1.9} /> Call
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => chatRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
                  >
                    <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.9} /> Message
                  </Button>
                </div>
              </div>
            </SectionCard>

            <div ref={chatRef}>
              <SectionCard
                title={`Messages with ${worker.name.split(" ")[0]}`}
                description="Scoped to this booking — access details, timings and updates stay with the service record."
              >
                <BookingChat booking={booking} viewerRole="customer" otherName={worker.name} />
              </SectionCard>
            </div>

            {(canConfirm || canRate) && (
              <SectionCard
                title={canConfirm ? "Confirm completion" : "Rate this service"}
                description={
                  canConfirm
                    ? "Releasing payment is in your hands — confirm only after you're satisfied with the work."
                    : "Your rating keeps quality visible for other households — and for the member's cooperative record."
                }
              >
                <RatingInput
                  value={canConfirm ? rating : rating || review?.rating || 0}
                  onChange={setRating}
                  tags={ratingTags}
                  onTagsChange={setRatingTags}
                  comment={ratingComment}
                  onCommentChange={setRatingComment}
                />
                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  {canConfirm ? (
                    <>
                      <Button
                        onClick={() =>
                          confirmBooking.mutate(
                            {
                              id: booking.id,
                              ...(rating > 0 ? { rating, comment: ratingComment.trim(), tags: ratingTags } : {}),
                            },
                            { onSuccess: () => resetRating() },
                          )
                        }
                        disabled={confirmBooking.isPending}
                      >
                        {confirmBooking.isPending ? "Confirming…" : rating > 0 ? "Confirm & submit rating" : "Confirm service completion"}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => confirmBooking.mutate({ id: booking.id })}
                        disabled={confirmBooking.isPending}
                        className="text-muted-foreground"
                      >
                        Confirm without rating
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={() =>
                        rateBooking.mutate(
                          { id: booking.id, rating: rating || 5, comment: ratingComment.trim(), tags: ratingTags },
                          { onSuccess: () => resetRating() },
                        )
                      }
                      disabled={rateBooking.isPending || rating === 0}
                    >
                      {rateBooking.isPending ? "Submitting…" : "Submit rating"}
                    </Button>
                  )}
                </div>
                {canConfirm && rating === 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">Rating is optional — you can also rate later from this page.</p>
                )}
                {canRate && rating === 0 && <p className="mt-2 text-xs text-muted-foreground">Pick a star rating to submit.</p>}
              </SectionCard>
            )}

            {review && (
              <SectionCard title="Your review" description={`${dateShort(review.createdAt)} · ${booking.reference}`}>
                <div className="flex items-start gap-3">
                  <PersonAvatar name={review.customerName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-3">
                      <p className="text-[13px] font-medium">{review.customerName}</p>
                      <RatingStars value={review.rating} showValue={false} />
                    </div>
                    {review.comment && <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{review.comment}</p>}
                    {review.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {review.tags.map((t) => (
                          <span key={t} className="rounded-sm border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </SectionCard>
            )}

            <SectionCard title="Status history" description="Every step is timestamped and attributable — an auditable trail of this service.">
              <StatusTimeline events={booking.timeline} />
            </SectionCard>

            {booking.evidence.length > 0 && (
              <SectionCard title="Work evidence" description="Photos recorded by the member during the service.">
                <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {booking.evidence.map((ev) => (
                    <li key={`${ev.phase}-${ev.capturedAt}`} className="rounded-lg border p-4">
                      <p className="micro-label capitalize">{ev.phase} · photo</p>
                      <p className="mt-1.5 flex items-center gap-2 text-[13px] font-medium">
                        <Camera className="h-4 w-4 text-muted-foreground" strokeWidth={1.9} />
                        {ev.label}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Captured {relativeTime(ev.capturedAt)}</p>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}
          </div>

          {/* Right rail */}
          <div className="space-y-6">
            {booking.recurrence && (
              <SectionCard
                title="Standing order"
                description={`Series ${booking.seriesId ?? "—"} · same member, same rate, priority scheduling`}
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StandingOrderChip recurrence={booking.recurrence} />
                    <span className="tnum text-[13px] text-muted-foreground">
                      Occurrence {booking.occurrenceIndex ?? 1} of the series
                    </span>
                  </div>
                  {booking.seriesEnded ? (
                    <p className="rounded-md border bg-muted/30 px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground">
                      This standing order was ended — no further {recurrenceLabel(booking.recurrence).toLowerCase()} visits will be scheduled.
                    </p>
                  ) : (
                    <p className="flex items-start gap-2 rounded-md border border-[oklch(0.90_0.06_80)] bg-[oklch(0.965_0.035_85)] px-3 py-2.5 text-[13px] leading-relaxed text-[oklch(0.45_0.10_65)]">
                      <CalendarClock className="tnum mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
                      {booking.status === "completed"
                        ? `The next visit was scheduled automatically for ${nextVisitLabel}.`
                        : `After you confirm this visit, the next one is scheduled automatically for ${nextVisitLabel}.`}
                    </p>
                  )}
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Standing orders give our members stable, predictable income — the cooperative's core promise. {worker.name} keeps priority on every occurrence.
                  </p>
                </div>
              </SectionCard>
            )}

            <SectionCard title="What you pay" description="Line-by-line, exactly as authorized at booking.">
              <CustomerPriceLines price={booking.price} />
              <div className="mt-5 border-t pt-5">
                <p className="micro-label mb-3">Where it goes</p>
                <PaymentAllocation price={booking.price} />
              </div>
              <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Star className="h-3.5 w-3.5 text-[oklch(0.72_0.115_75)]" strokeWidth={1.9} />
                Payment status: <StatusBadge status={booking.paymentStatus} />
              </p>
            </SectionCard>

            <SectionCard title="Service details">
              <dl className="divide-y divide-border/70 text-[13px]">
                <Row label="Reference">
                  <span className="tnum font-medium">{booking.reference}</span>
                </Row>
                <Row label="Scheduled">
                  <span className="tnum font-medium">{dateTimeLabel(booking.scheduledAt)}</span>
                </Row>
                <Row label="Duration">
                  <span className="tnum font-medium">{duration(booking.durationMin)}</span>
                </Row>
                <Row label="Address">
                  <span className="font-medium">{address.label}</span>
                  <span className="mt-0.5 block text-muted-foreground">{addressLine(address)}</span>
                </Row>
                <Row label="Requested">
                  <span className="block leading-relaxed text-muted-foreground">{booking.description}</span>
                </Row>
                {booking.customerNotes && (
                  <Row label="Your notes">
                    <span className="block leading-relaxed text-muted-foreground">{booking.customerNotes}</span>
                  </Row>
                )}
              </dl>
              {["cancelled", "declined"].includes(booking.status) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={() => navigate("customer-book", { categoryId: booking.categoryId })}
                >
                  <CalendarPlus className="h-4 w-4" strokeWidth={1.9} /> Book this service again
                </Button>
              )}
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

function LoadingBlock() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <div className="h-28 rounded-lg border bg-card" />
        <div className="h-48 rounded-lg border bg-card" />
      </div>
      <div className="h-64 rounded-lg border bg-card" />
    </div>
  );
}
