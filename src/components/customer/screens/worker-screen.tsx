"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarCheck,
  Check,
  Clock,
  Heart,
  MapPin,
  MessageSquare,
  Phone,
  ShieldCheck,
  Timer,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  ErrorState,
  FactorBars,
  MatchBadge,
  PageHeader,
  PersonAvatar,
  RatingStars,
  ScoreDial,
  SectionCard,
  StatInline,
  StatusBadge,
  statusLabel,
} from "@/components/shared";
import { useCategories, useToggleSaveWorker, useWorkerProfile } from "@/hooks/use-api";
import { useAppStore } from "@/store/app-store";
import { dateFull, money, num, relativeTime, DAY_NAMES, TIME_SLOTS } from "@/lib/format";
import { cn } from "@/lib/utils";
import { setBookingPrefill, peekWorkerMatchContext, clearWorkerMatchContext, type WorkerMatchContext } from "../prefill";

/* keyed by TIME_SLOTS ids ("08–12" | "12–16" | "16–20"), values as HHMM */
const SLOT_RANGES: Record<string, [number, number]> = {
  "08–12": [800, 1200],
  "12–16": [1200, 1600],
  "16–20": [1600, 2000],
};

function coversSlot(slots: string[], range: [number, number]): boolean {
  return slots.some((s) => {
    const [from, to] = s.split("–").map((x) => parseInt(x.replace(":", ""), 10));
    return from <= range[0] && to >= range[1];
  });
}

