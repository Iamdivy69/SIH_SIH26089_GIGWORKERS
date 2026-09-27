"use client";

/**
 * Customer GST tax-invoice screen (Task 7-a).
 *
 * Route: #/customer-invoice/:bookingId — data from useInvoice (server derives
 * every figure from the booking's own PriceBreakdown, so the document can
 * never disagree with what the customer paid).
 *
 * Document rules:
 * - The whole invoice lives inside ONE .print-sheet wrapper — the global
 *   print CSS (globals.css) lets only that subtree reach the paper; the
 *   toolbar above it carries .no-print.
 * - `print:*` utilities normalise the document for paper regardless of the
 *   active theme (dark-mode tokens would otherwise print as light-on-white);
 *   they carry the `!` flag so they win over themed utilities.
 * - Semantic tokens only on screen; black/white opacities only under print.
 */

import { useEffect } from "react";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared";
import { useInvoice } from "@/hooks/use-api";
import { useAppStore } from "@/store/app-store";
import { csvDateStamp, downloadCsv } from "@/lib/csv";
import { dateFull, money, num } from "@/lib/format";
import type { InvoiceData } from "@/lib/types";

/* Print normalisation shared by every themed surface inside the document. */
const PRINT_MUTED = "print:text-black/60!";
const PRINT_HAIRLINE = "print:border-black/25!";
const PRINT_CELL = "bg-card print:bg-white!";

