import type {
  AdminSurplusView,
  AdminTrainingData,
  AppNotification,
  AuditEntry,
  Booking,
  BookingMessage,
  BookingRecurrence,
  Customer,
  DividendDistribution,
  GovernanceData,
  GovernanceProposal,
  InvoiceData,
  MemberDividendView,
  OpenJobRequest,
  Payout,
  PlatformPolicy,
  Review,
  ServiceCategory,
  SkillCourse,
  SurplusAllocationLine,
  SurplusData,
  SurplusMemberPreview,
  SupportTicket,
  Transaction,
  TrainingCertificate,
  TrainingCourse,
  TrainingEnrollment,
  Worker,
  WorkerAvailabilitySlot,
  WorkerOverview,
  WorkerTrainingData,
  WelfareProfile,
} from "@/lib/types";
import { amountInWords } from "@/lib/format";
import { computePrice } from "@/lib/rates";
import { publishNotification } from "./push";
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
  surplus: SurplusData;
  /** Completed dividend payments per member (newest first; FY 2025-26 seeded). */
  dividendHistory: DividendDistribution[];
  forecast: ReturnType<typeof generateForecast>;
  savedWorkers: string[]; // customer's shortlist
  openRequests: OpenJobRequest[];
  counters: { booking: number; ticket: number; claim: number; notification: number; audit: number; training: number; certificate: number };
}

const globalRef = globalThis as unknown as { __sahyogStore?: Store; __sahyogSeedVersion?: number };

/** Bump whenever seed data changes — a stale store from a previous HMR cycle reseeds automatically.
 *  16 = dividendHistory seed (FY 2025-26 per-member records) + close-vote/distribution flow. */
const SEED_VERSION = 16;

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
    surplus: seedSurplus(),
    dividendHistory: seedDividendHistory(),
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

/* ------------------------------------------------------------------ */
/* Surplus & dividend allocation (cooperative annual distribution)     */
/* ------------------------------------------------------------------ */

/** Operating costs as a share of platform-fee income (simulated:
 *  centre rent, staff, tool bank, training stipends, insurance admin). */
const OPERATING_COST_SHARE = 0.62;

const SURPLUS_LINES: Omit<SurplusAllocationLine, "pct">[] = [
  {
    key: "reserves",
    label: "Welfare & stability reserve",
    description: "Strengthens the welfare fund and cushions lean months — the co-op's safety net for members.",
    tone: "info",
    minPct: 20,
  },
  {
    key: "dividend",
    label: "Member patronage dividend",
    description: "Distributed to members in proportion to the service value they completed this year.",
    tone: "success",
    minPct: 10,
  },
  {
    key: "training",
    label: "Training & certification fund",
    description: "Funds free skill courses, wages for training hours and certification assessments.",
    tone: "primary",
    minPct: 5,
  },
  {
    key: "community",
    label: "Community programmes",
    description: "Ward-level safety drives, member health camps and the tool-bank upgrade cycle.",
    tone: "warning",
    minPct: 0,
  },
  {
    key: "contingency",
    label: "Contingency provision",
    description: "Held for disputes, refunds and unplanned operational shocks.",
    tone: "neutral",
    minPct: 0,
  },
];

const SEED_ALLOCATION_PCT: Record<SurplusAllocationLine["key"], number> = {
  reserves: 35,
  dividend: 40,
  training: 15,
  community: 7,
  contingency: 3,
};

/** Patronage basis: completed service value (transaction gross) per member this FY. */
function patronageByWorker(): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of getStore().transactions) map.set(t.workerId, (map.get(t.workerId) ?? 0) + t.gross);
  return map;
}

