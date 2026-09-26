"use client";

import { useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ErrorState, PageHeader, SectionCard } from "@/components/shared";
import { FineNote } from "./ui";
import { usePolicies, useUpdatePolicy } from "@/hooks/use-api";
import { money, num, relativeTime } from "@/lib/format";
import type { PlatformPolicy } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RateField {
  key: "commissionPct" | "welfarePct" | "gstPct" | "tdsPct";
  label: string;
  description: string;
  min: number;
  max: number;
  step?: number;
}

const RATE_FIELDS: RateField[] = [
  {
    key: "commissionPct",
    label: "Platform commission",
    description: "Processing share retained by the cooperative for operations, support and training.",
    min: 0,
    max: 15,
    step: 0.5,
  },
  {
    key: "welfarePct",
    label: "Welfare contribution",
    description: "Credited to the serving member's welfare fund on every completed booking.",
    min: 0,
    max: 10,
    step: 0.5,
  },
  {
    key: "gstPct",
    label: "GST",
    description: "Applied on the platform commission only, collected and remitted (simulated).",
    min: 0,
    max: 28,
  },
  {
    key: "tdsPct",
    label: "TDS",
    description: "Deducted at source from member payouts under s.194-O (simulated).",
    min: 0,
    max: 5,
    step: 0.1,
  },
];

const EXAMPLE_CHARGE = 800;

/** Policies — the cooperative's rulebook: rates and operational policy text. */
export function AdminPoliciesScreen() {
  const policies = usePolicies();
  const update = useUpdatePolicy();

  if (policies.isError) {
    return (
      <>
        <PageHeader eyebrow="Cooperative · policy" title="Policies" />
        <ErrorState message="Policy configuration could not be loaded." onRetry={() => policies.refetch()} />
      </>
    );
  }

  if (policies.isLoading || !policies.data) {
    return (
      <>
        <PageHeader eyebrow="Cooperative · policy" title="Policies" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-[360px] rounded-lg" />
          <Skeleton className="h-[360px] rounded-lg" />
        </div>
      </>
    );
  }

  /* Keyed by updatedAt — the editor resets cleanly whenever the server policy changes (e.g. after save). */
  return <PolicyEditor key={policies.data.updatedAt} policy={policies.data} update={update} />;
}

