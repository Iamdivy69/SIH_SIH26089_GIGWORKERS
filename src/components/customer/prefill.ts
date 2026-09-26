"use client";

/**
 * Cross-screen handoff state for the customer app.
 *
 * The hash router (src/store/app-store.ts) only carries registered route
 * params, so flows that need richer context between screens (search query →
 * discover, preselected worker/service → booking flow, match factors → worker
 * profile) use these tiny module-scoped mailboxes. A value is written just
 * before `navigate()`; the target screen peeks at it while initialising state
 * and clears it from a mount effect (peek/clear keeps render pure and
 * double-render safe).
 */

import type { MatchFactor, ServiceCategoryId } from "@/lib/types";

/* ------------------------- search → discover ------------------------- */

let pendingSearch: string | null = null;

export function setSearchHandoff(q: string): void {
  pendingSearch = q.trim() || null;
}

export function peekSearchHandoff(): string | null {
  return pendingSearch;
}

export function clearSearchHandoff(): void {
  pendingSearch = null;
}

/* ---------------------- profile → booking flow ----------------------- */

export interface BookingPrefill {
  workerId?: string;
  categoryId?: ServiceCategoryId;
  serviceId?: string;
  /** "Book again" — carry over the work description and notes from a past booking. */
  description?: string;
  notes?: string;
}

let bookingPrefill: BookingPrefill | null = null;

export function setBookingPrefill(prefill: BookingPrefill): void {
  bookingPrefill = prefill;
}

export function peekBookingPrefill(): BookingPrefill | null {
  return bookingPrefill;
}

export function clearBookingPrefill(): void {
  bookingPrefill = null;
}

/* -------------------- matching → worker profile ---------------------- */

export interface WorkerMatchContext {
  workerId: string;
  score?: number;
  factors: MatchFactor[];
}

let workerMatchContext: WorkerMatchContext | null = null;

export function setWorkerMatchContext(ctx: WorkerMatchContext): void {
  workerMatchContext = ctx;
}

export function peekWorkerMatchContext(): WorkerMatchContext | null {
  return workerMatchContext;
}

export function clearWorkerMatchContext(): void {
  workerMatchContext = null;
}
