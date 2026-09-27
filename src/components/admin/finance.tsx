"use client";

import { Download, Landmark } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertBanner,
  DataTable,
  ErrorState,
  PageHeader,
  SectionCard,
  TrendAreaChart,
} from "@/components/shared";
import type { Column } from "@/components/shared";
import { FineNote, KpiStrip, KpiStripSkeleton } from "./ui";
import { useFinance } from "@/hooks/use-api";
import { money, moneyCompact } from "@/lib/format";
import { csvDateStamp, downloadCsv } from "@/lib/csv";
import { cn } from "@/lib/utils";

type ReconRow = { label: string; amount: number; expected: number; status: "matched" | "variance" };

type FinanceData = NonNullable<ReturnType<typeof useFinance>["data"]>;

/** Month-to-date finance statement as a spreadsheet download. */
function exportFinanceCsv(d: FinanceData): void {
  downloadCsv(`sahyog-finance-mtd-${csvDateStamp()}`, ["Section", "Line item", "Amount (₹)", "Note"], [
    ["Month to date", "Commission — cooperative revenue", d.commissionMonth, "6% processing share of completed bookings"],
    ["Month to date", "GST collected", d.gstCollectedMonth, "18% on platform fees · payable"],
    ["Month to date", "Welfare pool — member contributions", d.welfarePoolMonth, "3% of service charges, credited per member"],
    ["Month to date", "Payouts processed", d.payoutsProcessedMonth, "settled this month"],
    ["Month to date", "TDS remitted", d.tdsRemittedMonth, "s.194-O (simulated)"],
    ["Balances", "Welfare pool — accumulated funds", d.welfarePoolTotal, "member-visible"],
    ["Balances", "Payouts pending", d.payoutsPending, "next weekly batch"],
    ["Balances", "Dispute holds", d.disputeHolds, "frozen pending resolution"],
    ...d.revenueSeries.map((r) => ["Weekly revenue (8 weeks)", String(r.label), r.value, "commission per week"] as (string | number)[]),
    ...d.reconciliation.map(
      (r) => ["Ledger reconciliation", r.label, r.amount, `expected ${r.expected} · ${r.status}`] as (string | number)[],
    ),
  ]);
  toast("Finance statement exported", {
    description: "Month-to-date figures, weekly revenue and ledger reconciliation — CSV.",
  });
}

