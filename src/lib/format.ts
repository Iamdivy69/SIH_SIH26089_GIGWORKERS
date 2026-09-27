import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday, parseISO } from "date-fns";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrPlain = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹1,25,000 — tabular-friendly currency */
export function money(n: number | undefined | null): string {
  return inr.format(Math.round(n ?? 0));
}

/** 1,25,000 without the symbol */
export function num(n: number | undefined | null): string {
  return inrPlain.format(Math.round(n ?? 0));
}

/** ₹1.24L style compact for large figures */
export function moneyCompact(n: number): string {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return money(n);
}

export function toDate(iso: string): Date {
  const d = parseISO(iso);
  return Number.isNaN(d.getTime()) ? new Date(NaN) : d;
}

/** Defensive formatters — never throw on bad demo data, show em-dash instead */
function safeFormat(d: Date, f: string): string {
  try {
    if (Number.isNaN(d.getTime())) return "—";
    return format(d, f);
  } catch {
    return "—";
  }
}

/** "Sat, 27 Sep" */
export function dateShort(iso: string): string {
  return safeFormat(toDate(iso), "EEE, d MMM");
}

/** "Sat, 27 Sep 2025" */
export function dateFull(iso: string): string {
  return safeFormat(toDate(iso), "EEE, d MMM yyyy");
}

/** "4:30 PM" */
export function time(iso: string): string {
  return safeFormat(toDate(iso), "h:mm a");
}

/** "Today · 4:30 PM" / "Tomorrow · 10:00 AM" / "Sat, 27 Sep · 4:30 PM" */
export function dateTimeLabel(iso: string): string {
  const d = toDate(iso);
  if (isToday(d)) return `Today · ${safeFormat(d, "h:mm a")}`;
  if (isTomorrow(d)) return `Tomorrow · ${safeFormat(d, "h:mm a")}`;
  if (isYesterday(d)) return `Yesterday · ${safeFormat(d, "h:mm a")}`;
  return `${safeFormat(d, "EEE, d MMM")} · ${safeFormat(d, "h:mm a")}`;
}

export function relativeTime(iso: string): string {
  try {
    const d = toDate(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const distance = formatDistanceToNowStrict(d);
    /* future timestamps (clock skew, fresh seeds) read as "in …", never "… ago" */
    return d.getTime() > Date.now() ? `in ${distance}` : `${distance} ago`;
  } catch {
    return "—";
  }
}

/** "2h 15m" from minutes */
export function duration(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} hr`;
  return `${h}h ${m}m`;
}

/** Deterministic initials, e.g. "Priya Sharma" → "PS" */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Deterministic soft avatar tone class from a name */
const AVATAR_TONES = [
  "bg-[oklch(0.90_0.03_155)] text-[oklch(0.35_0.06_158)]",
  "bg-[oklch(0.92_0.025_75)] text-[oklch(0.42_0.09_70)]",
  "bg-[oklch(0.91_0.03_240)] text-[oklch(0.38_0.05_240)]",
  "bg-[oklch(0.92_0.03_25)] text-[oklch(0.42_0.11_28)]",
  "bg-[oklch(0.91_0.035_190)] text-[oklch(0.36_0.05_195)]",
  "bg-[oklch(0.92_0.028_330)] text-[oklch(0.42_0.09_330)]",
];

export function avatarTone(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 997;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

export function pctLabel(n: number): string {
  return `${Math.round(n)}%`;
}

/* ------------------------------------------------------------------ */
/* Amount in words (Indian numbering) — used on tax invoices           */
/* ------------------------------------------------------------------ */

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return (h ? ONES[h] + " Hundred" + (rest ? " " : "") : "") + (rest ? twoDigits(rest) : "");
}

/** "Eight Hundred Eighty-One" — Indian system (crore / lakh / thousand). */
export function amountInWords(n: number): string {
  const total = Math.round(Math.abs(n));
  if (total === 0) return "Zero";
  const crore = Math.floor(total / 10000000);
  const lakh = Math.floor((total % 10000000) / 100000);
  const thousand = Math.floor((total % 100000) / 1000);
  const rest = total % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(" ");
}

/** e.g. "4.8" rating → "4.8 / 5" */
export function ratingLabel(r: number): string {
  return `${r.toFixed(1)} / 5`;
}

export function bookingReference(id: string): string {
  return `SG-${id.slice(-6).toUpperCase()}`;
}

/** Day names indexed the same as AvailabilitySlot.day */
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const TIME_SLOTS = [
  { id: "08–12", label: "Morning", hint: "8 AM – 12 PM" },
  { id: "12–16", label: "Afternoon", hint: "12 PM – 4 PM" },
  { id: "16–20", label: "Evening", hint: "4 PM – 8 PM" },
] as const;

export type TimeSlotId = (typeof TIME_SLOTS)[number]["id"];
