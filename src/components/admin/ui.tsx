"use client";

import { ReactNode, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { num } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* KPI strip — one card, many cells. Hairline dividers, tabular        */
/* numerals, no floating-card soup. The enterprise ops pattern.        */
/* ------------------------------------------------------------------ */

export interface KpiCellData {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Semantic emphasis on the value (amber = attention) */
  tone?: "default" | "attention" | "critical" | "positive";
}

const TONE_TEXT: Record<NonNullable<KpiCellData["tone"]>, string> = {
  default: "text-foreground",
  attention: "text-warning-deep",
  critical: "text-destructive-deep",
  positive: "text-success-deep",
};

export function KpiStrip({ cells, className }: { cells: KpiCellData[]; className?: string }) {
  const wide = cells.length > 4;
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4",
        wide && "2xl:grid-cols-8",
        className,
      )}
      role="list"
      aria-label="Key metrics"
    >
      {cells.map((c) => (
        <div key={c.label} className="flex min-w-0 flex-col bg-card px-4 py-3.5" role="listitem">
          <p className="micro-label leading-[1.35]">{c.label}</p>
          <p className={cn("tnum mt-1.5 text-[20px] font-semibold leading-tight tracking-tight", TONE_TEXT[c.tone ?? "default"])}>
            {c.value}
          </p>
          {/* reserve two sub lines so every cell in the strip shares one height */}
          {c.sub && <p className="mt-1 line-clamp-2 min-h-[2.1rem] text-xs leading-snug text-muted-foreground">{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}

/** Skeleton matching the strip layout while queries load. */
export function KpiStripSkeleton({ count = 8, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-4",
        count > 4 && "2xl:grid-cols-8",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-card px-4 py-3.5">
          <div className="h-2.5 w-2/3 animate-pulse rounded-sm bg-muted" />
          <div className="mt-2.5 h-5 w-1/2 animate-pulse rounded-sm bg-muted" />
          <div className="mt-2 h-2.5 w-3/4 animate-pulse rounded-sm bg-muted" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Category name lookup (fallback when the catalog query is loading)   */
/* ------------------------------------------------------------------ */

export const CATEGORY_NAMES: Record<string, string> = {
  electrical: "Electrical",
  plumbing: "Plumbing",
  cleaning: "Cleaning",
  gardening: "Gardening",
  repairs: "Repairs",
  "community-care": "Community care",
};

/* ------------------------------------------------------------------ */
/* Filter chips — status/type selectors shared by list screens         */
/* ------------------------------------------------------------------ */

export interface ChipOption {
  value: string;
  label: string;
  count?: number;
}

export function FilterChips({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-7 rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active
                ? "border-primary/40 bg-accent text-primary"
                : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn("tnum ml-1.5", active ? "text-primary/70" : "text-muted-foreground/70")}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Demand level badge — forecast peak severity                         */
/* ------------------------------------------------------------------ */

const DEMAND_STYLES = {
  low: { cls: "border-border bg-muted text-muted-foreground", label: "Low" },
  medium: { cls: "border-info/40 bg-info-muted text-info-deep", label: "Medium" },
  high: { cls: "border-warning/40 bg-warning-muted text-warning-deep", label: "High" },
  very_high: { cls: "border-destructive/40 bg-destructive-muted text-destructive-deep", label: "Very high" },
} as const;

export function DemandBadge({ level }: { level: "low" | "medium" | "high" | "very_high" }) {
  const s = DEMAND_STYLES[level];
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-[11px] font-medium", s.cls)}>
      {s.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Audit severity                                                      */
/* ------------------------------------------------------------------ */

const SEVERITY_STYLES = {
  info: { dot: "bg-info", text: "text-info-deep", label: "Info" },
  notice: { dot: "bg-success", text: "text-success-deep", label: "Notice" },
  warning: { dot: "bg-warning", text: "text-warning-deep", label: "Warning" },
} as const;

export function SeverityBadge({ severity }: { severity: "info" | "notice" | "warning" }) {
  const s = SEVERITY_STYLES[severity];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium", s.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden />
      {s.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Role chip (audit / disputes)                                        */
/* ------------------------------------------------------------------ */

export function RoleChip({ role }: { role: "customer" | "worker" | "admin" }) {
  const map = {
    customer: "Customer",
    worker: "Member",
    admin: "Staff",
  } as const;
  return <span className="micro-label rounded-sm border bg-muted px-1.5 py-0.5 text-muted-foreground">{map[role]}</span>;
}

/* ------------------------------------------------------------------ */
/* Percentage bar list (utilization etc — HBarList with % suffix)      */
/* ------------------------------------------------------------------ */

export function PctBarList({
  data,
  max = 100,
  className,
}: {
  data: { label: string; value: number }[];
  max?: number;
  className?: string;
}) {
  return (
    <ul className={cn("space-y-3", className)}>
      {data.map((d) => (
        <li key={d.label}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate">{d.label}</span>
            <span className="tnum shrink-0 font-medium">{num(d.value)}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", d.value >= 90 ? "bg-warning" : "bg-chart-2")}
              style={{ width: `${Math.min(100, (d.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------ */
/* Fine print                                                          */
/* ------------------------------------------------------------------ */

export function FineNote({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>{children}</p>;
}

/* ------------------------------------------------------------------ */
/* Layout helpers                                                      */
/* ------------------------------------------------------------------ */

/** True at ≥1024px — used to switch master-detail between inline panel and dialog. */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

/** Master-detail wrapper: list column + detail column (desktop) or dialog (mobile). */
export function MasterDetail({
  list,
  detail,
  selectedKey,
  className,
}: {
  list: ReactNode;
  detail: ReactNode;
  selectedKey: string | null;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]", className)}>
      <div className="min-w-0">{list}</div>
      <div className={cn("min-w-0", !selectedKey && "hidden lg:block")}>{detail}</div>
    </div>
  );
}

/** Empty placeholder panel shown on desktop when nothing is selected. */
export function SelectPrompt({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
