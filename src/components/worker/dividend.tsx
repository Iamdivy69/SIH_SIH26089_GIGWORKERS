"use client";

/**
 * Member-facing patronage dividend — the worker-side window into the
 * cooperative's annual surplus allocation. Reads the LIVE board draft
 * (same store, same math as the admin screen), so when the board edits
 * the split every member's projection moves with it. Nothing here is a
 * promise: drafts are subject to a member vote before distribution.
 */

import { Coins, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SectionCard } from "@/components/shared";
import { useAppStore } from "@/store/app-store";
import { useMemberDividend } from "@/hooks/use-api";
import { dateFull, dateShort, money, moneyCompact } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SurplusAllocationLine } from "@/lib/types";

/* Tone → segment colour. Same token map as the admin allocation bar. */
const TONE_BG: Record<SurplusAllocationLine["tone"], string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  neutral: "bg-muted-foreground/50",
};

const SHORT_LABEL: Record<SurplusAllocationLine["key"], string> = {
  reserves: "Reserves",
  dividend: "Dividend",
  training: "Training",
  community: "Community",
  contingency: "Contingency",
};

/** State chip for the allocation lifecycle: draft → in vote → distributed. */
function DraftStateChip({ status }: { status: "draft" | "in_vote" | "distributed" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        status === "in_vote"
          ? "border-warning/40 bg-warning-muted text-warning-deep"
          : status === "distributed"
            ? "border-success/40 bg-success-muted text-success-deep"
            : "border-border bg-muted/60 text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "in_vote" ? "bg-warning" : status === "distributed" ? "bg-success" : "bg-muted-foreground/60",
        )}
        aria-hidden
      />
      {status === "in_vote" ? "In vote" : status === "distributed" ? "Distributed" : "Board draft"}
    </span>
  );
}

