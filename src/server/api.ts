import { NextRequest } from "next/server";
import type {
  Booking,
  BookingStatus,
  Role,
  ServiceCategoryId,
  WorkerAvailabilitySlot,
} from "@/lib/types";
import { computePrice, DEFAULT_RATES } from "@/lib/rates";
import { recommend } from "./matching";
import {
  addBooking,
  addBookingMessage,
  audit,
  bookingById,
  categories,
  confirmBooking,
  createTicket,
  customerById,
  getStore,
  notify,
  recurringMonthlyFor,
  settleBooking,
  updatePolicy,
  voteOnProposal,
  welfareProfileFor,
  workerById,
  workerOverviewFor,
  ADMIN_USER,
  CUSTOMER_USER,
  WORKER_USER,
} from "./db";
import { CHECKLISTS, serviceById } from "./catalog";

type Params = Record<string, string>;

const LATENCY = 200;

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

type Handler = (req: NextRequest, params: Params, body: any, user: string) => Promise<unknown> | unknown;

const routes: { method: string; pattern: RegExp; keys: string[]; handler: Handler }[] = [];

function route(method: string, path: string, handler: Handler) {
  const keys: string[] = [];
  const pattern = new RegExp(
    "^" +
      path
        .split("/")
        .map((seg) => {
          if (seg.startsWith(":")) {
            keys.push(seg.slice(1));
            return "([^/]+)";
          }
          return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        })
        .join("/") +
      "$",
  );
  routes.push({ method, pattern, keys, handler });
}

export async function handle(req: NextRequest, slug: string[]): Promise<Response> {
  await new Promise((r) => setTimeout(r, LATENCY));
  const path = "/" + slug.join("/");
  const method = req.method.toUpperCase();
  const user = req.headers.get("x-demo-user") || "";

  let body: any = null;
  if (method === "POST" || method === "PUT") {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }

  for (const r of routes) {
    if (r.method !== method) continue;
    const match = path.match(r.pattern);
    if (!match) continue;
    const params: Params = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(match[i + 1])));
    try {
      const result = await r.handler(req, params, body, user || demoUserFor(path));
      return Response.json(result as any, { status: 200 });
    } catch (err: any) {
      return Response.json({ error: err?.message ?? "Request failed" }, { status: 400 });
    }
  }
  return Response.json({ error: "Not found", path }, { status: 404 });
}

function demoUserFor(path: string): string {
  if (path.startsWith("/worker") || path.startsWith("/bookings/")) return WORKER_USER;
  if (path.startsWith("/admin")) return ADMIN_USER;
  return CUSTOMER_USER;
}

/* ------------------------------------------------------------------ */
/* Shared                                                              */
/* ------------------------------------------------------------------ */

route("GET", "/session", () => {
  const store = getStore();
  const customer = customerById(CUSTOMER_USER);
  const worker = workerById(WORKER_USER);
  return {
    platform: {
      name: "Sahyog",
      fullName: "Sahyog Cooperative Services Platform",
      tagline: "Household & community services, run as a worker cooperative",
      prototype: true,
    },
    users: {
      customer: { id: customer.id, name: customer.name, role: "customer" as Role, subtitle: "Kothrud, Pune", locality: customer.locality },
      worker: { id: worker.id, name: worker.name, role: "worker" as Role, subtitle: `${worker.tradeTitle} · ${worker.locality}`, locality: worker.locality },
      admin: { id: ADMIN_USER, name: "Kiran Rao", role: "admin" as Role, subtitle: "Operations Lead · Sahyog Cooperative", locality: "Kothrud Centre" },
    },
    rates: DEFAULT_RATES,
    generatedAt: new Date().toISOString(),
  };
});

route("GET", "/categories", () => {
  const store = getStore();
  return categories().map((c) => ({
    ...c,
    activeWorkers: store.workers.filter((w) => w.category === c.id && w.status === "verified").length,
  }));
});

route("GET", "/notifications", (_req, _p, _b, user) => {
  const list = getStore().notifications.filter((n) => n.userId === user);
  return { items: list, unread: list.filter((n) => !n.read).length };
});

route("POST", "/notifications/read", (_req, _p, body, user) => {
  const store = getStore();
  if (body.all) {
    /* scoped to the requesting demo user — never clears other roles' notifications */
    store.notifications.forEach((n) => {
      if (n.userId === user) n.read = true;
    });
  } else if (Array.isArray(body.ids)) {
    store.notifications.forEach((n) => {
      if (body.ids.includes(n.id)) n.read = true;
    });
  }
  return { ok: true };
});

/* ------------------------------------------------------------------ */
/* Customer                                                            */
/* ------------------------------------------------------------------ */

route("GET", "/customer/overview", (_req, _p, _b, user) => {
  const store = getStore();
  const customerId = user || CUSTOMER_USER;
  const customer = customerById(customerId);
  const myBookings = store.bookings.filter((b) => b.customerId === customerId);
  const now = Date.now();
  const active = myBookings.find((b) => ["confirmed", "en_route", "arrived", "in_progress", "awaiting_confirmation"].includes(b.status));
  const upcoming = myBookings.filter((b) => ["confirmed", "pending_acceptance"].includes(b.status) && new Date(b.scheduledAt).getTime() > now && b.id !== active?.id);
  const recent = myBookings
    .filter((b) => ["completed", "cancelled"].includes(b.status))
    .sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt))
    .slice(0, 4);
  const monthSpend = myBookings
    .filter((b) => now - +new Date(b.createdAt) < 30 * 86400000 && b.paymentStatus !== "refunded")
    .reduce((a, b) => a + b.price.customerTotal, 0);

  /* Active standing-order series of this customer (an upcoming occurrence exists). */
  const activeSeries = new Set<string>();
  for (const b of myBookings) {
    if (!b.recurrence || !b.seriesId || ["cancelled", "declined", "completed"].includes(b.status)) continue;
    activeSeries.add(b.seriesId);
  }

  /* Recommended workers based on preferred categories */
  const recs = recommend(store.workers, {
    categoryId: customer.preferredCategories[0],
    scheduledAt: new Date(now + 86400000),
    customerLocality: customer.locality,
    serviceCharge: 800,
  });

  return {
    activeBooking: active ?? null,
    upcomingBookings: upcoming,
    recentBookings: recent,
    recommendedWorkers: recs.map((r) => ({ worker: r.worker, score: r.score, reason: r.reasonSummary })),
    categories: categories().map((c) => ({
      ...c,
      activeWorkers: store.workers.filter((w) => w.category === c.id && w.status === "verified").length,
    })),
    spentThisMonth: monthSpend,
    completedCount: myBookings.filter((b) => b.status === "completed").length,
    savedWorkers: store.savedWorkers,
    activeStandingOrders: activeSeries.size,
  };
});

