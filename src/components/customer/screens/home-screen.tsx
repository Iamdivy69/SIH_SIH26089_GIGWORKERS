"use client";

import { useState } from "react";
import {
  ArrowRight,
  CalendarPlus,
  HeartHandshake,
  LifeBuoy,
  Receipt,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingPanel, SectionCard, StatInline, StatusBadge } from "@/components/shared";
import { useCustomerOverview } from "@/hooks/use-api";
import { useAppStore } from "@/store/app-store";
import { money, dateTimeLabel, dateFull } from "@/lib/format";
import { CATEGORY_ICONS, greeting } from "../constants";
import { setSearchHandoff } from "../prefill";
import { useWorkerMap } from "../hooks";
import { WorkerCard } from "../parts/worker-card";
import { BookingCard } from "../parts/booking-card";

export function HomeScreen() {
  const navigate = useAppStore((s) => s.navigate);
  const { data, isLoading } = useCustomerOverview();
  const { map: workers } = useWorkerMap();
  const [q, setQ] = useState("");

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchHandoff(q);
    navigate("customer-discover");
  };

  const active = data?.activeBooking ?? null;
  const activeWorker = active ? workers.get(active.workerId) : undefined;
  const upcoming = data?.upcomingBookings[0];

  return (
    <div className="space-y-6">
      {/* Greeting + quick actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="micro-label">{dateFull(new Date().toISOString())}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            {greeting()}, Ananya
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kothrud, Pune · your cooperative for household services
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button onClick={() => navigate("customer-book")}>
            <CalendarPlus className="h-4 w-4" strokeWidth={1.9} /> New request
          </Button>
          <Button variant="outline" onClick={() => navigate("customer-support")}>
            <LifeBuoy className="h-4 w-4" strokeWidth={1.9} /> Support
          </Button>
        </div>
      </div>

      {/* Quick search */}
      <form onSubmit={search} className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.9} />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search members — try “electrician”, “deep clean”, “leaking tap”…"
            className="pl-9"
            aria-label="Search service members"
          />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {/* Categories */}
      <section aria-label="Service categories">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight">Browse services</h2>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => navigate("customer-discover")}>
            All members <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.9} />
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(data?.categories ?? []).map((c) => {
            const Icon = CATEGORY_ICONS[c.id];
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => navigate("customer-discover", { category: c.id })}
                className="group flex flex-col rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span className="flex items-start justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md border bg-muted/50">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                  </span>
                  <ArrowRight
                    className="h-4 w-4 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
                    strokeWidth={1.9}
                    aria-hidden
                  />
                </span>
                <span className="mt-3 text-[14px] font-semibold leading-tight">{c.name}</span>
                <span className="mt-1 text-xs leading-snug text-muted-foreground">{c.tagline}</span>
                <span className="tnum mt-2.5 text-[11px] font-medium text-muted-foreground">
                  {c.activeWorkers} verified {c.activeWorkers === 1 ? "member" : "members"}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Main column */}
        <div className="min-w-0 space-y-6">
          {/* Active / next service */}
          {isLoading ? (
            <LoadingPanel rows={2} />
          ) : active ? (
            <SectionCard
              title="Service in progress"
              actions={
                <Button variant="outline" size="sm" onClick={() => navigate("customer-booking", { bookingId: active.id })}>
                  Track
                </Button>
              }
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-semibold leading-tight">{active.title}</h3>
                    <StatusBadge status={active.status} />
                  </div>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {activeWorker ? `${activeWorker.name} · ${activeWorker.tradeTitle}` : "Member"}
                  </p>
                  <p className="tnum mt-0.5 text-[13px] text-muted-foreground">{dateTimeLabel(active.scheduledAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-6">
                  <StatInline label="Total" value={money(active.price.customerTotal)} />
                  <Button size="sm" variant="outline" onClick={() => navigate("customer-booking", { bookingId: active.id })}>
                    View
                  </Button>
                </div>
              </div>
            </SectionCard>
          ) : upcoming ? (
            <SectionCard title="Next service">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[15px] font-semibold leading-tight">{upcoming.title}</h3>
                    <StatusBadge status={upcoming.status} />
                  </div>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {workers.get(upcoming.workerId)?.name ?? "Member"} · {dateTimeLabel(upcoming.scheduledAt)}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate("customer-booking", { bookingId: upcoming.id })}>
                  View
                </Button>
              </div>
              <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
                No service in progress right now — book a new request and we'll match you within minutes.
              </p>
            </SectionCard>
          ) : (
            <SectionCard title="Next service">
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Nothing scheduled. Book a service and we'll match you with a verified member near you.
              </p>
              <Button size="sm" className="mt-4" onClick={() => navigate("customer-book")}>
                <CalendarPlus className="h-4 w-4" strokeWidth={1.9} /> New request
              </Button>
            </SectionCard>
          )}

          {/* Recent bookings */}
          <SectionCard
            title="Recent bookings"
            description="Your last completed and closed services."
            actions={
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => navigate("customer-bookings")}>
                All bookings <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.9} />
              </Button>
            }
          >
            {isLoading ? (
              <LoadingPanel rows={3} className="border-0" />
            ) : (data?.recentBookings.length ?? 0) === 0 ? (
              <p className="py-4 text-center text-[13px] text-muted-foreground">Your completed bookings will appear here.</p>
            ) : (
              <div className="space-y-3">
                {data!.recentBookings.map((b) => (
                  <BookingCard
                    key={b.id}
                    booking={b}
                    worker={workers.get(b.workerId)}
                    compact
                    onView={() => navigate("customer-booking", { bookingId: b.id })}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <SectionCard title="Recommended for you" description="Based on your booking history and neighbourhood.">
            {isLoading ? (
              <LoadingPanel rows={3} className="border-0" />
            ) : (
              <div className="space-y-3">
                {(data?.recommendedWorkers ?? []).map((r) => (
                  <WorkerCard
                    key={r.worker.id}
                    worker={r.worker}
                    score={r.score}
                    compact
                    onView={() => navigate("customer-worker", { workerId: r.worker.id })}
                    onBook={() => navigate("customer-book", { categoryId: r.worker.category })}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Quick actions">
            <div className="grid gap-2">
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("customer-book")}>
                <CalendarPlus className="h-4 w-4" strokeWidth={1.9} /> Book a new service
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("customer-payments")}>
                <Receipt className="h-4 w-4" strokeWidth={1.9} /> Payments & invoices
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate("customer-support")}>
                <LifeBuoy className="h-4 w-4" strokeWidth={1.9} /> Contact support
              </Button>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-4">
              <StatInline label="Spent this month" value={money(data?.spentThisMonth)} />
              <StatInline label="Completed services" value={String(data?.completedCount ?? 0)} />
            </dl>
          </SectionCard>

          {/* Trust strip */}
          <section className="rounded-lg border bg-[oklch(0.975_0.012_155)] p-5">
            <p className="flex items-center gap-2 text-[13px] font-semibold">
              <ShieldCheck className="h-4 w-4 text-[oklch(0.45_0.10_155)]" strokeWidth={1.9} />
              Every member is cooperative-verified
            </p>
            <ul className="mt-3 space-y-2 text-[13px] leading-snug text-muted-foreground">
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[oklch(0.5_0.105_155)]" strokeWidth={1.9} />
                ID, police record and trade checks on joining — renewed yearly
              </li>
              <li className="flex gap-2">
                <Receipt className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[oklch(0.5_0.105_155)]" strokeWidth={1.9} />
                Transparent pricing — every rupee of your bill is traced on the invoice
              </li>
              <li className="flex gap-2">
                <HeartHandshake className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[oklch(0.5_0.105_155)]" strokeWidth={1.9} />
                3% of every booking goes to your member's welfare fund
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