function seedSurplus(): SurplusData {
  const platformFeesYtd = Math.round(SEED_TRANSACTIONS.reduce((a, t) => a + t.platformFee, 0));
  const operatingCostsYtd = Math.round(platformFeesYtd * OPERATING_COST_SHARE);
  const patronageTotal = SEED_TRANSACTIONS.reduce((a, t) => a + t.gross, 0);
  const sharingMembers = new Set(SEED_TRANSACTIONS.map((t) => t.workerId)).size;
  return {
    fiscalYear: "2026-27",
    platformFeesYtd,
    operatingCostsYtd,
    surplusYtd: platformFeesYtd - operatingCostsYtd,
    patronageTotal,
    sharingMembers,
    allocations: SURPLUS_LINES.map((l) => ({ ...l, pct: SEED_ALLOCATION_PCT[l.key] })),
    status: "draft",
    lastDistributed: {
      fiscalYear: "2025-26",
      surplus: 1840000,
      patronageBonus: 920000,
      members: 216,
      distributedAt: new Date(Date.now() - 120 * DAY).toISOString(),
    },
  };
}

/** FY 2025-26 per-member dividend records — the narrative "what you received last
 *  year" for the 12 demo members (₹9.2L pool, 216 members, avg ₹4,259 — amounts
 *  weighted by each member's demo patronage rank). NOTE: builds its patronage
 *  map from SEED_TRANSACTIONS directly — calling getStore() here would recurse
 *  (the store is still being constructed). */
function seedDividendHistory(): DividendDistribution[] {
  const patronage = new Map<string, number>();
  for (const t of SEED_TRANSACTIONS) patronage.set(t.workerId, (patronage.get(t.workerId) ?? 0) + t.gross);
  const maxP = Math.max(1, ...patronage.values());
  const total = Math.max(1, SEED_TRANSACTIONS.reduce((a, t) => a + t.gross, 0));
  const distributedAt = new Date(Date.now() - 120 * DAY).toISOString();
  let n = 0;
  return [...patronage.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([workerId, p]) => {
      n += 1;
      return {
        id: `div-2526-${String(n).padStart(3, "0")}`,
        workerId,
        fiscalYear: "2025-26",
        patronage: p,
        sharePct: Math.round((p / total) * 1000) / 10,
        amount: 2200 + Math.round((4800 * p) / maxP),
        reference: `DIV-2526-${String(n).padStart(3, "0")}`,
        proposalCode: "PRO-2025-083",
        distributedAt,
      };
    });
}

/** Admin view of the surplus plan with the live dividend preview. */
export function surplusView(): AdminSurplusView {
  const surplus = getStore().surplus;
  const patronage = patronageByWorker();
  const dividendPool = Math.round((surplus.surplusYtd * (surplus.allocations.find((a) => a.key === "dividend")?.pct ?? 0)) / 100);
  const memberPreview: SurplusMemberPreview[] = [...patronage.entries()]
    .map(([workerId, p]) => {
      const worker = getStore().workers.find((w) => w.id === workerId);
      const sharePct = surplus.patronageTotal > 0 ? (p / surplus.patronageTotal) * 100 : 0;
      return {
        workerId,
        name: worker?.name ?? workerId,
        trade: worker?.tradeTitle ?? "—",
        patronage: p,
        sharePct: Math.round(sharePct * 10) / 10,
        dividend: Math.round((dividendPool * p) / Math.max(1, surplus.patronageTotal)),
      };
    })
    .sort((a, b) => b.patronage - a.patronage);
  return {
    ...surplus,
    dividendPool,
    avgDividend: surplus.sharingMembers > 0 ? Math.round(dividendPool / surplus.sharingMembers) : 0,
    memberPreview,
    distributionLedger: getStore()
      .dividendHistory.filter((r) => r.fiscalYear === surplus.fiscalYear)
      .sort((a, b) => b.amount - a.amount)
      .map((r) => {
        const worker = getStore().workers.find((w) => w.id === r.workerId);
        return { ...r, name: worker?.name ?? r.workerId, trade: worker?.tradeTitle ?? "—" };
      }),
  };
}

/** Member-facing dividend projection from the LIVE surplus plan — identical math
 *  to surplusView(), so the admin's draft edits move every member's number. */