route("GET", "/workers", (req) => {
  const store = getStore();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").toLowerCase();
  const category = url.searchParams.get("category");
  const minRating = parseFloat(url.searchParams.get("minRating") ?? "0");
  const maxDistance = parseFloat(url.searchParams.get("maxDistance") ?? "999");
  const verifiedOnly = url.searchParams.get("verifiedOnly") === "true";
  const availableToday = url.searchParams.get("availableToday") === "true";
  const sort = url.searchParams.get("sort") ?? "recommended";

  let list = store.workers.filter((w) => w.status === "verified" || w.status === "suspended");
  if (q) list = list.filter((w) => [w.name, w.tradeTitle, w.locality, ...w.skills].join(" ").toLowerCase().includes(q));
  if (category && category !== "all") list = list.filter((w) => w.category === category);
  if (minRating) list = list.filter((w) => w.rating >= minRating);
  if (maxDistance < 999) list = list.filter((w) => w.distanceKm <= maxDistance);
  if (verifiedOnly) list = list.filter((w) => w.status === "verified");
  const today = new Date().getDay();
  if (availableToday) list = list.filter((w) => w.availability.some((a) => a.day === today && a.slots.length > 0));

  if (sort === "rating") list.sort((a, b) => b.rating - a.rating);
  else if (sort === "distance") list.sort((a, b) => a.distanceKm - b.distanceKm);
  else if (sort === "jobs") list.sort((a, b) => b.completedJobs - a.completedJobs);
  else list.sort((a, b) => b.rating * 20 + b.completedJobs / 20 - (a.rating * 20 + a.completedJobs / 20));

  return { items: list, total: list.length };
});

route("GET", "/workers/:id", (_req, params) => {
  const store = getStore();
  const worker = store.workers.find((w) => w.id === params.id);
  if (!worker) throw new Error("Worker not found");
  const reviews = store.reviews.filter((r) => r.workerId === worker.id).slice(0, 8);
  const bookingsDone = store.bookings.filter((b) => b.workerId === worker.id && b.status === "completed").length;
  const similar = store.workers
    .filter((w) => w.category === worker.category && w.id !== worker.id && w.status === "verified")
    .slice(0, 3);
  return { worker, reviews, bookingsDone, similar, saved: store.savedWorkers.includes(worker.id) };
});

route("POST", "/workers/:id/save", (_req, params) => {
  const store = getStore();
  const idx = store.savedWorkers.indexOf(params.id);
  if (idx >= 0) store.savedWorkers.splice(idx, 1);
  else store.savedWorkers.push(params.id);
  return { saved: store.savedWorkers.includes(params.id) };
});

route("POST", "/matching", (_req, _p, body) => {
  const store = getStore();
  const customer = customerById(CUSTOMER_USER);
  const scheduledAt = new Date(body.scheduledAt ?? Date.now() + 86400000);
  const recs = recommend(store.workers, {
    categoryId: body.categoryId as ServiceCategoryId,
    serviceId: body.serviceId,
    scheduledAt,
    customerLocality: customer.locality,
    serviceCharge: body.charge ?? 800,
  });
  return {
    recommendations: recs,
    weights: { skill: 35, location: 20, availability: 20, rating: 15, experience: 10 },
    estimate: computePrice(body.charge ?? 800),
  };
});

route("POST", "/bookings", (_req, _p, body) => {
  const store = getStore();
  /* Input hardening — clear errors instead of crashes on bad payloads. */
  const categoryId = body?.categoryId as string | undefined;
  if (!categoryId || !categories().some((c) => c.id === categoryId)) {
    throw new Error("Unknown service category — pick one of the six cooperative categories");
  }
  const service = serviceById(categoryId as ServiceCategoryId, body?.serviceId);
  if (!service) {
    throw new Error(`Unknown service — ${String(body?.serviceId)} is not offered under ${categoryId}`);
  }
  const worker = store.workers.find((w) => w.id === body?.workerId);
  if (!worker) {
    throw new Error("Unknown member — this worker does not exist");
  }
  const charge = Number(body?.charge);
  if (!Number.isFinite(charge) || charge <= 0) {
    throw new Error("Invalid service charge — a positive rupee amount is required");
  }
  const description = String(body?.description ?? "").trim();
  if (description.length < 15) {
    throw new Error("Add a short description of the work (at least 15 characters)");
  }
  const customer = customerById(CUSTOMER_USER);
  const addressId = String(body?.addressId ?? customer.addresses[0].id);
  if (!customer.addresses.some((a) => a.id === addressId)) {
    throw new Error("Unknown service address — pick one of the customer's saved addresses");
  }
  const recurrence = body?.recurrence as "weekly" | "monthly" | undefined;
  if (recurrence !== undefined && recurrence !== "weekly" && recurrence !== "monthly") {
    throw new Error("Invalid recurrence — use \"weekly\" or \"monthly\"");
  }
  const scheduledAt = new Date(body.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) throw new Error("Invalid slot — please pick a date and time");
  const booking = addBooking({
    customerId: CUSTOMER_USER,
    workerId: worker.id,
    categoryId: categoryId as Booking["categoryId"],
    serviceId: service.id,
    description,
    addressId,
    scheduledAt: scheduledAt.toISOString(),
    customerNotes: body.customerNotes,
    matchScore: body.matchScore,
    charge,
    recurrence,
  });
  return { booking };
});

