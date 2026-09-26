import type {
  AppNotification,
  AuditEntry,
  Booking,
  BookingMessage,
  BookingRecurrence,
  Customer,
  GovernanceData,
  GovernanceProposal,
  OpenJobRequest,
  Payout,
  PlatformPolicy,
  Review,
  ServiceCategory,
  SkillCourse,
  SupportTicket,
  Transaction,
  TrainingCertificate,
  TrainingCourse,
  TrainingEnrollment,
  AdminTrainingData,
  Worker,
  WorkerAvailabilitySlot,
  WorkerOverview,
  WorkerTrainingData,
  WelfareProfile,
} from "@/lib/types";
import { computePrice } from "@/lib/rates";
import { CATEGORIES, CHECKLISTS, serviceById } from "./catalog";
import {
  CUSTOMERS,
  SEED_AUDIT,
  SEED_BOOKINGS,
  SEED_COURSES,
  SEED_NOTIFICATIONS,
  SEED_PAYOUTS,
  SEED_POLICY,
  SEED_REVIEWS,
  SEED_TICKETS,
  SEED_TRANSACTIONS,
  TRAINING_COURSES,
  TRAINING_ENROLLMENTS,
  WORKERS,
} from "./seed";
import { buildGovernance, buildWelfareProfile } from "./seed-context";
import { generateForecast } from "./forecast";
import { recommend } from "./matching";

/**
 * In-memory store backing the mock API. Seeded once per server process.
 * All mutations (bookings, votes, claims, verification decisions…) operate
 * on this store so the whole demo session stays consistent across roles.
 */

interface Store {
  workers: Worker[];
  customers: Customer[];
  bookings: Booking[];
  reviews: Review[];
  transactions: Transaction[];
  payouts: Payout[];
  notifications: AppNotification[];
  tickets: SupportTicket[];
  audit: AuditEntry[];
  courses: SkillCourse[];
  trainingCourses: TrainingCourse[];
  trainingEnrollments: TrainingEnrollment[];
  policy: PlatformPolicy;
  governance: GovernanceData;
  forecast: ReturnType<typeof generateForecast>;
  savedWorkers: string[]; // customer's shortlist
  openRequests: OpenJobRequest[];
  counters: { booking: number; ticket: number; claim: number; notification: number; audit: number; training: number; certificate: number };
}

const globalRef = globalThis as unknown as { __sahyogStore?: Store; __sahyogSeedVersion?: number };

/** Bump whenever seed data changes — a stale store from a previous HMR cycle reseeds automatically.
 *  13 = training-hub seed + reseeds away task 6-b's live E2E test enrolments. */
const SEED_VERSION = 14;

