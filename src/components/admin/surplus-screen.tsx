"use client";

/**
 * Surplus & dividends — the cooperative's annual surplus allocation builder.
 *
 * The showcase of cooperative economics: the surplus earned from platform
 * processing fees is drafted by the admin desk, then approved by member vote;
 * dividends follow patronage (completed service value), never share count.
 *
 * Draft state: steppers with policy floors, live stacked preview bar, live
 * dividend figures, save/reset, and "Send to member vote". In-vote state:
 * allocation locked, proposal banner with a deep link to governance.
 */

import { useMemo, useState } from "react";
import { Coins, Minus, Plus, RotateCcw, Save, Vote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertBanner,
  DataTable,
  ErrorState,
  PageHeader,
  PersonAvatar,
  SectionCard,
} from "@/components/shared";
import type { Column } from "@/components/shared";
import { FineNote, KpiStrip, KpiStripSkeleton } from "./ui";
import { useAdminSurplus, useSubmitSurplusProposal, useUpdateSurplusAllocation } from "@/hooks/use-api";
import { dateFull, money, moneyCompact, num } from "@/lib/format";
import type { SurplusAllocationKey, SurplusAllocationLine, SurplusMemberPreview } from "@/lib/types";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";

type Pcts = Record<SurplusAllocationKey, number>;

/** The board's default split — also the seeded allocation (35/40/15/7/3). */
const BOARD_DEFAULT: Pcts = { reserves: 35, dividend: 40, training: 15, community: 7, contingency: 3 };

/** Tone → semantic background token (allocation dot + stacked-bar segment). */
const TONE_BG: Record<SurplusAllocationLine["tone"], string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  neutral: "bg-muted-foreground/40",
};

/** Column template for the 6-cell KPI strip — fills cleanly at every breakpoint. */
const KPI_COLS = "sm:grid-cols-3 xl:grid-cols-6 2xl:grid-cols-6";