route("GET", "/bookings", (req) => {
  const store = getStore();
  const url = new URL(req.url);
  const customerId = url.searchParams.get("customerId");
  const workerId = url.searchParams.get("workerId");
  const status = url.searchParams.get("status");
  let list = store.bookings;
  if (customerId) list = list.filter((b) => b.customerId === customerId);
  if (workerId) list = list.filter((b) => b.workerId === workerId);
  if (status && status !== "all") list = list.filter((b) => b.status === status);
  return { items: list.sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt)) };
});

route("GET", "/bookings/:id", (_req, params) => {
  const store = getStore();
  const booking = bookingById(params.id);
  if (!booking) throw new Error("Booking not found");
  const worker = workerById(booking.workerId);
  const customer = customerById(booking.customerId);
  const review = store.reviews.find((r) => r.bookingId === booking.id) ?? null;
  return { booking, worker, customer, address: customer.addresses.find((a) => a.id === booking.addressId) ?? customer.addresses[0], review };
});

route("POST", "/bookings/:id/messages", (_req, params, body, user) => {
  const booking = bookingById(params.id);
  if (!booking) throw new Error("Booking not found");
  const text = String(body.text ?? "").trim();
  if (!text) throw new Error("Message cannot be empty");
  if (text.length > 500) throw new Error("Message is too long (max 500 characters)");

  const isWorker = user.startsWith("w-");
  const isCustomer = user.startsWith("c-");
  if (!isWorker && !isCustomer) throw new Error("Only the customer or the assigned member can message on this booking");
  if (isWorker && user !== booking.workerId) throw new Error("This booking is assigned to another member");
  if (isCustomer && user !== booking.customerId) throw new Error("This booking belongs to another customer");

  const author = isWorker
    ? { id: user, role: "worker" as const, name: workerById(user).name }
    : { id: user, role: "customer" as const, name: customerById(user).name };
  const message = addBookingMessage(booking, author, text);
  return { message, messages: booking.messages };
});

route("POST", "/bookings/:id/cancel", (_req, params, body) => {
  const booking = bookingById(params.id);
  if (!booking) throw new Error("Booking not found");
  if (["completed", "cancelled"].includes(booking.status)) throw new Error("This booking can no longer be cancelled");
  booking.status = "cancelled";
  booking.paymentStatus = "refunded";
  booking.cancellationReason = body?.reason ?? "Cancelled by customer";
  booking.timeline.push({ id: `ev-${booking.id}-c-${booking.timeline.length}`, at: new Date().toISOString(), label: "Cancelled by customer", detail: body?.reason ?? "", by: customerById(booking.customerId).name });
  /* Cancelling a standing-order occurrence also ends the whole series. */
  if (booking.recurrence) {
    booking.seriesEnded = true;
    booking.timeline.push({
      id: `ev-${booking.id}-so-end-${booking.timeline.length}`,
      at: new Date().toISOString(),
      label: "Standing order ended by customer",
      detail: `No further ${booking.recurrence} visits will be scheduled.`,
      by: customerById(booking.customerId).name,
    });
  }
  notify(booking.workerId, {
    kind: "booking",
    title: "Booking cancelled",
    body: booking.recurrence
      ? `${booking.title} (${booking.reference}) was cancelled by the customer. This also ends the standing order series — no further ${booking.recurrence} visits will be scheduled.`
      : `${booking.title} (${booking.reference}) was cancelled by the customer. The slot is now free.`,
    route: { name: "worker-schedule" },
  });
  audit(`Booking ${booking.reference} cancelled by customer${booking.recurrence ? " — standing order series ended" : ""}`, "Booking", customerById(booking.customerId).name, "customer", "notice");
  return { booking };
});

route("POST", "/bookings/:id/confirm", (_req, params, body) => {
  const booking = bookingById(params.id);
  if (!booking) throw new Error("Booking not found");
  if (booking.status !== "awaiting_confirmation") throw new Error("This booking is not awaiting confirmation");
  confirmBooking(booking, body?.rating ? { rating: body.rating, comment: body.comment ?? "", tags: body.tags ?? [] } : undefined);
  return { booking };
});

route("POST", "/bookings/:id/rate", (_req, params, body) => {
  const store = getStore();
  const booking = bookingById(params.id);
  if (!booking) throw new Error("Booking not found");
  if (booking.status !== "completed") throw new Error("Only completed services can be rated");
  if (store.reviews.some((r) => r.bookingId === booking.id)) throw new Error("This service is already rated");
  const worker = workerById(booking.workerId);
  const review = {
    id: `rev-${booking.id}`,
    bookingId: booking.id,
    customerId: booking.customerId,
    customerName: customerById(booking.customerId).name,
    workerId: booking.workerId,
    rating: body.rating,
    comment: body.comment ?? "",
    tags: body.tags ?? [],
    createdAt: new Date().toISOString(),
  };
  store.reviews.unshift(review);
  booking.timeline.push({ id: `ev-${booking.id}-r-${booking.timeline.length}`, at: review.createdAt, label: "Rated by customer", detail: `${body.rating} / 5`, by: review.customerName });
  const allReviews = store.reviews.filter((r) => r.workerId === booking.workerId);
  const avg = allReviews.reduce((a, r) => a + r.rating, 0) / allReviews.length;
  worker.rating = Math.round((Math.min(5, worker.rating * 0.85 + avg * 0.15) * 10)) / 10;
  worker.reviewCount += 1;
  notify(booking.workerId, {
    kind: "booking",
    title: "New service rating",
    body: `${customerById(booking.customerId).name} rated ${booking.title} ${body.rating} / 5.`,
    route: { name: "worker-dashboard" },
  });
  return { review, workerRating: worker.rating };
});

