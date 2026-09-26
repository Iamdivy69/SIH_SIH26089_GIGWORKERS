"use client";

import { PageHeader, StatusBadge, DataTable } from "@/components/shared";
import type { Column } from "@/components/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkerJobs } from "@/hooks/use-api";
import type { Booking } from "@/lib/types";
import { dateTimeLabel, money } from "@/lib/format";
import { BookingOfferCard, JobRowCard, OpenJobButton, OpenRequestCard, QueryGate } from "../parts";

function CountPill({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="tnum ml-1.5 rounded-full bg-primary px-1.5 py-px text-[10px] font-semibold leading-4 text-primary-foreground">
      {count}
    </span>
  );
}

const historyColumns: Column<Booking>[] = [
  {
    key: "service",
    header: "Service",
    cell: (b) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{b.title}</p>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{b.reference}</p>
      </div>
    ),
  },
  { key: "scheduled", header: "Scheduled", cell: (b) => <span className="tnum text-muted-foreground">{dateTimeLabel(b.scheduledAt)}</span> },
  {
    key: "status",
    header: "Status",
    cell: (b) => <StatusBadge status={b.status} />,
  },
  {
    key: "net",
    header: "Net payout",
    align: "right",
    cell: (b) => <span className="tnum font-semibold">{money(b.price.workerNetPayout)}</span>,
  },
];

export function WorkerJobs() {
  const q = useWorkerJobs();

  return (
    <div>
      <PageHeader
        eyebrow="Work"
        title="Job opportunities"
        description="Direct requests from customers who chose you, plus open-pool jobs the platform matches to your skills, slots and service area. Every offer shows the full payout before you accept."
      />
      <QueryGate query={q}>
        {(data) => {
          const offersCount = data.offers.length + data.openRequests.length;
          return (
            <Tabs defaultValue="offers">
              <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
                <TabsTrigger value="offers" className="flex-1 sm:flex-none">
                  Offers
                  <CountPill count={offersCount} />
                </TabsTrigger>
                <TabsTrigger value="scheduled" className="flex-1 sm:flex-none">
                  Scheduled
                  <CountPill count={data.scheduled.length} />
                </TabsTrigger>
                <TabsTrigger value="active" className="flex-1 sm:flex-none">
                  Active
                  <CountPill count={data.active.length} />
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1 sm:flex-none">
                  History
                </TabsTrigger>
              </TabsList>

              <TabsContent value="offers" className="mt-5 space-y-6">
                {data.offers.length > 0 && (
                  <section>
                    <h2 className="micro-label mb-3">Direct requests — customers who chose you</h2>
                    <div className="space-y-4">
                      {data.offers.map((b) => (
                        <BookingOfferCard key={b.id} booking={b} />
                      ))}
                    </div>
                  </section>
                )}
                {data.openRequests.length > 0 && (
                  <section>
                    <h2 className="micro-label mb-3">Open pool — platform-routed demand near you</h2>
                    <div className="space-y-4">
                      {data.openRequests.map((r) => (
                        <OpenRequestCard key={r.id} request={r} />
                      ))}
                    </div>
                  </section>
                )}
                {offersCount === 0 && (
                  <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center">
                    <p className="text-sm font-medium">No open offers right now</p>
                    <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-muted-foreground">
                      New requests appear here the moment they match your trade, rating and confirmed slots. Keep your availability current to
                      receive more offers.
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="scheduled" className="mt-5">
                {data.scheduled.length > 0 ? (
                  <ul className="space-y-2.5">
                    {data.scheduled.map((b) => (
                      <li key={b.id}>
                        <JobRowCard booking={b} showCustomer />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center">
                    <p className="text-sm font-medium">Nothing scheduled yet</p>
                    <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-muted-foreground">
                      Accepted jobs land here with their date, time and customer location.
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="active" className="mt-5">
                {data.active.length > 0 ? (
                  <ul className="space-y-3">
                    {data.active.map((b) => (
                      <li key={b.id}>
                        <JobRowCard
                          booking={b}
                          showCustomer
                          footer={
                            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/70 pt-3">
                              <p className="text-xs text-muted-foreground">
                                Live job — advance the status, work the checklist and capture evidence.
                              </p>
                              <OpenJobButton bookingId={b.id} label="Open execution" />
                            </div>
                          }
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center">
                    <p className="text-sm font-medium">No jobs in progress</p>
                    <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-muted-foreground">
                      When you start a scheduled job it moves here until the customer confirms completion.
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="history" className="mt-5">
                <div className="hidden rounded-lg border bg-card md:block">
                  <DataTable
                    columns={historyColumns}
                    rows={data.history}
                    getRowKey={(b) => b.id}
                    dense
                    emptyTitle="No completed jobs yet"
                    emptyDescription="Your service history and settled payouts will appear here."
                  />
                </div>
                <div className="space-y-2.5 md:hidden">
                  {data.history.length === 0 ? (
                    <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">No completed jobs yet</p>
                  ) : (
                    data.history.map((b) => <JobRowCard key={b.id} booking={b} />)
                  )}
                </div>
              </TabsContent>
            </Tabs>
          );
        }}
      </QueryGate>
    </div>
  );
}
