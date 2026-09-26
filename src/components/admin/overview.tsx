"use client";

import { useMemo } from "react";
import { ArrowRight, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertBanner,
  DataTable,
  ErrorState,
  PageHeader,
  SectionCard,
  StatusBadge,
  TrendAreaChart,
  ValueBarChart,
  PersonAvatar,
} from "@/components/shared";
import type { Column } from "@/components/shared";
import { KpiStrip, KpiStripSkeleton, PctBarList } from "./ui";
import { useAdminBookings, useAdminOverview } from "@/hooks/use-api";
import { useAppStore } from "@/store/app-store";
import { money, moneyCompact, num, dateTimeLabel, pctLabel, ratingLabel } from "@/lib/format";
import type { Booking } from "@/lib/types";
import { cn } from "@/lib/utils";

type BookingRow = { booking: Booking; customerName: string; workerName: string };

/** Cooperative operations overview — the flagship daily-read screen. */
export function AdminOverviewScreen() {
  const navigate = useAppStore((s) => s.navigate);
  const overview = useAdminOverview();
  const bookings = useAdminBookings();

  const data = overview.data;

  const recentRows = useMemo<BookingRow[]>(
    () => (bookings.data?.items ?? []).slice(0, 8),
    [bookings.data],
  );

  if (overview.isError) {
    return (
      <>
        <PageHeader eyebrow="Cooperative operations · West Pune" title="Operations overview" />
        <ErrorState message="Live operations data could not be loaded." onRetry={() => overview.refetch()} />
      </>
    );
  }

  const loading = overview.isLoading || !data;

  return (
    <>
      <PageHeader
        eyebrow="Cooperative operations · West Pune"
        title="Operations overview"
        description="The cooperative at a glance — demand, workforce, exceptions and money. Everything below is live operational data for the 216-member West Pune unit."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate("admin-forecast")}>
              <TrendingUp className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.9} />
              7-day forecast
            </Button>
            <Button size="sm" onClick={() => navigate("admin-verifications")}>
              Verification queue
              {!loading && data.kpis.pendingVerifications > 0 && (
                <span className="tnum ml-1.5 rounded-sm bg-primary-foreground/15 px-1.5 py-0.5 text-[11px] font-semibold">
                  {data.kpis.pendingVerifications}
                </span>
              )}
            </Button>
          </>
        }
      />

      {/* Exceptions first — what needs a human right now */}
      <section aria-label="Operational alerts" className="mb-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[62px] rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {data.alerts.map((alert) => (
              <AlertBanner
                key={alert.id}
                severity={alert.severity}
                title={alert.title}
                detail={alert.detail}
                action={alert.action}
                onAction={alert.route ? () => navigate(alert.route as string) : undefined}
              />
            ))}
          </div>
        )}
      </section>

      {/* KPI strip */}
      {loading ? (
        <KpiStripSkeleton className="mb-6" />
      ) : (
        <KpiStrip
          className="mb-6"
          cells={[
            { label: "Active members", value: num(data.kpis.activeWorkers), sub: "verified & serving" },
            { label: "Households", value: num(data.kpis.activeCustomers), sub: "active customers" },
            { label: "Bookings today", value: num(data.kpis.bookingsToday), sub: `${num(data.kpis.completedToday)} completed` },
            { label: "Service quality", value: ratingLabel(data.kpis.avgRating), sub: `CSAT ${pctLabel(data.kpis.csat)} · on-time ${pctLabel(data.kpis.onTimeRate)}` },
            {
              label: "Pending verifications",
              value: num(data.kpis.pendingVerifications),
              sub: "in onboarding queue",
              tone: data.kpis.pendingVerifications > 0 ? "attention" : "default",
            },
            {
              label: "Open cases",
              value: num(data.kpis.openDisputes),
              sub: "disputes & complaints",
              tone: data.kpis.openDisputes > 0 ? "attention" : "default",
            },
            { label: "Payments today", value: money(data.kpis.transactionVolumeToday), sub: "customer volume" },
            { label: "Welfare pool", value: moneyCompact(data.kpis.welfarePoolTotal), sub: "member benefit funds" },
          ]}
        />
      )}

      {/* Flow + quality */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Bookings flow — last 14 days"
          description="Scheduled services per day across all categories."
        >
          {loading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : (
            <TrendAreaChart data={data.bookingsTrend} height={224} />
          )}
        </SectionCard>

        <SectionCard title="Service quality" description="Rolling member performance, verified reviews only.">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : (
            <div className="space-y-3.5">
              <QualityRow label="Average rating" value={ratingLabel(data.kpis.avgRating)} detail="across all categories" />
              <QualityRow label="Customer satisfaction" value={pctLabel(data.kpis.csat)} detail="post-service surveys" />
              <QualityRow label="On-time arrival" value={pctLabel(data.kpis.onTimeRate)} detail="within 15 min of slot" />
              <QualityRow
                label="Cancellation rate"
                value={pctLabel(data.kpis.cancellationRate)}
                detail="customer + member initiated"
                tone={data.kpis.cancellationRate > 8 ? "attention" : "default"}
              />
            </div>
          )}
        </SectionCard>
      </div>

      {/* Demand + capacity + geography */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <SectionCard title="Category demand" description="Bookings created, last 30 days.">
          {loading ? <Skeleton className="h-[200px] w-full" /> : <ValueBarChart data={data.categoryDemand} height={208} />}
        </SectionCard>
        <SectionCard
          title="Member utilization"
          description="Completed jobs vs weekly capacity per category."
        >
          {loading ? <Skeleton className="h-[200px] w-full" /> : <PctBarList data={data.workerUtilization} />}
        </SectionCard>
        <SectionCard title="Coverage by locality" description="Where demand and members are concentrated.">
          {loading ? (
            <Skeleton className="h-[200px] w-full" />
          ) : (
            <ul className="space-y-3">
              {data.geographic.slice(0, 6).map((g) => (
                <li key={g.locality}>
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="truncate">{g.locality}</span>
                    <span className="tnum shrink-0 text-muted-foreground">
                      {num(g.bookings)} {g.bookings === 1 ? "booking" : "bookings"} · {num(g.workers)} {g.workers === 1 ? "member" : "members"}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[oklch(0.62_0.088_158)]"
                      style={{ width: `${(g.bookings / Math.max(...data.geographic.map((x) => x.bookings), 1)) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {/* Quality per category */}
      <SectionCard className="mb-6" title="Rating by category" description="Average member rating — the cooperative's quality ledger.">
        {loading ? (
          <Skeleton className="h-[150px] w-full" />
        ) : (
          <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
            <ul className="space-y-3">
              {data.quality.map((q) => (
                <li key={q.label}>
                  <div className="flex items-baseline justify-between gap-3 text-[13px]">
                    <span className="truncate">{q.label}</span>
                    <span className="tnum shrink-0 font-medium">{q.value.toFixed(1)} / 5</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-[oklch(0.62_0.088_158)]" style={{ width: `${(q.value / 5) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="self-end text-xs leading-relaxed text-muted-foreground">
              Ratings come only from verified, completed bookings. Category averages drive match ranking and the
              high-performer fee proposals debated in governance — members see the same numbers you do.
            </p>
          </div>
        )}
      </SectionCard>

      {/* Recent bookings */}
      <SectionCard
        title="Recent bookings"
        description="Latest service requests across the cooperative."
        forTable
        actions={
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate("admin-bookings")}>
            All bookings <ArrowRight className="ml-1 h-3.5 w-3.5" strokeWidth={1.9} />
          </Button>
        }
      >
        {bookings.isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <RecentBookingsTable rows={recentRows} />
        )}
      </SectionCard>
    </>
  );
}

function QualityRow({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "attention";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 pb-3 last:border-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
      <p className={cn("tnum shrink-0 text-lg font-semibold tracking-tight", tone === "attention" && "text-[oklch(0.45_0.10_65)]")}>
        {value}
      </p>
    </div>
  );
}

function RecentBookingsTable({ rows }: { rows: BookingRow[] }) {
  const columns: Column<BookingRow>[] = [
    {
      key: "ref",
      header: "Reference",
      cell: (r) => <span className="tnum font-medium">{r.booking.reference}</span>,
    },
    {
      key: "customer",
      header: "Customer",
      cell: (r) => <span className="truncate">{r.customerName}</span>,
    },
    {
      key: "worker",
      header: "Member",
      cell: (r) => (
        <span className="flex items-center gap-2">
          <PersonAvatar name={r.workerName} size="xs" />
          <span className="truncate">{r.workerName}</span>
        </span>
      ),
      hideOnTablet: true,
    },
    { key: "service", header: "Service", cell: (r) => <span className="truncate">{r.booking.title}</span> },
    {
      key: "scheduled",
      header: "Scheduled",
      cell: (r) => <span className="tnum whitespace-nowrap text-muted-foreground">{dateTimeLabel(r.booking.scheduledAt)}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => <StatusBadge status={r.booking.status} />,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (r) => <span className="tnum font-medium">{money(r.booking.price.customerTotal)}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowKey={(r) => r.booking.id}
      emptyTitle="No bookings yet"
      mobileCard={(r) => (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="tnum text-xs font-medium">{r.booking.reference}</span>
            <StatusBadge status={r.booking.status} />
          </div>
          <p className="text-[13px] font-medium">{r.booking.title}</p>
          <p className="text-xs text-muted-foreground">
            {r.customerName} → {r.workerName} · {dateTimeLabel(r.booking.scheduledAt)}
          </p>
          <p className="tnum text-[13px] font-semibold">{money(r.booking.price.customerTotal)}</p>
        </div>
      )}
    />
  );
}