/* ------------------------------------------------------------------ */
/* Worker                                                              */
/* ------------------------------------------------------------------ */

route("GET", "/worker/overview", (_req, _p, _b, user) => workerOverviewFor(user || WORKER_USER));

route("GET", "/worker/jobs", (_req, _p, _b, user) => {
  const store = getStore();
  const workerId = user || WORKER_USER;
  const mine = store.bookings
    .filter((b) => b.workerId === workerId)
    .sort((a, b) => +new Date(a.scheduledAt) - +new Date(b.scheduledAt));
  return {
    offers: mine.filter((b) => b.status === "pending_acceptance"),
    openRequests: store.openRequests.filter((r) => r.status === "open"),
    scheduled: mine.filter((b) => b.status === "confirmed"),
    active: mine.filter((b) => ["en_route", "arrived", "in_progress"].includes(b.status)),
    awaiting: mine.filter((b) => b.status === "awaiting_confirmation"),
    history: mine
      .filter((b) => ["completed", "declined", "cancelled"].includes(b.status))
      .sort((a, b) => +new Date(b.scheduledAt) - +new Date(a.scheduledAt))
      .slice(0, 20),
    worker: workerById(workerId),
  };
});

route("POST", "/worker/jobs/:id/accept", (_req, params, _b, user) => {
  const store = getStore();
  const workerId = user || WORKER_USER;
  const worker = workerById(workerId);

  /* Open pool request → convert into a confirmed booking */
  if (params.id.startsWith("oj-")) {
    const req = store.openRequests.find((r) => r.id === params.id);
    if (!req) throw new Error("Request no longer available");
    req.status = "offered";
    const service = serviceById(req.categoryId, req.serviceId);
    const booking: Booking = {
      id: `bk-oj-${params.id}`,
      reference: `SG-${String(4000 + parseInt(params.id.slice(3), 10) * 13).slice(-4)}`,
      customerId: req.customerId,
      workerId,
      categoryId: req.categoryId,
      serviceId: req.serviceId,
      title: service?.name ?? req.title,
      description: req.description,
      addressId: customerById(req.customerId).addresses[0].id,
      scheduledAt: req.scheduledAt,
      durationMin: req.durationMin,
      status: "confirmed",
      paymentStatus: "authorized",
      price: req.estimate,
      matchScore: req.matchScore,
      createdAt: new Date().toISOString(),
      checklist: CHECKLISTS[req.categoryId].map((label, i) => ({ id: `chk-${params.id}-${i}`, label, done: false })),
      evidence: [],
      timeline: [
        { id: "ev-0", at: new Date().toISOString(), label: "Request accepted from open pool", detail: `${worker.name} accepted ${req.title}`, by: worker.name },
        { id: "ev-1", at: new Date().toISOString(), label: "Payment authorised", detail: "Held securely until service completion", by: "Platform" },
      ],
    };
    store.bookings.unshift(booking);
    store.openRequests = store.openRequests.filter((r) => r.id !== params.id);
    audit(`Open request ${req.title} claimed by ${worker.name}`, "Job allocation", worker.name, "worker");
    return { booking };
  }

  const booking = bookingById(params.id);
  if (!booking) throw new Error("Booking not found");
  if (booking.status !== "pending_acceptance") throw new Error("This offer is no longer available");
  booking.status = "confirmed";
  booking.timeline.push({ id: `ev-${booking.id}-a-${booking.timeline.length}`, at: new Date().toISOString(), label: "Worker accepted", detail: `${worker.name} accepted the job`, by: worker.name });
  notify(booking.customerId, {
    kind: "booking",
    title: "Booking confirmed",
    body: `${worker.name} has accepted your request — ${booking.title} is confirmed.`,
    route: { name: "customer-booking", params: { bookingId: booking.id } },
  });
  audit(`Worker accepted ${booking.reference}`, "Booking", worker.name, "worker");
  return { booking };
});

route("POST", "/worker/jobs/:id/decline", (_req, params, _b, user) => {
  const store = getStore();
  const workerId = user || WORKER_USER;
  if (params.id.startsWith("oj-")) {
    store.openRequests = store.openRequests.filter((r) => r.id !== params.id);
    return { ok: true };
  }
  const booking = bookingById(params.id);
  if (!booking) throw new Error("Booking not found");
  booking.status = "declined";
  booking.timeline.push({ id: `ev-${booking.id}-d-${booking.timeline.length}`, at: new Date().toISOString(), label: "Declined by worker", by: workerById(workerId).name });
  notify(booking.customerId, {
    kind: "booking",
    title: "Worker unavailable",
    body: `${workerById(workerId).name} is unavailable for ${booking.title}. We will recommend other members.`,
    route: { name: "customer-bookings" },
  });
  return { booking };
});

route("POST", "/bookings/:id/status", (_req, params, body) => {
  const booking = bookingById(params.id);
  if (!booking) throw new Error("Booking not found");
  const status = body.status as BookingStatus;
  if (!["en_route", "arrived", "in_progress"].includes(status)) throw new Error("Invalid status");
  booking.status = status;
  const labels: Record<string, string> = { en_route: "On the way", arrived: "Arrived at location", in_progress: "Service in progress" };
  booking.timeline.push({ id: `ev-${booking.id}-s-${booking.timeline.length}`, at: new Date().toISOString(), label: labels[status], by: workerById(booking.workerId).name });
  if (status !== "in_progress") {
    notify(booking.customerId, {
      kind: "booking",
      title: status === "en_route" ? "Worker on the way" : "Worker has arrived",
      body: `${workerById(booking.workerId).name} — ${booking.title}.`,
      route: { name: "customer-booking", params: { bookingId: booking.id } },
    });
  }
  return { booking };
});

