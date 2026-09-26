"use client";

import { useState } from "react";
import { Landmark, Repeat, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { DataTable, PageHeader, SectionCard, StatTile, StatusBadge, TrendAreaChart, WorkerPayoutCard } from "@/components/shared";
import type { Column } from "@/components/shared";
import { useAppStore } from "@/store/app-store";
import { useWorkerEarnings } from "@/hooks/use-api";
import { computePrice } from "@/lib/rates";
import { dateShort, money, num } from "@/lib/format";
import type { Transaction } from "@/lib/types";
import { QueryGate, simulatedToast } from "../parts";

function TransactionDialog({ txn, onClose }: { txn: Transaction | null; onClose: () => void }) {
  const price = txn ? computePrice(txn.gross - txn.welfareContribution) : null;
  return (
    <Dialog open={txn !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6">{txn?.serviceTitle}</DialogTitle>
          <DialogDescription className="tnum">
            {txn && (
              <>
                {txn.bookingRef} · {dateShort(txn.date)} · <StatusBadge status={txn.status} />
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {price && (
          <>
            <WorkerPayoutCard price={price} />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Recomputed from the settled transaction record — identical to the breakdown on your job screen at completion time.
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function WorkerEarnings() {
  const navigate = useAppStore((s) => s.navigate);
  const q = useWorkerEarnings();
  const [selected, setSelected] = useState<Transaction | null>(null);

  const txnColumns: Column<Transaction>[] = [
    {
      key: "service",
      header: "Service",
      cell: (t) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{t.serviceTitle}</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{t.bookingRef}</p>
        </div>
      ),
    },
    { key: "date", header: "Date", cell: (t) => <span className="tnum text-muted-foreground">{dateShort(t.date)}</span> },
    { key: "gross", header: "Gross", align: "right", cell: (t) => <span className="tnum">{money(t.gross)}</span> },
    {
      key: "platform",
      header: "Platform",
      align: "right",
      cell: (t) => <span className="tnum text-muted-foreground">− {money(t.platformFee)}</span>,
    },
    {
      key: "welfare",
      header: "Welfare",
      align: "right",
      cell: (t) => <span className="tnum text-[oklch(0.45_0.10_155)]">{money(t.welfareContribution)}</span>,
    },
    { key: "tds", header: "TDS", align: "right", cell: (t) => <span className="tnum text-muted-foreground">− {money(t.tds)}</span> },
    { key: "net", header: "Net", align: "right", cell: (t) => <span className="tnum font-semibold">{money(t.net)}</span> },
    { key: "status", header: "Status", cell: (t) => <StatusBadge status={t.status} /> },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Earnings & benefits"
        title="Earnings & payouts"
        description="Every rupee from every booking — gross value, deductions, welfare credit and net cash. Nothing is hidden, because you set the rates."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => simulatedToast("Payout settings", "Bank ••4417 (HDFC) is your default payout method — changes require KYC (simulated).")}
          >
            <Wallet className="h-3.5 w-3.5" strokeWidth={1.9} />
            Payout method · Bank ••4417
          </Button>
        }
      />
      <QueryGate query={q}>
        {(data) => {
          const s = data.summary;
          return (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile
                  label="Available balance"
                  value={money(s.availableBalance)}
                  sub={`Next payout ${dateShort(data.nextPayoutDate)}`}
                  emphasis
                />
                <StatTile label="Pending settlement" value={money(s.pendingSettlement)} sub="Awaiting customer confirmation" />
                <StatTile label="This week" value={money(s.weekEarnings)} sub="Net cash, last 7 days" />
                <StatTile label="This month" value={money(s.monthEarnings)} sub={`Avg ${money(s.avgPerJob)} per service`} />
              </div>

              {/* Standing orders — the cooperative's stable-income promise, quantified */}
              {s.standingOrders > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-lg border border-primary/25 bg-accent/40 px-4 py-3">
                  <p className="flex min-w-0 items-center gap-2.5 text-[13px]">
                    <Repeat className="h-4 w-4 shrink-0 text-[oklch(0.45_0.10_155)]" strokeWidth={1.9} aria-hidden />
                    <span className="tnum font-semibold text-[oklch(0.45_0.10_155)]">Recurring income: {money(s.recurringMonthly)}/mo</span>
                    <span className="text-muted-foreground">
                      from {num(s.standingOrders)} standing order{s.standingOrders === 1 ? "" : "s"}
                    </span>
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Estimated from your active weekly (×4.33) and monthly series — stable, predictable income.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-lg border bg-muted/30 px-4 py-3">
                  <p className="flex min-w-0 items-center gap-2.5 text-[13px] text-muted-foreground">
                    <Repeat className="h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden />
                    Recurring income: <span className="tnum font-semibold">{money(0)}/mo</span> — no active standing orders yet
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Great repeat service turns one-time customers into weekly or monthly standing orders — the cooperative's core promise.
                  </p>
                </div>
              )}

              <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="min-w-0 space-y-6 lg:col-span-2">
                  <SectionCard title="Net earnings by week" description="Last 8 weeks, after platform fee, welfare contribution and TDS">
                    <TrendAreaChart data={data.weeklySeries} currency height={210} />
                  </SectionCard>

                  <SectionCard
                    title="Transactions"
                    description="Every settled service with its full deduction breakdown. Select a row for the payout view."
                    forTable
                  >
                    <DataTable
                      columns={txnColumns}
                      rows={data.transactions}
                      getRowKey={(t) => t.id}
                      onRowClick={(t) => setSelected(t)}
                      dense
                      emptyTitle="No settled transactions yet"
                      emptyDescription="Transactions appear here as customers confirm completed services."
                    />
                    <div className="divide-y border-t md:hidden">
                      {data.transactions.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                          onClick={() => setSelected(t)}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium">{t.serviceTitle}</p>
                            <p className="tnum mt-0.5 text-xs text-muted-foreground">
                              {dateShort(t.date)} · {t.bookingRef}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="tnum text-[13px] font-semibold">{money(t.net)}</span>
                            <StatusBadge status={t.status} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </SectionCard>
                </div>

                <div className="space-y-6">
                  <SectionCard title="How your payout is calculated" description="Rates are cooperative policy — changed only by member vote.">
                    <dl className="space-y-2 text-[13px]">
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted-foreground">Platform fee</dt>
                        <dd className="tnum font-medium">{data.rates.commissionPct}% of service charge</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted-foreground">Welfare contribution</dt>
                        <dd className="tnum font-medium">{data.rates.welfarePct}% → your fund</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted-foreground">TDS</dt>
                        <dd className="tnum font-medium">{data.rates.tdsPct}% of service charge</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted-foreground">GST</dt>
                        <dd className="tnum font-medium">{data.rates.gstPct}% on platform fee</dd>
                      </div>
                    </dl>
                    <Separator className="my-4" />
                    <p className="micro-label mb-2">Example — ₹800 service charge</p>
                    <WorkerPayoutCard price={computePrice(800)} />
                  </SectionCard>

                  <SectionCard title="This month" description="Your booking value and where it went">
                    <dl className="space-y-2.5 text-[13px]">
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted-foreground">Gross booking value</dt>
                        <dd className="tnum font-medium">{money(s.grossMonth)}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted-foreground">Platform fee (paid by customers)</dt>
                        <dd className="tnum font-medium text-muted-foreground">{money(s.platformFeesMonth)}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted-foreground">Credited to your welfare fund</dt>
                        <dd className="tnum font-medium text-[oklch(0.45_0.10_155)]">{money(s.welfareMonth)}</dd>
                      </div>
                      <Separator />
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-[15px] font-semibold">Net cash this month</dt>
                        <dd className="tnum text-[15px] font-semibold">{money(s.monthEarnings)}</dd>
                      </div>
                    </dl>
                    <div className="mt-4 rounded-md bg-muted/50 px-3 py-2.5">
                      <p className="micro-label">Year to date</p>
                      <p className="tnum mt-1 text-[13px] leading-relaxed">
                        {money(s.welfareYtd)} welfare contributions · {money(s.tdsYtd)} TDS deducted (deposited against your PAN, simulated)
                      </p>
                    </div>
                  </SectionCard>

                  <SectionCard title="Payout history" description="Weekly batch → Bank ••4417 (HDFC)">
                    <ul className="space-y-3">
                      {data.payouts.map((p) => (
                        <li key={p.id} className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium">{p.period}</p>
                            <p className="tnum mt-0.5 text-xs text-muted-foreground">
                              {dateShort(p.date)} · {p.transactions} services · {p.reference}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="tnum text-[13px] font-semibold">{money(p.amount)}</span>
                            <StatusBadge status={p.status} />
                          </div>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 flex items-start gap-1.5 rounded-md bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                      <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
                      Payouts are batched weekly and reach your bank the next working evening. Payment infrastructure is simulated in this
                      prototype.
                    </p>
                  </SectionCard>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                These rates are cooperative policy — changed only by member vote in{" "}
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => navigate("worker-governance")}>
                  Governance
                </Button>
                . Every deduction on this page is traceable to the policy.
              </p>
            </div>
          );
        }}
      </QueryGate>
      <TransactionDialog txn={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
