"use client";

import { useState } from "react";
import { Info, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AlertBanner, PageHeader, SectionCard } from "@/components/shared";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { useAvailability, useSaveAvailability } from "@/hooks/use-api";
import { QueryGate } from "../parts";
import { DAY_NAMES } from "@/lib/format";
import type { WorkerAvailabilitySlot } from "@/lib/types";

/** Slot ids exactly as stored on the worker record (en-dash separators). */
const SLOT_DEFS = [
  { id: "08:00–12:00", label: "Morning", hint: "8 AM – 12 PM" },
  { id: "12:00–16:00", label: "Afternoon", hint: "12 – 4 PM" },
  { id: "16:00–20:00", label: "Evening", hint: "4 – 8 PM" },
] as const;

/** Monday-first display order; day indexes stay 0=Sun…6=Sat. */
const DISPLAY_DAYS = [1, 2, 3, 4, 5, 6, 0];

function normalize(slots: WorkerAvailabilitySlot[]): string {
  return JSON.stringify(
    Array.from({ length: 7 }, (_, day) => {
      const s = slots.find((x) => x.day === day)?.slots ?? [];
      return { day, slots: [...s].sort() };
    }),
  );
}

function toMap(slots: WorkerAvailabilitySlot[]): Record<number, string[]> {
  const map: Record<number, string[]> = {};
  DISPLAY_DAYS.forEach((day) => {
    map[day] = [...(slots.find((s) => s.day === day)?.slots ?? [])];
  });
  return map;
}

export function WorkerAvailability() {
  const navigate = useAppStore((s) => s.navigate);
  const q = useAvailability();
  const save = useSaveAvailability();
  const [draft, setDraft] = useState<Record<number, string[]> | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Work"
        title="Weekly availability"
        description="Choose the slots you want to work. Matching prioritises members whose confirmed availability covers the customer's requested time."
      />
      <QueryGate query={q}>
        {(data) => {
          const original = toMap(data);
          const current = draft ?? original;
          const dirty = draft !== null && normalize(Object.entries(current).map(([day, slots]) => ({ day: Number(day), slots }))) !== normalize(data);
          const slotCount = DISPLAY_DAYS.reduce((acc, day) => acc + current[day].length, 0);

          const toggle = (day: number, slot: string) => {
            setDraft((prev) => {
              const base = prev ?? original;
              const slots = base[day];
              return {
                ...base,
                [day]: slots.includes(slot) ? slots.filter((s) => s !== slot) : [...slots, slot],
              };
            });
          };

          return (
            <div className="space-y-6">
              <AlertBanner
                severity="info"
                title="Weekend evening slots earn a shift bonus"
                detail="PRO-2026-009 (passed, 76% approval): members covering 3+ weekend evening shifts in a month earn a ₹150 bonus per shift, funded from platform fee revenue. Evening availability also receives priority matching — it is the cooperative's highest-demand window."
                action="View policy"
                onAction={() => navigate("worker-governance")}
              />

              <SectionCard
                title="Your working slots"
                description="Morning, afternoon and evening blocks for each day of the week."
                actions={
                  <span className="tnum text-[13px] font-medium">
                    {slotCount} slot{slotCount === 1 ? "" : "s"} · ~{slotCount * 4} h / week
                  </span>
                }
              >
                {/* Slot header (desktop) */}
                <div className="hidden grid-cols-[120px_repeat(3,1fr)] gap-3 pb-2 sm:grid">
                  <span />
                  {SLOT_DEFS.map((s) => (
                    <div key={s.id} className="text-center">
                      <p className="text-[13px] font-semibold">{s.label}</p>
                      <p className="tnum text-[11px] text-muted-foreground">{s.hint}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2.5">
                  {DISPLAY_DAYS.map((day) => {
                    const isToday = day === new Date().getDay();
                    return (
                      <div
                        key={day}
                        className={cn(
                          "grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-[120px_repeat(3,1fr)] sm:items-center sm:gap-3 sm:border-0 sm:p-0",
                          isToday && "border-primary/30 bg-accent/30 sm:bg-transparent",
                        )}
                      >
                        <p className={cn("text-[13px] font-semibold", isToday ? "text-primary" : "")}>
                          {DAY_NAMES[day]}
                          {isToday && <span className="ml-1.5 text-[11px] font-medium text-muted-foreground">Today</span>}
                        </p>
                        {SLOT_DEFS.map((slot) => {
                          const on = current[day].includes(slot.id);
                          return (
                            <label
                              key={slot.id}
                              className={cn(
                                "flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2.5 transition-colors sm:justify-center sm:gap-4",
                                on ? "border-primary/30 bg-accent/50" : "bg-muted/30 hover:bg-muted/60",
                              )}
                            >
                              <span className="flex items-center gap-2">
                                <span
                                  className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-primary" : "bg-muted-foreground/40")}
                                  aria-hidden
                                />
                                <span className="text-[13px] font-medium sm:hidden">{slot.label}</span>
                                <span className="tnum hidden text-xs text-muted-foreground sm:inline">{slot.hint}</span>
                              </span>
                              <Switch
                                checked={on}
                                onCheckedChange={() => toggle(day, slot.id)}
                                aria-label={`${DAY_NAMES[day]} ${slot.label} (${slot.hint})`}
                              />
                            </label>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
                  <p className={cn("text-[13px]", dirty ? "font-medium text-foreground" : "text-muted-foreground")}>
                    {dirty ? "Unsaved changes — new offers will use the saved slots until you save." : "All changes saved"}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDraft(null)} disabled={!dirty || save.isPending}>
                      <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.9} />
                      Reset
                    </Button>
                    <Button
                      size="sm"
                      disabled={!dirty || save.isPending}
                      onClick={() =>
                        save.mutate(
                          DISPLAY_DAYS.map((day) => ({ day, slots: [...current[day]].sort() })),
                          { onSuccess: () => setDraft(null) },
                        )
                      }
                    >
                      <Save className="h-3.5 w-3.5" strokeWidth={1.9} />
                      {save.isPending ? "Saving…" : "Save availability"}
                    </Button>
                  </div>
                </div>
              </SectionCard>

              <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
                Availability is a commitment, not a shift rota — you can still decline any offer. Members who keep at least 12 slots open
                receive about twice as many matched offers.
              </p>
            </div>
          );
        }}
      </QueryGate>
    </div>
  );
}
