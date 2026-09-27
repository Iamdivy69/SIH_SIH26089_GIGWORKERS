"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import { DEMO_USER_ID, useRole } from "@/store/app-store";
import type {
  AdminOverview,
  AdminSurplusView,
  AdminTrainingData,
  AppNotification,
  Booking,
  BookingMessage,
  BookingRecurrence,
  CustomerOverview,
  FinanceOverview,
  ForecastData,
  GovernanceData,
  GovernanceProposal,
  InvoiceData,
  MemberDividendView,
  OpenJobRequest,
  PlatformPolicy,
  ServiceCategory,
  ServiceCategoryId,
  SkillCourse,
  SurplusAllocationKey,
  SupportTicket,
  TrainingCertificate,
  TrainingEnrollment,
  Transaction,
  Worker,
  WorkerAvailabilitySlot,
  WorkerOverview,
  WorkerRecommendation,
  WorkerTrainingData,
  WelfareProfile,
  WorkerCertification,
  VerificationItem,
  Review,
  Customer,
} from "@/lib/types";

/* ----------------------------- shared ----------------------------- */

export interface SessionResponse {
  platform: { name: string; fullName: string; tagline: string; prototype: boolean };
  users: Record<"customer" | "worker" | "admin", { id: string; name: string; role: string; subtitle: string; locality: string }>;
  rates: { commissionPct: number; welfarePct: number; gstPct: number; tdsPct: number };
  generatedAt: string;
}

export function useSession() {
  return useQuery({ queryKey: ["session"], queryFn: () => apiClient.get<SessionResponse>("session"), staleTime: 5 * 60_000 });
}

export function useNotifications() {
  const role = useRole();
  return useQuery({
    queryKey: ["notifications", role],
    queryFn: () => apiClient.get<{ items: AppNotification[]; unread: number }>("notifications", { user: DEMO_USER_ID[role] }),
    refetchInterval: 20_000,
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ids?: string[]; all?: boolean }) => apiClient.post("notifications/read", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: () => apiClient.get<ServiceCategory[]>("categories"), staleTime: 5 * 60_000 });
}

/* ---------------------------- customer ----------------------------- */

export function useCustomerOverview() {
  return useQuery({ queryKey: ["customer-overview"], queryFn: () => apiClient.get<CustomerOverview>("customer/overview") });
}

export interface WorkerFilters {
  q?: string;
  category?: string;
  minRating?: number;
  maxDistance?: number;
  verifiedOnly?: boolean;
  availableToday?: boolean;
  sort?: string;
}

export function useWorkers(filters: WorkerFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== false) params.set(k, String(v));
  });
  return useQuery({
    queryKey: ["workers", filters],
    queryFn: () => apiClient.get<{ items: Worker[]; total: number }>(`workers?${params.toString()}`),
  });
}

export function useWorkerProfile(id: string | undefined) {
  return useQuery({
    queryKey: ["worker", id],
    queryFn: () =>
      apiClient.get<{
        worker: Worker;
        reviews: Review[];
        bookingsDone: number;
        similar: Worker[];
        saved: boolean;
        /** Cooperative training credentials (certificates) earned by this member. */
        certificates: TrainingCertificate[];
      }>(`workers/${id}`),
    enabled: Boolean(id),
  });
}

export function useToggleSaveWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workerId: string) => apiClient.post<{ saved: boolean }>(`workers/${workerId}/save`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["worker"] });
      qc.invalidateQueries({ queryKey: ["customer-overview"] });
    },
  });
}

export interface MatchingInput {
  categoryId: ServiceCategoryId;
  serviceId?: string;
  description?: string;
  scheduledAt: string;
  charge: number;
}

export function useMatching() {
  return useMutation({
    mutationFn: (input: MatchingInput) =>
      apiClient.post<{ recommendations: WorkerRecommendation[]; weights: Record<string, number>; estimate: ReturnType<typeof import("@/lib/rates").computePrice> }>("matching", input),
  });
}

