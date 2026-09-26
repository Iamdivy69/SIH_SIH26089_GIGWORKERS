"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeriesPoint } from "@/lib/types";
import { money, num } from "@/lib/format";
import { cn } from "@/lib/utils";

const AXIS = { tickLine: false, axisLine: false, tickMargin: 8 } as const;
const GRID_STROKE = "var(--border)";

function ChartTooltip({ active, payload, label, format }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      {label !== undefined && <p className="mb-1 font-medium text-foreground">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.dataKey ?? p.name} className="tnum flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-[2px]" style={{ background: p.color ?? p.fill }} />
          <span>{p.name}:</span>
          <span className="font-medium text-foreground">{format ? format(p.value) : num(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

/** Single-series area trend (earnings, volume) */
export function TrendAreaChart({ data, height = 200, currency, className }: { data: SeriesPoint[]; height?: number; currency?: boolean; className?: string }) {
  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.1} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={24} />
          <YAxis {...AXIS} width={44} tickFormatter={(v) => (currency ? (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)) : num(v))} />
          <Tooltip content={<ChartTooltip format={currency ? money : undefined} />} />
          <Area
            type="monotone"
            dataKey="value"
            name="Value"
            stroke="var(--primary)"
            strokeWidth={1.75}
            fill="url(#trendFill)"
            dot={{ r: 2.5, fill: "var(--primary)", fillOpacity: 0.8, strokeWidth: 0 }}
            activeDot={{ r: 3.5, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Grouped bars: value vs secondary (forecast vs historical, etc.) */
export function CompareBarChart({
  data,
  height = 220,
  labelA = "This period",
  labelB = "Previous",
  currency,
  className,
}: {
  data: SeriesPoint[];
  height?: number;
  labelA?: string;
  labelB?: string;
  currency?: boolean;
  className?: string;
}) {
  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2} barSize={10}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="label" {...AXIS} interval={0} minTickGap={8} />
          <YAxis {...AXIS} width={36} tickFormatter={(v) => num(v)} />
          <Tooltip content={<ChartTooltip format={currency ? money : undefined} />} cursor={{ fill: "var(--muted)" }} />
          <Legend
            verticalAlign="top"
            align="right"
            height={28}
            iconType="square"
            iconSize={8}
            formatter={(v) => <span className="text-[11px] text-muted-foreground">{v}</span>}
          />
          <Bar dataKey="value" name={labelA} fill="var(--chart-1)" radius={[2, 2, 0, 0]} />
          <Bar dataKey="secondary" name={labelB} fill="var(--chart-3)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Simple value bars (category demand, utilization) */
export function ValueBarChart({
  data,
  height = 200,
  currency,
  color = "var(--chart-1)",
  className,
}: {
  data: SeriesPoint[];
  height?: number;
  currency?: boolean;
  color?: string;
  className?: string;
}) {
  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barSize={26}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="label" {...AXIS} interval={0} />
          <YAxis {...AXIS} width={40} tickFormatter={(v) => (currency ? (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v)) : num(v))} />
          <Tooltip content={<ChartTooltip format={currency ? money : undefined} />} cursor={{ fill: "var(--muted)" }} />
          <Bar dataKey="value" name="Value" radius={[2, 2, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Thin line for rates/percentages (0–5 or 0–100 scales) */
export function LineTrend({ data, height = 200, suffix, max, className }: { data: SeriesPoint[]; height?: number; suffix?: string; max?: number; className?: string }) {
  return (
    <div className={className} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis dataKey="label" {...AXIS} minTickGap={24} />
          <YAxis {...AXIS} width={36} domain={max ? [0, max] : ["auto", "auto"]} />
          <Tooltip content={<ChartTooltip format={(v: number) => `${num(v)}${suffix ?? ""}`} />} />
          <Line
            type="monotone"
            dataKey="value"
            name="Value"
            stroke="var(--chart-6)"
            strokeWidth={1.75}
            dot={{ r: 2.5, fill: "var(--chart-6)", fillOpacity: 0.8, strokeWidth: 0 }}
            activeDot={{ r: 3.5, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Sparkline for stat tiles */
export function Spark({ data, className, tone = "var(--primary)" }: { data: number[]; className?: string; tone?: string }) {
  const points = data.map((v, i) => ({ i, v }));
  return (
    <div className={className} style={{ height: 28, width: 72 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Area type="monotone" dataKey="v" stroke={tone} strokeWidth={1.5} fill="transparent" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bar list — good for locality/category comparisons */
export function HBarList({ data, currency, max, className }: { data: { label: string; value: number }[]; currency?: boolean; max?: number; className?: string }) {
  const top = max ?? Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className={cn("space-y-3", className)}>
      {data.map((d) => (
        <li key={d.label}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate">{d.label}</span>
            <span className="tnum shrink-0 font-medium">{currency ? money(d.value) : num(d.value)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-[oklch(0.62_0.088_158)]" style={{ width: `${(d.value / top) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
