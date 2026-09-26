"use client";

import type { PriceBreakdown } from "@/lib/types";
import { customerAllocation, pct } from "@/lib/rates";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Transparent pricing — the platform's signature component.
 * Customer view shows every line of the bill and exactly where the money goes.
 */
export function CustomerPriceLines({ price, className }: { price: PriceBreakdown; className?: string }) {
  const rows: { label: string; note: string; amount: number; strong?: boolean }[] = [
    { label: "Service charge", note: "Paid to your service member", amount: price.serviceCharge },
    { label: "Welfare contribution", note: "3% — credited to the member's welfare fund", amount: price.welfareContribution },
    { label: "Platform processing", note: "6% — cooperative operations & support", amount: price.platformFee },
    { label: "GST", note: "18% on the processing fee", amount: price.gst },
  ];
  return (
    <div className={cn("text-sm", className)}>
      <dl className="divide-y divide-border/70">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 py-2.5">
            <div className="min-w-0">
              <dt className="font-medium">{r.label}</dt>
              <dd className="mt-0.5 text-xs text-muted-foreground">{r.note}</dd>
            </div>
            <dd className="tnum shrink-0 font-medium">{money(r.amount)}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-4 py-3">
          <dt className="text-[15px] font-semibold">Total payable</dt>
          <dd className="tnum text-[15px] font-semibold">{money(price.customerTotal)}</dd>
        </div>
      </dl>
    </div>
  );
}

const SEGMENT_COLORS: Record<string, string> = {
  primary: "bg-primary",
  success: "bg-[oklch(0.62_0.10_158)]",
  info: "bg-[oklch(0.70_0.03_235)]",
  neutral: "bg-muted-foreground/50",
};

/** Where every rupee of the customer's payment goes. Sums to the total. */
export function PaymentAllocation({ price, className }: { price: PriceBreakdown; className?: string }) {
  const parts = customerAllocation(price);
  const total = price.customerTotal;
  return (
    <div className={cn("", className)}>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Payment allocation">
        {parts.map((p) => (
          <div key={p.label} className={cn("h-full", SEGMENT_COLORS[p.tone])} style={{ width: `${(p.amount / total) * 100}%` }} />
        ))}
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {parts.map((p) => (
          <div key={p.label} className="flex items-baseline justify-between gap-3 text-[13px]">
            <dt className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <span className={cn("h-2 w-2 shrink-0 rounded-[2px]", SEGMENT_COLORS[p.tone])} aria-hidden />
              <span className="truncate">{p.label}</span>
            </dt>
            <dd className="tnum shrink-0 font-medium">
              {money(p.amount)}
              <span className="ml-1 text-[11px] font-normal text-muted-foreground">{pct(p.amount, total)}%</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Worker-side settlement card — same booking, the member's view. */
export function WorkerPayoutCard({ price, className }: { price: PriceBreakdown; className?: string }) {
  const rows = [
    { label: "Gross booking value", note: "Service charge + welfare contribution", amount: price.workerGross },
    { label: "Platform fee", note: "6% — paid by the customer, allocated to the cooperative", amount: -price.platformFee },
    { label: "Welfare contribution", note: "3% — moves to your welfare fund, not lost income", amount: -price.workerWelfareCredit, keep: true },
    { label: "TDS", note: "1% — deducted at source (simulated)", amount: -price.workerTds },
  ];
  return (
    <div className={cn("text-sm", className)}>
      <dl className="divide-y divide-border/70">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 py-2.5">
            <div className="min-w-0">
              <dt className="font-medium">{r.label}</dt>
              <dd className="mt-0.5 text-xs text-muted-foreground">{r.note}</dd>
            </div>
            <dd className={cn("tnum shrink-0 font-medium", r.amount < 0 && !r.keep && "text-muted-foreground", r.keep && "text-[oklch(0.45_0.10_155)]")}>
              {r.amount < 0 ? `− ${money(Math.abs(r.amount))}` : money(r.amount)}
            </dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-4 py-3">
          <dt className="text-[15px] font-semibold">Net cash payout</dt>
          <dd className="tnum text-[15px] font-semibold">{money(price.workerNetPayout)}</dd>
        </div>
      </dl>
      <p className="mt-2 flex items-start gap-1.5 rounded-md bg-[oklch(0.945_0.034_155)] px-3 py-2 text-xs leading-relaxed text-[oklch(0.40_0.09_155)]">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        You also receive {money(price.workerWelfareCredit)} in your welfare fund — total value from this job{" "}
        <span className="tnum font-semibold">{money(price.workerNetPayout + price.workerWelfareCredit)}</span>.
      </p>
    </div>
  );
}

/** Compact single-line total for cards and lists. */
export function PriceTotal({ price, className }: { price: PriceBreakdown; className?: string }) {
  return (
    <span className={cn("tnum inline-flex items-baseline gap-1.5", className)}>
      <span className="font-semibold">{money(price.customerTotal)}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3.5 w-3.5 cursor-help text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent side="top" className="w-64">
          <p className="text-xs leading-relaxed">
            Service {money(price.serviceCharge)} · Welfare {money(price.welfareContribution)} · Processing {money(price.platformFee)} · GST {money(price.gst)}
          </p>
        </TooltipContent>
      </Tooltip>
    </span>
  );
}