function seedStore(): Store {
  const store: Store = {
    workers: structuredClone(WORKERS),
    customers: structuredClone(CUSTOMERS),
    bookings: structuredClone(SEED_BOOKINGS),
    reviews: structuredClone(SEED_REVIEWS),
    transactions: structuredClone(SEED_TRANSACTIONS),
    payouts: structuredClone(SEED_PAYOUTS),
    notifications: structuredClone(SEED_NOTIFICATIONS),
    tickets: structuredClone(SEED_TICKETS),
    audit: structuredClone(SEED_AUDIT),
    courses: structuredClone(SEED_COURSES),
    trainingCourses: structuredClone(TRAINING_COURSES),
    trainingEnrollments: structuredClone(TRAINING_ENROLLMENTS),
    policy: structuredClone(SEED_POLICY),
    governance: buildGovernance(),
    forecast: generateForecast(),
    savedWorkers: ["w-meena", "w-priya"],
    openRequests: [],
    /* live training ids/certificates continue past the seeded range (SCT-2025-041…047) */
    counters: { booking: 1, ticket: 100, claim: 100, notification: 100, audit: 100, training: 100, certificate: 50 },
  };

  /* Open job request pool for the worker (platform-routed demand) */
  const now = Date.now();
  const mkRequest = (
    id: string,
    title: string,
    categoryId: OpenJobRequest["categoryId"],
    serviceId: string,
    description: string,
    locality: string,
    distanceKm: number,
    inDays: number,
    hour: number,
    charge: number,
  ): OpenJobRequest => {
    const when = new Date(now + inDays * 86400000);
    when.setHours(hour, 0, 0, 0);
    return {
      id,
      title,
      categoryId,
      serviceId,
      description,
      locality,
      distanceKm,
      scheduledAt: when.toISOString(),
      durationMin: serviceById(categoryId, serviceId)?.durationMin ?? 60,
      estimate: computePrice(charge),
      matchScore: 0,
      matchFactors: [],
      postedAt: new Date(now - 2 * 3600000).toISOString(),
      customerId: "c-rohan",
      status: "open",
    };
  };

  const priya = store.workers.find((w) => w.id === "w-priya")!;
  const scoreFor = (req: OpenJobRequest) =>
    recommend([priya], {
      categoryId: req.categoryId,
      serviceId: req.serviceId,
      scheduledAt: new Date(req.scheduledAt),
      customerLocality: req.locality,
      serviceCharge: req.estimate.serviceCharge,
    })[0];

  const pool = [
    mkRequest("oj-1", "Ceiling fan installation — master bedroom", "electrical", "svc-e1", "New fan to be installed; old one will be removed. Ladder available on site.", "Kothrud", 1.2, 0, 18, 599),
    mkRequest("oj-2", "Switchboard replacement — 2 rooms", "electrical", "svc-e2", "Two old switchboards to be replaced with new modular boards. Materials on site.", "Warje", 2.3, 1, 11, 950),
    mkRequest("oj-3", "Full wiring inspection — 2 BHK", "electrical", "svc-e4", "Pre-monsoon inspection; earthing check and written safety summary needed.", "Baner", 5.4, 2, 17, 1250),
  ];

  store.openRequests = pool.map((r) => {
    const rec = scoreFor(r);
    return { ...r, matchScore: rec.score, matchFactors: rec.factors, estimate: rec.estimatedPrice };
  });

  return store;
}

export function getStore(): Store {
  if (!globalRef.__sahyogStore || globalRef.__sahyogSeedVersion !== SEED_VERSION) {
    globalRef.__sahyogStore = seedStore();
    globalRef.__sahyogSeedVersion = SEED_VERSION;
  }
  return globalRef.__sahyogStore;
}

/* ------------------------------------------------------------------ */
/* Store helpers used by handlers                                      */
/* ------------------------------------------------------------------ */

const DAY = 86400000;

export function notify(userId: string, n: Omit<AppNotification, "id" | "userId" | "createdAt" | "read">) {
  const store = getStore();
  store.notifications.unshift({
    ...n,
    id: `nt-live-${store.counters.notification++}`,
    userId,
    createdAt: new Date().toISOString(),
    read: false,
  });
}

export function audit(action: string, entity: string, actor: string, actorRole: AuditEntry["actorRole"], severity: AuditEntry["severity"] = "info") {
  getStore().audit.unshift({
    id: `au-live-${getStore().counters.audit++}`,
    at: new Date().toISOString(),
    actor,
    actorRole,
    action,
    entity,
    severity,
  });
}

export const CUSTOMER_USER = "c-ananya";
export const WORKER_USER = "w-priya";
export const ADMIN_USER = "u-admin";

export function customerById(id: string) {
  return getStore().customers.find((c) => c.id === id)!;
}
export function workerById(id: string) {
  return getStore().workers.find((w) => w.id === id)!;
}
export function bookingById(id: string) {
  return getStore().bookings.find((b) => b.id === id);
}

/** Append a message to the booking-scoped customer↔worker thread. */
export function addBookingMessage(
  booking: Booking,
  author: { id: string; role: "customer" | "worker"; name: string },
  text: string,
): BookingMessage {
  const message: BookingMessage = {
    id: `msg-${booking.id}-${(booking.messages ?? []).length + 1}`,
    authorRole: author.role,
    authorName: author.name,
    text: text.trim(),
    at: new Date().toISOString(),
  };
  booking.messages = [...(booking.messages ?? []), message];

  /* notify the other party */
  const recipient = author.role === "customer" ? booking.workerId : booking.customerId;
  const routeName = author.role === "customer" ? "worker-job" : "customer-booking";
  notify(recipient, {
    kind: "booking",
    title: `New message from ${author.name}`,
    body: `${booking.title} — “${text.trim().slice(0, 70)}${text.trim().length > 70 ? "…" : ""}”`,
    route: { name: routeName, params: { bookingId: booking.id } },
  });
  return message;
}