export interface CreateBookingInput {
  workerId: string;
  categoryId: ServiceCategoryId;
  serviceId: string;
  description: string;
  addressId: string;
  scheduledAt: string;
  customerNotes?: string;
  matchScore?: number;
  charge: number;
  /** Standing-order frequency; omit (or "one-time") for a regular booking. */
  recurrence?: BookingRecurrence;
}

export function useCreateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookingInput) => apiClient.post<{ booking: Booking }>("bookings", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-overview"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useBookings(scope: { customerId?: string; workerId?: string; status?: string }) {
  const params = new URLSearchParams(Object.fromEntries(Object.entries(scope).filter(([, v]) => Boolean(v)) as [string, string][]));
  return useQuery({
    queryKey: ["bookings", scope],
    queryFn: () => apiClient.get<{ items: Booking[] }>(`bookings?${params.toString()}`),
  });
}

export interface BookingDetail {
  booking: Booking;
  worker: Worker;
  customer: Customer;
  address: Customer["addresses"][number];
  review: Review | null;
}

export function useBooking(id: string | undefined) {
  return useQuery({ queryKey: ["booking", id], queryFn: () => apiClient.get<BookingDetail>(`bookings/${id}`), enabled: Boolean(id) });
}

/** Send a message in the booking-scoped customer↔worker thread. */
export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => apiClient.post<{ message: BookingMessage }>(`bookings/${id}/messages`, { text }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["booking", vars.id] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (err) => toast.error("Message not sent", { description: err instanceof Error ? err.message : undefined }),
  });
}

export function useCancelBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => apiClient.post<{ booking: Booking }>(`bookings/${id}/cancel`, { reason }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["booking", vars.id] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["customer-overview"] });
      toast.success("Booking cancelled", { description: "Any amount held will be refunded to your payment method." });
    },
  });
}

export function useConfirmBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rating, comment, tags }: { id: string; rating?: number; comment?: string; tags?: string[] }) =>
      apiClient.post<{ booking: Booking }>(`bookings/${id}/confirm`, { rating, comment, tags }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["booking", vars.id] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["customer-overview"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Service confirmed", { description: "Payment has been settled to your service member." });
    },
  });
}

export function useRateBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rating, comment, tags }: { id: string; rating: number; comment: string; tags: string[] }) =>
      apiClient.post<{ review: Review; workerRating: number }>(`bookings/${id}/rate`, { rating, comment, tags }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["booking", vars.id] });
      qc.invalidateQueries({ queryKey: ["worker"] });
      toast.success("Rating submitted", { description: "Thank you — ratings keep quality visible for everyone." });
    },
  });
}

/* ----------------------------- worker ------------------------------ */

export function useWorkerOverview() {
  return useQuery({ queryKey: ["worker-overview"], queryFn: () => apiClient.get<WorkerOverview>("worker/overview") });
}

export interface WorkerJobsData {
  offers: Booking[];
  openRequests: OpenJobRequest[];
  scheduled: Booking[];
  active: Booking[];
  awaiting: Booking[];
  history: Booking[];
  worker: Worker;
}

export function useWorkerJobs() {
  return useQuery({ queryKey: ["worker-jobs"], queryFn: () => apiClient.get<WorkerJobsData>("worker/jobs") });
}

export function useJobAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "accept" | "decline" }) =>
      apiClient.post<{ booking?: Booking }>(`worker/jobs/${id}/${action}`),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["worker-jobs"] });
      qc.invalidateQueries({ queryKey: ["worker-overview"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["booking"] });
      if (vars.action === "accept") toast.success("Job accepted", { description: "Added to your schedule. The customer has been informed." });
      else toast("Job declined", { description: "We'll offer it to other nearby members." });
    },
  });
}

export function useBookingStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: "en_route" | "arrived" | "in_progress" }) =>
      apiClient.post<{ booking: Booking }>(`bookings/${id}/status`, { status }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["booking", vars.id] });
      qc.invalidateQueries({ queryKey: ["worker-jobs"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useChecklistToggle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, itemId, done }: { id: string; itemId: string; done: boolean }) =>
      apiClient.post<{ booking: Booking }>(`bookings/${id}/checklist`, { itemId, done }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["booking", vars.id] });
    },
  });
}

