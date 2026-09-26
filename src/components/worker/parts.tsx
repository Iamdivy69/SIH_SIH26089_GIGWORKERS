"use client";

import { ReactNode, useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import { Check, ChevronDown, ChevronRight, Clock, MapPin, MessageSquare, Navigation, Phone, Timer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAppStore } from "@/store/app-store";
import { useBooking, useJobAction } from "@/hooks/use-api";
import {
  ErrorState,
  FactorBars,
  LoadingPanel,
  MatchBadge,
  MatchReasonChips,
  StatusBadge,
} from "@/components/shared";
import { cn } from "@/lib/utils";
import { dateTimeLabel, duration, money, relativeTime } from "@/lib/format";
import type { Booking, OpenJobRequest } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Query plumbing                                                      */
/* ------------------------------------------------------------------ */

/** Loading / error / data gate so every screen stays consistent. */
export function QueryGate<T>({ query, children }: { query: UseQueryResult<T>; children: (data: T) => ReactNode }) {
  if (query.isPending) return <LoadingPanel rows={5} />;
  if (query.isError) {
    return <ErrorState message={query.error instanceof Error ? query.error.message : undefined} onRetry={() => void query.refetch()} />;
  }
  return <>{children(query.data)}</>;
}

/** Feedback for actions that cannot be real in a prototype. */
export function simulatedToast(action: string, detail?: string) {
  toast.info(`${action} (simulated)`, { description: detail });
}

/* ------------------------------------------------------------------ */
/* Small presentation pieces                                           */
/* ------------------------------------------------------------------ */

/** Contact / navigation actions — simulated in the prototype. */
export function ContactActions({ name }: { name: string }) {
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => simulatedToast("Opening navigation", "Route to the service address opened in your maps app.")} aria-label="Navigate to address">
        <Navigation className="h-3.5 w-3.5" strokeWidth={1.9} /> Navigate
      </Button>
      <Button variant="outline" size="sm" onClick={() => simulatedToast(`Calling ${name}`)} aria-label={`Call ${name}`}>
        <Phone className="h-3.5 w-3.5" strokeWidth={1.9} /> Call
      </Button>
      <Button variant="outline" size="sm" onClick={() => simulatedToast(`Message thread with ${name}`)} aria-label={`Message ${name}`}>
        <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.9} /> Message
      </Button>
    </>
  );
}

/** Small origin tag on offer cards. */
export function OfferTag({ kind }: { kind: "direct" | "pool" }) {
  return kind === "direct" ? (
    <span className="inline-flex items-center rounded-sm border border-primary/25 bg-accent px-1.5 py-0.5 text-[11px] font-medium text-accent-foreground">
      Direct request
    </span>
  ) : (
    <span className="inline-flex items-center rounded-sm border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      Open pool
    </span>
  );
}

/** Net cash + welfare credit — the worker-side value of a job. */
export function NetEarningsLine({ net, welfare, className }: { net: number; welfare: number; className?: string }) {
  return (
    <p className={cn("flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5", className)}>
      <span className="micro-label">Net earnings</span>
      <span className="tnum text-lg font-semibold tracking-tight">{money(net)}</span>
      <span className="tnum text-xs font-medium text-[oklch(0.45_0.10_155)]">+ {money(welfare)} welfare credit</span>
    </p>
  );
}