export function addBooking(input: {
  customerId: string;
  workerId: string;
  categoryId: Booking["categoryId"];
  serviceId: string;
  description: string;
  addressId: string;
  scheduledAt: string;
  customerNotes?: string;
  matchScore?: number;
  charge: number;
  /** Standing-order frequency; absent = one-time booking. */
  recurrence?: BookingRecurrence;
}): Booking {
  const store = getStore();
  const n = store.counters.booking++;
  const id = `bk-9${String(n).padStart(3, "0")}`;
  const reference = `SG-${String(3000 + n * 7).slice(-4)}`;
  const seriesId = input.recurrence ? `so-9${String(n).padStart(3, "0")}` : undefined;
  const customer = customerById(input.customerId);
  const worker = workerById(input.workerId);
  const service = serviceById(input.categoryId, input.serviceId);
  const price = computePrice(input.charge);

  const booking: Booking = {
    id,
    reference,
    customerId: input.customerId,
    workerId: input.workerId,
    categoryId: input.categoryId,
    serviceId: input.serviceId,
    title: service?.name ?? "Service request",
    description: input.description,
    addressId: input.addressId,
    scheduledAt: input.scheduledAt,
    durationMin: service?.durationMin ?? 60,
    status: "pending_acceptance",
    paymentStatus: "authorized",
    price,
    matchScore: input.matchScore,
    createdAt: new Date().toISOString(),
    checklist: CHECKLISTS[input.categoryId].map((label, i) => ({ id: `chk-${id}-${i}`, label, done: false })),
    evidence: [],
    timeline: [
      { id: `ev-${id}-0`, at: new Date().toISOString(), label: "Request created", detail: `${customer.name} · ${service?.name ?? input.categoryId}`, by: customer.name },
      { id: `ev-${id}-1`, at: new Date().toISOString(), label: "Payment authorised", detail: "Held securely until service completion", by: "Platform" },
    ],
    customerNotes: input.customerNotes,
    recurrence: input.recurrence,
    seriesId,
    occurrenceIndex: input.recurrence ? 1 : undefined,
  };
  if (input.recurrence) {
    booking.timeline.push({
      id: `ev-${id}-so`,
      at: new Date().toISOString(),
      label: "Standing order created",
      detail: `${input.recurrence === "weekly" ? "Weekly" : "Monthly"} — the next visit is scheduled automatically after each completed service`,
      by: customer.name,
    });
  }
  store.bookings.unshift(booking);

  notify(input.workerId, {
    kind: "job",
    title: input.recurrence ? "New standing-order job offer" : "New job offer",
    body: input.recurrence
      ? `${service?.name ?? "Service request"} at ${customer.locality} — ${new Date(input.scheduledAt).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}. ${input.recurrence === "weekly" ? "Weekly" : "Monthly"} standing order — reliable repeat income. Match ${input.matchScore ?? 90}%.`
      : `${service?.name ?? "Service request"} at ${customer.locality} — ${new Date(input.scheduledAt).toLocaleString("en-IN", { weekday: "short", hour: "numeric", minute: "2-digit" })}. Match ${input.matchScore ?? 90}%.`,
    route: { name: "worker-jobs" },
  });
  audit(`New booking ${reference} routed to ${worker.name} (${input.matchScore ?? 90}% match)${input.recurrence ? " — standing order" : ""}`, "Booking", customer.name, "customer");
  return booking;
}

export function settleBooking(booking: Booking) {
  /* Completion + payment settlement + welfare contribution + review prompt */
  const store = getStore();
  booking.status = "awaiting_confirmation";
  booking.timeline.push({
    id: `ev-${booking.id}-done-${booking.timeline.length}`,
    at: new Date().toISOString(),
    label: "Service completed",
    detail: "Checklist and evidence recorded",
    by: workerById(booking.workerId).name,
  });

  notify(booking.customerId, {
    kind: "booking",
    title: "Service completed",
    body: `${booking.title} by ${workerById(booking.workerId).name} is complete. Please confirm to settle the payment.`,
    route: { name: "customer-booking", params: { bookingId: booking.id } },
  });
  audit(`Service completed for ${booking.reference}`, "Booking", workerById(booking.workerId).name, "worker");
}