export function WorkerScreen({ workerId }: { workerId: string }) {
  const navigate = useAppStore((s) => s.navigate);
  const { data, isLoading, isError, refetch } = useWorkerProfile(workerId);
  const { data: categories } = useCategories();
  const toggleSave = useToggleSaveWorker();

  /* "Why recommended" context, handed off from the booking flow's match step */
  const [matchContext] = useState<WorkerMatchContext | null>(() => {
    const ctx = peekWorkerMatchContext();
    return ctx && ctx.workerId === workerId ? ctx : null;
  });
  useEffect(() => {
    clearWorkerMatchContext();
  }, []);

  const [serviceId, setServiceId] = useState<string>("");
  const worker = data?.worker;
  const category = useMemo(() => categories?.find((c) => c.id === worker?.category), [categories, worker]);
  /* the select defaults to the first service; user choice overrides */
  const effectiveServiceId = serviceId || category?.services[0]?.id || "";

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-24 rounded-lg border bg-card" />
        <div className="h-64 rounded-lg border bg-card" />
      </div>
    );
  }
  if (isError || !worker || !data) {
    return <ErrorState message="This member profile could not be loaded." onRetry={() => refetch()} />;
  }

  const saved = data.saved;
  const ratingSum = data.reviews.reduce((a, r) => a + r.rating, 0);
  const avgReview = data.reviews.length ? ratingSum / data.reviews.length : worker.rating;

  const bookThisMember = () => {
    if (!effectiveServiceId || !category) return;
    setBookingPrefill({ workerId: worker.id, categoryId: category.id, serviceId: effectiveServiceId });
    navigate("customer-book", { categoryId: category.id });
  };

  return (
    <div>
      <PageHeader
        eyebrow={category ? `${category.name} · Member profile` : "Member profile"}
        title={worker.name}
        description={`${worker.tradeTitle} · ${worker.locality}, ${worker.city}`}
        onBack={() => navigate("customer-discover")}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toggleSave.mutate(worker.id, {
                  onSuccess: (res) =>
                    toast.success(res.saved ? "Saved to your members" : "Removed from saved members", {
                      description: res.saved ? `${worker.name} will appear in your recommendations.` : undefined,
                    }),
                })
              }
            >
              <Heart
                className={cn("h-4 w-4", saved && "fill-[oklch(0.525_0.185_27)] text-[oklch(0.525_0.185_27)]")}
                strokeWidth={1.9}
              />
              {saved ? "Saved" : "Save"}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (category) {
                  setBookingPrefill({ workerId: worker.id, categoryId: category.id, serviceId: category.services[0]?.id });
                  navigate("customer-book", { categoryId: category.id });
                }
              }}
            >
              Book {worker.name.split(" ")[0]}
            </Button>
          </>
        }
      />

      {/* Why recommended (when arriving from the matching step) */}
      {matchContext && matchContext.factors.length > 0 && (
        <SectionCard
          title="Why this member was recommended"
          description="The full scoring breakdown from your request — the same numbers the cooperative publishes for every match."
          className="mb-6"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="flex shrink-0 flex-col items-center gap-2">
              <ScoreDial score={matchContext.score ?? worker.rating * 20} size={88} />
              {typeof matchContext.score === "number" && <MatchBadge score={matchContext.score} />}
            </div>
            <div className="min-w-0 flex-1">
              <FactorBars factors={matchContext.factors} />
            </div>
          </div>
        </SectionCard>
      )}

      {/* Identity header */}
      <section className="mb-6 rounded-lg border bg-card p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <PersonAvatar name={worker.name} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold tracking-tight">{worker.name}</h2>
              <StatusBadge status="verified" label="Verified member" />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {worker.tradeTitle} · cooperative member{" "}
              <span className="tnum font-medium text-foreground">{worker.cooperativeMemberId}</span> · member since{" "}
              {dateFull(worker.memberSince)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              <RatingStars value={worker.rating} count={worker.reviewCount} />
              <span className="tnum inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" strokeWidth={1.9} />
                {worker.locality} · {worker.distanceKm} km from you
              </span>
            </div>
          </div>
        </div>
        <Separator className="my-4" />
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatInline label="Completed services" value={num(worker.completedJobs)} sub="on Sahyog" />
          <StatInline label="On-time rate" value={`${worker.onTimeRate}%`} sub="last 90 days" />
          <StatInline label="Response time" value={`~${worker.responseMins} min`} sub="to requests" />
          <StatInline label="Repeat customers" value={`${worker.repeatCustomerRate}%`} sub="book again" />
        </dl>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main column */}
        <div className="min-w-0 space-y-6">
          <SectionCard title="About" description={worker.bio}>
            <div className="flex flex-wrap gap-1.5">
              {worker.skills.map((s) => (
                <span key={s} className="rounded-sm border bg-muted/50 px-2.5 py-1 text-xs font-medium">
                  {s}
                </span>
              ))}
            </div>
            <p className="mt-4 text-[13px] text-muted-foreground">
              <span className="font-medium text-foreground">Languages:</span> {worker.languages.join(", ")}
            </p>
          </SectionCard>

          <SectionCard title="Certifications & verification" description="Checks completed before this member could accept bookings.">
            <ul className="divide-y divide-border/70">
              {worker.verification.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">{v.label}</p>
                    {v.reference && <p className="tnum text-xs text-muted-foreground">Ref {v.reference}</p>}
                  </div>
                  <span className="flex shrink-0 items-center gap-2">
                    {v.verifiedAt && <span className="tnum text-xs text-muted-foreground">{dateFull(v.verifiedAt)}</span>}
                    <StatusBadge status={v.status} />
                  </span>
                </li>
              ))}
            </ul>
            {worker.certifications.length > 0 && (
              <div className="mt-4 border-t pt-4">
                <p className="micro-label mb-2">Certifications</p>
                <ul className="space-y-2.5">
                  {worker.certifications.map((c) => (
                    <li key={c.id} className="flex items-start gap-2.5">
                      <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.5_0.105_155)]" strokeWidth={1.9} />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium leading-snug">{c.name}</p>
                        <p className="tnum text-xs text-muted-foreground">
                          {c.issuer} · {dateFull(c.issuedAt)}
                          {c.validTill ? ` · valid till ${dateFull(c.validTill)}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Weekly availability" description="Windows this member usually works. Your slot is confirmed on acceptance.">
            <div className="overflow-x-auto scroll-slim">
              <table className="w-full min-w-[420px] border-collapse text-[13px]">
                <thead>
                  <tr className="border-b">
                    <th className="micro-label px-2 py-2 text-left font-medium">Window</th>
                    {DAY_NAMES.map((d) => (
                      <th key={d} className="micro-label px-2 py-2 text-center font-medium">
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TIME_SLOTS.map((slot) => (
                    <tr key={slot.id} className="border-b border-border/70 last:border-0">
                      <td className="px-2 py-2.5">
                        <p className="font-medium">{slot.label}</p>
                        <p className="text-xs text-muted-foreground">{slot.hint}</p>
                      </td>
                      {DAY_NAMES.map((d, i) => {
                        const dayAvail = worker.availability.find((a) => a.day === i);
                        const covered = dayAvail ? coversSlot(dayAvail.slots, SLOT_RANGES[slot.id]) : false;
                        return (
                          <td key={d} className="px-2 py-2.5 text-center">
                            {covered ? (
                              <Check className="mx-auto h-4 w-4 text-[oklch(0.5_0.105_155)]" strokeWidth={2.2} />
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            title={`Reviews (${num(worker.reviewCount)})`}
            description={`Average ${avgReview.toFixed(1)} / 5 from verified bookings on the platform.`}
          >
            {data.reviews.length === 0 ? (
              <p className="py-2 text-[13px] text-muted-foreground">No written reviews yet for this member.</p>
            ) : (
              <ul className="divide-y divide-border/70">
                {data.reviews.map((r) => (
                  <li key={r.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-start gap-3">
                      <PersonAvatar name={r.customerName} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <p className="text-[13px] font-medium">{r.customerName}</p>
                          <span className="text-xs text-muted-foreground">{relativeTime(r.createdAt)}</span>
                        </div>
                        <RatingStars value={r.rating} showValue={false} className="mt-1" />
                        {r.comment && <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{r.comment}</p>}
                        {r.tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {r.tags.map((t) => (
                              <span key={t} className="rounded-sm border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {category && (
            <SectionCard title="Pricing" description={worker.baseRateNote}>
              <ul className="divide-y divide-border/70">
                {category.services.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    </div>
                    <p className="tnum shrink-0 text-[13px] font-semibold">
                      {money(s.basePrice)}
                      <span className="ml-1 font-normal text-muted-foreground">/ {s.unit}</span>
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Rates are set by cooperative policy and reviewed by member vote — no surge pricing. A 3% welfare contribution and 6% processing fee are shown separately on your bill.
              </p>
            </SectionCard>
          )}

          {data.similar.length > 0 && (
            <SectionCard title={`Other ${category?.name ?? ""} members near you`}>
              <ul className="divide-y divide-border/70">
                {data.similar.map((w) => (
                  <li key={w.id}>
                    <button
                      type="button"
                      onClick={() => navigate("customer-worker", { workerId: w.id })}
                      className="flex w-full items-center justify-between gap-4 py-3 text-left transition-colors hover:bg-muted/40"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <PersonAvatar name={w.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium">{w.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {w.tradeTitle} · {w.locality}
                          </span>
                        </span>
                      </span>
                      <RatingStars value={w.rating} count={w.reviewCount} size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <SectionCard title="Book this member" description="Pick a service — you'll see the full match breakdown and price before paying.">
            {category && (
              <>
                <Label htmlFor="wp-service" className="text-xs text-muted-foreground">Service</Label>
                <Select value={effectiveServiceId} onValueChange={setServiceId}>
                  <SelectTrigger id="wp-service" className="mt-1 text-[13px]" aria-label="Choose a service">
                    <SelectValue placeholder="Choose a service" />
                  </SelectTrigger>
                  <SelectContent>
                    {category.services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} · {money(s.basePrice)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button className="mt-4 w-full" onClick={bookThisMember} disabled={!effectiveServiceId}>
                  Continue to booking
                </Button>
              </>
            )}
            <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4">
              <StatInline label="Experience" value={`${worker.experienceYears} yrs`} />
              <StatInline label="Services done" value={num(data.bookingsDone)} sub="on Sahyog" />
            </div>
          </SectionCard>

          <SectionCard title="Why you can trust this member">
            <ul className="space-y-3 text-[13px] leading-snug">
              <li className="flex gap-2.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.5_0.105_155)]" strokeWidth={1.9} />
                <span>
                  <span className="font-medium">Cooperative-verified.</span> All {statusLabel("verified").toLowerCase()} checks passed before accepting bookings.
                </span>
              </li>
              <li className="flex gap-2.5">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.5_0.105_155)]" strokeWidth={1.9} />
                <span>
                  <span className="font-medium">Member-owner.</span> Holds membership {worker.cooperativeMemberId} with voting rights — quality is their own business.
                </span>
              </li>
              <li className="flex gap-2.5">
                <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.5_0.105_155)]" strokeWidth={1.9} />
                <span>
                  <span className="font-medium">Track record.</span> {num(worker.completedJobs)} completed services · {worker.onTimeRate}% on time.
                </span>
              </li>
              <li className="flex gap-2.5">
                <Timer className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.5_0.105_155)]" strokeWidth={1.9} />
                <span>
                  <span className="font-medium">Responsive.</span> Typically replies within {worker.responseMins} minutes.
                </span>
              </li>
            </ul>
          </SectionCard>

          <SectionCard title="Contact" description="Contact details unlock once a booking is accepted.">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast(`Calling ${worker.name}…`, { description: "Contact is simulated in this prototype." })}
              >
                <Phone className="h-3.5 w-3.5" strokeWidth={1.9} /> Call
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast(`Message thread with ${worker.name}`, { description: "Messaging is simulated in this prototype." })}
              >
                <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.9} /> Message
              </Button>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" strokeWidth={1.9} /> Replies in ~{worker.responseMins} min on average
            </p>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