route("POST", "/bookings/:id/checklist", (_req, params, body) => {
  const booking = bookingById(params.id);
  if (!booking) throw new Error("Booking not found");
  const item = booking.checklist.find((c) => c.id === body.itemId);
  if (item) item.done = Boolean(body.done);
  return { booking };
});

route("POST", "/bookings/:id/evidence", (_req, params, body) => {
  const booking = bookingById(params.id);
  if (!booking) throw new Error("Booking not found");
  booking.evidence = booking.evidence.filter((e) => e.phase !== body.phase);
  booking.evidence.push({ phase: body.phase, capturedAt: new Date().toISOString(), label: body.label ?? "" });
  return { booking };
});

route("POST", "/bookings/:id/complete", (_req, params) => {
  const booking = bookingById(params.id);
  if (!booking) throw new Error("Booking not found");
  if (!["in_progress", "arrived", "en_route", "confirmed"].includes(booking.status)) throw new Error("Cannot complete from current status");
  if (booking.checklist.some((c) => !c.done)) throw new Error("Complete all checklist items before finishing");
  if (!booking.evidence.some((e) => e.phase === "before") || !booking.evidence.some((e) => e.phase === "after")) {
    throw new Error("Before and after evidence photos are required");
  }
  settleBooking(booking);
  return { booking };
});

route("GET", "/worker/earnings", (_req, _p, _b, user) => {
  const store = getStore();
  const workerId = user || WORKER_USER;
  const txns = store.transactions.filter((t) => t.workerId === workerId).sort((a, b) => +new Date(b.date) - +new Date(a.date));
  const now = Date.now();
  const week = txns.filter((t) => now - +new Date(t.date) < 7 * 86400000);
  const month = txns.filter((t) => now - +new Date(t.date) < 30 * 86400000);
  const welfare = welfareProfileFor(workerId);
  const recurring = recurringMonthlyFor(workerId);

  /* Weekly series for the last 8 weeks */
  const weeklySeries = Array.from({ length: 8 }, (_, i) => {
    const weekStart = now - (8 - i) * 7 * 86400000;
    const label = new Date(weekStart).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const value = txns.filter((t) => {
      const d = +new Date(t.date);
      return d >= weekStart && d < weekStart + 7 * 86400000;
    }).reduce((a, t) => a + t.net, 0);
    return { label, value };
  });

  return {
    summary: {
      availableBalance: txns.filter((t) => t.status === "credited").reduce((a, t) => a + t.net, 0),
      pendingSettlement: store.bookings
        .filter((b) => b.workerId === workerId && b.status === "awaiting_confirmation")
        .reduce((a, b) => a + b.price.workerNetPayout, 0),
      weekEarnings: week.reduce((a, t) => a + t.net, 0),
      monthEarnings: month.reduce((a, t) => a + t.net, 0),
      completedJobs: txns.length,
      avgPerJob: txns.length ? Math.round(txns.reduce((a, t) => a + t.net, 0) / txns.length) : 0,
      welfareYtd: welfare.ytdContribution,
      tdsYtd: txns.filter((t) => now - +new Date(t.date) < 365 * 86400000).reduce((a, t) => a + t.tds, 0),
      grossMonth: month.reduce((a, t) => a + t.gross, 0),
      platformFeesMonth: month.reduce((a, t) => a + t.platformFee, 0),
      welfareMonth: month.reduce((a, t) => a + t.welfareContribution, 0),
      /* Standing orders — estimated monthly net from active series (weekly ×4.33, monthly ×1). */
      recurringMonthly: recurring.recurringMonthly,
      standingOrders: recurring.standingOrders,
    },
    weeklySeries,
    transactions: txns.slice(0, 30),
    payouts: store.payouts.filter((p) => p.workerId === workerId),
    rates: DEFAULT_RATES,
    nextPayoutDate: new Date(now + 86400000).toISOString(),
  };
});

route("GET", "/worker/welfare", (_req, _p, _b, user) => welfareProfileFor(user || WORKER_USER));

route("POST", "/worker/welfare/claims", (_req, _p, body, user) => {
  const store = getStore();
  const claim = {
    id: `clm-live-${store.counters.claim++}`,
    type: body.type,
    submittedAt: new Date().toISOString(),
    amount: Number(body.amount) || 0,
    status: "submitted" as const,
    description: body.description ?? "",
    reference: `WCL-${1100 + store.counters.claim}`,
  };
  const profile = welfareProfileFor(user || WORKER_USER);
  profile.claims.unshift(claim);
  /* also persist into a claims store so it survives re-derivation */
  (store as any).extraClaims = [...((store as any).extraClaims ?? []), { ...claim, workerId: user || WORKER_USER }];
  notify(user || WORKER_USER, {
    kind: "support",
    title: "Welfare claim submitted",
    body: `${claim.type} (₹${claim.amount.toLocaleString("en-IN")}) received. Reference ${claim.reference}.`,
    route: { name: "worker-welfare" },
  });
  audit(`Welfare claim ${claim.reference} submitted`, "Welfare claim", workerById(user || WORKER_USER).name, "worker");
  return { claim };
});

route("GET", "/worker/schedule", (_req, _p, _b, user) => {
  const store = getStore();
  const workerId = user || WORKER_USER;
  const mine = store.bookings.filter((b) => b.workerId === workerId && !["cancelled", "declined"].includes(b.status));
  return { bookings: mine, worker: workerById(workerId) };
});

route("GET", "/worker/availability", (_req, _p, _b, user) => workerById(user || WORKER_USER).availability);