export function useCaptureEvidence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, phase, label }: { id: string; phase: "before" | "after"; label: string }) =>
      apiClient.post<{ booking: Booking }>(`bookings/${id}/evidence`, { phase, label }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["booking", vars.id] });
    },
  });
}

export function useCompleteBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<{ booking: Booking }>(`bookings/${id}/complete`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["booking", id] });
      qc.invalidateQueries({ queryKey: ["worker-jobs"] });
      qc.invalidateQueries({ queryKey: ["worker-overview"] });
      qc.invalidateQueries({ queryKey: ["worker-earnings"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Service completed", { description: "Payment will settle once the customer confirms. They've been notified." });
    },
    onError: (err: Error) => toast.error("Cannot complete yet", { description: err.message }),
  });
}

export interface WorkerEarnings {
  summary: {
    availableBalance: number;
    pendingSettlement: number;
    weekEarnings: number;
    monthEarnings: number;
    completedJobs: number;
    avgPerJob: number;
    welfareYtd: number;
    tdsYtd: number;
    grossMonth: number;
    platformFeesMonth: number;
    welfareMonth: number;
    /** Estimated monthly net from active standing orders (weekly ×4.33, monthly ×1). */
    recurringMonthly: number;
    /** Count of active standing-order series. */
    standingOrders: number;
  };
  weeklySeries: { label: string; value: number }[];
  transactions: Transaction[];
  payouts: import("@/lib/types").Payout[];
  rates: { commissionPct: number; welfarePct: number; gstPct: number; tdsPct: number };
  nextPayoutDate: string;
}

export function useWorkerEarnings() {
  return useQuery({ queryKey: ["worker-earnings"], queryFn: () => apiClient.get<WorkerEarnings>("worker/earnings") });
}

export function useWelfare() {
  return useQuery({ queryKey: ["worker-welfare"], queryFn: () => apiClient.get<WelfareProfile>("worker/welfare") });
}

/** Member's live patronage-dividend projection from the board's current surplus draft. */
export function useMemberDividend() {
  return useQuery({ queryKey: ["worker-dividend"], queryFn: () => apiClient.get<MemberDividendView>("worker/dividend") });
}

export function useSubmitClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { type: string; amount: number; description: string }) =>
      apiClient.post<{ claim: WelfareProfile["claims"][number] }>("worker/welfare/claims", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["worker-welfare"] });
      toast.success("Claim submitted", { description: "Expect a decision within 3 working days. Reference shared in notifications." });
    },
  });
}

export function useSchedule() {
  return useQuery({
    queryKey: ["worker-schedule"],
    queryFn: () => apiClient.get<{ bookings: Booking[]; worker: Worker }>("worker/schedule"),
  });
}

export function useAvailability() {
  return useQuery({ queryKey: ["worker-availability"], queryFn: () => apiClient.get<WorkerAvailabilitySlot[]>("worker/availability") });
}

export function useSaveAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (availability: WorkerAvailabilitySlot[]) => apiClient.put<{ availability: WorkerAvailabilitySlot[] }>("worker/availability", { availability }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["worker-availability"] });
      qc.invalidateQueries({ queryKey: ["worker-overview"] });
      toast.success("Availability updated", { description: "You'll receive offers matching these slots." });
    },
  });
}

export function useVerification() {
  return useQuery({
    queryKey: ["worker-verification"],
    queryFn: () => apiClient.get<{ worker: Worker; verification: VerificationItem[]; certifications: WorkerCertification[] }>("worker/verification"),
  });
}

export function useSkills() {
  return useQuery({
    queryKey: ["worker-skills"],
    queryFn: () => apiClient.get<{ courses: SkillCourse[]; credits: number }>("worker/skills"),
  });
}

/* ------------------------- training hub --------------------------- */

export function useWorkerTraining() {
  return useQuery({ queryKey: ["worker-training"], queryFn: () => apiClient.get<WorkerTrainingData>("worker/training") });
}

export function useEnrollCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => apiClient.post<{ enrollment: TrainingEnrollment }>(`worker/training/${courseId}/enroll`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["worker-training"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Enrolled", { description: "The course is in My learning — the cooperative covers the fee." });
    },
    onError: (err: Error) => toast.error("Could not enrol", { description: err.message }),
  });
}

