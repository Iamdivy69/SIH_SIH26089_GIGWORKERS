"use client";

import { useMemo, useState } from "react";
import { Ban, Download, MessageSquare, Search, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DataTable,
  ErrorState,
  PageHeader,
  PersonAvatar,
  RatingStars,
  SectionCard,
  StatusBadge,
} from "@/components/shared";
import type { Column } from "@/components/shared";
import { CATEGORY_NAMES, FilterChips, KpiStrip } from "./ui";
import { useAdminWorkers } from "@/hooks/use-api";
import { useAppStore } from "@/store/app-store";
import { csvDateStamp, downloadCsv } from "@/lib/csv";
import { dateFull, dateShort, money, num, pctLabel, ratingLabel } from "@/lib/format";
import type { Worker } from "@/lib/types";
import { cn } from "@/lib/utils";

type AdminWorker = Worker & { weekJobs: number; weekEarnings: number };

const STATUS_CHIPS = [
  { value: "all", label: "All" },
  { value: "verified", label: "Verified" },
  { value: "pending", label: "Pending" },
  { value: "under_review", label: "Under review" },
  { value: "needs_action", label: "Needs action" },
  { value: "rejected", label: "Rejected" },
  { value: "suspended", label: "Suspended" },
];

/** Workforce register — every member of the cooperative. */
export function AdminWorkersScreen() {
  const workers = useAdminWorkers();
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AdminWorker | null>(null);

  const items = workers.data?.items ?? [];

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    for (const w of items) counts[w.status] = (counts[w.status] ?? 0) + 1;
    return counts;
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((w) => {
      if (status !== "all" && w.status !== status) return false;
      if (!q) return true;
      return (
        w.name.toLowerCase().includes(q) ||
        w.tradeTitle.toLowerCase().includes(q) ||
        w.locality.toLowerCase().includes(q) ||
        w.cooperativeMemberId.toLowerCase().includes(q)
      );
    });
  }, [items, status, query]);

  const verifiedItems = items.filter((w) => w.status === "verified");
  const avgRating = verifiedItems.length ? verifiedItems.reduce((a, w) => a + w.rating, 0) / verifiedItems.length : 0;
  const weekEarnings = items.reduce((a, w) => a + w.weekEarnings, 0);

  const exportCsv = () => {
    downloadCsv(
      `sahyog-members-${csvDateStamp()}`,
      ["Member ID", "Name", "Trade", "Category", "Locality", "Status", "Rating", "Reviews", "Completed jobs", "Experience (yrs)", "On-time %", "Week jobs", "Week earnings", "Member since"],
      filtered.map((w) => [
        w.cooperativeMemberId,
        w.name,
        w.tradeTitle,
        CATEGORY_NAMES[w.category] ?? w.category,
        `${w.locality}, ${w.city}`,
        w.status,
        w.rating.toFixed(1),
        w.reviewCount,
        w.completedJobs,
        w.experienceYears,
        w.onTimeRate,
        w.weekJobs,
        w.weekEarnings,
        dateShort(w.memberSince),
      ]),
    );
    toast.success("Member register exported", { description: `${filtered.length} rows · reflects the current filter and search.` });
  };

  if (workers.isError) {
    return (
      <>
        <PageHeader eyebrow="Workforce" title="Members" />
        <ErrorState message="The member register could not be loaded." onRetry={() => workers.refetch()} />
      </>
    );
  }

  const loading = workers.isLoading;

  return (
    <>
      <PageHeader
        eyebrow="Workforce · member register"
        title="Members"
        description="Every worker of the cooperative — onboarding status, quality signals and weekly activity. Click a row for the full member file."
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={loading || filtered.length === 0}>
            <Download className="h-3.5 w-3.5" strokeWidth={1.9} /> Export CSV
          </Button>
        }
      />

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-[76px] rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-[400px] rounded-lg" />
        </div>
      ) : (
        <>
          <KpiStrip
            className="mb-4"
            cells={[
              { label: "Members shown", value: num(filtered.length), sub: `of ${num(items.length)} registered` },
              { label: "Verified & serving", value: num(statusCounts.verified ?? 0), sub: "full member-owners" },
              { label: "Avg rating", value: ratingLabel(avgRating), sub: "verified members" },
              { label: "Weekly earnings", value: money(weekEarnings), sub: "net payouts, all members" },
            ]}
          />

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <FilterChips
              ariaLabel="Filter members by status"
              value={status}
              onChange={setStatus}
              options={STATUS_CHIPS.map((c) => ({ ...c, count: statusCounts[c.value] ?? 0 }))}
            />
            <div className="relative sm:w-64">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.9} />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, trade, locality…"
                className="h-9 pl-8 text-[13px]"
                aria-label="Search members"
              />
            </div>
          </div>

          <SectionCard forTable>
            <DataTable
              columns={workerColumns}
              rows={filtered}
              getRowKey={(w) => w.id}
              onRowClick={(w) => setSelected(w)}
              emptyTitle="No members match"
              emptyDescription="Try a different status filter or clear the search."
              mobileCard={(w) => <WorkerMobileCard worker={w} />}
            />
          </SectionCard>
        </>
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto scroll-slim sm:max-w-2xl">
          {selected && <WorkerDetail worker={selected} onClose={() => setSelected(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

const workerColumns: Column<AdminWorker>[] = [
  {
    key: "member",
    header: "Member",
    cell: (w) => (
      <div className="flex items-center gap-2.5">
        <PersonAvatar name={w.name} size="sm" />
        <div className="min-w-0">
          <p className="truncate font-medium leading-tight">{w.name}</p>
          <p className="tnum text-[11px] text-muted-foreground">{w.cooperativeMemberId}</p>
        </div>
      </div>
    ),
  },
  {
    key: "trade",
    header: "Trade",
    cell: (w) => (
      <div className="min-w-0">
        <p className="truncate leading-tight">{w.tradeTitle}</p>
        <p className="text-[11px] text-muted-foreground">{CATEGORY_NAMES[w.category] ?? w.category}</p>
      </div>
    ),
  },
  { key: "locality", header: "Locality", cell: (w) => <span className="text-muted-foreground">{w.locality}</span>, hideOnTablet: true },
  { key: "status", header: "Status", cell: (w) => <StatusBadge status={w.status} /> },
  {
    key: "rating",
    header: "Rating",
    cell: (w) =>
      w.reviewCount > 0 ? (
        <RatingStars value={w.rating} size={11} showValue />
      ) : (
        <span className="text-xs text-muted-foreground">—</span>
      ),
    hideOnTablet: true,
  },
  { key: "completed", header: "Jobs", align: "right", cell: (w) => <span className="tnum">{num(w.completedJobs)}</span>, hideOnTablet: true },
  {
    key: "ontime",
    header: "On-time",
    align: "right",
    cell: (w) => <span className={cn("tnum", w.onTimeRate >= 90 ? "text-[oklch(0.40_0.09_155)]" : "text-foreground")}>{w.onTimeRate > 0 ? pctLabel(w.onTimeRate) : "—"}</span>,
    hideOnTablet: true,
  },
  {
    key: "week",
    header: "This week",
    align: "right",
    cell: (w) => (
      <div>
        <p className="tnum leading-tight">{num(w.weekJobs)} jobs</p>
        <p className="tnum text-[11px] text-muted-foreground">{money(w.weekEarnings)}</p>
      </div>
    ),
  },
  {
    key: "since",
    header: "Member since",
    cell: (w) => <span className="tnum whitespace-nowrap text-muted-foreground">{dateShort(w.memberSince)}</span>,
    hideOnDesktop: true,
  },
];

function WorkerMobileCard({ worker: w }: { worker: AdminWorker }) {
  return (
    <div className="flex items-start gap-3">
      <PersonAvatar name={w.name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-[13px] font-medium">{w.name}</p>
          <StatusBadge status={w.status} />
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {w.tradeTitle} · {w.locality}
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
          <span className="tnum text-muted-foreground">
            {w.reviewCount > 0 ? `${w.rating.toFixed(1)}★ · ${num(w.completedJobs)} jobs` : "New applicant"}
          </span>
          <span className="tnum font-medium">{money(w.weekEarnings)}</span>
        </div>
      </div>
    </div>
  );
}

function WorkerDetail({ worker: w, onClose }: { worker: AdminWorker; onClose: () => void }) {
  const navigate = useAppStore((s) => s.navigate);
  const [suspendOpen, setSuspendOpen] = useState(false);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="sr-only">Member file — {w.name}</DialogTitle>
        <DialogDescription className="sr-only">Full member record for {w.name}.</DialogDescription>
        <div className="flex items-start gap-4">
          <PersonAvatar name={w.name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold leading-tight tracking-tight">{w.name}</h3>
              <StatusBadge status={w.status} />
            </div>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{w.tradeTitle}</p>
            <p className="tnum mt-1 text-xs text-muted-foreground">
              {w.cooperativeMemberId} · member since {dateFull(w.memberSince)} · {w.locality}, {w.city}
            </p>
          </div>
        </div>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-y py-4 sm:grid-cols-4">
        <Stat label="Rating" value={w.reviewCount > 0 ? ratingLabel(w.rating) : "—"} sub={w.reviewCount > 0 ? `${num(w.reviewCount)} reviews` : "no reviews yet"} />
        <Stat label="Completed" value={num(w.completedJobs)} sub="jobs" />
        <Stat label="On-time" value={w.onTimeRate > 0 ? pctLabel(w.onTimeRate) : "—"} sub="within 15 min" />
        <Stat label="Experience" value={`${num(w.experienceYears)} yrs`} sub={w.skills.slice(0, 2).join(", ") || "—"} />
        <Stat label="Repeat customers" value={w.repeatCustomerRate > 0 ? pctLabel(w.repeatCustomerRate) : "—"} sub="book again" />
        <Stat label="Response time" value={w.responseMins > 0 ? `~${num(w.responseMins)} min` : "—"} sub="to offers" />
        <Stat label="This week" value={`${num(w.weekJobs)} jobs`} sub="completed" />
        <Stat label="Weekly earnings" value={money(w.weekEarnings)} sub="net payouts" />
      </div>

      <section aria-label="Verification checks" className="mt-4">
        <h4 className="micro-label mb-2">Verification checks</h4>
        <ul className="space-y-2">
          {w.verification.map((v) => (
            <li key={v.id} className="flex items-start justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
              <div className="min-w-0">
                <p className="text-[13px] leading-snug">{v.label}</p>
                {v.note && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{v.note}</p>}
                {v.reference && <p className="tnum mt-0.5 text-[11px] text-muted-foreground/80">Ref {v.reference}</p>}
              </div>
              <div className="shrink-0 text-right">
                <StatusBadge status={v.status} />
                {v.verifiedAt && <p className="tnum mt-1 text-[11px] text-muted-foreground">{dateShort(v.verifiedAt)}</p>}
              </div>
            </li>
          ))}
          {w.verification.length === 0 && <li className="text-xs text-muted-foreground">No checks recorded.</li>}
        </ul>
      </section>

      <section aria-label="Certifications" className="mt-4">
        <h4 className="micro-label mb-2">Certifications</h4>
        {w.certifications.length > 0 ? (
          <ul className="space-y-2">
            {w.certifications.map((c) => (
              <li key={c.id} className="rounded-md border px-3 py-2">
                <p className="text-[13px] font-medium">{c.name}</p>
                <p className="tnum mt-0.5 text-xs text-muted-foreground">
                  {c.issuer} · {c.credentialId}
                  {c.validTill ? ` · valid till ${dateShort(c.validTill)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No certifications on file yet.</p>
        )}
      </section>

      <section aria-label="Weekly availability" className="mt-4">
        <h4 className="micro-label mb-2">Weekly availability</h4>
        {w.availability.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {w.availability.map((a) => (
              <span key={a.day} className="rounded-sm border bg-muted/50 px-2 py-1 text-[11px]">
                <span className="font-medium">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][a.day]}</span>
                <span className="tnum ml-1.5 text-muted-foreground">{a.slots.join(" · ")}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Availability not set (applicant — set during onboarding).</p>
        )}
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
        {w.status === "verified" ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => toast("Message drafted", { description: `Secure chat with ${w.name.split(" ")[0]} opens here. Delivery simulated in the prototype.` })}
            >
              <MessageSquare className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.9} />
              Message member
            </Button>
            <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/5" onClick={() => setSuspendOpen(true)}>
              <Ban className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.9} />
              Suspend member
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">Applicant — managed from the verification queue.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                navigate("admin-verifications");
              }}
            >
              <ShieldQuestion className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.9} />
              Open verification queue
            </Button>
          </>
        )}
      </div>

      <AlertDialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend {w.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {w.name.split(" ")[0]} will stop receiving new offers immediately; scheduled bookings are reassigned. Suspension is
              reversible and recorded in the audit log. (Simulated action in the prototype.)
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep active</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                toast("Member suspension recorded", {
                  description: `${w.name} suspended — 2 scheduled bookings flagged for reassignment. Audit entry written. (Simulated)`,
                })
              }
            >
              Suspend member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="micro-label">{label}</p>
      <p className="tnum mt-0.5 text-[15px] font-semibold leading-tight">{value}</p>
      {sub && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
