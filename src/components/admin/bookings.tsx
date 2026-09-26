"use client";

import { useMemo, useState } from "react";
import { Download, Repeat, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CustomerPriceLines,
  DataTable,
  ErrorState,
  MatchBadge,
  PageHeader,
  SectionCard,
  StatusBadge,
  statusLabel,
  StatusTimeline,
} from "@/components/shared";
import type { Column } from "@/components/shared";
import { FineNote } from "./ui";
import { useAdminBookings } from "@/hooks/use-api";
import { csvDateStamp, downloadCsv } from "@/lib/csv";
import { dateShort, dateTimeLabel, duration, money, num, relativeTime } from "@/lib/format";
import type { Booking, BookingStatus } from "@/lib/types";

type BookingRow = { booking: Booking; customerName: string; workerName: string };

const STATUS_OPTIONS: BookingStatus[] = [
  "pending_acceptance",
  "confirmed",
  "en_route",
  "arrived",
  "in_progress",
  "awaiting_confirmation",
  "completed",
  "cancelled",
  "declined",
];

/** All bookings across the cooperative — the operations ledger. */
export function AdminBookingsScreen() {
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const bookings = useAdminBookings(status);

  const [selected, setSelected] = useState<BookingRow | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bookings.data?.items ?? [];
    return (bookings.data?.items ?? []).filter((r) =>
      [r.booking.reference, r.booking.title, r.customerName, r.workerName, r.booking.description]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [bookings.data, query]);

  const totalValue = rows.reduce((a, r) => a + r.booking.price.customerTotal, 0);

  const exportCsv = () => {
    downloadCsv(
      `sahyog-bookings-${csvDateStamp()}`,
      ["Reference", "Status", "Recurrence", "Service", "Category", "Customer", "Member", "Scheduled", "Payment", "Service charge", "Welfare", "Platform fee", "GST", "Customer total", "Worker net"],
      rows.map((r) => [
        r.booking.reference,
        statusLabel(r.booking.status),
        r.booking.recurrence ?? "one-time",
        r.booking.title,
        r.booking.categoryId,
        r.customerName,
        r.workerName,
        dateTimeLabel(r.booking.scheduledAt),
        r.booking.paymentStatus,
        r.booking.price.serviceCharge,
        r.booking.price.welfareContribution,
        r.booking.price.platformFee,
        r.booking.price.gst,
        r.booking.price.customerTotal,
        r.booking.price.workerNetPayout,
      ]),
    );
    toast.success("Bookings CSV exported", { description: `${rows.length} rows · reflects the current status filter and search.` });
  };

  if (bookings.isError) {
    return (
      <>
        <PageHeader eyebrow="Operations" title="Bookings" />
        <ErrorState message="The booking ledger could not be loaded." onRetry={() => bookings.refetch()} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Operations · service ledger"
        title="Bookings"
        description={
          bookings.isLoading
            ? "Loading the booking ledger…"
            : `${num(rows.length)} bookings shown · ${money(totalValue)} customer value. Full lifecycle state, payment status and pricing breakdown for every service request.`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="h-3.5 w-3.5" strokeWidth={1.9} /> Export CSV
            </Button>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9 w-[190px] text-[13px]" aria-label="Filter by status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-[13px]">
                  All statuses
                </SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s} className="text-[13px]">
                    {statusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.9} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reference, customer, member, service…"
            className="h-9 pl-8 text-[13px]"
            aria-label="Search bookings"
          />
        </div>
      </div>

      <SectionCard forTable>
        {bookings.isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <DataTable
            columns={bookingColumns}
            rows={rows}
            getRowKey={(r) => r.booking.id}
            onRowClick={(r) => setSelected(r)}
            emptyTitle="No bookings match"
            emptyDescription={status !== "all" || query ? "Adjust the status filter or clear the search." : undefined}
            mobileCard={(r) => (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="tnum text-xs font-medium">{r.booking.reference}</span>
                    {r.booking.recurrence && (
                      <span className="inline-flex items-center gap-1 rounded-sm border border-warning/40 bg-warning-muted px-1.5 py-0.5 text-[11px] font-medium text-warning-deep">
                        <Repeat className="h-3 w-3" strokeWidth={1.9} aria-hidden />
                        Standing · {r.booking.recurrence}
                      </span>
                    )}
                  </div>
                  <StatusBadge status={r.booking.status} />
                </div>
                <p className="text-[13px] font-medium">{r.booking.title}</p>
                <p className="text-xs text-muted-foreground">
                  {r.customerName} → {r.workerName}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <span className="tnum text-xs text-muted-foreground">{dateTimeLabel(r.booking.scheduledAt)}</span>
                  <span className="tnum text-[13px] font-semibold">{money(r.booking.price.customerTotal)}</span>
                </div>
              </div>
            )}
          />
        )}
      </SectionCard>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto scroll-slim sm:max-w-2xl">
          {selected && <BookingDetail row={selected} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

const bookingColumns: Column<BookingRow>[] = [
  {
    key: "ref",
    header: "Reference",
    cell: (r) => (
      <div className="min-w-0">
        <span className="tnum font-medium">{r.booking.reference}</span>
        {r.booking.recurrence && (
          <span className="mt-1 inline-flex items-center gap-1 rounded-sm border border-warning/40 bg-warning-muted px-1.5 py-0.5 text-[11px] font-medium text-warning-deep">
            <Repeat className="h-3 w-3" strokeWidth={1.9} aria-hidden />
            Standing · {r.booking.recurrence}
          </span>
        )}
      </div>
    ),
  },
  {
    key: "created",
    header: "Created",
    cell: (r) => <span className="tnum whitespace-nowrap text-muted-foreground">{dateShort(r.booking.createdAt)}</span>,
    hideOnTablet: true,
  },
  { key: "customer", header: "Customer", cell: (r) => <span className="truncate">{r.customerName}</span> },
  {
    key: "worker",
    header: "Member",
    cell: (r) => <span className="truncate">{r.workerName}</span>,
    hideOnTablet: true,
  },
  { key: "service", header: "Service", cell: (r) => <span className="truncate">{r.booking.title}</span> },
  {
    key: "scheduled",
    header: "Scheduled",
    cell: (r) => <span className="tnum whitespace-nowrap text-muted-foreground">{dateTimeLabel(r.booking.scheduledAt)}</span>,
  },
  { key: "status", header: "Status", cell: (r) => <StatusBadge status={r.booking.status} /> },
  {
    key: "payment",
    header: "Payment",
    cell: (r) => <StatusBadge status={r.booking.paymentStatus} />,
    hideOnTablet: true,
  },
  {
    key: "total",
    header: "Total",
    align: "right",
    cell: (r) => <span className="tnum font-medium">{money(r.booking.price.customerTotal)}</span>,
  },
];

function BookingDetail({ row }: { row: BookingRow }) {
  const b = row.booking;
  return (
    <>
      <DialogHeader>
        <div className="flex flex-wrap items-center gap-2 pr-6">
          <DialogTitle className="tnum">{b.reference}</DialogTitle>
          <StatusBadge status={b.status} />
          <StatusBadge status={b.paymentStatus} />
          {b.matchScore !== undefined && <MatchBadge score={b.matchScore} />}
          {b.recurrence && (
            <span className="inline-flex items-center gap-1 rounded-sm border border-warning/40 bg-warning-muted px-1.5 py-0.5 text-[11px] font-medium text-warning-deep">
              <Repeat className="h-3 w-3" strokeWidth={1.9} aria-hidden />
              Standing · {b.recurrence}
            </span>
          )}
        </div>
        <DialogDescription>
          {b.title} · created {relativeTime(b.createdAt)}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-x-6 gap-y-3 border-y py-4 sm:grid-cols-2">
        <Field label="Customer" value={row.customerName} />
        <Field label="Member" value={row.workerName} />
        <Field label="Scheduled" value={`${dateTimeLabel(b.scheduledAt)} · ${duration(b.durationMin)}`} />
        <Field label="Payment" value={`${statusLabel(b.paymentStatus)} · ${money(b.price.customerTotal)}`} />
        <div className="sm:col-span-2">
          <Field label="Request" value={b.description} />
        </div>
        {b.customerNotes && (
          <div className="sm:col-span-2">
            <Field label="Customer notes" value={b.customerNotes} />
          </div>
        )}
        {b.cancellationReason && (
          <div className="sm:col-span-2">
            <Field label="Cancellation reason" value={b.cancellationReason} />
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <section aria-label="Lifecycle timeline">
          <h4 className="micro-label mb-3">Lifecycle</h4>
          <StatusTimeline events={b.timeline} />
        </section>
        <section aria-label="Pricing breakdown">
          <h4 className="micro-label mb-3">How the customer's payment is split</h4>
          <CustomerPriceLines price={b.price} />
          <FineNote className="mt-3">
            Every rupee is allocated at source — member payout, welfare fund, cooperative operations and taxes reconcile to the
            customer total.
          </FineNote>
        </section>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="micro-label">{label}</p>
      <p className="mt-0.5 text-[13px] leading-relaxed">{value}</p>
    </div>
  );
}