export function confirmBooking(booking: Booking, rating?: { rating: number; comment: string; tags: string[] }) {
  const store = getStore();
  booking.status = "completed";
  booking.paymentStatus = "settled";
  booking.timeline.push({
    id: `ev-${booking.id}-settle-${booking.timeline.length}`,
    at: new Date().toISOString(),
    label: "Payment settled to worker",
    detail: "Full breakdown available in the worker's earnings",
    by: "Platform",
  });

  const txn: Transaction = {
    id: `txn-${booking.id}`,
    bookingId: booking.id,
    bookingRef: booking.reference,
    workerId: booking.workerId,
    date: new Date().toISOString(),
    serviceTitle: booking.title,
    gross: booking.price.workerGross,
    platformFee: booking.price.platformFee,
    welfareContribution: booking.price.welfareContribution,
    tds: booking.price.workerTds,
    net: booking.price.workerNetPayout,
    status: "credited",
  };
  store.transactions.unshift(txn);

  if (rating) {
    const review: Review = {
      id: `rev-${booking.id}`,
      bookingId: booking.id,
      customerId: booking.customerId,
      customerName: customerById(booking.customerId).name,
      workerId: booking.workerId,
      rating: rating.rating,
      comment: rating.comment,
      tags: rating.tags,
      createdAt: new Date().toISOString(),
    };
    store.reviews.unshift(review);
    booking.timeline.push({
      id: `ev-${booking.id}-rate-${booking.timeline.length}`,
      at: review.createdAt,
      label: "Rated by customer",
      detail: `${rating.rating} / 5`,
      by: review.customerName,
    });
    /* Recompute worker's public rating from her review history (lifetime baseline + reviews) */
    const w = workerById(booking.workerId);
    const allReviews = store.reviews.filter((r) => r.workerId === booking.workerId);
    const avg = allReviews.reduce((a, r) => a + r.rating, 0) / allReviews.length;
    w.rating = Math.round(Math.min(5, w.rating * 0.85 + avg * 0.15) * 10) / 10;
    w.reviewCount += 1;
    w.completedJobs += 1;
  }

  notify(booking.workerId, {
    kind: "payment",
    title: "Payment settled",
    body: `₹${booking.price.workerNetPayout} for ${booking.title} (${booking.reference}) has been added to your available earnings. Welfare contribution ₹${booking.price.welfareContribution} credited to your fund.`,
    route: { name: "worker-earnings" },
  });
  audit(`Payment settled for ${booking.reference} — worker net ₹${booking.price.workerNetPayout}`, "Payment", "Platform", "admin");

  /* Standing orders: each completed occurrence automatically schedules the next one. */
  if (booking.recurrence) scheduleNextOccurrence(booking);
}

/* ------------------------------------------------------------------ */
/* Standing orders — recurrence chain                                   */
/* ------------------------------------------------------------------ */

/** Days added per recurrence frequency (same time-of-day is preserved). */
export const RECURRENCE_DAYS: Record<BookingRecurrence, number> = { weekly: 7, monthly: 30 };

/**
 * When a recurring booking completes, the cooperative schedules the next
 * occurrence automatically — same member, same rate, same slot time. The
 * member has priority and must accept to confirm; payment is pre-authorised.
 * Idempotent: never spawns a second occurrence for the same completed visit.
 */