export function memberDividendFor(workerId: string): MemberDividendView {
  const store = getStore();
  const surplus = store.surplus;
  const myPatronage = patronageByWorker().get(workerId) ?? 0;
  const dividendPool = Math.round((surplus.surplusYtd * (surplus.allocations.find((a) => a.key === "dividend")?.pct ?? 0)) / 100);
  const last = surplus.lastDistributed;
  const history = store.dividendHistory.filter((d) => d.workerId === workerId);
  const received = surplus.status === "distributed" ? history.find((d) => d.fiscalYear === surplus.fiscalYear) : undefined;
  return {
    fiscalYear: surplus.fiscalYear,
    status: surplus.status,
    proposal: surplus.proposal,
    received,
    myPatronage,
    patronageTotal: surplus.patronageTotal,
    sharingMembers: surplus.sharingMembers,
    mySharePct: surplus.patronageTotal > 0 && myPatronage > 0 ? Math.round((myPatronage / surplus.patronageTotal) * 1000) / 10 : 0,
    dividendPool,
    myProjectedDividend: Math.round((dividendPool * myPatronage) / Math.max(1, surplus.patronageTotal)),
    avgDividend: surplus.sharingMembers > 0 ? Math.round(dividendPool / surplus.sharingMembers) : 0,
    surplusYtd: surplus.surplusYtd,
    dividendRatePct: myPatronage > 0 ? Math.round(((dividendPool * myPatronage) / Math.max(1, surplus.patronageTotal) / myPatronage) * 1000) / 10 : 0,
    allocations: surplus.allocations,
    history,
    lastDistributed: { ...last, avgDividend: Math.round(last.patronageBonus / Math.max(1, last.members)) },
  };
}

export function updateSurplusAllocation(pcts: Partial<Record<SurplusAllocationLine["key"], number>>): SurplusData {
  const surplus = getStore().surplus;
  if (surplus.status === "in_vote") throw new Error("This allocation is with the members for voting — a new draft must be opened after the vote closes");
  if (surplus.status === "distributed") throw new Error(`The FY ${surplus.fiscalYear} allocation has been distributed — the next cycle opens a fresh draft`);
  const next = surplus.allocations.map((a) => {
    const raw = pcts[a.key];
    if (raw === undefined) return a;
    const pct = Math.round(Number(raw));
    if (!Number.isFinite(pct)) throw new Error(`Invalid percentage for ${a.label}`);
    if (pct < a.minPct) throw new Error(`${a.label} cannot go below ${a.minPct}% — policy guardrail`);
    if (pct > 100) throw new Error(`${a.label} cannot exceed 100%`);
    return { ...a, pct };
  });
  const sum = next.reduce((acc, a) => acc + a.pct, 0);
  if (sum !== 100) throw new Error(`Allocation must total 100% — currently ${sum}%`);
  surplus.allocations = next;
  return surplus;
}

