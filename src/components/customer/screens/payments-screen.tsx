"use client";

import { useMemo, useState } from "react";
import { Download, FileText, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  CustomerPriceLines,
  DataTable,
  ErrorState,
  LoadingPanel,
  PageHeader,
  PaymentAllocation,
  SectionCard,
  StatTile,
  StatusBadge,
  type Column,
} from "@/components/shared";
import { useBookings, useCustomerOverview } from "@/hooks/use-api";
import { useAppStore } from "@/store/app-store";
import { csvDateStamp, downloadCsv } from "@/lib/csv";
import { dateShort, dateTimeLabel, money, num } from "@/lib/format";
import type { Booking } from "@/lib/types";
import { addressById, invoiceNo } from "../constants";
import { useWorkerMap } from "../hooks";

export function PaymentsScreen() {
  const navigate = useAppStore((s) => s.navigate);
  const { data: overview } = useCustomerOverview();
  const { data, isLoading, isError, refetch } = useBookings({ customerId: "c-ananya" });
  const { map: workers } = useWorkerMap();
  const [selected, setSelected] = useState<Booking | null>(null);

  const invoices = useMemo(
    () =>
      (data?.items ?? [])
        .filter((b) => b.paymentStatus !== "failed")
        .sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt)),
    [data],
  );

  const completed = invoices.filter((b) => b.status === "completed");
  const avgBooking = completed.length
    ? completed.reduce((a, b) => a + b.price.customerTotal, 0) / completed.length
    : 0;

  const exportStatement = () => {
    downloadCsv(
      `sahyog-statement-ananya-${csvDateStamp()}`,
      ["Invoice no.", "Reference", "Date", "Service", "Member", "Service charge", "Welfare contribution", "Platform fee", "GST", "Total", "Payment status"],
      invoices.map((b) => [
        invoiceNo(b.id),
        b.reference,
        dateShort(b.scheduledAt),
        b.title,
        workers.get(b.workerId)?.name ?? "Member",
        b.price.serviceCharge,
        b.price.welfareContribution,
        b.price.platformFee,
        b.price.gst,
        b.price.customerTotal,
        b.paymentStatus,
      ]),
    );
    toast.success("Statement downloaded", { description: `${invoices.length} invoices · opens in any spreadsheet app.` });
  };

  const columns: Column<Booking>[] = [
    {
      key: "date",
      header: "Date",
      cell: (b) => <span className="tnum whitespace-nowrap text-muted-foreground">{dateShort(b.scheduledAt)}</span>,
    },
    {
      key: "service",
      header: "Service",
      cell: (b) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{b.title}</p>
          <p className="tnum text-xs text-muted-foreground">{invoiceNo(b.id)} · {b.reference}</p>
        </div>
      ),
    },
    {
      key: "worker",
      header: "Member",
      hideOnTablet: true,
      cell: (b) => <span className="text-muted-foreground">{workers.get(b.workerId)?.name ?? "Member"}</span>,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (b) => <span className="tnum font-semibold">{money(b.price.customerTotal)}</span>,
    },
    {
      key: "payment",
      header: "Payment",
      align: "right",
      cell: (b) => <StatusBadge status={b.paymentStatus} />,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="My activity"
        title="Payments & invoices"
        description="Every rupee of every booking, itemised. Payment is held at booking and settles to your member only after you confirm completion."
        actions={
          <Button variant="outline" size="sm" onClick={exportStatement} disabled={invoices.length === 0}>
            <Download className="h-3.5 w-3.5" strokeWidth={1.9} /> Statement (CSV)
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatTile label="Spent this month" value={money(overview?.spentThisMonth)} sub="incl. welfare & GST" />
        <StatTile label="Completed services" value={num(overview?.completedCount ?? 0)} sub="lifetime" />
        <StatTile label="Average booking" value={money(avgBooking)} sub="completed services" />
      </div>

      <SectionCard title="Invoices" description="Click a row for the full invoice with allocation breakdown." forTable>
        {isError ? (
          <div className="p-5">
            <ErrorState onRetry={() => refetch()} />
          </div>
        ) : isLoading ? (
          <div className="p-5">
            <LoadingPanel rows={5} className="border-0" />
          </div>
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={invoices}
              getRowKey={(b) => b.id}
              onRowClick={(b) => setSelected(b)}
              emptyTitle="No invoices yet"
              emptyDescription="Your bookings and their invoices will appear here."
            />
            {invoices.length > 0 && (
              <div className="divide-y md:hidden">
                {invoices.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelected(b)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{b.title}</p>
                      <p className="tnum text-xs text-muted-foreground">
                        {dateShort(b.scheduledAt)} · {workers.get(b.workerId)?.name ?? "Member"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tnum text-[13px] font-semibold">{money(b.price.customerTotal)}</p>
                      <StatusBadge status={b.paymentStatus} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </SectionCard>

      <InvoiceDialog
        booking={selected}
        workerName={selected ? workers.get(selected.workerId)?.name : undefined}
        onClose={() => setSelected(null)}
        onOpenBooking={(id) => navigate("customer-booking", { bookingId: id })}
        onOpenInvoice={(id) => navigate("customer-invoice", { bookingId: id })}
      />
    </div>
  );
}

function InvoiceDialog({
  booking,
  workerName,
  onClose,
  onOpenBooking,
  onOpenInvoice,
}: {
  booking: Booking | null;
  workerName?: string;
  onClose: () => void;
  onOpenBooking: (id: string) => void;
  onOpenInvoice: (id: string) => void;
}) {
  if (!booking) return null;
  const address = addressById(booking.addressId);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" strokeWidth={1.9} />
            Tax invoice · <span className="tnum">{invoiceNo(booking.id)}</span>
          </DialogTitle>
          <DialogDescription>
            Issued {dateShort(booking.scheduledAt)} · booking {booking.reference} · simulated document for the SIH prototype
          </DialogDescription>
        </DialogHeader>

        <div className="text-[13px] leading-relaxed">
          <div className="flex flex-wrap items-start justify-between gap-4 rounded-md border bg-muted/30 p-4">
            <div>
              <p className="font-semibold">Sahyog Services Cooperative</p>
              <p className="text-xs text-muted-foreground">West Pune Multi-State Cooperative Society Ltd. (simulated)</p>
              <p className="tnum text-xs text-muted-foreground">GSTIN 27AABCS1429B1ZP</p>
            </div>
            <div className="text-right">
              <p className="font-medium">Billed to</p>
              <p>Ananya Deshpande</p>
              <p className="text-xs text-muted-foreground">{address.label} · {address.locality} {address.pincode}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-between gap-x-6 gap-y-1">
            <p>
              <span className="text-muted-foreground">Service:</span>{" "}
              <span className="font-medium">{booking.title}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Member:</span>{" "}
              <span className="font-medium">{workerName ?? "Member"}</span>
            </p>
          </div>

          <Separator className="my-4" />

          <CustomerPriceLines price={booking.price} />

          <div className="mt-5 border-t pt-4">
            <p className="micro-label mb-3">Allocation of your payment</p>
            <PaymentAllocation price={booking.price} />
          </div>

          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            GST is levied at 18% on the platform processing fee only ({money(booking.price.gst)}). The welfare contribution
            of {money(booking.price.welfareContribution)} is credited in full to your member's welfare fund. Visit on{" "}
            {dateTimeLabel(booking.scheduledAt)}.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={() => { onClose(); onOpenBooking(booking.id); }} className="text-muted-foreground">
            View booking
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                downloadCsv(
                  `invoice-${invoiceNo(booking.id).toLowerCase()}`,
                  ["Sahyog Services Cooperative — tax invoice (simulated)"],
                  [
                    ["Invoice no.", invoiceNo(booking.id)],
                    ["Booking reference", booking.reference],
                    ["Issued", dateShort(booking.scheduledAt)],
                    ["Billed to", "Ananya Deshpande"],
                    ["Service", booking.title],
                    ["Member", workerName ?? "Member"],
                    [],
                    ["Line item", "Amount (INR)"],
                    ["Service charge", booking.price.serviceCharge],
                    ["Welfare contribution (to member's fund)", booking.price.welfareContribution],
                    ["Platform processing fee", booking.price.platformFee],
                    ["GST @ 18% on processing fee", booking.price.gst],
                    ["Total", booking.price.customerTotal],
                  ],
                );
                toast.success("Invoice downloaded", { description: `${invoiceNo(booking.id)}.csv — line-item breakdown as shown above.` });
              }}
            >
              <Download className="h-3.5 w-3.5" strokeWidth={1.9} /> Download invoice
            </Button>
            {["authorized", "settled"].includes(booking.paymentStatus) && (
              <Button
                size="sm"
                onClick={() => {
                  onClose();
                  onOpenInvoice(booking.id);
                }}
                aria-label="View the full GST tax invoice for this booking"
              >
                <Receipt className="h-3.5 w-3.5" strokeWidth={1.9} /> View full invoice
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