function scheduleNextOccurrence(booking: Booking): Booking | null {
  if (!booking.recurrence || booking.seriesEnded) return null;
  const store = getStore();
  const nextIndex = (booking.occurrenceIndex ?? 1) + 1;
  if (store.bookings.some((b) => b.seriesId === booking.seriesId && b.occurrenceIndex === nextIndex)) return null;

  const n = store.counters.booking++;
  const id = `bk-9${String(n).padStart(3, "0")}`;
  const reference = `SG-${String(3000 + n * 7).slice(-4)}`;
  const nextAt = new Date(+new Date(booking.scheduledAt) + RECURRENCE_DAYS[booking.recurrence] * 86400000);
  const now = new Date().toISOString();
  const customer = customerById(booking.customerId);
  const worker = workerById(booking.workerId);
  const whenLabel = nextAt.toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  const next: Booking = {
    id,
    reference,
    customerId: booking.customerId,
    workerId: booking.workerId,
    categoryId: booking.categoryId,
    serviceId: booking.serviceId,
    title: booking.title,
    description: booking.description,
    addressId: booking.addressId,
    scheduledAt: nextAt.toISOString(),
    durationMin: booking.durationMin,
    status: "pending_acceptance",
    paymentStatus: "authorized",
    price: { ...booking.price },
    matchScore: booking.matchScore,
    createdAt: now,
    checklist: booking.checklist.map((c) => ({ ...c, id: `chk-${id}-${c.id.split("-").pop()}`, done: false })),
    evidence: [],
    timeline: [
      {
        id: `ev-${id}-so`,
        at: now,
        label: "Standing order — next occurrence scheduled automatically",
        detail: `Occurrence ${nextIndex} of ${booking.seriesId ?? "the series"} · ${whenLabel}`,
        by: "Platform",
      },
      { id: `ev-${id}-1`, at: now, label: "Payment authorised", detail: "Held securely until service completion", by: "Platform" },
    ],
    customerNotes: booking.customerNotes,
    recurrence: booking.recurrence,
    seriesId: booking.seriesId,
    occurrenceIndex: nextIndex,
  };
  store.bookings.unshift(next);

  notify(booking.workerId, {
    kind: "job",
    title: "Standing order continues",
    body: `Standing order: ${booking.title} for ${customer.name} continues — next occurrence ${whenLabel}. You have priority; accept to confirm.`,
    route: { name: "worker-jobs" },
  });
  notify(booking.customerId, {
    kind: "booking",
    title: "Your standing order continues",
    body: `Your standing order continues — next visit scheduled ${whenLabel}, awaiting ${worker.name}'s confirmation.`,
    route: { name: "customer-booking", params: { bookingId: id } },
  });
  audit(`Standing order ${booking.seriesId ?? booking.reference} — next occurrence ${reference} scheduled automatically for ${whenLabel}`, "Booking", "Platform", "admin");
  return next;
}

/**
 * Estimated monthly net income from the worker's ACTIVE standing orders —
 * series that still have a non-cancelled, non-declined occurrence to serve.
 * Weekly series are annualised to a month (× 4.33), monthly ones count as-is.
 */
export function recurringMonthlyFor(workerId: string): { recurringMonthly: number; standingOrders: number } {
  const store = getStore();
  const series = new Map<string, { latest: Booking; active: boolean }>();
  for (const b of store.bookings) {
    if (b.workerId !== workerId || !b.recurrence || !b.seriesId) continue;
    const entry = series.get(b.seriesId);
    if (!entry) {
      series.set(b.seriesId, { latest: b, active: !["cancelled", "declined", "completed"].includes(b.status) });
    } else {
      if ((b.occurrenceIndex ?? 1) >= (entry.latest.occurrenceIndex ?? 1)) entry.latest = b;
      if (!["cancelled", "declined", "completed"].includes(b.status)) entry.active = true;
    }
  }
  let monthly = 0;
  let count = 0;
  for (const { latest, active } of series.values()) {
    if (!active) continue;
    count += 1;
    monthly += latest.price.workerNetPayout * (latest.recurrence === "weekly" ? 4.33 : 1);
  }
  return { recurringMonthly: Math.round(monthly), standingOrders: count };
}

export function welfareProfileFor(workerId: string): WelfareProfile {
  const store = getStore();
  const txns = store.transactions
    .filter((t) => t.workerId === workerId)
    .map((t) => ({ bookingRef: t.bookingRef, amount: t.welfareContribution, date: new Date(t.date).getTime() }));
  const extraClaims = ((store as any).extraClaims ?? []).filter(
    (c: { workerId: string }) => c.workerId === workerId,
  ) as import("@/lib/types").WelfareClaim[];
  return buildWelfareProfile(txns, extraClaims);
}

/* ------------------------------------------------------------------ */
/* Training & upskilling hub — cooperative-funded member training      */
/* ------------------------------------------------------------------ */

function trainingCourseById(courseId: string): TrainingCourse {
  const course = getStore().trainingCourses.find((c) => c.id === courseId);
  if (!course) throw new Error("Training course not found");
  return course;
}

function myEnrollment(workerId: string, courseId: string): TrainingEnrollment {
  const e = getStore().trainingEnrollments.find((en) => en.workerId === workerId && en.courseId === courseId);
  if (!e) throw new Error("You are not enrolled in this course — enrol first from the catalogue");
  return e;
}