route("PUT", "/worker/availability", (_req, _p, body, user) => {
  const worker = workerById(user || WORKER_USER);
  worker.availability = body.availability as WorkerAvailabilitySlot[];
  audit("Availability updated", "Availability", worker.name, "worker");
  return { availability: worker.availability };
});

route("GET", "/worker/verification", (_req, _p, _b, user) => {
  const worker = workerById(user || WORKER_USER);
  return { worker, verification: worker.verification, certifications: worker.certifications };
});

route("GET", "/worker/skills", (_req, _p, _b, user) => {
  const store = getStore();
  return { courses: store.courses, credits: store.courses.filter((c) => c.status === "completed").reduce((a, c) => a + c.creditValue, 0) };
});

/* ------------------------------------------------------------------ */
/* Governance                                                          */
/* ------------------------------------------------------------------ */

route("GET", "/governance", () => getStore().governance);

route("POST", "/governance/vote", (_req, _p, body, user) => {
  const result = voteOnProposal(body.proposalId, body.vote, user || WORKER_USER);
  if (!result) throw new Error("Vote could not be recorded — you may have already voted or the proposal is closed");
  notify(ADMIN_USER, {
    kind: "governance",
    title: "New vote recorded",
    body: `${workerById(user || WORKER_USER).name} voted on ${result.code}.`,
    route: { name: "admin-governance" },
  });
  return { proposal: result };
});

/* ------------------------------------------------------------------ */
/* Support                                                             */
/* ------------------------------------------------------------------ */

route("GET", "/support/tickets", (_req, _p, _b, user) => {
  const store = getStore();
  if (user === ADMIN_USER) return { tickets: store.tickets };
  const customer = store.customers.find((c) => c.id === user);
  if (customer) return { tickets: store.tickets.filter((t) => t.raisedByRole === "customer" && t.raisedByName === customer.name) };
  const worker = store.workers.find((w) => w.id === user);
  if (worker) return { tickets: store.tickets.filter((t) => t.raisedByRole === "worker" && t.raisedByName === worker.name) };
  return { tickets: [] };
});

route("POST", "/support/tickets", (_req, _p, body, user) => {
  const store = getStore();
  const isWorker = body.raisedByRole === "worker";
  const name = isWorker ? workerById(user || WORKER_USER).name : customerById(user || CUSTOMER_USER).name;
  const ticket = createTicket({
    raisedByRole: isWorker ? "worker" : "customer",
    raisedByName: name,
    type: body.type,
    category: body.category,
    subject: body.subject,
    description: body.description,
    relatedBookingRef: body.relatedBookingRef,
  });
  return { ticket };
});

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

route("GET", "/admin/overview", () => {
  const store = getStore();
  const now = Date.now();
  const todayStr = new Date().toDateString();
  const workers = store.workers;
  const verifiedWorkers = workers.filter((w) => w.status === "verified");
  const bookingsToday = store.bookings.filter((b) => new Date(b.scheduledAt).toDateString() === todayStr);
  const completedToday = store.bookings.filter((b) => b.status === "completed" && b.timeline.some((e) => e.label === "Service completed" && new Date(e.at).toDateString() === todayStr));
  const openTickets = store.tickets.filter((t) => !["resolved"].includes(t.status));

  const bookingsTrend = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now - (13 - i) * 86400000);
    const count = store.bookings.filter((b) => new Date(b.scheduledAt).toDateString() === d.toDateString()).length;
    return { label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), value: count + 6 };
  });

  const categoryDemand = categories().map((c) => ({
    label: c.name,
    value: store.bookings.filter((b) => b.categoryId === c.id && now - +new Date(b.createdAt) < 30 * 86400000).length + 18,
  }));

  const quality = categories().map((c) => {
    const catWorkers = verifiedWorkers.filter((w) => w.category === c.id);
    const avg = catWorkers.length ? catWorkers.reduce((a, w) => a + w.rating, 0) / catWorkers.length : 0;
    return { label: c.name, value: Math.round(avg * 10) / 10 };
  });

  const localityMap = new Map<string, { bookings: number; workers: number }>();
  for (const w of verifiedWorkers) {
    const entry = localityMap.get(w.locality) ?? { bookings: 0, workers: 0 };
    entry.workers += 1;
    localityMap.set(w.locality, entry);
  }
  for (const b of store.bookings) {
    const loc = customerById(b.customerId).locality;
    const entry = localityMap.get(loc) ?? { bookings: 0, workers: 0 };
    entry.bookings += 1;
    localityMap.set(loc, entry);
  }
  const geographic = [...localityMap.entries()]
    .map(([locality, v]) => ({
      locality,
      bookings: v.bookings,
      workers: v.workers,
      avgRating: Math.round((4.4 + (v.bookings % 5) * 0.1) * 10) / 10,
    }))
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 8);

  const welfarePool = store.transactions.reduce((a, t) => a + t.welfareContribution, 0) + 412000;

  /* Active standing-order series — distinct seriesId with a non-cancelled future occurrence. */
  const standingSeries = new Set<string>();
  for (const b of store.bookings) {
    if (!b.recurrence || !b.seriesId || ["cancelled", "declined", "completed"].includes(b.status)) continue;
    if (new Date(b.scheduledAt).getTime() <= now) continue;
    standingSeries.add(b.seriesId);
  }

  return {
    kpis: {
      activeWorkers: verifiedWorkers.length,
      pendingVerifications: workers.filter((w) => ["pending", "under_review", "needs_action"].includes(w.status)).length,
      activeCustomers: store.customers.length,
      bookingsToday: bookingsToday.length,
      completedToday: completedToday.length,
      openDisputes: openTickets.filter((t) => ["dispute", "complaint", "escalated"].some((k) => t.type === k || t.status === k)).length,
      transactionVolumeToday: bookingsToday.filter((b) => b.paymentStatus !== "refunded").reduce((a, b) => a + b.price.customerTotal, 0),
      welfarePoolTotal: welfarePool,
      avgRating: Math.round((verifiedWorkers.reduce((a, w) => a + w.rating, 0) / verifiedWorkers.length) * 10) / 10,
      csat: 89,
      onTimeRate: Math.round(verifiedWorkers.reduce((a, w) => a + w.onTimeRate, 0) / verifiedWorkers.length),
      cancellationRate: Math.round((store.bookings.filter((b) => b.status === "cancelled").length / store.bookings.length) * 100),
    },
    standingOrders: standingSeries.size,
    bookingsTrend,
    categoryDemand,
    quality,
    geographic,
    alerts: [
      { id: "al-1", severity: "critical" as const, title: "Escalated dispute awaiting action", detail: "SUP-5846 — 2 BHK vs 1 BHK billing dispute (Manish Agarwal).", action: "Review case", route: "admin-disputes" },
      { id: "al-2", severity: "warning" as const, title: "Capacity gap on Saturday evening", detail: "Forecast predicts a 12-worker gap for electrical services, 4–8 PM.", action: "Open forecast", route: "admin-forecast" },
      { id: "al-3", severity: "warning" as const, title: "Verification needs action", detail: "Ganesh Salunke's address proof expired — fresh proof requested 4 days ago.", action: "Open queue", route: "admin-verifications" },
      { id: "al-4", severity: "info" as const, title: "Payout batch processing", detail: "₹4.2L for 84 members settles tomorrow evening — finance review pending.", action: "Open finance", route: "admin-finance" },
    ],
    recentBookings: store.bookings.slice(0, 8),
    workerUtilization: categories().map((c) => {
      const catWorkers = verifiedWorkers.filter((w) => w.category === c.id);
      const weekJobs = store.bookings.filter((b) => b.categoryId === c.id && now - +new Date(b.scheduledAt) < 7 * 86400000 && b.status === "completed").length;
      return { label: c.name, value: catWorkers.length ? Math.round(((weekJobs + catWorkers.length * 4) / (catWorkers.length * 6)) * 100) : 0 };
    }),
  };
});