export function AdminSurplusScreen() {
  const navigate = useAppStore((s) => s.navigate);
  const surplus = useAdminSurplus();
  const save = useUpdateSurplusAllocation();
  const submit = useSubmitSurplusProposal();

  /* Local draft — null until the first edit, otherwise mirrors the server. */
  const [override, setOverride] = useState<Pcts | null>(null);
  const serverPcts = useMemo<Pcts | null>(
    () =>
      surplus.data
        ? (Object.fromEntries(surplus.data.allocations.map((a) => [a.key, a.pct])) as Pcts)
        : null,
    [surplus.data],
  );
  const pcts = override ?? serverPcts;

  if (surplus.isError) {
    return (
      <>
        <PageHeader eyebrow="Cooperative" title="Surplus & dividends" />
        <ErrorState message="The surplus plan could not be loaded." onRetry={() => surplus.refetch()} />
      </>
    );
  }

  if (surplus.isLoading || !surplus.data || !pcts) {
    return (
      <>
        <PageHeader
          eyebrow="Cooperative"
          title="Surplus & dividends"
          description="FY 2026-27 allocation of the cooperative's surplus."
        />
        <KpiStripSkeleton count={6} className={cn("mb-6", KPI_COLS)} />
        <div className="space-y-6">
          <Skeleton className="h-48 w-full rounded-lg" />
          <Skeleton className="h-[26rem] w-full rounded-lg" />
          <Skeleton className="h-36 w-full rounded-lg" />
        </div>
      </>
    );
  }

  const d = surplus.data;
  const inVote = d.status === "in_vote";
  const sum = d.allocations.reduce((acc, l) => acc + pcts[l.key], 0);
  const balanced = sum === 100;
  const dirty = d.allocations.some((l) => pcts[l.key] !== l.pct);
  const livePool = Math.round((d.surplusYtd * pcts.dividend) / 100);
  const liveAvg = d.sharingMembers > 0 ? Math.round(livePool / d.sharingMembers) : 0;
  const amountFor = (pct: number) => money(Math.round((d.surplusYtd * pct) / 100));

  const setPct = (line: SurplusAllocationLine, next: number) => {
    setOverride({ ...pcts, [line.key]: Math.max(line.minPct, Math.min(100, next)) });
  };

  /* Dividend preview follows the live draft split — same math as the server. */
  const previewRows: SurplusMemberPreview[] = d.memberPreview.slice(0, 10).map((m) => ({
    ...m,
    dividend: Math.round((livePool * m.patronage) / Math.max(1, d.patronageTotal)),
  }));

  const onSave = () => {
    if (!balanced) return;
    save.mutate(pcts, { onError: (e) => toast.error(e.message) });
  };

  const onSend = () => {
    if (!balanced || dirty) return;
    submit.mutate(undefined, { onError: (e) => toast.error(e.message) });
  };

  const ld = d.lastDistributed;

  return (
    <>
      <PageHeader
        eyebrow="Cooperative"
        title="Surplus & dividends"
        description={`FY ${d.fiscalYear} allocation · ${money(d.surplusYtd)} surplus to distribute with member approval`}
      />

      <KpiStrip
        className={cn("mb-6", KPI_COLS)}
        cells={[
          {
            label: "Surplus YTD",
            value: money(d.surplusYtd),
            sub: `platform fees ${money(d.platformFeesYtd)} − costs ${money(d.operatingCostsYtd)}`,
          },
          { label: "Dividend pool", value: money(livePool), sub: "at current allocation", tone: "positive" },
          { label: "Avg dividend", value: money(liveAvg), sub: "per sharing member" },
          { label: "Patronage base", value: money(d.patronageTotal), sub: "completed service value FY" },
          { label: "Sharing members", value: num(d.sharingMembers), sub: "members with completed work" },
          { label: "Platform fees YTD", value: money(d.platformFeesYtd), sub: "6% processing share, settled" },
        ]}
      />

      <div className="space-y-6">
        {/* ---------------- how this year's surplus is built ---------------- */}
        <SectionCard
          title="How this year's surplus is built"
          description={`FY ${d.fiscalYear} to date — every rupee traceable to settled bookings.`}
        >
          <dl>
            <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2.5">
              <div className="min-w-0">
                <dt className="text-sm">Platform processing fees</dt>
                <p className="mt-0.5 text-xs text-muted-foreground">6% cooperative share of settled bookings</p>
              </div>
              <dd className="tnum shrink-0 text-sm font-medium">{money(d.platformFeesYtd)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <div className="min-w-0">
                <dt className="text-sm">Less operating costs</dt>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  centre, staff, tool bank, training stipends — simulated
                </p>
              </div>
              <dd className="tnum shrink-0 text-sm font-medium">
                <span className="mr-1 text-muted-foreground">−</span>
                {money(d.operatingCostsYtd)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-t pt-3">
              <dt className="text-sm font-semibold">Surplus for the year</dt>
              <dd className="tnum shrink-0 text-base font-semibold tracking-tight">
                <span className="mr-1 font-normal text-muted-foreground">=</span>
                {money(d.surplusYtd)}
              </dd>
            </div>
          </dl>
          <FineNote className="mt-4 border-t pt-3">
            Operating costs are simulated at 62% of platform-fee income in this prototype. The fee figure above reconciles
            line-for-line with the commission ledger on the Finance screen — the same settled transactions, viewed from the
            cooperative side. The surplus accrues as bookings settle.
          </FineNote>
        </SectionCard>

        {/* ---------------- the allocation builder ---------------- */}
        <SectionCard
          title="Proposed allocation"
          description={
            inVote
              ? "This is the split the members are voting on — editing is locked while the vote is open."
              : "Adjust the split — the bar and dividend figures update live. Floors are member-approved guardrails, and the total must balance at 100% before saving."
          }
          actions={
            !inVote && (
              <Button
                size="sm"
                onClick={onSend}
                disabled={!balanced || dirty || submit.isPending}
                title={
                  !balanced
                    ? "Allocation must total 100% before it can be voted on"
                    : dirty
                      ? "Save the draft first — members vote on the saved split"
                      : "Publish this allocation as a proposal for all 216 members"
                }
              >
                <Vote className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.9} />
                {submit.isPending ? "Sending…" : "Send to member vote"}
              </Button>
            )
          }
        >
          {inVote && d.proposal && (
            <AlertBanner
              severity="warning"
              className="mb-5"
              title={`${d.proposal.code} is with the members — voting closes ${dateFull(d.proposal.closesAt)}`}
              detail="The allocation takes effect only if the proposal passes."
              action="View proposal"
              onAction={() => navigate("admin-governance")}
            />
          )}

          <ul className="divide-y">
            {d.allocations.map((line) => (
              <AllocationRow
                key={line.key}
                line={line}
                pct={pcts[line.key]}
                amount={amountFor(pcts[line.key])}
                locked={inVote}
                onStep={(next) => setPct(line, next)}
              />
            ))}
          </ul>

          {/* live stacked allocation preview — updates before saving */}
          <div className="mt-6">
            <div
              className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`Allocation preview: ${d.allocations.map((l) => `${l.label} ${pcts[l.key]}%`).join(", ")}`}
            >
              {d.allocations.map((l) => (
                <div key={l.key} className={cn("h-full", TONE_BG[l.tone])} style={{ width: `${pcts[l.key]}%` }} />
              ))}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
              {d.allocations.map((l) => (
                <li key={l.key} className="flex min-w-0 items-center gap-2 text-xs">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", TONE_BG[l.tone])} aria-hidden />
                  <span className="truncate text-muted-foreground">{l.label}</span>
                  <span className="tnum shrink-0 font-medium">{pcts[l.key]}%</span>
                  <span className="tnum shrink-0 text-muted-foreground">{amountFor(pcts[l.key])}</span>
                </li>
              ))}
            </ul>
          </div>

          {inVote ? (
            <div className="mt-6 space-y-2 border-t pt-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <Button variant="outline" size="sm" disabled title="Locked while the member vote is open">
                  <Vote className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.9} />
                  Send to member vote
                </Button>
                <p className="text-xs text-muted-foreground">Already sent — members are voting on this allocation now.</p>
              </div>
              <FineNote>
                A new draft can be opened after the vote closes{d.proposal ? ` (${dateFull(d.proposal.closesAt)})` : ""}.
              </FineNote>
            </div>
          ) : (
            <div className="mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={cn(
                    "micro-label whitespace-nowrap rounded-sm border px-2 py-1",
                    balanced
                      ? "border-success/40 bg-success-muted text-success-deep"
                      : "border-destructive/40 bg-destructive-muted text-destructive-deep",
                  )}
                >
                  {balanced
                    ? "100% · balanced"
                    : `${sum}% · ${sum < 100 ? `${100 - sum}% unallocated` : `${sum - 100}% over-allocated`}`}
                </span>
                {dirty && balanced && (
                  <span className="text-xs text-muted-foreground">
                    Unsaved changes — save the draft before sending it to the members.
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOverride({ ...BOARD_DEFAULT })}
                  disabled={save.isPending}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.9} />
                  Reset to board default
                </Button>
                <Button size="sm" onClick={onSave} disabled={!balanced || save.isPending}>
                  <Save className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.9} />
                  {save.isPending ? "Saving…" : "Save draft"}
                </Button>
              </div>
            </div>
          )}
        </SectionCard>

        {/* ---------------- member dividend preview ---------------- */}
        <SectionCard
          title="Member dividend preview"
          description="Dividends follow patronage — the completed service value each member delivered this year — never share count. One member, one vote."
          forTable
        >
          <DataTable
            columns={memberColumns}
            rows={previewRows}
            getRowKey={(m) => m.workerId}
            emptyTitle="No members with completed work yet"
            emptyDescription="Members appear here as bookings settle through the year."
            mobileCard={(m) => (
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <PersonAvatar name={m.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.trade}</p>
                  </div>
                  <p className="tnum shrink-0 text-sm font-semibold text-success-deep">{money(m.dividend)}</p>
                </div>
                <p className="tnum flex items-center justify-between pl-10 text-xs text-muted-foreground">
                  <span>Patronage {money(m.patronage)}</span>
                  <span>Share {m.sharePct.toFixed(1)}%</span>
                </p>
              </div>
            )}
          />
          <div className="border-t px-5 py-3">
            <FineNote>
              Preview at the current dividend percentage — final figures are set by the member vote. Top{" "}
              {num(previewRows.length)} of {num(d.sharingMembers)} sharing members by patronage; every member with
              completed work this year shares in the distribution.
            </FineNote>
          </div>
        </SectionCard>

        {/* ---------------- last year's distribution ---------------- */}
        <SectionCard
          title={`Last year — FY ${ld.fiscalYear}`}
          description="The most recent completed distribution to member-owners."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <p className="micro-label">Surplus generated</p>
              <p className="tnum mt-1 text-xl font-semibold tracking-tight">{moneyCompact(ld.surplus)}</p>
              <p className="tnum mt-0.5 text-xs text-muted-foreground">{money(ld.surplus)}</p>
            </div>
            <div>
              <p className="micro-label">Patronage bonus distributed</p>
              <p className="tnum mt-1 text-xl font-semibold tracking-tight text-success-deep">
                {moneyCompact(ld.patronageBonus)}
              </p>
              <p className="tnum mt-0.5 text-xs text-muted-foreground">
                {money(ld.patronageBonus)} · 50% of surplus
              </p>
            </div>
            <div>
              <p className="micro-label">Members sharing</p>
              <p className="tnum mt-1 text-xl font-semibold tracking-tight">{num(ld.members)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">distributed {dateFull(ld.distributedAt)}</p>
            </div>
          </div>
          <FineNote className="mt-4 border-t pt-3">
            Dividends were paid in proportion to each member&apos;s completed service value — patronage, not share count —
            after the split was approved by member vote.
          </FineNote>
        </SectionCard>

        {/* ---------------- cooperative framing ---------------- */}
        <div className="flex items-start gap-2.5 rounded-lg border bg-muted/30 p-4">
          <Coins className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.9} />
          <FineNote>
            This surplus belongs to the cooperative&apos;s member-owners — the admin desk drafts the allocation, and the
            members decide by vote before anything is distributed. Floors and quorum rules are set in the bye-laws, and
            every change is recorded in the audit log.
          </FineNote>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* One allocation line: tone dot, label, stepper, amount, floor chip.  */
