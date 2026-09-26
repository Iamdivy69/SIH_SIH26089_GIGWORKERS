/**
 * Sahyog — Cooperative Gig Services Platform (SIH26089)
 * Domain models shared by server seed/handlers and the client application.
 */

export type Role = "customer" | "worker" | "admin";

export type ServiceCategoryId =
  | "electrical"
  | "plumbing"
  | "cleaning"
  | "gardening"
  | "repairs"
  | "community-care";

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  /** Base service charge in INR (whole rupees) */
  basePrice: number;
  /** Typical duration in minutes */
  durationMin: number;
  unit: "visit" | "hour" | "task";
}

export interface ServiceCategory {
  id: ServiceCategoryId;
  name: string;
  tagline: string;
  description: string;
  services: ServiceItem[];
  coverage: string[];
  /** Verified, active members in this category (enriched by the API) */
  activeWorkers?: number;
}

export type VerificationItemStatus = "verified" | "pending" | "under_review" | "needs_action" | "rejected" | "not_started";

export interface VerificationItem {
  id: string;
  label: string;
  status: VerificationItemStatus;
  verifiedAt?: string;
  note?: string;
  /** Simulated document reference */
  reference?: string;
}

export type WorkerStatus = "verified" | "pending" | "under_review" | "needs_action" | "rejected" | "suspended";

export interface WorkerCertification {
  id: string;
  name: string;
  issuer: string;
  issuedAt: string;
  validTill?: string;
  credentialId: string;
}

export interface WorkerAvailabilitySlot {
  day: number; // 0=Sun … 6=Sat
  slots: string[]; // e.g. ["08:00–12:00", "16:00–20:00"]
}

export interface Worker {
  id: string;
  name: string;
  category: ServiceCategoryId;
  tradeTitle: string;
  locality: string;
  city: string;
  distanceKm: number; // distance from the demo customer's address
  rating: number;
  reviewCount: number;
  completedJobs: number;
  experienceYears: number;
  status: WorkerStatus;
  memberSince: string;
  cooperativeMemberId: string;
  preferredRadiusKm: number;
  onTimeRate: number; // 0–100
  repeatCustomerRate: number; // 0–100
  responseMins: number;
  baseRateNote: string;
  certifications: WorkerCertification[];
  verification: VerificationItem[];
  availability: WorkerAvailabilitySlot[];
  bio: string;
  languages: string[];
  skills: string[];
}

export interface Customer {
  id: string;
  name: string;
  locality: string;
  city: string;
  memberSince: string;
  totalBookings: number;
  lifetimeValue: number;
  addresses: CustomerAddress[];
  preferredCategories: ServiceCategoryId[];
}

export interface CustomerAddress {
  id: string;
  label: string;
  line: string;
  locality: string;
  city: string;
  pincode: string;
}

export type BookingStatus =
  | "pending_acceptance"
  | "confirmed"
  | "en_route"
  | "arrived"
  | "in_progress"
  | "awaiting_confirmation"
  | "completed"
  | "cancelled"
  | "declined";

export type PaymentStatus = "authorized" | "settled" | "refunded" | "failed";

