"use client";

import type { MatchFactor } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

/** Score pill — e.g. "94% match" */
export function MatchBadge({ score, className, size = "md" }: { score: number; className?: string; size?: "sm" | "md" | "lg" }) {
  const tone = score >= 85 ? "text-[oklch(0.40_0.09_155)]" : score >= 70 ? "text-[oklch(0.45_0.10_65)]" : "text-muted-foreground";
  const sizes = { sm: "text-xs px-1.5 py-0.5", md: "text-[13px] px-2 py-1", lg: "text-sm px-2.5 py-1.5" };
  return (
    <span
      className={cn(
        "tnum inline-flex items-center gap-1 rounded-sm border border-[oklch(0.88_0.03_155)] bg-[oklch(0.945_0.034_155)] font-semibold",
        tone,
        sizes[size],
        className,
      )}
    >
      {score}% match
    </span>
  );
}

const barTone = (score: number) =>
  score >= 85 ? "bg-[oklch(0.5_0.105_155)]" : score >= 70 ? "bg-[oklch(0.62_0.122_65)]" : score >= 50 ? "bg-[oklch(0.72_0.115_75)]" : "bg-muted-foreground/50";

const assessmentTone = (score: number) =>
  score >= 85 ? "text-[oklch(0.40_0.09_155)]" : score >= 70 ? "text-[oklch(0.45_0.10_65)]" : "text-muted-foreground";

/**
 * "Why this worker / job was recommended" — the transparent scoring
 * explanation. Every factor: label, weight, assessment, score bar, reason.
 */
export function FactorBars({ factors, className, compact }: { factors: MatchFactor[]; className?: string; compact?: boolean }) {
  return (
    <div className={cn("space-y-3", className)}>
      {factors.map((f) => (
        <div key={f.id}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13px] font-medium">
              {f.label}
              <span className="ml-1.5 font-normal text-muted-foreground">· {f.weightPct}%</span>
            </p>
            <p className={cn("shrink-0 text-xs font-medium", assessmentTone(f.score))}>{f.assessment}</p>
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className={cn("h-full rounded-full", barTone(f.score))} style={{ width: `${f.score}%` }} />
            </div>
            {!compact && <span className="tnum w-8 text-right text-[11px] text-muted-foreground">{f.score}</span>}
          </div>
          {!compact && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.detail}</p>}
        </div>
      ))}
    </div>
  );
}

/** Compact ✓ reason chips used on job/recommendation cards. */
export function MatchReasonChips({ factors, max = 4 }: { factors: MatchFactor[]; max?: number }) {
  return (
    <ul className="space-y-1.5">
      {factors.slice(0, max).map((f) => (
        <li key={f.id} className="flex items-start gap-2 text-[13px]">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[oklch(0.5_0.105_155)]" />
          <span>
            {f.label} — <span className="text-muted-foreground">{f.assessment.toLowerCase()}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Big score dial for the recommendation hero. */
export function ScoreDial({ score, label = "match", size = 96 }: { score: number; label?: string; size?: number }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const filled = (score / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth="6" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum text-xl font-semibold leading-none">{score}%</span>
        <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