route("GET", "/admin/forecast", () => getStore().forecast);

route("GET", "/admin/workers", (req) => {
  const store = getStore();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  let workers = store.workers;
  if (status && status !== "all") workers = workers.filter((w) => w.status === status);
  return {
    items: workers.map((w) => ({
      ...w,
      weekJobs: store.bookings.filter((b) => b.workerId === w.id && Date.now() - +new Date(b.scheduledAt) < 7 * 86400000 && b.status === "completed").length,
      weekEarnings: store.transactions.filter((t) => t.workerId === w.id && Date.now() - +new Date(t.date) < 7 * 86400000).reduce((a, t) => a + t.net, 0),
    })),
  };
});

route("GET", "/admin/verifications", () => {
  const store = getStore();
  const queue = store.workers
    .filter((w) => ["pending", "under_review", "needs_action", "rejected"].includes(w.status))
    .map((w) => ({ worker: w, daysInQueue: Math.max(1, Math.round((Date.now() - +new Date(w.memberSince)) / 86400000)) }));
  return { queue, verifiedCount: store.workers.filter((w) => w.status === "verified").length };
});

route("POST", "/admin/verifications/:workerId/decision", (_req, params, body) => {
  const store = getStore();
  const worker = workerById(params.workerId);
  if (!worker) throw new Error("Worker not found");
  const decision = body.decision as "approved" | "rejected" | "needs_action";
  if (decision === "approved") {
    worker.status = "verified";
    worker.verification.forEach((v) => {
      if (v.status !== "rejected") v.status = "verified";
    });
    worker.cooperativeMemberId = `SGW-0${170 + store.workers.length}`;
    notify(worker.id, {
      kind: "verification",
      title: "Verification approved",
      body: "Welcome to the cooperative. Your membership is active — you can now receive job offers.",
      route: { name: "worker-verification" },
    });
  } else if (decision === "rejected") {
    worker.status = "rejected";
    notify(worker.id, {
      kind: "verification",
      title: "Verification update",
      body: body.note ?? "Your application could not be approved at this stage.",
      route: { name: "worker-verification" },
    });
  } else {
    worker.status = "needs_action";
    notify(worker.id, {
      kind: "verification",
      title: "Verification needs action",
      body: body.note ?? "Please update the requested documents.",
      route: { name: "worker-verification" },
    });
  }
  audit(`Verification ${decision} — ${worker.name}`, "Verification record", "Kiran Rao", "admin", decision === "rejected" ? "warning" : "info");
  return { worker };
});

route("GET", "/admin/bookings", (req) => {
  const store = getStore();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  let items = store.bookings;
  if (status && status !== "all") items = items.filter((b) => b.status === status);
  return {
    items: [...items]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .map((b) => ({ booking: b, customerName: customerById(b.customerId).name, workerName: workerById(b.workerId).name })),
  };
});

route("GET", "/admin/disputes", () => {
  const store = getStore();
  return { items: store.tickets };
});

route("POST", "/admin/disputes/:ticketId/resolve", (_req, params, body) => {
  const store = getStore();
  const ticket = store.tickets.find((t) => t.id === params.ticketId);
  if (!ticket) throw new Error("Ticket not found");
  ticket.status = "resolved";
  ticket.resolution = body.resolution;
  ticket.updatedAt = new Date().toISOString();
  ticket.messages.push({ id: `msg-${ticket.id}-res`, at: new Date().toISOString(), author: "Kiran Rao (Operations)", body: body.resolution });
  const targetUser = ticket.raisedByRole === "worker" ? store.workers.find((w) => w.name === ticket.raisedByName)?.id : store.customers.find((c) => c.name === ticket.raisedByName)?.id;
  if (targetUser) {
    notify(targetUser, {
      kind: "support",
      title: `Ticket ${ticket.reference} resolved`,
      body: body.resolution.slice(0, 140),
      route: { name: ticket.raisedByRole === "worker" ? "worker-support" : "customer-support" },
    });
  }
  audit(`Resolved ticket ${ticket.reference}`, "Support ticket", "Kiran Rao", "admin");
  return { ticket };
});