/** Completed, certificate-bearing enrollments of one member, joined with course data. */
export function trainingCertificatesFor(workerId: string): TrainingCertificate[] {
  const store = getStore();
  return store.trainingEnrollments
    .filter((e) => e.workerId === workerId && e.status === "completed" && e.certificateId && e.completedAt)
    .map((e) => {
      const course = store.trainingCourses.find((c) => c.id === e.courseId)!;
      return {
        courseId: course.id,
        courseTitle: course.title,
        certificateId: e.certificateId!,
        completedAt: e.completedAt!,
        score: e.score,
        skills: course.skills,
        level: course.level,
        hours: course.durationHrs,
        category: course.category,
      };
    })
    .sort((a, b) => +new Date(b.completedAt) - +new Date(a.completedAt));
}

/** Learning hours earned, with partial credit for in-progress courses. */
function trainingHours(enrollments: TrainingEnrollment[]): number {
  const store = getStore();
  return Math.round(
    enrollments.reduce((a, e) => {
      const c = store.trainingCourses.find((x) => x.id === e.courseId);
      return a + (c ? (c.durationHrs * e.progressPct) / 100 : 0);
    }, 0),
  );
}

/** GET /worker/training — catalogue + own enrolments + certificates + stats. */
export function workerTrainingFor(workerId: string): WorkerTrainingData {
  const store = getStore();
  const myEnrollments = [...store.trainingEnrollments.filter((e) => e.workerId === workerId)].sort(
    (a, b) => +new Date(b.enrolledAt) - +new Date(a.enrolledAt),
  );
  const certificates = trainingCertificatesFor(workerId);
  const upcoming = store.trainingCourses
    .map((c) => c.nextCohortAt)
    .filter((d): d is string => Boolean(d) && +new Date(d!) > Date.now());
  return {
    courses: store.trainingCourses,
    myEnrollments,
    certificates,
    stats: {
      completedCount: myEnrollments.filter((e) => e.status === "completed").length,
      inProgress: myEnrollments.filter((e) => e.status === "in_progress").length,
      certificatesEarned: certificates.length,
      hoursCompleted: trainingHours(myEnrollments),
      nextCohortAt: upcoming.length ? new Date(Math.min(...upcoming.map((d) => +new Date(d)))).toISOString() : undefined,
    },
  };
}

/** GET /admin/training — coverage, per-course and per-member rows. */
export function adminTrainingFor(): AdminTrainingData {
  const store = getStore();
  const monthAgo = Date.now() - 30 * DAY;
  const byCourse = store.trainingCourses
    .map((c) => {
      const ens = store.trainingEnrollments.filter((e) => e.courseId === c.id);
      const completed = ens.filter((e) => e.status === "completed").length;
      return {
        courseId: c.id,
        title: c.title,
        level: c.level,
        category: c.category,
        enrolled: ens.length,
        completed,
        completionRate: ens.length ? Math.round((completed / ens.length) * 100) : 0,
      };
    })
    .sort((a, b) => b.enrolled - a.enrolled || a.title.localeCompare(b.title));
  const byMember = store.workers
    .map((w) => {
      const ens = store.trainingEnrollments.filter((e) => e.workerId === w.id);
      return {
        workerId: w.id,
        name: w.name,
        trade: w.tradeTitle,
        certificates: ens.filter((e) => e.status === "completed" && e.certificateId).length,
        active: ens.filter((e) => e.status === "in_progress").length,
        hoursCompleted: trainingHours(ens),
      };
    })
    .sort((a, b) => b.certificates - a.certificates || b.hoursCompleted - a.hoursCompleted || a.name.localeCompare(b.name));
  return {
    coverage: {
      membersWithTraining: new Set(store.trainingEnrollments.map((e) => e.workerId)).size,
      totalMembers: store.workers.length,
      activeEnrollments: store.trainingEnrollments.filter((e) => e.status === "in_progress").length,
      completionsThisMonth: store.trainingEnrollments.filter((e) => e.completedAt && +new Date(e.completedAt) >= monthAgo).length,
      certificatesIssued: store.trainingEnrollments.filter((e) => e.certificateId).length,
    },
    byCourse,
    byMember,
  };
}

