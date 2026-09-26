"use client";

import {
  Droplets,
  HeartHandshake,
  Leaf,
  Sparkles,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { CustomerAddress, ServiceCategoryId, Worker, Booking } from "@/lib/types";

/** Ananya's two demo addresses (mirror of the server seed). */
export const DEMO_ADDRESSES: CustomerAddress[] = [
  {
    id: "addr-home",
    label: "Home",
    line: "Flat 402, Sunshree Residency, Paud Road",
    locality: "Kothrud",
    city: "Pune",
    pincode: "411038",
  },
  {
    id: "addr-parents",
    label: "Parents' home",
    line: "Row House 12, Sai Colony, Karve Nagar",
    locality: "Karve Nagar",
    city: "Pune",
    pincode: "411052",
  },
];

export function addressById(id: string): CustomerAddress {
  return DEMO_ADDRESSES.find((a) => a.id === id) ?? DEMO_ADDRESSES[0];
}

/** One-line address: "Flat 402, …, Kothrud 411038" */
export function addressLine(a: CustomerAddress): string {
  return `${a.line}, ${a.locality} ${a.pincode}`;
}

export const CATEGORY_ICONS: Record<ServiceCategoryId, LucideIcon> = {
  electrical: Zap,
  plumbing: Droplets,
  cleaning: Sparkles,
  gardening: Leaf,
  repairs: Wrench,
  "community-care": HeartHandshake,
};

/** Simulated UPI payment methods offered at checkout. */
export const PAYMENT_METHODS = [
  { id: "upi-saved", label: "ananya@upi", note: "Saved UPI ID · default", tag: "UPI" },
  { id: "gpay", label: "Google Pay", note: "Pay via GPay app", tag: "UPI" },
  { id: "paytm", label: "Paytm", note: "Pay via Paytm wallet / UPI", tag: "UPI" },
  { id: "bhim", label: "BHIM UPI", note: "Any UPI app", tag: "UPI" },
] as const;

/** Quick rating tag vocabulary (mirrors seeded review tags). */
export const RATING_TAGS = [
  "Punctual",
  "Skilled",
  "Professional",
  "Tidy",
  "Clear explanation",
  "Fair pricing",
  "Polite",
  "Thorough",
] as const;

/* ------------------------------------------------------------------ */
/* Booking lifecycle helpers                                           */
/* ------------------------------------------------------------------ */

const EXECUTING: Booking["status"][] = ["en_route", "arrived", "in_progress", "awaiting_confirmation"];
const SCHEDULED: Booking["status"][] = ["pending_acceptance", "confirmed"];
const TERMINAL: Booking["status"][] = ["completed", "cancelled", "declined"];

function endOfToday(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/** In the service lifecycle and happening now (or needing attention today). */
export function isActiveBooking(b: Booking): boolean {
  if (EXECUTING.includes(b.status)) return true;
  if (SCHEDULED.includes(b.status)) return new Date(b.scheduledAt).getTime() <= endOfToday();
  return false;
}

/** Accepted/scheduled for a future date. */
export function isUpcomingBooking(b: Booking): boolean {
  return SCHEDULED.includes(b.status) && new Date(b.scheduledAt).getTime() > endOfToday();
}

export function isHistoryBooking(b: Booking): boolean {
  return TERMINAL.includes(b.status);
}

/** Deterministic invoice number for a booking (INV-0912 style). */
export function invoiceNo(bookingId: string): string {
  const n = parseInt(bookingId.replace(/\D/g, ""), 10) || 0;
  return `INV-${String(809 + n).padStart(4, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Slot picking (booking flow step 4)                                  */
/* ------------------------------------------------------------------ */

export interface SlotGroup {
  id: "morning" | "afternoon" | "evening";
  label: string;
  hint: string;
  times: string[];
  /** hour range covered by this group, e.g. [8, 12) */
  range: [number, number];
}

export const SLOT_GROUPS: SlotGroup[] = [
  { id: "morning", label: "Morning", hint: "8 AM – 12 PM", times: ["08:00", "09:30", "11:00"], range: [8, 12] },
  { id: "afternoon", label: "Afternoon", hint: "12 PM – 4 PM", times: ["12:30", "14:00", "15:30"], range: [12, 16] },
  { id: "evening", label: "Evening", hint: "4 PM – 8 PM", times: ["17:00", "18:30"], range: [16, 20] },
];

/** Next `count` days starting today, as yyyy-MM-dd strings. */
export function nextDays(count = 7): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < count; i++) {
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    out.push(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`);
  }
  return out;
}

/** "Today" / "Tomorrow" / "Wed, 15 Jan" for a yyyy-MM-dd chip. */
export function dayChipLabel(dateStr: string): string {
  const [y, m, day] = dateStr.split("-").map(Number);
  const d = new Date(y, m - 1, day);
  const today = new Date();
  const diff = Math.round((d.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  const fmt = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short" });
  return fmt.format(new Date(y, m - 1, day));
}

/** Combine a yyyy-MM-dd chip + "HH:mm" time into an ISO string. */
export function slotToISO(dateStr: string, time: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
}

/** A time chip is bookable if it leaves at least ~30 minutes from now. */
export function isSlotBookable(dateStr: string, time: string): boolean {
  return new Date(slotToISO(dateStr, time)).getTime() >= Date.now() + 30 * 60_000;
}

/**
 * Provisional scheduledAt used to run matching (step 3) before the customer
 * picks the actual slot (step 4). Picks the earliest sensible near-term slot,
 * always inside a slot window.
 */
export function provisionalScheduledAt(): string {
  const today = nextDays(1)[0];
  const times = ["17:00", "18:30", "09:30"];
  for (const t of times) {
    if (isSlotBookable(today, t)) return slotToISO(today, t);
  }
  return slotToISO(nextDays(7)[1], "09:30");
}

/* ------------------------------------------------------------------ */
/* Worker availability helpers                                         */
/* ------------------------------------------------------------------ */

/** Does the worker's weekly availability cover this slot group on this date? */
export function workerCoversGroup(worker: Worker | undefined, dateStr: string, group: SlotGroup): boolean {
  if (!worker) return true;
  const [y, m, d] = dateStr.split("-").map(Number);
  const day = new Date(y, m - 1, d).getDay();
  const dayAvail = worker.availability.find((a) => a.day === day);
  if (!dayAvail) return false;
  const [gStart, gEnd] = group.range;
  return dayAvail.slots.some((s) => {
    const [from, to] = s.split("–").map((x) => parseInt(x.replace(":", ""), 10));
    return from <= gStart * 100 && to >= gEnd * 100;
  });
}

/** Worker has at least one availability window today. */
export function availableToday(worker: Worker): boolean {
  const today = new Date().getDay();
  return worker.availability.some((a) => a.day === today && a.slots.length > 0);
}

/* ------------------------------------------------------------------ */
/* Misc presentation helpers                                           */
/* ------------------------------------------------------------------ */

export const TICKET_TYPES = [
  { value: "complaint", label: "Complaint" },
  { value: "dispute", label: "Dispute" },
  { value: "question", label: "Question" },
] as const;

export const TICKET_CATEGORIES = ["Booking", "Payment", "Service quality", "Punctuality", "App & account", "Other"] as const;

export function ticketTypeLabel(t: string): string {
  return { complaint: "Complaint", dispute: "Dispute", question: "Question" }[t] ?? t;
}

/** Demo customer's membership age (mirrors the seed: ~420 days). */
export const MEMBER_SINCE_ISO = new Date(Date.now() - 420 * 86400000).toISOString();

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