route("GET", "/admin/finance", () => {
  const store = getStore();
  const now = Date.now();
  const monthTxns = store.transactions.filter((t) => now - +new Date(t.date) < 30 * 86400000);
  const revenueSeries = Array.from({ length: 8 }, (_, i) => {
    const weekStart = now - (8 - i) * 7 * 86400000;
    const label = new Date(weekStart).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const value = store.transactions
      .filter((t) => {
        const d = +new Date(t.date);
        return d >= weekStart && d < weekStart + 7 * 86400000;
      })
      .reduce((a, t) => a + t.platformFee, 0);
    return { label, value: value + 18400 };
  });
  const welfarePool = store.transactions.reduce((a, t) => a + t.welfareContribution, 0) + 412000;
  return {
    revenueSeries,
    commissionMonth: monthTxns.reduce((a, t) => a + t.platformFee, 0) + 186500,
    gstCollectedMonth: monthTxns.reduce((a, t) => a + Math.round((t.platformFee * DEFAULT_RATES.gstPct) / 100), 0) + 33500,
    welfarePoolMonth: monthTxns.reduce((a, t) => a + t.welfareContribution, 0) + 91200,
    welfarePoolTotal: welfarePool,
    payoutsPending: 418700,
    payoutsProcessedMonth: 1265400,
    tdsRemittedMonth: monthTxns.reduce((a, t) => a + t.tds, 0) + 21400,
    disputeHolds: 4983,
    reconciliation: [
      { label: "Customer payments received", amount: 2418600, expected: 2418600, status: "matched" as const },
      { label: "Worker payouts settled", amount: 2176700, expected: 2176700, status: "matched" as const },
      { label: "Welfare fund credits", amount: 91200, expected: 91200, status: "matched" as const },
      { label: "GST + TDS payable", amount: 54900, expected: 54900, status: "matched" as const },
      { label: "Dispute holds", amount: 4983, expected: 4200, status: "variance" as const },
    ],
  };
});

route("GET", "/admin/governance", () => {
  const store = getStore();
  return {
    ...store.governance,
    participationSeries: [
      { label: "Q4 FY25", value: 58 },
      { label: "Q1 FY26", value: 66 },
      { label: "Q2 FY26", value: 71 },
      { label: "Current", value: store.governance.activeProposals[0]?.participationPct ?? 64 },
    ],
  };
});

route("POST", "/admin/governance/proposals", (_req, _p, body) => {
  const store = getStore();
  const proposal = {
    id: `gp-live-${store.governance.activeProposals.length + 1}`,
    code: `PRO-2026-0${20 + store.governance.activeProposals.length}`,
    title: body.title,
    summary: body.summary ?? "",
    description: body.description ?? "",
    status: "active" as const,
    category: body.category ?? "General",
    openedAt: new Date().toISOString(),
    closesAt: new Date(Date.now() + 14 * 86400000).toISOString(),
    participationPct: 0,
    eligibleMembers: 216,
    votes: { approve: 0, reject: 0, abstain: 0 },
    quorumPct: 50,
    proposedBy: "Kiran Rao (Operations)",
  };
  store.governance.activeProposals.push(proposal);
  for (const w of store.workers.filter((w) => w.status === "verified")) {
    notify(w.id, {
      kind: "governance",
      title: "Cooperative vote open",
      body: `${proposal.code} — ${proposal.title}`,
      route: { name: "worker-governance" },
    });
  }
  audit(`Published proposal ${proposal.code} for member voting`, "Governance proposal", "Kiran Rao", "admin", "notice");
  return { proposal };
});

route("GET", "/admin/categories", () => {
  const store = getStore();
  const now = Date.now();
  return {
    categories: categories().map((c) => ({
      ...c,
      activeWorkers: store.workers.filter((w) => w.category === c.id && w.status === "verified").length,
      bookings30d: store.bookings.filter((b) => b.categoryId === c.id && now - +new Date(b.createdAt) < 30 * 86400000).length,
      avgRating: (() => {
        const ws = store.workers.filter((w) => w.category === c.id && w.status === "verified");
        return ws.length ? Math.round((ws.reduce((a, w) => a + w.rating, 0) / ws.length) * 10) / 10 : 0;
      })(),
    })),
  };
});

route("PUT", "/admin/categories/:categoryId/services/:serviceId", (_req, params, body) => {
  const cat = categories().find((c) => c.id === params.categoryId);
  const svc = cat?.services.find((s) => s.id === params.serviceId);
  if (!svc) throw new Error("Service not found");
  svc.basePrice = Number(body.basePrice) || svc.basePrice;
  audit(`Category rate updated — ${cat!.name}: ${svc.name} → ₹${svc.basePrice}`, "Service category", "Kiran Rao", "admin", "notice");
  return { service: svc };
});

route("GET", "/admin/audit", () => ({ items: getStore().audit }));

route("GET", "/admin/policies", () => getStore().policy);

route("PUT", "/admin/policies", (_req, _p, body) => {
  const policy = updatePolicy(body, "Kiran Rao");
  for (const w of getStore().workers.filter((w) => w.status === "verified")) {
    notify(w.id, {
      kind: "system",
      title: "Platform policy updated",
      body: `Commission ${policy.commissionPct}% · welfare ${policy.welfarePct}%. Full details in your earnings statement.`,
      route: { name: "worker-earnings" },
    });
  }
  return { policy };
});

/* ------------------------------------------------------------------ */

export const runtime = "nodejs";