/** Enrol a member in a course (no fee — funded from the operations budget). */
export function enrollInCourse(workerId: string, courseId: string): TrainingEnrollment {
  const store = getStore();
  const course = trainingCourseById(courseId);
  if (store.trainingEnrollments.some((e) => e.workerId === workerId && e.courseId === courseId)) {
    throw new Error("You are already enrolled in this course — continue it from My learning");
  }
  const worker = workerById(workerId);
  const enrollment: TrainingEnrollment = {
    id: `tre-live-${store.counters.training++}`,
    courseId,
    workerId,
    status: "in_progress",
    progressPct: 0,
    enrolledAt: new Date().toISOString(),
  };
  store.trainingEnrollments.push(enrollment);
  notify(workerId, {
    kind: "verification",
    title: "Enrolment confirmed",
    body: `${course.title} — ${course.format.replace("-", " ")} format, ${course.durationHrs} learning hours. The course fee is covered by the cooperative; materials are in your training hub.`,
    route: { name: "worker-training" },
  });
  audit(`${worker.name} enrolled in ${course.title}`, "Training enrolment", worker.name, "worker");
  return enrollment;
}

/** Advance one module — progress moves by exactly 100/moduleCount. */
export function markModuleComplete(workerId: string, courseId: string): { enrollment: TrainingEnrollment; modulesDone: number; moduleCount: number } {
  const course = trainingCourseById(courseId);
  const enrollment = myEnrollment(workerId, courseId);
  if (enrollment.status === "completed") throw new Error("This course is already completed");
  const modulesDone = Math.min(course.moduleCount, Math.round((enrollment.progressPct / 100) * course.moduleCount));
  const next = Math.min(course.moduleCount, modulesDone + 1);
  enrollment.progressPct = Math.round((next / course.moduleCount) * 100);
  return { enrollment, modulesDone: next, moduleCount: course.moduleCount };
}

/** Complete a course at 100% — issues a deterministic SCT-2025-### certificate. */
export function completeCourse(workerId: string, courseId: string): TrainingEnrollment {
  const store = getStore();
  const course = trainingCourseById(courseId);
  const enrollment = myEnrollment(workerId, courseId);
  if (enrollment.status === "completed") {
    throw new Error(`Already completed — certificate ${enrollment.certificateId ?? "issued"}`);
  }
  if (enrollment.progressPct < 100) {
    throw new Error(`Finish all modules first — you are at ${enrollment.progressPct}%`);
  }
  const worker = workerById(workerId);
  const n = store.counters.certificate++;
  enrollment.status = "completed";
  enrollment.completedAt = new Date().toISOString();
  enrollment.certificateId = `SCT-2025-${String(n).padStart(3, "0")}`;
  /* final assessment score (simulated) — deterministic per issuance */
  enrollment.score = 82 + ((n * 7) % 14);
  notify(workerId, {
    kind: "verification",
    title: "Certificate issued",
    body: `Certificate ${enrollment.certificateId} issued — ${course.title} (score ${enrollment.score}/100). It is now visible on your customer-facing profile.`,
    route: { name: "worker-training" },
  });
  audit(`Certificate ${enrollment.certificateId} issued — ${worker.name} completed ${course.title} (${enrollment.score}/100)`, "Training certificate", worker.name, "worker", "notice");
  return enrollment;
}

export function voteOnProposal(proposalId: string, vote: "approve" | "reject" | "abstain", memberId: string) {
  const store = getStore();
  const all = [...store.governance.activeProposals, ...store.governance.pastProposals];
  const proposal = all.find((p) => p.id === proposalId);
  if (!proposal || proposal.myVote || proposal.status !== "active") return null;
  proposal.myVote = vote;
  proposal.votes[vote] += 1;
  const voted = proposal.votes.approve + proposal.votes.reject + proposal.votes.abstain;
  proposal.participationPct = Math.round((voted / proposal.eligibleMembers) * 100);
  audit(`Member vote recorded on ${proposal.code} (${vote})`, "Governance proposal", workerById(memberId).name, "worker");
  return proposal;
}