/** Mini stacked bar of the current allocation split (compact member view). */
function AllocationBar({ allocations, executed }: { allocations: SurplusAllocationLine[]; executed?: boolean }) {
  return (
    <div>
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${executed ? "Executed split" : "Board draft split"}: ${allocations.map((a) => `${SHORT_LABEL[a.key]} ${a.pct}%`).join(", ")}`}
      >
        {allocations.map((a) =>
          a.pct > 0 ? <div key={a.key} className={cn("h-full", TONE_BG[a.tone])} style={{ width: `${a.pct}%` }} /> : null,
        )}
      </div>
      <p className="tnum mt-2 text-[11px] leading-relaxed text-muted-foreground">
        {allocations.map((a) => `${SHORT_LABEL[a.key]} ${a.pct}%`).join(" · ")}
      </p>
    </div>
  );
}

/** Full sidebar card — the earnings screen. */
export function MemberDividendCard() {
  const navigate = useAppStore((s) => s.navigate);
  const q = useMemberDividend();
  const d = q.data;
  if (!d) return null;

  return (
    <SectionCard
      title="Patronage dividend"
      description={`FY ${d.fiscalYear} · surplus distribution`}
      actions={<DraftStateChip status={d.status} />}
    >
      <p className="micro-label">{d.status === "distributed" ? "Your dividend — credited" : "Your projection at the current split"}</p>
      <p className="tnum mt-1 text-2xl font-semibold tracking-tight text-success-deep">
        {money(d.status === "distributed" ? (d.received?.amount ?? d.myProjectedDividend) : d.myProjectedDividend)}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {d.status === "distributed"
          ? `Credited ${dateFull(d.received?.distributedAt ?? d.lastDistributed.distributedAt)}${d.received ? ` · reference ${d.received.reference}` : ""} — from the surplus your work earned for the cooperative.`
          : d.status === "in_vote"
            ? `At the allocation now with the members${d.proposal ? ` (${d.proposal.code})` : ""}.`
            : "Moves live as the board edits the draft — nothing is paid until the members vote."}
      </p>

      <dl className="mt-4 space-y-2 text-[13px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Your patronage this FY</dt>
          <dd className="tnum font-medium">{money(d.myPatronage)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Share of co-op patronage</dt>
          <dd className="tnum font-medium">
            {d.mySharePct.toLocaleString("en-IN", { minimumFractionDigits: 1 })}%
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Dividend pool ({d.status === "distributed" ? "executed" : "draft"})</dt>
          <dd className="tnum font-medium">
            {money(d.dividendPool)} <span className="text-[11px] font-normal text-muted-foreground">· avg {money(d.avgDividend)}</span>
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-muted-foreground">Dividend rate on your patronage</dt>
          <dd className="tnum font-medium">
            {d.dividendRatePct.toLocaleString("en-IN", { minimumFractionDigits: 1 })}%
          </dd>
        </div>
      </dl>

      <Separator className="my-4" />
      <p className="micro-label mb-2">{d.status === "distributed" ? "The split the members approved" : "Board's draft split"}</p>
      <AllocationBar allocations={d.allocations} executed={d.status === "distributed"} />

      {d.status === "distributed" ? (
        <p className="mt-4 rounded-md bg-success-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          Approved by member vote{d.received ? ` (${d.received.proposalCode})` : ""} and executed — this amount is part of your
          record below, certified in the cooperative's audit log.
        </p>
      ) : d.status === "in_vote" && d.proposal ? (
        <div className="mt-4">
          <Button size="sm" className="w-full" onClick={() => navigate("worker-governance")}>
            <Vote className="h-3.5 w-3.5" strokeWidth={1.9} />
            Vote on {d.proposal.code}
          </Button>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Voting closes {dateFull(d.proposal.closesAt)} · one member, one vote.</p>
        </div>
      ) : (
        <div className="mt-4">
          <Button variant="outline" size="sm" className="w-full" onClick={() => navigate("worker-governance")}>
            <Vote className="h-3.5 w-3.5" strokeWidth={1.9} />
            Proposals open for your vote
          </Button>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            The board's draft goes to a member vote before anything is distributed.
          </p>
        </div>
      )}

      {d.history.length > 0 ? (
        <div className="mt-4 border-t pt-4">
          <p className="micro-label mb-2.5">Dividends you have received</p>
          <ul className="space-y-3">
            {d.history.map((h) => (
              <li key={h.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="tnum text-[13px] font-medium">FY {h.fiscalYear}</p>
                  <p className="tnum mt-0.5 text-xs text-muted-foreground">
                    {money(h.patronage)} patronage · {h.sharePct.toLocaleString("en-IN", { minimumFractionDigits: 1 })}% share
                  </p>
                  <p className="tnum mt-0.5 font-mono text-[11px] text-muted-foreground/80">
                    {h.reference} · {h.proposalCode} · {dateShort(h.distributedAt)}
                  </p>
                </div>
                <p className="tnum shrink-0 text-[13px] font-semibold text-success-deep">+ {money(h.amount)}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-4 rounded-md bg-muted/50 px-3 py-2.5">
          <p className="micro-label">Last year — FY {d.lastDistributed.fiscalYear}</p>
          <p className="tnum mt-1 text-[13px] leading-relaxed">
            {moneyCompact(d.lastDistributed.patronageBonus)} patronage bonus across{" "}
            {d.lastDistributed.members} members — avg {money(d.lastDistributed.avgDividend)} each
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Distributed strictly in proportion to completed service value {dateFull(d.lastDistributed.distributedAt)}.
          </p>
        </div>
      )}
    </SectionCard>
  );
}

/** Compact one-line strip — the welfare screen (below the KPI row). */
export function MemberDividendStrip() {
  const navigate = useAppStore((s) => s.navigate);
  const q = useMemberDividend();
  const d = q.data;
  if (!d) return null;

  const distributed = d.status === "distributed";

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-lg border border-success/25 bg-success-muted/50 px-4 py-3">
      <p className="flex min-w-0 items-center gap-2.5 text-[13px]">
        <Coins className="h-4 w-4 shrink-0 text-success-deep" strokeWidth={1.9} aria-hidden />
        <span className="tnum font-semibold text-success-deep">
          {distributed
            ? `Patronage dividend credited: ${money(d.received?.amount ?? d.myProjectedDividend)}`
            : `Patronage dividend projection: ${money(d.myProjectedDividend)}`}
        </span>
        <span className="text-muted-foreground">
          on {money(d.myPatronage)} of patronage · FY {d.fiscalYear}
          {distributed ? " — credited" : d.status === "in_vote" ? " in vote now" : " board draft"}
        </span>
      </p>
      <p className="flex min-w-0 items-center gap-2 text-xs leading-relaxed text-muted-foreground">
        Surplus the cooperative earned from your work, returned in proportion to it.
        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => navigate("worker-earnings")}>
          Details
        </Button>
      </p>
    </div>
  );
}