export interface PriceBreakdown {
  serviceCharge: number;
  /** 3% of service charge → worker welfare fund */
  welfareContribution: number;
  /** 6% of service charge → cooperative operations */
  platformFee: number;
  /** 18% GST on platform fee */
  gst: number;
  customerTotal: number;
  /** Worker-side settlement */
  workerGross: number;
  workerWelfareCredit: number;
  workerTds: number;
  workerNetPayout: number;
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface EvidencePhoto {
  phase: "before" | "after";
  capturedAt: string;
  label: string;
}

export interface BookingEvent {
  id: string;
  at: string;
  label: string;
  detail?: string;
  by?: string;
}

/** Message in the booking-scoped thread between the customer and the worker. */
export interface BookingMessage {
  id: string;
  authorRole: "customer" | "worker";
  authorName: string;
  text: string;
  at: string;
}

/** Standing-order recurrence — absent means a one-time booking. */
export type BookingRecurrence = "weekly" | "monthly";

export interface Booking {
  id: string;
  reference: string;
  customerId: string;
  workerId: string;
  categoryId: ServiceCategoryId;
  serviceId: string;
  title: string;
  description: string;
  addressId: string;
  scheduledAt: string;
  durationMin: number;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  price: PriceBreakdown;
  matchScore?: number;
  createdAt: string;
  checklist: ChecklistItem[];
  evidence: EvidencePhoto[];
  timeline: BookingEvent[];
  messages?: BookingMessage[];
  customerNotes?: string;
  cancellationReason?: string;
  /** Standing order frequency ("weekly"/"monthly"); absent = one-time booking. */
  recurrence?: BookingRecurrence;
  /** Standing-order series id — shared by every occurrence (e.g. "so-001"). */
  seriesId?: string;
  /** 1-based position of this booking within its series. */
  occurrenceIndex?: number;
  /** Set when the series is ended (cancellation) so no further occurrence is spawned. */
  seriesEnded?: boolean;
}

export interface Review {
  id: string;
  bookingId: string;
  customerId: string;
  customerName: string;
  workerId: string;
  rating: number;
  comment: string;
  tags: string[];
  createdAt: string;
}

export interface Transaction {
  id: string;
  bookingId: string;
  bookingRef: string;
  workerId: string;
  date: string;
  serviceTitle: string;
  gross: number;
  platformFee: number;
  welfareContribution: number;
  tds: number;
  net: number;
  status: "credited" | "in_payout" | "paid_out";
}

export interface Payout {
  id: string;
  workerId: string;
  period: string;
  date: string;
  transactions: number;
  amount: number;
  method: string;
  status: "processing" | "processed" | "failed";
  reference: string;
}

export type BenefitStatus = "active" | "eligible" | "pending" | "opt_in";

export interface WelfareBenefit {
  id: string;
  name: string;
  description: string;
  status: BenefitStatus;
  meta: string;
  value?: string;
  since?: string;
  policyRef?: string;
}

export interface WelfareContribution {
  id: string;
  date: string;
  bookingRef: string;
  amount: number;
  balanceAfter: number;
}

export interface WelfareClaim {
  id: string;
  type: string;
  submittedAt: string;
  amount: number;
  status: "submitted" | "under_review" | "approved" | "settled" | "rejected" | "info_requested";
  description: string;
  decisionNote?: string;
  reference: string;
}

export interface WelfareProfile {
  benefits: WelfareBenefit[];
  contributions: WelfareContribution[];
  claims: WelfareClaim[];
  fundBalance: number;
  ytdContribution: number;
  coopMatchYtd: number;
  pensionPot: number;
  emergencyAssistanceLimit: number;
}

export type ProposalStatus = "active" | "passed" | "rejected" | "draft" | "closed";

export interface GovernanceProposal {
  id: string;
  code: string;
  title: string;
  summary: string;
  description: string;
  status: ProposalStatus;
  category: string;
  openedAt: string;
  closesAt: string;
  participationPct: number;
  eligibleMembers: number;
  votes: { approve: number; reject: number; abstain: number };
  quorumPct: number;
  fiscalNote?: string;
  proposedBy: string;
  myVote?: "approve" | "reject" | "abstain";
  outcomeNote?: string;
}

export interface AssemblyMeeting {
  id: string;
  title: string;
  date: string;
  time: string;
  venue: string;
  agenda: string[];
  mode: string;
}

export interface DividendStatement {
  fiscalYear: string;
  surplus: number;
  patronageBonus: number;
  members: number;
  myShare: number;
  distributedAt: string;
  note: string;
}

export interface GovernanceData {
  membershipId: string;
  memberSince: string;
  shareCapital: number;
  votingWeight: number;
  activeProposals: GovernanceProposal[];
  pastProposals: GovernanceProposal[];
  meetings: AssemblyMeeting[];
  dividend: DividendStatement;
  announcements: { id: string; title: string; date: string; body: string }[];
}

export type NotificationKind = "job" | "payment" | "verification" | "governance" | "booking" | "system" | "support";

export interface AppNotification {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  route?: { name: string; params?: Record<string, string> };
}

export type ForecastLevel = "low" | "medium" | "high" | "very_high";

export interface ForecastCell {
  day: number; // 0 = today … 6
  slot: string; // "08–12" | "12–16" | "16–20"
  categoryId: ServiceCategoryId;
  predicted: number;
  historical: number;
  availableWorkers: number;
  confidence: number;
}

export interface ForecastPeak {
  id: string;
  day: number;
  slot: string;
  categoryId: ServiceCategoryId;
  demandLevel: ForecastLevel;
  predicted: number;
  availableWorkers: number;
  gap: number;
  recommendedAction: string;
}

export interface ForecastData {
  cells: ForecastCell[];
  peaks: ForecastPeak[];
  weekSummary: {
    predictedBookings: number;
    lastWeekBookings: number;
    avgConfidence: number;
    totalGap: number;
  };
  generatedAt: string;
}

export type TicketStatus = "open" | "in_review" | "awaiting_response" | "resolved" | "escalated";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

export interface SupportTicket {
  id: string;
  reference: string;
  raisedByRole: Role;
  raisedByName: string;
  type: "complaint" | "dispute" | "grievance" | "payout_issue" | "verification_issue" | "question";
  category: string;
  subject: string;
  description: string;
  relatedBookingRef?: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  messages: { id: string; at: string; author: string; body: string; internal?: boolean }[];
  resolution?: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  actorRole: Role;
  action: string;
  entity: string;
  severity: "info" | "notice" | "warning";
}

export interface SkillCourse {
  id: string;
  title: string;
  provider: string;
  category: ServiceCategoryId;
  status: "completed" | "in_progress" | "available";
  progress: number;
  completedAt?: string;
  hours: number;
  certified: boolean;
  creditValue: number;
}

/* ------------------------------------------------------------------ */
/* Training & upskilling hub (cooperative-funded member training)      */
/* ------------------------------------------------------------------ */

/** Course category — one of the co-op's service trades, or "professional" for
 *  cross-trade skills (communication, payments, safety practice). */
export type TrainingCategoryId = ServiceCategoryId | "professional";

export interface TrainingCourse {
  id: string;
  title: string;
  category: TrainingCategoryId;
  /** 1–2 sentences, plain language, what the member will be able to do. */
  description: string;
  /** Total learning hours across all modules. */
  durationHrs: number;
  level: "foundation" | "advanced";
  format: "in-person" | "online" | "hybrid";
  /** Instructor with credentials, e.g. "Vikram Salunkhe — ITI Pune, 18 yrs". */
  instructor: string;
  /** 2–4 concrete skills the course certifies. */
  skills: string[];
  moduleCount: number;
  /** Next cohort start; undefined = rolling/online access. */
  nextCohortAt?: string;
  seatsLeft?: number;
}

export interface TrainingEnrollment {
  id: string;
  courseId: string;
  workerId: string;
  status: "in_progress" | "completed";
  /** 0–100, advanced one module at a time (100/moduleCount per module). */
  progressPct: number;
  enrolledAt: string;
  completedAt?: string;
  /** SCT-2025-### — issued when the course is completed at 100%. */
  certificateId?: string;
  /** Final assessment score out of 100. */
  score?: number;
}

/** A completed, certificate-bearing enrollment joined with its course. */
export interface TrainingCertificate {
  courseId: string;
  courseTitle: string;
  certificateId: string;
  completedAt: string;
  score?: number;
  skills: string[];
  level: TrainingCourse["level"];
  hours: number;
  category: TrainingCategoryId;
}

export interface WorkerTrainingData {
  courses: TrainingCourse[];
  myEnrollments: TrainingEnrollment[];
  certificates: TrainingCertificate[];
  stats: {
    completedCount: number;
    inProgress: number;
    certificatesEarned: number;
    /** Learning hours earned, including partial credit for in-progress courses. */
    hoursCompleted: number;
    /** Earliest upcoming cohort across the catalogue. */
    nextCohortAt?: string;
  };
}

export interface AdminTrainingData {
  coverage: {
    membersWithTraining: number;
    totalMembers: number;
    activeEnrollments: number;
    completionsThisMonth: number;
    certificatesIssued: number;
  };
  byCourse: {
    courseId: string;
    title: string;
    level: TrainingCourse["level"];
    category: TrainingCategoryId;
    enrolled: number;
    completed: number;
    completionRate: number;
  }[];
  byMember: {
    workerId: string;
    name: string;
    trade: string;
    certificates: number;
    active: number;
    hoursCompleted: number;
  }[];
}

export interface PlatformPolicy {
  commissionPct: number;
  welfarePct: number;
  gstPct: number;
  tdsPct: number;
  surgePolicy: string;
  cancellationPolicy: string;
  disputeWindowDays: number;
  minWagePerHour: number;
  updatedBy: string;
  updatedAt: string;
}

export interface OpenJobRequest {
  id: string;
  title: string;
  categoryId: ServiceCategoryId;
  serviceId: string;
  description: string;
  locality: string;
  distanceKm: number;
  scheduledAt: string;
  durationMin: number;
  estimate: PriceBreakdown;
  matchScore: number;
  matchFactors: MatchFactor[];
  postedAt: string;
  customerId: string;
  status: "open" | "offered";
}

export interface MatchFactor {
  id: string;
  label: string;
  assessment: string; // "Excellent" | "Good" | "Fair" | "Limited"
  score: number; // 0–100
  weightPct: number;
  detail: string;
}

export interface WorkerRecommendation {
  worker: Worker;
  score: number;
  factors: MatchFactor[];
  estimatedPrice: PriceBreakdown;
  reasonSummary: string;
}

export interface AdminKpi {
  activeWorkers: number;
  pendingVerifications: number;
  activeCustomers: number;
  bookingsToday: number;
  completedToday: number;
  openDisputes: number;
  transactionVolumeToday: number;
  welfarePoolTotal: number;
  avgRating: number;
  csat: number;
  onTimeRate: number;
  cancellationRate: number;
}

export interface SeriesPoint {
  label: string;
  value: number;
  secondary?: number;
}

export interface AdminOverview {
  kpis: AdminKpi;
  /** Active standing-order series — distinct seriesId with a non-cancelled upcoming occurrence. */
  standingOrders: number;
  bookingsTrend: SeriesPoint[]; // last 14 days
  categoryDemand: SeriesPoint[];
  quality: SeriesPoint[]; // ratings per category
  geographic: { locality: string; bookings: number; workers: number; avgRating: number }[];
  alerts: { id: string; severity: "critical" | "warning" | "info"; title: string; detail: string; action: string; route?: string }[];
  recentBookings: Booking[];
  workerUtilization: SeriesPoint[];
}

export interface FinanceOverview {
  revenueSeries: SeriesPoint[];
  commissionMonth: number;
  gstCollectedMonth: number;
  welfarePoolMonth: number;
  welfarePoolTotal: number;
  payoutsPending: number;
  payoutsProcessedMonth: number;
  tdsRemittedMonth: number;
  disputeHolds: number;
  reconciliation: { label: string; amount: number; expected: number; status: "matched" | "variance" }[];
}

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
  subtitle: string;
  locality: string;
}

export interface CustomerOverview {
  activeBooking: Booking | null;
  upcomingBookings: Booking[];
  recentBookings: Booking[];
  recommendedWorkers: { worker: Worker; score: number; reason: string }[];
  categories: ServiceCategory[];
  spentThisMonth: number;
  completedCount: number;
  savedWorkers: string[];
  /** The customer's own active standing-order series count. */
  activeStandingOrders: number;
}

export interface WorkerOverview {
  todayEarnings: number;
  weekEarnings: number;
  monthEarnings: number;
  availableBalance: number;
  pendingSettlement: number;
  todayJobs: Booking[];
  upcomingJobs: Booking[];
  openRequests: OpenJobRequest[];
  rating: number;
  completedJobs: number;
  completionRate: number;
  onTimeRate: number;
  welfareBalance: number;
  activeBenefit: string;
  weekSeries: SeriesPoint[];
  cooperativeNotices: { id: string; title: string; body: string; date: string }[];
  verificationComplete: boolean;
  nextPayoutDate: string;
}