export function createTicket(input: {
  raisedByRole: "customer" | "worker";
  raisedByName: string;
  type: SupportTicket["type"];
  category: string;
  subject: string;
  description: string;
  relatedBookingRef?: string;
}): SupportTicket {
  const store = getStore();
  const id = `tk-live-${store.counters.ticket++}`;
  const ticket: SupportTicket = {
    id,
    reference: `SUP-5${String(900 + store.counters.ticket).slice(-3)}`,
    raisedByRole: input.raisedByRole,
    raisedByName: input.raisedByName,
    type: input.type,
    category: input.category,
    subject: input.subject,
    description: input.description,
    relatedBookingRef: input.relatedBookingRef,
    status: "open",
    priority: input.type === "dispute" ? "high" : "medium",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      {
        id: `msg-${id}-1`,
        at: new Date().toISOString(),
        author: input.raisedByName,
        body: input.description,
      },
    ],
  };
  store.tickets.unshift(ticket);
  notify(ADMIN_USER, {
    kind: "support",
    title: `New ${input.type.replace("_", " ")} raised`,
    body: `${ticket.reference} — ${input.subject}`,
    route: { name: "admin-disputes" },
  });
  audit(`New support ticket ${ticket.reference} — ${input.subject}`, "Support ticket", input.raisedByName, input.raisedByRole);
  return ticket;
}

export function updatePolicy(patch: Partial<PlatformPolicy>, actor: string) {
  const store = getStore();
  store.policy = { ...store.policy, ...patch, updatedBy: actor, updatedAt: new Date().toISOString() };
  audit(`Platform policy updated by ${actor}`, "Platform policy", actor, "admin", "notice");
  return store.policy;
}

export function categories(): ServiceCategory[] {
  return CATEGORIES;
}

export function workerOverviewFor(workerId: string): WorkerOverview {
  const store = getStore();
  const worker = workerById(workerId);
  const now = Date.now();
  const workerBookings = store.bookings.filter((b) => b.workerId === workerId);
  const txns = store.transactions.filter((t) => t.workerId === workerId);
  const todayTxns = txns.filter((t) => new Date(t.date).toDateString() === new Date().toDateString());
  const weekTxns = txns.filter((t) => now - new Date(t.date).getTime() < 7 * DAY);
  const monthTxns = txns.filter((t) => now - new Date(t.date).getTime() < 30 * DAY);

  /* Weekly series — last 7 days of earnings */
  const weekSeries = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now - (6 - i) * DAY);
    const label = d.toLocaleDateString("en-IN", { weekday: "short" });
    const value = txns
      .filter((t) => new Date(t.date).toDateString() === d.toDateString())
      .reduce((a, t) => a + t.net, 0);
    return { label, value };
  });

  const welfare = welfareProfileFor(workerId);
  const completed = workerBookings.filter((b) => b.status === "completed").length;
  const cancelled = workerBookings.filter((b) => b.status === "cancelled").length;
  const completionRate = Math.round((completed / Math.max(1, completed + cancelled)) * 100);

  return {
    todayEarnings: todayTxns.reduce((a, t) => a + t.net, 0),
    weekEarnings: weekTxns.reduce((a, t) => a + t.net, 0),
    monthEarnings: monthTxns.reduce((a, t) => a + t.net, 0),
    availableBalance: txns.filter((t) => t.status === "credited").reduce((a, t) => a + t.net, 0),
    pendingSettlement: workerBookings
      .filter((b) => b.status === "awaiting_confirmation")
      .reduce((a, b) => a + b.price.workerNetPayout, 0),
    todayJobs: workerBookings.filter(
      (b) => new Date(b.scheduledAt).toDateString() === new Date().toDateString() && !["cancelled", "declined"].includes(b.status),
    ),
    upcomingJobs: workerBookings.filter(
      (b) =>
        new Date(b.scheduledAt).getTime() > now &&
        ["confirmed", "pending_acceptance"].includes(b.status),
    ),
    openRequests: store.openRequests.filter((r) => r.status === "open"),
    rating: worker.rating,
    completedJobs: worker.completedJobs,
    completionRate,
    onTimeRate: worker.onTimeRate,
    welfareBalance: welfare.fundBalance,
    activeBenefit: "Health insurance · Accident cover",
    weekSeries,
    cooperativeNotices: [
      {
        id: "ocn-1",
        title: `Voting open: ${store.governance.activeProposals[0].code}`,
        body: store.governance.activeProposals[0].title,
        date: new Date(now - DAY).toISOString(),
      },
      {
        id: "ocn-2",
        title: "Safety kit collection",
        body: "Insulated tool sets ready at Sahyog Centre, 10 AM–6 PM on weekdays.",
        date: new Date(now - 2 * DAY).toISOString(),
      },
    ],
    verificationComplete: worker.status === "verified",
    nextPayoutDate: new Date(now + DAY).toISOString(),
  };
}