export function useCourseProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) =>
      apiClient.post<{ enrollment: TrainingEnrollment; modulesDone: number; moduleCount: number }>(`worker/training/${courseId}/progress`),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["worker-training"] });
      toast.success(`Module ${data.modulesDone} of ${data.moduleCount} complete`, {
        description:
          data.enrollment.progressPct >= 100
            ? "All modules done — complete the course to earn your certificate."
            : `${data.enrollment.progressPct}% through the course.`,
      });
    },
    onError: (err: Error) => toast.error("Progress not saved", { description: err.message }),
  });
}

export function useCompleteCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => apiClient.post<{ enrollment: TrainingEnrollment }>(`worker/training/${courseId}/complete`),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["worker-training"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(`Certificate ${data.enrollment.certificateId} issued`, {
        description: `Score ${data.enrollment.score ?? "—"}/100 — the credential is on your profile for customers to see.`,
      });
    },
    onError: (err: Error) => toast.error("Cannot complete yet", { description: err.message }),
  });
}

/* ---------------------------- governance --------------------------- */

export function useGovernance() {
  return useQuery({ queryKey: ["governance"], queryFn: () => apiClient.get<GovernanceData>("governance") });
}

export function useVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ proposalId, vote }: { proposalId: string; vote: "approve" | "reject" | "abstain" }) =>
      apiClient.post<{ proposal: GovernanceData["activeProposals"][number] }>("governance/vote", { proposalId, vote }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["governance"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Vote recorded", { description: "One member, one vote — thank you for participating." });
    },
    onError: (err: Error) => toast.error("Vote not recorded", { description: err.message }),
  });
}

/* ------------------------------ support ---------------------------- */

export function useSupportTickets() {
  const role = useRole();
  return useQuery({ queryKey: ["support-tickets", role], queryFn: () => apiClient.get<{ tickets: SupportTicket[] }>("support/tickets", { user: DEMO_USER_ID[role] }) });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { raisedByRole: "customer" | "worker"; type: string; category: string; subject: string; description: string; relatedBookingRef?: string }) =>
      apiClient.post<{ ticket: SupportTicket }>("support/tickets", input),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Request submitted", { description: `Reference ${data.ticket.reference}. Our team responds within 4 working hours.` });
    },
  });
}

/* ------------------------------ admin ------------------------------ */

export function useAdminOverview() {
  return useQuery({ queryKey: ["admin-overview"], queryFn: () => apiClient.get<AdminOverview>("admin/overview") });
}

export function useForecast() {
  return useQuery({ queryKey: ["admin-forecast"], queryFn: () => apiClient.get<ForecastData>("admin/forecast") });
}

export function useAdminTraining() {
  return useQuery({ queryKey: ["admin-training"], queryFn: () => apiClient.get<AdminTrainingData>("admin/training") });
}

export function useAdminWorkers(status?: string) {
  return useQuery({
    queryKey: ["admin-workers", status],
    queryFn: () => apiClient.get<{ items: (Worker & { weekJobs: number; weekEarnings: number })[] }>(`admin/workers?status=${status ?? "all"}`),
  });
}

export function useVerifications() {
  return useQuery({
    queryKey: ["admin-verifications"],
    queryFn: () => apiClient.get<{ queue: { worker: Worker; daysInQueue: number }[]; verifiedCount: number }>("admin/verifications"),
  });
}

export function useVerificationDecision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workerId, decision, note }: { workerId: string; decision: "approved" | "rejected" | "needs_action"; note?: string }) =>
      apiClient.post<{ worker: Worker }>(`admin/verifications/${workerId}/decision`, { decision, note }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["admin-verifications"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      qc.invalidateQueries({ queryKey: ["admin-workers"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(`Verification ${vars.decision.replace("_", " ")}`, { description: "The applicant has been notified." });
    },
  });
}

export function useAdminBookings(status?: string) {
  return useQuery({
    queryKey: ["admin-bookings", status],
    queryFn: () =>
      apiClient.get<{ items: { booking: Booking; customerName: string; workerName: string }[] }>(`admin/bookings?status=${status ?? "all"}`),
  });
}

export function useDisputes() {
  return useQuery({ queryKey: ["admin-disputes"], queryFn: () => apiClient.get<{ items: SupportTicket[] }>("admin/disputes") });
}

export function useResolveDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, resolution }: { ticketId: string; resolution: string }) =>
      apiClient.post<{ ticket: SupportTicket }>(`admin/disputes/${ticketId}/resolve`, { resolution }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-disputes"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Case resolved", { description: "Both parties have been notified with the resolution note." });
    },
  });
}