/* ------------------------------------------------------------------ */

function AllocationRow({
  line,
  pct,
  amount,
  locked,
  onStep,
}: {
  line: SurplusAllocationLine;
  pct: number;
  amount: string;
  locked: boolean;
  onStep: (next: number) => void;
}) {
  const atFloor = pct <= line.minPct;
  return (
    <li className="flex flex-col gap-2.5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-[3px]", TONE_BG[line.tone])} aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug">{line.label}</p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{line.description}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 sm:justify-end">
        {locked ? (
          <>
            <span className="tnum w-12 text-center text-sm font-semibold text-muted-foreground">{pct}%</span>
            <span className="tnum w-20 text-right text-sm text-muted-foreground">{amount}</span>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="sm:size-8"
                aria-label={`Decrease ${line.label} share by one percent`}
                disabled={atFloor}
                onClick={() => onStep(pct - 1)}
              >
                <Minus className="h-3.5 w-3.5" strokeWidth={1.9} />
              </Button>
              <span className="tnum w-12 text-center text-sm font-semibold">{pct}%</span>
              <Button
                variant="outline"
                size="icon"
                className="sm:size-8"
                aria-label={`Increase ${line.label} share by one percent`}
                disabled={pct >= 100}
                onClick={() => onStep(pct + 1)}
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={1.9} />
              </Button>
            </div>
            <span className="tnum w-20 text-right text-sm text-muted-foreground">{amount}</span>
            {atFloor && (
              <span className="micro-label whitespace-nowrap rounded-sm border bg-muted px-1.5 py-0.5 text-muted-foreground">
                floor {line.minPct}%
              </span>
            )}
          </>
        )}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Dividend preview table                                              */
/* ------------------------------------------------------------------ */

const memberColumns: Column<SurplusMemberPreview>[] = [
  {
    key: "member",
    header: "Member",
    cell: (m) => (
      <div className="flex items-center gap-2.5">
        <PersonAvatar name={m.name} size="sm" />
        <div className="min-w-0">
          <p className="text-[13px] font-medium leading-tight">{m.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{m.trade}</p>
        </div>
      </div>
    ),
  },
  {
    key: "patronage",
    header: "Patronage value",
    align: "right",
    cell: (m) => <span className="tnum">{money(m.patronage)}</span>,
  },
  {
    key: "share",
    header: "Share",
    align: "right",
    cell: (m) => <span className="tnum text-muted-foreground">{m.sharePct.toFixed(1)}%</span>,
  },
  {
    key: "dividend",
    header: "Dividend",
    align: "right",
    cell: (m) => <span className="tnum text-[13px] font-semibold text-success-deep">{money(m.dividend)}</span>,
  },
];