function PolicyEditor({
  policy,
  update,
}: {
  policy: PlatformPolicy;
  update: ReturnType<typeof useUpdatePolicy>;
}) {
  const [form, setForm] = useState<PlatformPolicy>({ ...policy });
  const [saveOpen, setSaveOpen] = useState(false);

  const dirty =
    form.commissionPct !== policy.commissionPct ||
    form.welfarePct !== policy.welfarePct ||
    form.gstPct !== policy.gstPct ||
    form.tdsPct !== policy.tdsPct ||
    form.surgePolicy !== policy.surgePolicy ||
    form.cancellationPolicy !== policy.cancellationPolicy ||
    form.disputeWindowDays !== policy.disputeWindowDays ||
    form.minWagePerHour !== policy.minWagePerHour;

  const ratesValid = RATE_FIELDS.every((f) => Number.isFinite(form[f.key]) && form[f.key] >= f.min && form[f.key] <= f.max);

  /* Live preview of the pricing model on an ₹800 service */
  const preview = (() => {
    const welfare = Math.round((EXAMPLE_CHARGE * form.welfarePct) / 100);
    const fee = Math.round((EXAMPLE_CHARGE * form.commissionPct) / 100);
    const gst = Math.round((fee * form.gstPct) / 100);
    const tds = Math.round((EXAMPLE_CHARGE * form.tdsPct) / 100);
    return {
      customerTotal: EXAMPLE_CHARGE + welfare + fee + gst,
      memberNet: EXAMPLE_CHARGE - tds,
      welfare,
      fee,
      gst,
      tds,
    };
  })();

  const setField = <K extends keyof PlatformPolicy>(key: K, value: PlatformPolicy[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <>
      <PageHeader
        eyebrow="Cooperative · policy"
        title="Policies"
        description="The cooperative's published rulebook. Rate changes are policy instruments — they require Executive Committee notification, notify all members, and are written to the audit log."
        actions={
          <>
            {dirty && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setForm({ ...policy })}
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.9} />
                Discard
              </Button>
            )}
              <AlertDialog open={saveOpen} onOpenChange={setSaveOpen}>
                <AlertDialogTrigger asChild>
                  <Button size="sm" disabled={!dirty || !ratesValid || update.isPending}>
                    <Save className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.9} />
                    Save changes
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Publish policy change?</AlertDialogTitle>
                    <AlertDialogDescription>
                      New bookings will use the updated rates immediately; in-flight bookings keep their quoted price. All 216
                      members will be notified with the before/after rates, and the change is recorded in the audit log.
                      {dirty && preview && (
                        <span className="tnum mt-2 block rounded-md bg-muted/70 px-2.5 py-1.5 text-xs">
                          On an {money(EXAMPLE_CHARGE)} service: customer pays {money(preview.customerTotal)} · member nets{" "}
                          {money(preview.memberNet)}
                        </span>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={update.isPending}
                      onClick={(e) => {
                        e.preventDefault();
                        if (!dirty) return;
                        update.mutate(
                          {
                            commissionPct: form.commissionPct,
                            welfarePct: form.welfarePct,
                            gstPct: form.gstPct,
                            tdsPct: form.tdsPct,
                            surgePolicy: form.surgePolicy,
                            cancellationPolicy: form.cancellationPolicy,
                            disputeWindowDays: form.disputeWindowDays,
                            minWagePerHour: form.minWagePerHour,
                          },
                          { onSuccess: () => setSaveOpen(false) },
                        );
                      }}
                    >
                      {update.isPending ? "Publishing…" : "Publish update"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
          <SectionCard title="Platform rates" description="How every customer payment is split.">
            <div className="space-y-5">
              {RATE_FIELDS.map((f) => (
                <div key={f.key} className="grid gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <label className="text-[13px] font-medium" htmlFor={`rate-${f.key}`}>
                      {f.label}
                    </label>
                    <div className="relative">
                      <Input
                        id={`rate-${f.key}`}
                        value={String(form[f.key])}
                        onChange={(e) => setField(f.key, Number(e.target.value) as PlatformPolicy[typeof f.key])}
                        inputMode="decimal"
                        aria-label={`${f.label} percent`}
                        className={cn(
                          "tnum h-9 w-28 pr-7 text-right text-[13px]",
                          (Number.isNaN(Number(form[f.key])) || form[f.key] < f.min || form[f.key] > f.max) &&
                            "border-destructive focus-visible:ring-destructive/20",
                        )}
                      />
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {f.description} <span className="tnum">Allowed {f.min}–{f.max}%.</span>
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="space-y-4">
            {preview && (
              <SectionCard title="Live preview" description={`How an ${money(EXAMPLE_CHARGE)} service would split.`}>
                <dl className="text-sm">
                  <PreviewRow label="Customer pays" value={money(preview.customerTotal)} strong />
                  <PreviewRow label="Member net cash" value={money(preview.memberNet)} />
                  <PreviewRow label="Member welfare credit" value={money(preview.welfare)} tone="positive" />
                  <PreviewRow label="Cooperative commission" value={money(preview.fee)} />
                  <PreviewRow label="GST (on commission)" value={money(preview.gst)} />
                  <PreviewRow label="TDS withheld from member" value={money(preview.tds)} last />
                </dl>
                <FineNote className="mt-3 border-t pt-3">
                  Member total value = net cash + welfare credit. Every rupee of the customer total is allocated — nothing
                  floats.
                </FineNote>
              </SectionCard>
            )}

            <SectionCard title="Operational policies" description="Published text — members see this verbatim.">
              <div className="space-y-4">
                <div className="grid gap-1.5">
                  <label className="text-[13px] font-medium" htmlFor="policy-surge">
                    Demand & surge policy
                  </label>
                  <Textarea
                    id="policy-surge"
                    value={form.surgePolicy}
                    onChange={(e) => setField("surgePolicy", e.target.value)}
                    rows={3}
                    className="text-[13px]"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[13px] font-medium" htmlFor="policy-cancellation">
                    Cancellation policy
                  </label>
                  <Textarea
                    id="policy-cancellation"
                    value={form.cancellationPolicy}
                    onChange={(e) => setField("cancellationPolicy", e.target.value)}
                    rows={3}
                    className="text-[13px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <label className="text-[13px] font-medium" htmlFor="policy-dispute">
                      Dispute window (days)
                    </label>
                    <Input
                      id="policy-dispute"
                      value={String(form.disputeWindowDays)}
                      onChange={(e) => setField("disputeWindowDays", Number(e.target.value))}
                      inputMode="numeric"
                      className="tnum h-9 text-[13px]"
                      aria-label="Dispute window in days"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <label className="text-[13px] font-medium" htmlFor="policy-wage">
                      Min wage (₹/hour)
                    </label>
                    <Input
                      id="policy-wage"
                      value={String(form.minWagePerHour)}
                      onChange={(e) => setField("minWagePerHour", Number(e.target.value))}
                      inputMode="numeric"
                      className="tnum h-9 text-[13px]"
                      aria-label="Minimum wage per hour in rupees"
                    />
                  </div>
                </div>
              </div>
            </SectionCard>

            <div className="rounded-lg border bg-muted/30 p-4">
              <FineNote>
                Last updated by {policy.updatedBy} · {relativeTime(policy.updatedAt)} · dispute window{" "}
                {num(policy.disputeWindowDays)} days · min wage {money(policy.minWagePerHour)}/hr. Rate changes
                are conventionally ratified at the quarterly general body — this console records who changed what, when.
              </FineNote>
            </div>
          </div>
        </div>
    </>
  );
}

function PreviewRow({
  label,
  value,
  strong,
  tone,
  last,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "positive";
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 py-2.5",
        !last && "border-b border-border/70",
      )}
    >
      <dt className={cn("text-[13px]", strong ? "text-[15px] font-semibold" : "text-muted-foreground")}>{label}</dt>
      <dd
        className={cn(
          "tnum font-medium",
          strong && "text-[15px] font-semibold",
          tone === "positive" && "text-[oklch(0.40_0.09_155)]",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