export function InvoiceScreen({ bookingId }: { bookingId: string }) {
  const navigate = useAppStore((s) => s.navigate);
  const { data, isLoading, isError, error, refetch } = useInvoice(bookingId);

  /* Chrome paints the @page margin frame with the active colour scheme, so a
     dark-mode print would frame the white sheet in dark margins. Force a
     light scheme for the duration of the print job, then restore whatever
     next-themes had set. */
  useEffect(() => {
    let saved: string | null = null;
    const before = () => {
      saved = document.documentElement.style.getPropertyValue("color-scheme") || null;
      document.documentElement.style.setProperty("color-scheme", "light");
    };
    const after = () => {
      if (saved === null) document.documentElement.style.removeProperty("color-scheme");
      else document.documentElement.style.setProperty("color-scheme", saved);
      saved = null;
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
      after();
    };
  }, []);

  if (isError) {
    return (
      <div className="flex flex-col items-center py-8">
        <div className="w-full max-w-lg">
          <ErrorState message={error?.message ?? "This invoice cannot be shown."} onRetry={() => refetch()} />
        </div>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("customer-payments")}>
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.9} /> Back to payments
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar — screen only, never reaches the paper */}
      <div className="no-print mb-5 flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("customer-booking", { bookingId })}
          className="-ml-2 gap-1.5 text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.9} /> Back to booking
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => data && exportInvoiceCsv(data)} disabled={!data}>
            <Download className="h-3.5 w-3.5" strokeWidth={1.9} /> Download CSV
          </Button>
          <Button size="sm" onClick={() => window.print()} disabled={!data}>
            <Printer className="h-3.5 w-3.5" strokeWidth={1.9} /> Print invoice
          </Button>
        </div>
      </div>

      {isLoading || !data ? <InvoiceSkeleton /> : <InvoiceDocument data={data} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The document                                                        */
/* ------------------------------------------------------------------ */

function InvoiceDocument({ data }: { data: InvoiceData }) {
  const settled = data.payment.status === "Settled to member";
  const chargeRows: { label: string; amount: number }[] = [
    { label: "Service charge", amount: data.totals.serviceCharge },
    { label: "Welfare contribution", amount: data.totals.welfareContribution },
    { label: "Platform processing", amount: data.totals.platformFee },
    { label: "GST", amount: data.totals.gst },
  ];

  return (
    <div className="print-sheet mx-auto max-w-3xl rounded-lg border bg-card">
      <div className="p-6 sm:p-10 print:p-5!">
        {/* Letterhead */}
        <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-lg font-semibold leading-tight">{data.coop.name}</p>
            <div className={`mt-2 space-y-0.5 text-xs leading-relaxed text-muted-foreground ${PRINT_MUTED} print:mt-1! print:leading-snug!`}>
              {data.coop.address.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p className="tnum">{data.coop.registration}</p>
              <p>{data.coop.email}</p>
            </div>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <p className={`micro-label ${PRINT_MUTED}`}>Tax invoice</p>
            <p className="tnum mt-2 text-base font-semibold tracking-tight print:mt-1!">{data.invoiceNo}</p>
            <p className="tnum mt-1 text-[13px]">{dateFull(data.invoiceDate)}</p>
            <p className={`tnum mt-0.5 text-xs text-muted-foreground ${PRINT_MUTED}`}>Fiscal year {data.fiscalYear}</p>
          </div>
        </header>

        <Separator className="my-6 print:my-2! print:bg-black/25!" />

        {/* Billed to · Service member */}
        <div
          className={`mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-md border bg-border/70 sm:grid-cols-2 print:mt-3! ${PRINT_HAIRLINE} print:bg-black/20!`}
        >
          <div className={`p-4 print:p-3! ${PRINT_CELL}`}>
            <p className={`micro-label ${PRINT_MUTED}`}>Billed to</p>
            <p className="mt-2 text-[15px] font-semibold print:mt-1!">{data.billTo.name}</p>
            <p className={`tnum mt-0.5 text-xs text-muted-foreground ${PRINT_MUTED}`}>
              Customer ID {data.billTo.customerId}
            </p>
            <div className={`mt-2 space-y-0.5 text-[13px] leading-relaxed text-muted-foreground ${PRINT_MUTED} print:mt-1! print:leading-snug!`}>
              {data.billTo.address.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
          <div className={`p-4 print:p-3! ${PRINT_CELL}`}>
            <p className={`micro-label ${PRINT_MUTED}`}>Service member (co-operative)</p>
            <p className="mt-2 text-[15px] font-semibold print:mt-1!">{data.serviceBy.name}</p>
            <p className={`tnum mt-0.5 text-xs text-muted-foreground ${PRINT_MUTED}`}>
              Member no. {data.serviceBy.memberNo}
            </p>
            <p className={`mt-2 text-[13px] leading-relaxed text-muted-foreground ${PRINT_MUTED} print:mt-1! print:leading-snug!`}>{data.serviceBy.trade}</p>
          </div>
        </div>

        {/* Meta strip — booking · SAC · GSTIN · payment */}
        <dl
          className={`mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border/70 sm:grid-cols-4 print:mt-3! ${PRINT_HAIRLINE} print:bg-black/20!`}
        >
          <div className={`p-3.5 print:p-2.5! ${PRINT_CELL}`}>
            <dt className={`micro-label ${PRINT_MUTED}`}>Booking ref</dt>
            <dd className="tnum mt-1.5 text-[13px] font-medium print:mt-1!">{data.bookingRef}</dd>
          </div>
          <div className={`p-3.5 print:p-2.5! ${PRINT_CELL}`}>
            <dt className={`micro-label ${PRINT_MUTED}`}>SAC code</dt>
            <dd className="tnum mt-1.5 text-[13px] font-medium print:mt-1!">{data.sacCode}</dd>
          </div>
          <div className={`p-3.5 print:p-2.5! ${PRINT_CELL}`}>
            <dt className={`micro-label ${PRINT_MUTED}`}>GSTIN</dt>
            <dd className="tnum mt-1.5 text-[13px] font-medium print:mt-1!">{data.gstin}</dd>
          </div>
          <div className={`p-3.5 print:p-2! ${PRINT_CELL}`}>
            <dt className={`micro-label ${PRINT_MUTED}`}>Payment</dt>
            <dd className="mt-1.5 text-[13px] font-medium print:mt-1!">{data.payment.method}</dd>
            <dd className={`tnum mt-0.5 text-xs text-muted-foreground ${PRINT_MUTED}`}>{data.payment.reference}</dd>
            <dd className="mt-2 print:mt-1!">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                  settled
                    ? "border-success/40 bg-success-muted text-success-deep"
                    : "border-warning/40 bg-warning-muted text-warning-deep"
                } print:border-black/30! print:bg-black/[0.03]! print:text-black/70!`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${settled ? "bg-success" : "bg-warning"} print:bg-black/60!`}
                  aria-hidden
                />
                {data.payment.status}
              </span>
            </dd>
          </div>
        </dl>

        {/* Line items — table on paper and ≥sm, stacked rows on mobile.
            In print the per-item detail folds inline after the description
            (classic invoice layout) so the document fits one sheet. */}
        <div className="mt-6 print:mt-3!">
          <div className={`hidden overflow-hidden rounded-md border sm:block print:block ${PRINT_HAIRLINE}`}>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b bg-muted/40 print:border-black/25! print:bg-black/[0.03]!">
                  <th className={`micro-label px-4 py-2.5 text-left font-medium print:py-1.5! ${PRINT_MUTED}`}>Description</th>
                  <th className={`micro-label w-14 px-3 py-2.5 text-right font-medium print:py-1.5! ${PRINT_MUTED}`}>Qty</th>
                  <th className={`micro-label w-24 px-3 py-2.5 text-left font-medium print:py-1.5! ${PRINT_MUTED}`}>Unit</th>
                  <th className={`micro-label w-28 px-4 py-2.5 text-right font-medium print:py-1.5! ${PRINT_MUTED}`}>Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70 print:divide-black/20!">
                {data.items.map((it) => (
                  <tr key={it.description}>
                    <td className="px-4 py-3 align-top print:py-1.5!">
                      <p className="font-medium leading-snug">
                        {it.description}
                        {it.detail && (
                          <span
                            className={`hidden text-[11px] font-normal leading-snug text-muted-foreground print:inline! ${PRINT_MUTED}`}
                          >
                            {" — "}
                            {it.detail}
                          </span>
                        )}
                      </p>
                      {it.detail && (
                        <p
                          className={`mt-1 text-xs leading-relaxed text-muted-foreground print:hidden ${PRINT_MUTED}`}
                        >
                          {it.detail}
                        </p>
                      )}
                    </td>
                    <td className={`tnum px-3 py-3 text-right align-top text-muted-foreground print:py-1.5! ${PRINT_MUTED}`}>
                      {num(it.qty)}
                    </td>
                    <td className={`px-3 py-3 align-top text-muted-foreground print:py-1.5! ${PRINT_MUTED}`}>{it.unit}</td>
                    <td className="tnum px-4 py-3 text-right align-top font-medium print:py-1.5!">{money(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className={`divide-y divide-border/70 rounded-md border sm:hidden print:hidden ${PRINT_HAIRLINE} print:divide-black/20!`}>
            {data.items.map((it) => (
              <li key={it.description} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium leading-snug">{it.description}</p>
                  {it.detail && (
                    <p className={`mt-0.5 text-xs leading-relaxed text-muted-foreground ${PRINT_MUTED}`}>{it.detail}</p>
                  )}
                  <p className={`tnum mt-1 text-xs text-muted-foreground ${PRINT_MUTED}`}>
                    Qty {num(it.qty)} · {it.unit}
                  </p>
                </div>
                <p className="tnum shrink-0 text-[13px] font-semibold">{money(it.amount)}</p>
              </li>
            ))}
          </ul>

          {/* Totals */}
          <div className="mt-5 flex justify-end print:mt-2!">
            <dl className="w-full max-w-xs text-[13px]">
              {chargeRows.map((r) => (
                <div key={r.label} className="flex items-baseline justify-between gap-6 py-1.5 print:py-1!">
                  <dt className={`text-muted-foreground ${PRINT_MUTED}`}>{r.label}</dt>
                  <dd className="tnum font-medium">{money(r.amount)}</dd>
                </div>
              ))}
              <div className="mt-1 flex items-baseline justify-between gap-6 border-t-2 border-foreground py-2.5 print:border-black! print:py-1.5!">
                <dt className="text-[15px] font-semibold">Total payable</dt>
                <dd className="tnum text-[16px] font-semibold">{money(data.totals.customerTotal)}</dd>
              </div>
            </dl>
          </div>
          <p className={`mt-2 text-[13px] italic leading-relaxed text-muted-foreground print:mt-1! ${PRINT_MUTED}`}>
            <span className="font-medium">Amount in words:</span> {data.amountInWords}
          </p>
        </div>

        {/* Transparency footer */}
        <Separator className="my-6 print:my-2! print:bg-black/25!" />
        <footer>
          <p className={`micro-label ${PRINT_MUTED}`}>Notes</p>
          <ul
            className={`mt-2 list-outside list-disc space-y-1.5 pl-4 text-[12.5px] leading-relaxed text-muted-foreground marker:text-muted-foreground print:mt-0.5! print:space-y-0.5! print:text-[10.5px]! print:leading-snug! ${PRINT_MUTED} print:marker:text-black/50!`}
          >
            {data.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <p
            className={`mt-4 border-t pt-3 text-[12.5px] leading-relaxed text-muted-foreground print:mt-1! print:pt-1! print:text-[10.5px]! ${PRINT_MUTED} ${PRINT_HAIRLINE}`}
          >
            Sahyog Seva Sanstha — a worker-owned co-operative · This is a computer-generated invoice.
          </p>
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Loading skeleton — mirrors the document layout                     */
/* ------------------------------------------------------------------ */

function InvoiceSkeleton() {
  return (
    <div className="mx-auto max-w-3xl rounded-lg border bg-card">
      <div className="p-6 sm:p-10">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-2">
            <Skeleton className="h-5 w-60" />
            <Skeleton className="h-3 w-64" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="hidden space-y-2 sm:block">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="ml-auto h-4 w-36" />
            <Skeleton className="ml-auto h-3 w-28" />
          </div>
        </div>
        <Skeleton className="mt-6 h-px w-full" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="mt-6 h-28 w-full" />
        <div className="mt-5 flex justify-end">
          <Skeleton className="h-28 w-64" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CSV export — classic invoice rows                                   */
/* ------------------------------------------------------------------ */

function exportInvoiceCsv(inv: InvoiceData) {
  downloadCsv(
    `sahyog-invoice-${inv.bookingRef}`,
    ["Description", "Qty", "Unit", "Amount (₹)"],
    [
      ...inv.items.map((it) => [it.description, it.qty, it.unit, it.amount]),
      // Totals block — qty/unit cells intentionally empty
      ["Service charge", "", "", inv.totals.serviceCharge],
      ["Welfare contribution", "", "", inv.totals.welfareContribution],
      ["Platform processing", "", "", inv.totals.platformFee],
      ["GST", "", "", inv.totals.gst],
      ["Total payable", "", "", inv.totals.customerTotal],
      [],
      // Invoice meta
      ["Amount in words", inv.amountInWords, "", ""],
      ["Invoice no", inv.invoiceNo, "", ""],
      ["Invoice date", dateFull(inv.invoiceDate), "", ""],
      ["Fiscal year", inv.fiscalYear, "", ""],
      ["Booking reference", inv.bookingRef, "", ""],
      ["Billed to", `${inv.billTo.name} · ${inv.billTo.customerId}`, "", ""],
      ["Service member", `${inv.serviceBy.name} · ${inv.serviceBy.memberNo} · ${inv.serviceBy.trade}`, "", ""],
      ["Payment", `${inv.payment.method} · ${inv.payment.reference} · ${inv.payment.status}`, "", ""],
      ["GSTIN", inv.gstin, "", ""],
      ["SAC code", inv.sacCode, "", ""],
      ["Exported", csvDateStamp(), "", ""],
    ],
  );
  toast.success("Invoice downloaded", {
    description: `${inv.invoiceNo} · ${inv.bookingRef} — line items, totals and invoice details.`,
  });
}