function MetaRow({ items }: { items: { icon: LucideIcon; text: string }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
      {items.map((item) => (
        <li key={item.text} className="inline-flex items-center gap-1.5">
          <item.icon className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />
          {item.text}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Offer actions (shared by booking offers and open-pool requests)      */
/* ------------------------------------------------------------------ */

function OfferActions({ id, declineDetail }: { id: string; declineDetail: string }) {
  const accept = useJobAction();
  const decline = useJobAction();
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/70 pt-4">
      <Button size="sm" onClick={() => accept.mutate({ id, action: "accept" })} disabled={accept.isPending || decline.isPending}>
        {accept.isPending ? "Accepting…" : "Accept job"}
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={accept.isPending || decline.isPending}>
            Decline
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline this job?</AlertDialogTitle>
            <AlertDialogDescription>{declineDetail}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep the offer</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => decline.mutate({ id, action: "decline" })}
            >
              Decline job
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Offer cards — the flagship job-opportunity presentation              */
/* ------------------------------------------------------------------ */

export function OpenRequestCard({ request }: { request: OpenJobRequest }) {
  const [open, setOpen] = useState(false);
  const price = request.estimate;
  return (
    <article className="rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <OfferTag kind="pool" />
            <span className="micro-label">
              {request.locality} · posted {relativeTime(request.postedAt)}
            </span>
          </div>
          <h3 className="mt-1.5 text-[15px] font-semibold leading-snug tracking-tight">{request.title}</h3>
        </div>
        {request.matchScore > 0 && <MatchBadge score={request.matchScore} />}
      </div>
      <MetaRow
        items={[
          { icon: MapPin, text: `${request.locality} · ${request.distanceKm} km away` },
          { icon: Clock, text: dateTimeLabel(request.scheduledAt) },
          { icon: Timer, text: duration(request.durationMin) },
        ]}
      />
      <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">{request.description}</p>
      <div className="mt-3.5">
        <NetEarningsLine net={price.workerNetPayout} welfare={price.workerWelfareCredit} />
      </div>
      {request.matchFactors.length > 0 && (
        <div className="mt-3.5">
          <MatchReasonChips factors={request.matchFactors} max={3} />
        </div>
      )}
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="-ml-2 mt-1 h-7 text-[13px] text-muted-foreground">
            Why this match?
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} strokeWidth={1.9} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="rounded-md border border-border/70 bg-muted/30 p-4">
            <FactorBars factors={request.matchFactors} />
          </div>
        </CollapsibleContent>
      </Collapsible>
      <OfferActions
        id={request.id}
        declineDetail="The request returns to the open pool and will be offered to other nearby members. Offers you decline do not affect your standing."
      />
    </article>
  );
}

export function BookingOfferCard({ booking }: { booking: Booking }) {
  const detail = useBooking(booking.id);
  const customer = detail.data?.customer;
  const address = detail.data?.address;
  const price = booking.price;
  return (
    <article className="rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <OfferTag kind="direct" />
            <span className="micro-label">
              {customer ? `${customer.name} chose you` : "Customer request"} · {relativeTime(booking.createdAt)}
            </span>
          </div>
          <h3 className="mt-1.5 text-[15px] font-semibold leading-snug tracking-tight">{booking.title}</h3>
        </div>
        {booking.matchScore !== undefined && booking.matchScore > 0 && <MatchBadge score={booking.matchScore} />}
      </div>
      <MetaRow
        items={[
          { icon: MapPin, text: address ? `${address.locality} · ${address.pincode}` : "Address on acceptance" },
          { icon: Clock, text: dateTimeLabel(booking.scheduledAt) },
          { icon: Timer, text: duration(booking.durationMin) },
        ]}
      />
      <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">{booking.description}</p>
      {booking.customerNotes && (
        <p className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground/80">Customer note:</span> {booking.customerNotes}
        </p>
      )}
      <div className="mt-3.5">
        <NetEarningsLine net={price.workerNetPayout} welfare={price.workerWelfareCredit} />
      </div>
      <OfferActions
        id={booking.id}
        declineDetail="The customer will be informed immediately and the job offered to other nearby members. This cannot be undone."
      />
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Compact job row used by lists (schedule, tabs, today strip)          */
/* ------------------------------------------------------------------ */

export function JobRowCard({
  booking,
  showCustomer = false,
  className,
  footer,
}: {
  booking: Booking;
  showCustomer?: boolean;
  className?: string;
  footer?: ReactNode;
}) {
  const navigate = useAppStore((s) => s.navigate);
  const detail = useBooking(showCustomer ? booking.id : undefined);
  const open = () => navigate("worker-job", { bookingId: booking.id });
  return (
    <div
      role="link"
      tabIndex={0}
      aria-label={`Open job ${booking.title}, ${booking.reference}`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      className={cn(
        "cursor-pointer rounded-lg border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium leading-snug">{booking.title}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="tnum inline-flex items-center gap-1">
              <Clock className="h-3 w-3" strokeWidth={1.9} aria-hidden />
              {dateTimeLabel(booking.scheduledAt)}
            </span>
            <span className="tnum inline-flex items-center gap-1">
              <Timer className="h-3 w-3" strokeWidth={1.9} aria-hidden />
              {duration(booking.durationMin)}
            </span>
            {showCustomer && detail.data && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" strokeWidth={1.9} aria-hidden />
                {detail.data.address.locality} · {detail.data.customer.name}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <StatusBadge status={booking.status} />
          <span className="tnum text-[13px] font-semibold">{money(booking.price.workerNetPayout)}</span>
        </div>
      </div>
      {footer}
    </div>
  );
}

/** Right-aligned "open" affordance used inside active-job cards. */
export function OpenJobButton({ bookingId, label = "Open job" }: { bookingId: string; label?: string }) {
  const navigate = useAppStore((s) => s.navigate);
  return (
    <Button
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        navigate("worker-job", { bookingId });
      }}
    >
      {label}
      <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.9} />
    </Button>
  );
}

/** Small requirement status line (checklist / evidence). */
export function RequirementLine({ done, children }: { done: boolean; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[13px]">
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          done ? "border-transparent bg-[oklch(0.5_0.105_155)] text-white" : "border-border bg-muted/60 text-muted-foreground",
        )}
        aria-hidden
      >
        {done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
      </span>
      <span className={cn(done ? "text-foreground" : "text-muted-foreground")}>{children}</span>
    </li>
  );
}
