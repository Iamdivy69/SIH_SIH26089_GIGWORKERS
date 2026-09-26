"use client";

import { Camera, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/format";
import type { EvidencePhoto } from "@/lib/types";

/**
 * Simulated evidence capture tile. In this prototype, "capturing" a photo is
 * simulated locally — the tile records the phase, label and timestamp exactly
 * as a real upload would, so the workflow can be demonstrated end to end.
 */
export function EvidenceTile({
  phase,
  label,
  evidence,
  onCapture,
  disabled,
  className,
}: {
  phase: "before" | "after";
  label: string;
  evidence?: EvidencePhoto;
  onCapture?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const captured = evidence?.phase === phase;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-4 py-3",
        captured ? "border-[oklch(0.88_0.05_155)] bg-[oklch(0.965_0.02_155)]" : "bg-card",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border",
            captured ? "border-transparent bg-[oklch(0.5_0.105_155)] text-white" : "bg-muted/60 text-muted-foreground",
          )}
        >
          {captured ? <CheckCircle2 className="h-4.5 w-4.5" /> : <Camera className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-medium capitalize">{phase}-service photo</p>
          <p className="truncate text-xs text-muted-foreground">
            {captured ? `${evidence?.label ?? "Photo recorded"} · ${relativeTime(evidence!.capturedAt)}` : label}
          </p>
        </div>
      </div>
      {!captured && onCapture && (
        <Button variant="outline" size="sm" onClick={onCapture} disabled={disabled}>
          <Camera className="mr-1.5 h-3.5 w-3.5" /> Capture
        </Button>
      )}
      {captured && (
        <span className="tnum inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[oklch(0.40_0.09_155)]">
          <Clock className="h-3 w-3" /> Recorded
        </span>
      )}
    </div>
  );
}