/** Publishes the current allocation as a board proposal for member voting. */
export function submitSurplusProposal(actor: string): { proposal: GovernanceProposal; surplus: SurplusData } {
  const store = getStore();
  const surplus = store.surplus;
  if (surplus.status === "in_vote") throw new Error("This allocation is already with the members for voting");
  if (surplus.status === "distributed") throw new Error(`The FY ${surplus.fiscalYear} allocation has been distributed — the next cycle opens a fresh draft`);
  if (surplus.allocations.reduce((a, l) => a + l.pct, 0) !== 100) throw new Error("Allocation must total 100% before it can be voted on");

  /* Continue the PRO-2026-NNN numbering past every existing proposal. */
  const existing = [...store.governance.activeProposals, ...store.governance.pastProposals]
    .map((p) => Number(p.code.match(/(\d{3})$/)?.[1] ?? 0))
    .reduce((a, n) => Math.max(a, n), 0);
  const code = `PRO-2026-0${String(existing + 1).padStart(2, "0")}`;
  const closesAt = new Date(Date.now() + 14 * DAY).toISOString();
  const dividendPool = Math.round((surplus.surplusYtd * (surplus.allocations.find((a) => a.key === "dividend")?.pct ?? 0)) / 100);
  const parts = surplus.allocations.filter((a) => a.pct > 0).map((a) => `${a.pct}% ${a.label.toLowerCase()}`);

  const proposal: GovernanceProposal = {
    id: `gp-surplus-${existing + 1}`,
    code,
    title: `FY ${surplus.fiscalYear} surplus allocation — ${parts.join(", ")}`,
    summary: `Distribute the FY ${surplus.fiscalYear} surplus of ₹${surplus.surplusYtd.toLocaleString("en-IN")} across reserve, patronage dividend, training, community and contingency heads.`,
    description: `The board proposes distributing this year's surplus as follows: ${surplus.allocations
      .filter((a) => a.pct > 0)
      .map((a) => `${a.label} — ${a.pct}% (₹${Math.round((surplus.surplusYtd * a.pct) / 100).toLocaleString("en-IN")})`)
      .join("; ")}. Dividends are paid strictly in proportion to each member's completed service value (patronage), never per share — the estimated dividend pool is ₹${dividendPool.toLocaleString(
      "en-IN",
    )} across ${surplus.sharingMembers} sharing members. One member, one vote applies to this decision as to all others.`,
    status: "active",
    category: "Finance & surplus",
    openedAt: new Date().toISOString(),
    closesAt,
    /* Other members vote asynchronously — the seeded base mirrors the wider
     * membership's tallies on every other proposal (216 eligible, quorum 50%). */
    participationPct: 61,
    eligibleMembers: 216,
    votes: { approve: 102, reject: 21, abstain: 8 },
    quorumPct: 50,
    fiscalNote: `₹${surplus.surplusYtd.toLocaleString("en-IN")} surplus · dividend pool ₹${dividendPool.toLocaleString("en-IN")} · welfare reserve untouched below ${surplus.allocations.find((a) => a.key === "reserves")?.minPct ?? 20}% floor`,
    proposedBy: `${actor} (Operations)`,
  };

  store.governance.activeProposals.unshift(proposal);
  surplus.status = "in_vote";
  surplus.proposal = { id: proposal.id, code: proposal.code, closesAt };

  for (const w of store.workers.filter((w) => w.status === "verified")) {
    notify(w.id, {
      kind: "governance",
      title: "Surplus allocation vote open",
      body: `${code} — the board's FY ${surplus.fiscalYear} surplus proposal is ready for member voting. Dividend pool: ₹${dividendPool.toLocaleString("en-IN")}.`,
      route: { name: "worker-governance" },
    });
  }
  audit(`Published surplus allocation ${code} for member voting (dividend pool ₹${dividendPool.toLocaleString("en-IN")})`, "Surplus allocation", actor, "admin", "notice");
  return { proposal, surplus };
}

/* ------------------------------------------------------------------ */
/* Close-the-vote: tally, quorum, outcome, surplus distribution       */
/* ------------------------------------------------------------------ */

/** Closes an active proposal's vote: tallies cast votes, checks quorum,
 *  records the outcome and — when the SURPLUS proposal passes — executes the
 *  distribution: per-member patronage-proportional dividend ledger entries,
 *  notifications, audit, and the surplus state → "distributed".
 *  A failed/lapsed surplus vote reopens the board draft. */
