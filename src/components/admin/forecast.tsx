"use client";

import { useMemo, useState } from "react";
import { BellRing, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CompareBarChart,
  EmptyState,
  ErrorState,
  PageHeader,
  SectionCard,
} from "@/components/shared";
import { CATEGORY_NAMES, DemandBadge, FilterChips, FineNote, KpiStrip, KpiStripSkeleton } from "./ui";
import { useCategories, useForecast } from "@/hooks/use-api";
import { num, pctLabel } from "@/lib/format";
import type { ForecastCell } from "@/lib/types";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;
const SLOTS = ["08–12", "12–16", "16–20"] as const;

function forecastDate(day: number): Date {
  return new Date(Date.now() + day * DAY_MS);
}

function dayLabel(day: number): string {
  const d = forecastDate(day);
  if (day === 0) return "Today";
  if (day === 1) return "Tomorrow";
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return names[d.getDay()];
}

/** Weekday name — used for chart tick labels ("Sat 08–12"). */
function weekdayShort(day: number): string {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return names[forecastDate(day).getDay()];
}

function dayDateLabel(day: number): string {
  return forecastDate(day).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function slotLabel(slot: string): string {
  if (slot === "08–12") return "Morning · 8 AM – 12 PM";
  if (slot === "12–16") return "Afternoon · 12 – 4 PM";
  return "Evening · 4 – 8 PM";
}

function slotShort(slot: string): string {
  if (slot === "08–12") return "Morning";
  if (slot === "12–16") return "Afternoon";
  return "Evening";
}

/* Aggregate cells to one row per (day, slot) — used when "All categories" is selected. */
interface MatrixCell {
  day: number;
  slot: string;
  predicted: number;
  available: number;
  confidence: number;
}

function aggregate(cells: ForecastCell[]): MatrixCell[] {
  const map = new Map<string, MatrixCell>();
  for (const c of cells) {
    const key = `${c.day}-${c.slot}`;
    const entry = map.get(key) ?? { day: c.day, slot: c.slot, predicted: 0, available: 0, confidence: 0 };
    entry.predicted += c.predicted;
    entry.available += c.availableWorkers;
    entry.confidence += c.confidence;
    map.set(key, entry);
  }
  return [...map.values()].map((c) => ({ ...c, confidence: Math.round(c.confidence / (cells.length / map.size)) }));
}

type GapTone = "ok" | "watch" | "critical";

function gapTone(predicted: number, available: number): GapTone {
  const gap = predicted - available;
  if (gap <= 0) return "ok";
  return gap <= 5 ? "watch" : "critical";
}

const GAP_CELL: Record<GapTone, string> = {
  ok: "border-[oklch(0.88_0.05_155)] bg-[oklch(0.975_0.014_155)]",
  watch: "border-[oklch(0.90_0.06_80)] bg-[oklch(0.965_0.035_85)]",
  critical: "border-[oklch(0.90_0.04_27)] bg-[oklch(0.965_0.022_27)]",
};

const GAP_TEXT: Record<GapTone, string> = {
  ok: "text-[oklch(0.40_0.09_155)]",
  watch: "text-[oklch(0.45_0.10_65)]",
  critical: "text-[oklch(0.45_0.16_27)]",
};

function GapCell({ cell, compact = false }: { cell: MatrixCell; compact?: boolean }) {
  const gap = cell.predicted - cell.available;
  const tone = gapTone(cell.predicted, cell.available);
  return (
    <div className={cn("rounded-md border px-2.5 py-2 sm:px-3 sm:py-2.5", GAP_CELL[tone])} title={`${cell.predicted} predicted · ${cell.available} members available`}>
      <div className="flex items-baseline justify-between gap-1.5">
        <span className="tnum font-semibold leading-none tracking-tight sm:text-[17px]">{cell.predicted}</span>
        <span className={cn("tnum text-[10.5px] font-medium sm:text-[11px]", GAP_TEXT[tone])}>
          {gap > 0 ? `+${num(gap)} short` : "covered"}
        </span>
      </div>
      <p className="tnum mt-1 truncate text-[10.5px] text-muted-foreground sm:text-[11px]">
        {num(cell.available)} avail{!compact && ` · ${pctLabel(cell.confidence)} conf`}
      </p>
    </div>
  );
}

/** Demand forecasting — the cooperative's capacity planning tool. */
export function AdminForecastScreen() {
  const forecast = useForecast();
  const categories = useCategories();
  const [category, setCategory] = useState<string>("all");

  const data = forecast.data;

  const categoryName = (id: string): string =>
    categories.data?.find((c) => c.id === id)?.name ?? CATEGORY_NAMES[id] ?? id;

  const filteredCells = useMemo(
    () => (data ? data.cells.filter((c) => category === "all" || c.categoryId === category) : []),
    [data, category],
  );
  const matrix = useMemo(() => aggregate(filteredCells), [filteredCells]);

  const peaks = useMemo(
    () => (data ? data.peaks.filter((p) => category === "all" || p.categoryId === category) : []),
    [data, category],
  );

  /* Slot-level comparison series for the chart (21 windows, desktop) */
  const bySlotSeries = useMemo(
    () =>
      matrix.map((c) => ({
        label: `${weekdayShort(c.day)} ${c.slot}`,
        value: c.predicted,
        secondary: c.available,
      })),
    [matrix],
  );

  /* Day-level rollup for the mobile chart */
  const byDaySeries = useMemo(() => {
    const map = new Map<number, { predicted: number; available: number }>();
    for (const c of matrix) {
      const e = map.get(c.day) ?? { predicted: 0, available: 0 };
      e.predicted += c.predicted;
      e.available += c.available;
      map.set(c.day, e);
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([day, v]) => ({ label: dayLabel(day), value: v.predicted, secondary: v.available }));
  }, [matrix]);

  /* Summary figures for the current category scope (all = whole model output) */
  const scope = useMemo(() => {
    if (!data || category !== "all") {
      const predicted = filteredCells.reduce((a, c) => a + c.predicted, 0);
      const lastWeek = filteredCells.reduce((a, c) => a + c.historical, 0);
      return {
        predicted,
        lastWeek,
        gap: filteredCells.reduce((a, c) => a + Math.max(0, c.predicted - c.availableWorkers), 0),
        confidence: filteredCells.length ? Math.round(filteredCells.reduce((a, c) => a + c.confidence, 0) / filteredCells.length) : 0,
        windows: filteredCells.length,
      };
    }
    return {
      predicted: data.weekSummary.predictedBookings,
      lastWeek: data.weekSummary.lastWeekBookings,
      gap: data.weekSummary.totalGap,
      confidence: data.weekSummary.avgConfidence,
      windows: data.cells.length,
    };
  }, [data, category, filteredCells]);

  if (forecast.isError) {
    return (
      <>
        <PageHeader eyebrow="Capacity planning" title="Demand forecasting" />
        <ErrorState message="The forecast model output could not be loaded." onRetry={() => forecast.refetch()} />
      </>
    );
  }

  const loading = forecast.isLoading || !data;

  const weekDelta = Math.round(((scope.predicted - scope.lastWeek) / Math.max(1, scope.lastWeek)) * 100);

  return (
    <>
      <PageHeader
        eyebrow="Capacity planning · next 7 days"
        title="Demand forecasting"
        description={
          loading
            ? "Loading the weekly demand model…"
            : `Model generated ${new Date(data.generatedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} today · recalculated every morning at 6:00 AM. Predicted bookings vs available members, by category, day and slot.`
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void forecast.refetch();
              toast.success("Forecast refreshed", { description: "Latest model run loaded for all categories." });
            }}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.9} />
            Refresh model
          </Button>
        }
      />

      {loading ? (
        <KpiStripSkeleton count={4} className="mb-6" />
      ) : (
        <KpiStrip
          className="mb-6"
          cells={[
            {
              label: "Predicted demand",
              value: num(scope.predicted),
              sub: (
                <>
                  bookings · 7 days
                  <span className={cn("tnum ml-1 font-medium", weekDelta >= 0 ? "text-[oklch(0.40_0.09_155)]" : "text-[oklch(0.45_0.16_27)]")}>
                    {weekDelta >= 0 ? "+" : ""}
                    {weekDelta}% w/w
                  </span>
                </>
              ),
            },
            {
              label: "Capacity gap",
              value: num(scope.gap),
              sub: "uncovered bookings projected",
              tone: scope.gap > 40 ? "critical" : scope.gap > 0 ? "attention" : "default",
            },
            { label: "Model confidence", value: pctLabel(scope.confidence), sub: `avg across ${num(scope.windows)} windows` },
            { label: "Peak windows", value: num(peaks.length), sub: "action recommended", tone: peaks.length > 0 ? "attention" : "default" },
          ]}
        />
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterChips
          ariaLabel="Filter forecast by category"
          value={category}
          onChange={setCategory}
          options={[
            { value: "all", label: "All categories" },
            ...Object.keys(CATEGORY_NAMES).map((id) => ({ value: id, label: categoryName(id) })),
          ]}
        />
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-[oklch(0.88_0.05_155)] bg-[oklch(0.975_0.014_155)]" /> Covered
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-[oklch(0.90_0.06_80)] bg-[oklch(0.965_0.035_85)]" /> Gap ≤ 5
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-[oklch(0.90_0.04_27)] bg-[oklch(0.965_0.022_27)]" /> Gap &gt; 5
          </span>
        </div>
      </div>

      {/* Peaks — where operations should act this week */}
      <SectionCard
        className="mb-4"
        title="Peak windows — action recommended"
        description="Largest projected demand-vs-capacity gaps. Each card carries the operations desk's recommended play."
      >
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[172px] rounded-lg" />
            ))}
          </div>
        ) : peaks.length === 0 ? (
          <EmptyState
            title="No peak windows in this view"
            description={`${categoryName(category) || "This category"} is projected to stay within available capacity for the next 7 days.`}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {peaks.map((p) => (
              <div key={p.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="micro-label">
                      {dayLabel(p.day)} · {dayDateLabel(p.day)} · {slotShort(p.slot)} ({p.slot})
                    </p>
                    <p className="mt-1 text-[15px] font-semibold leading-tight">{categoryName(p.categoryId)}</p>
                  </div>
                  <DemandBadge level={p.demandLevel} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 border-t pt-3">
                  <div>
                    <p className="micro-label">Predicted</p>
                    <p className="tnum mt-0.5 text-lg font-semibold leading-tight">{num(p.predicted)}</p>
                  </div>
                  <div>
                    <p className="micro-label">Available</p>
                    <p className="tnum mt-0.5 text-lg font-semibold leading-tight">{num(p.availableWorkers)}</p>
                  </div>
                  <div>
                    <p className="micro-label">Gap</p>
                    <p className="tnum mt-0.5 text-lg font-semibold leading-tight text-[oklch(0.45_0.16_27)]">+{num(p.gap)}</p>
                  </div>
                </div>
                <p className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-[13px] leading-relaxed">{p.recommendedAction}.</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() =>
                    toast.success("Notification drafted", {
                      description: `Availability request prepared for ${categoryName(p.categoryId).toLowerCase()} members covering ${dayLabel(p.day).toLowerCase()} ${slotShort(p.slot).toLowerCase()} (${p.slot}). Delivery simulated.`,
                    })
                  }
                >
                  <BellRing className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.9} />
                  Notify members
                </Button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* The matrix — the planning surface */}
      <SectionCard
        className="mb-4"
        title="Capacity matrix"
        description={
          category === "all"
            ? "Predicted bookings vs available members, aggregated across all categories. Click through the filters above to isolate a trade."
            : `Predicted bookings vs available members for ${categoryName(category)}. Colour shows the gap: green covered, amber short by up to 5, red short by more than 5.`
        }
      >
        {loading ? (
          <Skeleton className="h-[380px] w-full" />
        ) : (
          <>
            {/* Desktop grid */}
            <div className="hidden gap-2 md:grid md:grid-cols-[132px_repeat(3,minmax(0,1fr))]">
              <div />
              {SLOTS.map((s) => (
                <div key={s} className="micro-label px-3 pt-1">
                  {slotLabel(s)}
                </div>
              ))}
              {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                const date = forecastDate(day);
                const weekend = date.getDay() === 0 || date.getDay() === 6;
                return (
                  <div key={day} className="contents">
                    <div className="flex flex-col justify-center py-1">
                      <p className={cn("text-[13px] font-medium leading-tight", day === 0 && "text-primary")}>
                        {dayLabel(day)}
                      </p>
                      <p className="tnum mt-0.5 text-[11px] text-muted-foreground">
                        {dayDateLabel(day)}
                        {weekend && <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground/70">wknd</span>}
                      </p>
                    </div>
                    {SLOTS.map((s) => {
                      const cell = matrix.find((c) => c.day === day && c.slot === s);
                      return cell ? (
                        <GapCell key={s} cell={cell} />
                      ) : (
                        <div key={s} className="rounded-md border border-dashed bg-muted/30" />
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Mobile: day blocks */}
            <div className="space-y-4 md:hidden">
              {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                const date = forecastDate(day);
                const weekend = date.getDay() === 0 || date.getDay() === 6;
                return (
                  <div key={day}>
                    <div className="mb-2 flex items-baseline gap-2">
                      <p className={cn("text-[13px] font-medium", day === 0 && "text-primary")}>{dayLabel(day)}</p>
                      <p className="tnum text-[11px] text-muted-foreground">
                        {dayDateLabel(day)}
                        {weekend && " · weekend"}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {SLOTS.map((s) => {
                        const cell = matrix.find((c) => c.day === day && c.slot === s);
                        return cell ? <GapCell key={s} cell={cell} compact /> : <div key={s} className="rounded-md border border-dashed bg-muted/30" />;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </SectionCard>

      {/* Chart — predicted vs available across windows */}
      <SectionCard
        className="mb-4"
        title="Demand vs capacity by window"
        description={
          category === "all"
            ? "Every day–slot window this week: predicted bookings against members expected to be available."
            : `${categoryName(category)} — predicted bookings against available members for all 21 windows.`
        }
      >
        {loading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : (
          <>
            <div className="hidden md:block">
              <CompareBarChart data={bySlotSeries} labelA="Predicted bookings" labelB="Available members" height={264} />
            </div>
            <div className="md:hidden">
              <CompareBarChart data={byDaySeries} labelA="Predicted bookings" labelB="Available members" height={208} />
            </div>
          </>
        )}
      </SectionCard>

      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-[13px] font-medium">How the forecast works</p>
        <FineNote className="mt-1.5">
          The model blends 12 weeks of booking history with seasonal patterns — weekday vs weekend, morning vs evening — and
          overlays current member availability per category and slot. Confidence reflects how stable each window's history is;
          gaps drive the peak cards above, where the operations desk drafts member notifications. This is a simulated model
          built for the prototype — a production deployment would train on the cooperative's own ledger.
        </FineNote>
      </div>
    </>
  );
}
