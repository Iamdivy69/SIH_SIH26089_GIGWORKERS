import type { PriceBreakdown } from "./types";

/**
 * Cooperative pricing policy — single source of truth.
 * These are the platform's published rates (editable by cooperative policy
 * on the admin side; rates are stored on the server and mirrored here for
 * instant client-side estimates).
 */
export const DEFAULT_RATES = {
  /** Platform processing fee — % of service charge (goes to cooperative operations) */
  commissionPct: 6,
  /** Welfare contribution — % of service charge (credited to the worker's welfare fund) */
  welfarePct: 3,
  /** GST — % applied on the platform processing fee */
  gstPct: 18,
  /** TDS — % of service charge, deducted from worker payout (Section 194-O, simulated) */
  tdsPct: 1,
};

const round = (n: number) => Math.round(n);

export function computePrice(serviceCharge: number): PriceBreakdown {
  const sc = round(serviceCharge);
  const welfareContribution = round((sc * DEFAULT_RATES.welfarePct) / 100);
  const platformFee = round((sc * DEFAULT_RATES.commissionPct) / 100);
  const gst = round((platformFee * DEFAULT_RATES.gstPct) / 100);
  const customerTotal = sc + welfareContribution + platformFee + gst;

  // Worker-side settlement view
  const workerGross = sc + welfareContribution;
  const workerWelfareCredit = welfareContribution;
  const workerTds = round((sc * DEFAULT_RATES.tdsPct) / 100);
  const workerNetPayout = sc - workerTds;

  return {
    serviceCharge: sc,
    welfareContribution,
    platformFee,
    gst,
    customerTotal,
    workerGross,
    workerWelfareCredit,
    workerTds,
    workerNetPayout,
  };
}

/** Allocation of the customer's payment across destinations (sums to customerTotal). */
export function customerAllocation(price: PriceBreakdown) {
  return [
    { label: "Worker payout", amount: price.workerNetPayout, tone: "primary" as const },
    { label: "Worker welfare fund", amount: price.workerWelfareCredit, tone: "success" as const },
    { label: "Cooperative operations", amount: price.platformFee, tone: "info" as const },
    { label: "GST + TDS remitted", amount: price.gst + price.workerTds, tone: "neutral" as const },
  ];
}

export function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}
