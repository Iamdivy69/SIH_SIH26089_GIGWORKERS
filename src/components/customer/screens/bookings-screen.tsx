"use client";

import { useMemo } from "react";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, LoadingPanel } from "@/components/shared";
import { useBookings } from "@/hooks/use-api";
import { useAppStore } from "@/store/app-store";
import type { Booking, Worker } from "@/lib/types";
import { isActiveBooking, isHistoryBooking, isUpcomingBooking } from "../constants";
import { useWorkerMap } from "../hooks";
import { setBookingPrefill } from "../prefill";
import { BookingCard } from "../parts/booking-card";

export function BookingsScreen() {
  const navigate = useAppStore((s) => s.navigate);
  const { data, isLoading, isError, refetch } = useBookings({ customerId: "c-ananya" });
  const { map: workers } = useWorkerMap();

  const items = data?.items ?? [];
  const groups = useMemo(
    () => ({
      active: items.filter(isActiveBooking),
      upcoming: items.filter(isUpcomingBooking),
      history: items.filter(isHistoryBooking),
    }),
    [items],
  );

  /* "Book again" — restart the flow with the same service, member and description. */
  const bookAgain = (b: Booking) => {
    setBookingPrefill({
      workerId: b.workerId,
      categoryId: b.categoryId,
      serviceId: b.serviceId,
      description: b.description,
      notes: b.customerNotes ?? undefined,
    });
    toast("Booking restarted", {
      description: `${b.title} — same service, member and description. Pick a slot to continue.`,
    });
    navigate("customer-book", { categoryId: b.categoryId });
  };

  return (
    <div>
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="micro-label mb-1.5">My activity</p>
          <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Every request, visit and completed service — with full pricing and status history.
          </p>
        </div>
        <Button onClick={() => navigate("customer-book")}>
          <CalendarPlus className="h-4 w-4" strokeWidth={1.9} /> New request
        </Button>
      </header>

      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <LoadingPanel rows={5} />
      ) : (
        <Tabs defaultValue="active">
          <TabsList className="mb-4 h-10">
            <TabsTrigger value="active" className="gap-1.5 text-[13px]">
              Active
              <span className="tnum rounded-sm bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">{groups.active.length}</span>
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="gap-1.5 text-[13px]">
              Upcoming
              <span className="tnum rounded-sm bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">{groups.upcoming.length}</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-[13px]">
              History
              <span className="tnum rounded-sm bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">{groups.history.length}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-0">
            <BookingList
              items={groups.active}
              emptyTitle="No active service"
              emptyDescription="Once you book a request it appears here with live status until it's completed."
              workers={workers}
              onNavigate={navigate}
            />
          </TabsContent>
          <TabsContent value="upcoming" className="mt-0">
            <BookingList
              items={groups.upcoming}
              emptyTitle="Nothing scheduled ahead"
              emptyDescription="Accepted and scheduled visits for future dates will show up here."
              workers={workers}
              onNavigate={navigate}
            />
          </TabsContent>
          <TabsContent value="history" className="mt-0">
            <BookingList
              items={groups.history}
              emptyTitle="No history yet"
              emptyDescription="Completed and cancelled services are kept here with their invoices."
              workers={workers}
              onNavigate={navigate}
              onBookAgain={bookAgain}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

type Navigate = ReturnType<typeof useAppStore.getState>["navigate"];

function BookingList({
  items,
  emptyTitle,
  emptyDescription,
  workers,
  onNavigate,
  onBookAgain,
}: {
  items: Booking[];
  emptyTitle: string;
  emptyDescription: string;
  workers: Map<string, Worker>;
  onNavigate: Navigate;
  onBookAgain?: (b: Booking) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        action={
          <Button variant="outline" size="sm" onClick={() => onNavigate("customer-book")}>
            <CalendarPlus className="h-4 w-4" strokeWidth={1.9} /> Book a service
          </Button>
        }
      />
    );
  }
  return (
    <div className="space-y-3">
      {items.map((b) => (
        <BookingCard
          key={b.id}
          booking={b}
          worker={workers.get(b.workerId)}
          onView={() => onNavigate("customer-booking", { bookingId: b.id })}
          onBookAgain={onBookAgain ? () => onBookAgain(b) : undefined}
        />
      ))}
    </div>
  );
}
