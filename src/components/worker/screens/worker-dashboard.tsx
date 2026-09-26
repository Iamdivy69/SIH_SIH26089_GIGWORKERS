"use client";

import { ArrowRight, CalendarDays, ChevronRight, Vote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppStore } from "@/store/app-store";
import { useGovernance, useWorkerJobs, useWorkerOverview } from "@/hooks/use-api";
import {
  AlertBanner,
  EmptyState,
  ErrorState,
  PageHeader,
  RatingStars,
  SectionCard,
  Spark,
  StatTile,
  TrendAreaChart,
} from "@/components/shared";
import { BookingOfferCard, JobRowCard, OpenRequestCard } from "../parts";
import { dateFull, dateShort, money } from "@/lib/format";

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-56" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-36 w-full rounded-lg" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-56 rounded-lg" />
          <Skeleton className="h-40 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function WorkerDashboard() {
  const navigate = useAppStore((s) => s.navigate);
  const overview = useWorkerOverview();
  const jobs = useWorkerJobs();
  const governance = useGovernance();

  if (overview.isPending || jobs.isPending) return <DashboardSkeleton />;
  if (overview.isError) {
    return <ErrorState message={overview.error instanceof Error ? overview.error.message : undefined} onRetry={() => void overview.refetch()} />;
  }

  const ov = overview.data;
  const worker = jobs.data?.worker;
  const offers = [...(jobs.data?.offers ?? []), ...(jobs.data?.openRequests ?? [])];
  const topOffers = offers.slice(0, 2);
  const unvoted = (governance.data?.activeProposals ?? []).filter((p) => !p.myVote);
  const nextUpcoming = ov.upcomingJobs[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const awaitingCount = jobs.data?.awaiting.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Member dashboard · SGW-0117 · Kothrud, Pune"
        title={`${greeting}, Priya`}
        description={
          worker
            ? `${worker.tradeTitle} · ${worker.experienceYears} years in the field · member-owner of the Sahyog workers' cooperative since ${dateShort(worker.memberSince)} ${new Date(worker.memberSince).getFullYear()}`
            : "Member-owner of the Sahyog workers' cooperative"
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate("worker-jobs")}>
            Job opportunities
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.9} />
          </Button>
        }
      />

      {/* Today strip */}
      <SectionCard
        title="Today's plan"
        description={dateFull(new Date().toISOString())}
        actions={
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => navigate("worker-schedule")}>
            <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.9} />
            Full schedule
          </Button>
        }
      >
        {ov.todayJobs.length > 0 ? (
          <ul className="space-y-2.5">
            {ov.todayJobs.map((b) => (
              <li key={b.id}>
                <JobRowCard booking={b} showCustomer />
              </li>
            ))}
          </ul>
        ) : nextUpcoming ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed bg-muted/30 px-4 py-3.5">
            <div>
              <p className="text-sm font-medium">No more jobs today</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                Next up: {nextUpcoming.title} · {dateShort(nextUpcoming.scheduledAt)}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("worker-job", { bookingId: nextUpcoming.id })}>
              View next job
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.9} />
            </Button>
          </div>
        ) : (
          <EmptyState
            title="Nothing scheduled today"
            description="Evening slots are the cooperative's highest-demand window — check your availability for the rest of the week."
            action={
              <Button variant="outline" size="sm" onClick={() => navigate("worker-availability")}>
                Review availability
              </Button>
            }
          />
        )}
      </SectionCard>

      {/* Earnings snapshot */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Available balance"
          value={money(ov.availableBalance)}
          sub={`Next payout ${dateShort(ov.nextPayoutDate)} · ••4417`}
          emphasis
        />
        <StatTile
          label="This week"
          value={money(ov.weekEarnings)}
          sub="Net cash, last 7 days"
          accessory={<Spark data={ov.weekSeries.map((p) => p.value)} />}
        />
        <StatTile
          label="Pending settlement"
          value={money(ov.pendingSettlement)}
          sub={
            awaitingCount > 0
              ? `${awaitingCount} service${awaitingCount === 1 ? "" : "s"} awaiting customer confirmation`
              : "Nothing awaiting confirmation"
          }
        />
        <StatTile label="Today's earnings" value={money(ov.todayEarnings)} sub={`This month ${money(ov.monthEarnings)}`} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Earnings this week" description="Net cash per day, after all deductions">
            <TrendAreaChart data={ov.weekSeries} currency height={190} />
          </SectionCard>

          <SectionCard
            title="New job offers"
            description={offers.length > 0 ? `${offers.length} job${offers.length === 1 ? "" : "s"} matched to your skills and slots` : undefined}
            actions={
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => navigate("worker-jobs")}>
                View all
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.9} />
              </Button>
            }
          >
            {topOffers.length > 0 ? (
              <div className="space-y-4">
                {topOffers.map((offer) =>
                  "estimate" in offer ? <OpenRequestCard key={offer.id} request={offer} /> : <BookingOfferCard key={offer.id} booking={offer} />,
                )}
              </div>
            ) : (
              <EmptyState
                title="No new offers right now"
                description="We'll notify you the moment a job matches your trade, slots and service area. Open-pool requests appear here too."
              />
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Your cooperative" description="You own this platform together with 215 other members">
            {governance.isPending ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-36" />
              </div>
            ) : (
              <div className="space-y-3.5">
                {unvoted.length > 0 && (
                  <AlertBanner
                    severity="warning"
                    title={unvoted.length === 1 ? "1 proposal awaiting your vote" : `${unvoted.length} proposals awaiting your vote`}
                    detail={`${unvoted[0].code} — voting closes ${dateShort(unvoted[0].closesAt)}. One member, one vote.`}
                    action="Vote now"
                    onAction={() => navigate("worker-governance")}
                  />
                )}
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="micro-label">Welfare fund balance</p>
                    <p className="tnum mt-0.5 text-lg font-semibold tracking-tight">{money(ov.welfareBalance)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Grows with every completed job</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 shrink-0 text-xs" onClick={() => navigate("worker-welfare")}>
                    View
                    <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.9} />
                  </Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="micro-label">Active benefits</p>
                    <p className="mt-0.5 text-[13px] font-medium leading-snug">{ov.activeBenefit}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 shrink-0 text-xs" onClick={() => navigate("worker-welfare")}>
                    Benefits
                    <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.9} />
                  </Button>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="micro-label">Membership</p>
                    <p className="tnum mt-0.5 text-[13px] font-medium">
                      SGW-0117 · share capital {money(governance.data?.shareCapital ?? 1000)}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 shrink-0 text-xs" onClick={() => navigate("worker-governance")}>
                    <Vote className="h-3.5 w-3.5" strokeWidth={1.9} />
                    Governance
                  </Button>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Service quality" description="What customers see when they book you">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="micro-label">Rating</p>
                <RatingStars value={ov.rating} showValue={false} size={12} />
                <p className="tnum -mt-0.5 text-lg font-semibold tracking-tight">{ov.rating.toFixed(1)}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{worker ? `${worker.reviewCount} reviews` : ""}</p>
              </div>
              <div>
                <p className="micro-label">Completion</p>
                <p className="tnum mt-0.5 text-lg font-semibold tracking-tight">{ov.completionRate}%</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{ov.completedJobs} services</p>
              </div>
              <div>
                <p className="micro-label">On time</p>
                <p className="tnum mt-0.5 text-lg font-semibold tracking-tight">{ov.onTimeRate}%</p>
                <p className="mt-0.5 text-xs text-muted-foreground">last 90 days</p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