export function closeProposal(
  proposalId: string,
  actor: string,
): { proposal: GovernanceProposal; distribution?: { pool: number; members: number } } {
  const store = getStore();
  const idx = store.governance.activeProposals.findIndex((p) => p.id === proposalId);
  if (idx === -1) throw new Error("Proposal not found or already closed");
  const [proposal] = store.governance.activeProposals.splice(idx, 1);

  const { approve, reject, abstain } = proposal.votes;
  const voted = approve + reject + abstain;
  const participation = Math.round((voted / Math.max(1, proposal.eligibleMembers)) * 100);
  const quorumMet = participation >= proposal.quorumPct;
  const passed = quorumMet && approve > reject;
  proposal.status = quorumMet ? (passed ? "passed" : "rejected") : "closed";
  proposal.participationPct = participation;
  proposal.closesAt = new Date().toISOString();
  proposal.outcomeNote = quorumMet
    ? `${passed ? "Passed" : "Rejected"} — ${participation}% participation · ${approve} approve / ${reject} reject / ${abstain} abstain.`
    : `Closed — quorum not met (${participation}% of ${proposal.eligibleMembers} eligible; ${proposal.quorumPct}% required). Referred back for reworking.`;
  store.governance.pastProposals.unshift(proposal);

  audit(
    `Vote closed on ${proposal.code}: ${quorumMet ? (passed ? "passed" : "rejected") : "quorum not met"} (${participation}% participation)`,
    "Governance proposal",
    actor,
    "admin",
    quorumMet ? "notice" : "warning",
  );

  /* If this was the surplus allocation vote, execute (or revert) the plan. */
  const surplus = store.surplus;
  if (surplus.proposal?.id === proposal.id) {
    if (passed) {
      const dividendPool = Math.round((surplus.surplusYtd * (surplus.allocations.find((a) => a.key === "dividend")?.pct ?? 0)) / 100);
      const patronage = patronageByWorker();
      const now = new Date().toISOString();
      let n = 0;
      for (const [workerId, p] of patronage) {
        n += 1;
        const amount = Math.round((dividendPool * p) / Math.max(1, surplus.patronageTotal));
        const sharePct = Math.round((p / Math.max(1, surplus.patronageTotal)) * 1000) / 10;
        const record: DividendDistribution = {
          id: `div-2627-${String(n).padStart(3, "0")}`,
          workerId,
          fiscalYear: surplus.fiscalYear,
          patronage: p,
          sharePct,
          amount,
          reference: `DIV-2627-${String(n).padStart(3, "0")}`,
          proposalCode: proposal.code,
          distributedAt: now,
        };
        store.dividendHistory.unshift(record);
        notify(workerId, {
          kind: "governance",
          title: "Patronage dividend credited",
          body: `₹${amount.toLocaleString("en-IN")} from the FY ${surplus.fiscalYear} surplus (${proposal.code}) — ${sharePct}% of patronage. Reference ${record.reference}.`,
          route: { name: "worker-earnings" },
        });
      }
      surplus.status = "distributed";
      surplus.lastDistributed = {
        fiscalYear: surplus.fiscalYear,
        surplus: surplus.surplusYtd,
        patronageBonus: dividendPool,
        members: surplus.sharingMembers,
        distributedAt: now,
      };
      audit(
        `FY ${surplus.fiscalYear} surplus distributed: ₹${dividendPool.toLocaleString("en-IN")} patronage dividend across ${patronage.size} members (avg ₹${Math.round(dividendPool / Math.max(1, patronage.size)).toLocaleString("en-IN")})`,
        "Surplus allocation",
        actor,
        "admin",
        "notice",
      );
      return { proposal, distribution: { pool: dividendPool, members: patronage.size } };
    }
    /* Failed or lapsed — reopen the board draft for reworking. */
    surplus.status = "draft";
    surplus.proposal = undefined;
    audit(`Surplus allocation ${proposal.code} did not pass — board draft reopened for reworking`, "Surplus allocation", actor, "admin", "warning");
  }

  return { proposal };
}

/* ------------------------------------------------------------------ */
/* Tax invoice for paid bookings                                       */
/* ------------------------------------------------------------------ */

const COOP_INVOICE_HEADER = {
  name: "Sahyog Seva Sanstha (Co-operative)",
  address: ["Sahyog Seva Centre, 12 Lane 3, Kothrud", "Pune, Maharashtra 411038"],
  registration: "Reg. No. MCS/PUN/2019/4821 · Multi-state co-operative society",
  email: "accounts@sahyog.example",
};
const GSTIN = "27AAECS1234F1Z5";
const SAC_CODE = "998721";

/** Indian fiscal year label (Apr–Mar) from a date, e.g. Sep 2026 → "2026-27". */
function fiscalYearOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "2026-27";
  const year = d.getFullYear();
  const fy = d.getMonth() >= 3 ? year : year - 1;
  return `${fy}-${String((fy + 1) % 100).padStart(2, "0")}`;
}