/** Finance — the cooperative's money view: revenue, member funds, compliance. */
export function AdminFinanceScreen() {
  const finance = useFinance();

  if (finance.isError) {
    return (
      <>
        <PageHeader eyebrow="Cooperative · finance" title="Finance" />
        <ErrorState message="Financial overview could not be loaded." onRetry={() => finance.refetch()} />
      </>
    );
  }

  const loading = finance.isLoading || !finance.data;
  /* Guarded by `loading` — safe in the !loading branches below. */
  const d = finance.data!;

  return (
    <>
      <PageHeader
        eyebrow="Cooperative · finance"
        title="Finance"
        description="Revenue, member funds and statutory balances for the current month. Every figure below is derived from the transaction ledger — the same ledger members see their own slice of."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => d && exportFinanceCsv(d)}
            disabled={loading || !d}
            aria-label="Export month-to-date finance statement as CSV"
          >
            <Download className="h-3.5 w-3.5" strokeWidth={1.9} /> Export CSV
          </Button>
        }
      />

      {loading ? (
        <KpiStripSkeleton className="mb-6" />
      ) : (
        <KpiStrip
          className="mb-6"
          cells={[
            { label: "Commission — MTD", value: money(d.commissionMonth), sub: "cooperative revenue" },
            { label: "GST collected", value: money(d.gstCollectedMonth), sub: "on platform fees · payable" },
            { label: "Welfare pool — month", value: money(d.welfarePoolMonth), sub: "member contributions" },
            { label: "Welfare pool — total", value: moneyCompact(d.welfarePoolTotal), sub: "accumulated funds" },
            { label: "Payouts pending", value: money(d.payoutsPending), sub: "next weekly batch", tone: "attention" },
            { label: "Payouts processed", value: moneyCompact(d.payoutsProcessedMonth), sub: "settled this month" },
            { label: "TDS remitted", value: money(d.tdsRemittedMonth), sub: "s.194-O (simulated)" },
            { label: "Dispute holds", value: money(d.disputeHolds), sub: "frozen pending resolution" },
          ]}
        />
      )}

      {loading ? (
        <Skeleton className="mb-6 h-[62px] rounded-lg" />
      ) : (
        <AlertBanner
          className="mb-6"
          severity="info"
          title="Weekly payout batch ready for review"
          detail="Batch POT-2609-142 · ₹4.2L net for 84 members settles tomorrow 6:00 PM. Finance sign-off pending — holds released so far this week: 1."
          action="Review batch"
          onAction={() =>
            toast("Payout batch opened", {
              description: "84 members · ₹4,18,700 net · settles tomorrow 6:00 PM after sign-off. (Simulated approval)",
            })
          }
        />
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Commission revenue — last 8 weeks"
          description="The cooperative's 6% processing share of completed bookings, by week."
        >
          {loading ? (
            <Skeleton className="h-[232px] w-full" />
          ) : (
            <TrendAreaChart data={d.revenueSeries} currency height={236} />
          )}
        </SectionCard>

        <SectionCard title="Where the money goes" description="Transparent by design — the model, not a margin.">
          <div className="space-y-3.5">
            <SplitRow label="Member net payout" share="≈ 87%" note="service charge − TDS, settled weekly" />
            <SplitRow label="Member welfare fund" share="3%" note="credited per booking, member-visible" tone="positive" />
            <SplitRow label="Cooperative operations" share="6%" note="support, training, tool bank" />
            <SplitRow label="GST + TDS" share="≈ 4%" note="collected and remitted (simulated)" />
          </div>
          <FineNote className="mt-4 border-t pt-3">
            The commission is a policy rate set by member vote — not a market take-rate. Any change goes through governance.
          </FineNote>
        </SectionCard>
      </div>

      <SectionCard
        title="Ledger reconciliation"
        description="Nightly reconciliation of the payment gateway, payout bank account and the welfare fund ledger."
        forTable
      >
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <DataTable
            dense
            columns={reconColumns}
            rows={d.reconciliation}
            getRowKey={(r) => r.label}
            emptyTitle="Nothing to reconcile"
            mobileCard={(r) => (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-medium">{r.label}</p>
                  <span
                    className={cn(
                      "micro-label rounded-sm border px-1.5 py-0.5",
                      r.status === "matched"
                        ? "border-success/40 bg-success-muted text-success-deep"
                        : "border-warning/40 bg-warning-muted text-warning-deep",
                    )}
                  >
                    {r.status === "matched" ? "Matched" : "Variance"}
                  </span>
                </div>
                <p className="tnum text-xs text-muted-foreground">
                  recorded {money(r.amount)} · expected {money(r.expected)}
                  {r.amount !== r.expected && (
                    <span className="tnum ml-1 font-medium text-warning-deep">
                      (Δ {money(r.amount - r.expected)})
                    </span>
                  )}
                </p>
              </div>
            )}
          />
        )}
      </SectionCard>

      <div className="mt-4 flex items-start gap-2.5 rounded-lg border bg-muted/30 p-4">
        <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.9} />
        <FineNote>
          Transparent-by-design: each customer payment is split at source into member payout, welfare contribution, cooperative
          commission and taxes — so this reconciliation is arithmetical, not forensic. Variances are flagged to the finance desk
          the same night. Banking, GST and TDS flows are simulated in this prototype.
        </FineNote>
      </div>
    </>
  );
}

function SplitRow({ label, share, note, tone }: { label: string; share: string; note: string; tone?: "positive" }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-3 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
      </div>
      <p className={cn("tnum shrink-0 text-lg font-semibold", tone === "positive" && "text-success-deep")}>{share}</p>
    </div>
  );
}

const reconColumns: Column<ReconRow>[] = [
  { key: "label", header: "Ledger line", cell: (r) => <span className="font-medium">{r.label}</span> },
  { key: "amount", header: "Recorded", align: "right", cell: (r) => <span className="tnum">{money(r.amount)}</span> },
  { key: "expected", header: "Expected", align: "right", cell: (r) => <span className="tnum text-muted-foreground">{money(r.expected)}</span> },
  {
    key: "variance",
    header: "Variance",
    align: "right",
    cell: (r) =>
      r.amount === r.expected ? (
        <span className="tnum text-muted-foreground">—</span>
      ) : (
        <span className="tnum font-medium text-warning-deep">
          {r.amount > r.expected ? "+" : "−"}
          {money(Math.abs(r.amount - r.expected))}
        </span>
      ),
  },
  {
    key: "status",
    header: "Status",
    cell: (r) => (
      <span
        className={cn(
          "micro-label rounded-sm border px-1.5 py-0.5",
          r.status === "matched"
            ? "border-success/40 bg-success-muted text-success-deep"
            : "border-warning/40 bg-warning-muted text-warning-deep",
        )}
      >
        {r.status === "matched" ? "Matched" : "Variance"}
      </span>
    ),
  },
];
