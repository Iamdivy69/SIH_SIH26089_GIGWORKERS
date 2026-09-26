"use client";

import { CalendarClock, IndianRupee, MapPin, Repeat, UserRound } from "lucide-react";
import { MatchBadge, PersonAvatar } from "@/components/shared";
import { computePrice } from "@/lib/rates";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ServiceCategory, Worker } from "@/lib/types";
import { addressById, recurrenceLabel, type RecurrenceChoice } from "../constants";

/** Row in the sticky context panel / mobile summary strip. */
function SummaryRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.9} />
      <div className="min-w-0 flex-1">
        <p className="micro-label">{label}</p>
        <div className="mt-0.5 text-[13px] leading-snug">{children}</div>
      </div>
    </div>
  );
}

export interface FlowSummaryProps {
  category?: ServiceCategory;
  serviceName?: string;
  charge: number;
  worker?: Worker;
  matchScore?: number;
  slotLabel?: string;
  addressId: string;
  /** Standing-order frequency chosen in step 4 ("one-time" = regular visit). */
  recurrence?: RecurrenceChoice;
}

/** Desktop sticky panel — service, member, slot, address and live price. */
export function FlowSummaryPanel(props: FlowSummaryProps) {
  const price = computePrice(props.charge);
  const address = addressById(props.addressId);
  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-card p-5">
        <h2 className="text-[15px] font-semibold tracking-tight">Request summary</h2>
        <div className="mt-2 divide-y divide-border/70">
          <SummaryRow icon={IndianRupee} label="Service">
            {props.category ? (
              <>
                <span className="font-medium">{props.serviceName ?? "Choose a service"}</span>
                <span className="block text-xs text-muted-foreground">{props.category.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Choose a category</span>
            )}
          </SummaryRow>
          <SummaryRow icon={UserRound} label="Member">
            {props.worker ? (
              <span className="flex items-center gap-2">
                <PersonAvatar name={props.worker.name} size="xs" />
                <span className="truncate font-medium">{props.worker.name}</span>
                {typeof props.matchScore === "number" && <MatchBadge score={props.matchScore} size="sm" />}
              </span>
            ) : (
              <span className="text-muted-foreground">Matched in step 3</span>
            )}
          </SummaryRow>
          <SummaryRow icon={CalendarClock} label="Slot">
            {props.slotLabel ? (
              <span className="font-medium">{props.slotLabel}</span>
            ) : (
              <span className="text-muted-foreground">Chosen in step 4</span>
            )}
            {props.slotLabel && props.recurrence && props.recurrence !== "one-time" && (
              <span className="mt-1 inline-flex items-center gap-1.5 rounded-sm border border-[oklch(0.90_0.06_80)] bg-[oklch(0.965_0.035_85)] px-1.5 py-0.5 text-[11px] font-medium text-[oklch(0.45_0.10_65)]">
                <Repeat className="h-3 w-3" strokeWidth={1.9} aria-hidden />
                Standing order · {recurrenceLabel(props.recurrence).toLowerCase()}
              </span>
            )}
          </SummaryRow>
          <SummaryRow icon={MapPin} label="Address">
            <span className="font-medium">{address.label}</span>
            <span className="block truncate text-xs text-muted-foreground">{address.locality}, {address.city} {address.pincode}</span>
          </SummaryRow>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="text-[15px] font-semibold tracking-tight">Price so far</h2>
        <dl className="mt-2 divide-y divide-border/70 text-[13px]">
          <div className="flex items-baseline justify-between py-2">
            <dt className="text-muted-foreground">Service charge</dt>
            <dd className="tnum font-medium">{money(price.serviceCharge)}</dd>
          </div>
          <div className="flex items-baseline justify-between py-2">
            <dt className="text-muted-foreground">Welfare · 3%</dt>
            <dd className="tnum font-medium">{money(price.welfareContribution)}</dd>
          </div>
          <div className="flex items-baseline justify-between py-2">
            <dt className="text-muted-foreground">Processing · 6%</dt>
            <dd className="tnum font-medium">{money(price.platformFee)}</dd>
          </div>
          <div className="flex items-baseline justify-between py-2">
            <dt className="text-muted-foreground">GST · 18% on fee</dt>
            <dd className="tnum font-medium">{money(price.gst)}</dd>
          </div>
          <div className="flex items-baseline justify-between py-2.5">
            <dt className="text-[15px] font-semibold">Total payable</dt>
            <dd className="tnum text-[15px] font-semibold">{money(price.customerTotal)}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Rates are set by cooperative policy — no surge pricing, no hidden lines. Every rupee is traceable on your invoice.
        </p>
      </section>
    </div>
  );
}

/** Compact mobile strip under the stepper. */
export function FlowSummaryStrip({ className, ...props }: FlowSummaryProps & { className?: string }) {
  const price = computePrice(props.charge);
  const address = addressById(props.addressId);
  return (
    <div className={cn("rounded-lg border bg-card px-4 py-3", className)}>
      <div className="flex items-center justify-between gap-4">
        <p className="min-w-0 truncate text-[13px] font-medium">
          {props.serviceName ?? "Service not chosen"}
          <span className="ml-2 font-normal text-muted-foreground">{props.category?.name}</span>
        </p>
        <p className="tnum shrink-0 text-[15px] font-semibold">{money(price.customerTotal)}</p>
      </div>
      {(props.worker || props.slotLabel) && (
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {[props.worker?.name, props.slotLabel, `${address.label} · ${address.locality}`].filter(Boolean).join(" · ")}
          {props.recurrence && props.recurrence !== "one-time" && ` · ${recurrenceLabel(props.recurrence)} standing order`}
        </p>
      )}
    </div>
  );
}