/** Invoice date = the moment payment settled (timeline "Payment settled" event,
 *  else the booking's last timeline entry, else creation). */
function invoiceDateFor(booking: Booking): string {
  const settled = booking.timeline.find((e) => /settl/i.test(e.label));
  return settled?.at ?? booking.timeline[booking.timeline.length - 1]?.at ?? booking.createdAt;
}

export function invoiceFor(bookingId: string): InvoiceData {
  const store = getStore();
  const booking = bookingById(bookingId);
  if (!booking) throw new Error("Booking not found");
  if (!["authorized", "settled"].includes(booking.paymentStatus)) {
    throw new Error("The invoice becomes available once payment is processed");
  }
  const customer = customerById(booking.customerId);
  const worker = workerById(booking.workerId);
  const txn = store.transactions.find((t) => t.bookingId === booking.id);
  const address = customer.addresses.find((a) => a.id === booking.addressId) ?? customer.addresses[0];
  const invoiceDate = invoiceDateFor(booking);
  const fiscalYear = fiscalYearOf(invoiceDate);
  const p = booking.price;

  const items: InvoiceData["items"] = [
    {
      description: booking.title,
      detail: booking.description,
      qty: 1,
      unit: "visit",
      amount: p.serviceCharge,
    },
    {
      description: "Co-operative welfare contribution",
      detail: "Credited to the service member's welfare fund (health, accident, pension).",
      qty: 1,
      unit: "—",
      amount: p.welfareContribution,
    },
    {
      description: "Platform processing & coordination",
      detail: "Matching, scheduling, escrow and dispute resolution operated by the co-operative.",
      qty: 1,
      unit: "—",
      amount: p.platformFee,
    },
    {
      description: "GST on processing fee",
      detail: "18% applied on the platform processing fee only.",
      qty: 1,
      unit: "—",
      amount: p.gst,
    },
  ];

  return {
    invoiceNo: `INV/${fiscalYear}/${booking.reference.replace("SG-", "")}`,
    invoiceDate,
    fiscalYear,
    bookingId: booking.id,
    bookingRef: booking.reference,
    sacCode: SAC_CODE,
    gstin: GSTIN,
    coop: COOP_INVOICE_HEADER,
    billTo: {
      name: customer.name,
      customerId: customer.id.toUpperCase(),
      address: [address.line, `${address.locality}, ${address.city} ${address.pincode}`],
    },
    serviceBy: { name: worker.name, memberNo: worker.cooperativeMemberId, trade: worker.tradeTitle },
    items,
    totals: p,
    payment: {
      method: "UPI · Sahyog escrow",
      reference: txn?.id ?? `pay-${booking.reference.toLowerCase()}`,
      status: booking.paymentStatus === "settled" ? "Settled to member" : "Held in escrow",
      paidAt: invoiceDate,
    },
    amountInWords: `Rupees ${amountInWords(p.customerTotal)} Only`,
    notes: [
      `Welfare contribution of ₹${p.welfareContribution} is credited to the service member's welfare fund — it is not co-operative revenue.`,
      `The service member receives ₹${p.workerNetPayout} net (₹${p.workerGross} gross less ₹${p.workerTds} TDS under section 194-O, simulated).`,
      "This is a computer-generated invoice and does not require a signature.",
      "Dispute window: 7 days from service completion, in accordance with co-operative policy.",
    ],
  };
}

export function notify(userId: string, n: Omit<AppNotification, "id" | "userId" | "createdAt" | "read">) {
  const store = getStore();
  const record: AppNotification = {
    ...n,
    id: `nt-live-${store.counters.notification++}`,
    userId,
    createdAt: new Date().toISOString(),
    read: false,
  };
  store.notifications.unshift(record);
  /* Real-time fan-out to connected tabs (best-effort — see src/server/push.ts).
     Seeded notifications bypass this function entirely, so only genuine
     runtime activity triggers pushes. */
  publishNotification(userId, {
    id: record.id,
    kind: record.kind,
    title: record.title,
    body: record.body,
    createdAt: record.createdAt,
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