export function useFinance() {
  return useQuery({ queryKey: ["admin-finance"], queryFn: () => apiClient.get<FinanceOverview>("admin/finance") });
}

export interface AdminGovernance extends GovernanceData {
  participationSeries: { label: string; value: number }[];
}

export function useAdminGovernance() {
  return useQuery({ queryKey: ["admin-governance"], queryFn: () => apiClient.get<AdminGovernance>("admin/governance") });
}

export function useCreateProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; summary: string; description: string; category?: string }) =>
      apiClient.post<{ proposal: GovernanceData["activeProposals"][number] }>("admin/governance/proposals", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-governance"] });
      qc.invalidateQueries({ queryKey: ["governance"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Proposal published", { description: "All 216 members have been notified to vote." });
    },
  });
}

export function useAdminCategories() {
  return useQuery({
    queryKey: ["admin-categories"],
    queryFn: () => apiClient.get<{ categories: (ServiceCategory & { activeWorkers: number; bookings30d: number; avgRating: number })[] }>("admin/categories"),
  });
}

export function useUpdateServiceRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, serviceId, basePrice }: { categoryId: string; serviceId: string; basePrice: number }) =>
      apiClient.put<{ service: ServiceCategory["services"][number] }>(`admin/categories/${categoryId}/services/${serviceId}`, { basePrice }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Rate updated", { description: "New bookings will use the updated rate." });
    },
  });
}

export function useAuditLog() {
  return useQuery({ queryKey: ["admin-audit"], queryFn: () => apiClient.get<{ items: import("@/lib/types").AuditEntry[] }>("admin/audit") });
}

export function usePolicies() {
  return useQuery({ queryKey: ["admin-policies"], queryFn: () => apiClient.get<PlatformPolicy>("admin/policies") });
}

export function useUpdatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<PlatformPolicy>) => apiClient.put<{ policy: PlatformPolicy }>("admin/policies", patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-policies"] });
      toast.success("Policy updated", { description: "Members have been notified of the change." });
    },
  });
}

/* --------------------------- invoices (7-a) --------------------------- */

export function useInvoice(bookingId: string | undefined) {
  return useQuery({
    queryKey: ["invoice", bookingId],
    queryFn: () => apiClient.get<InvoiceData>(`invoices/${bookingId}`),
    enabled: Boolean(bookingId),
    retry: false,
  });
}

/* ----------------------- surplus & dividends (7-c) ----------------------- */

export function useAdminSurplus() {
  return useQuery({ queryKey: ["admin-surplus"], queryFn: () => apiClient.get<AdminSurplusView>("admin/surplus") });
}

export function useUpdateSurplusAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (allocations: Partial<Record<SurplusAllocationKey, number>>) =>
      apiClient.post<AdminSurplusView>("admin/surplus", { allocations }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-surplus"] });
      toast.success("Draft allocation saved", { description: "The dividend preview below reflects the new split." });
    },
  });
}

export function useSubmitSurplusProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.post<{ proposal: GovernanceProposal; surplus: AdminSurplusView }>("admin/surplus/propose"),
    onSuccess: ({ proposal }) => {
      qc.invalidateQueries({ queryKey: ["admin-surplus"] });
      qc.invalidateQueries({ queryKey: ["admin-governance"] });
      qc.invalidateQueries({ queryKey: ["governance"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(`${proposal.code} sent to member vote`, {
        description: `Dividend pool ${proposal.fiscalNote?.match(/₹[\d,]+/)?.[0] ?? "—"} — all 216 members can now vote for 14 days.`,
      });
    },
  });
}
