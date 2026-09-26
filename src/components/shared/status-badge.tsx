"use client";

import { cn } from "@/lib/utils";
import type {
  BenefitStatus,
  BookingStatus,
  PaymentStatus,
  ProposalStatus,
  TicketPriority,
  TicketStatus,
  VerificationItemStatus,
  WorkerStatus,
} from "@/lib/types";

type Tone = "success" | "warning" | "destructive" | "info" | "neutral" | "primary";

/* Tone classes are semantic tokens (globals.css :root + .dark) so every badge
   adapts to dark mode. `*-deep` = readable text on the matching `*-muted` tint. */
const TONES: Record<Tone, { dot: string; text: string; bg: string; border: string }> = {
  success: { dot: "bg-success", text: "text-success-deep", bg: "bg-success-muted", border: "border-success/40" },
  warning: { dot: "bg-warning", text: "text-warning-deep", bg: "bg-warning-muted", border: "border-warning/40" },
  destructive: { dot: "bg-destructive", text: "text-destructive-deep", bg: "bg-destructive-muted", border: "border-destructive/40" },
  info: { dot: "bg-info", text: "text-info-deep", bg: "bg-info-muted", border: "border-info/40" },
  neutral: { dot: "bg-muted-foreground", text: "text-muted-foreground", bg: "bg-muted", border: "border-border" },
  primary: { dot: "bg-primary", text: "text-primary", bg: "bg-accent", border: "border-primary/40" },
};

const STATUS_TONE: Record<string, Tone> = {
  /* worker / verification */
  verified: "success",
  active: "success",
  under_review: "info",
  pending: "warning",
  not_started: "neutral",
  needs_action: "warning",
  rejected: "destructive",
  suspended: "destructive",
  opt_in: "info",
  /* bookings */
  pending_acceptance: "warning",
  confirmed: "info",
  en_route: "info",
  arrived: "info",
  in_progress: "primary",
  awaiting_confirmation: "warning",
  completed: "success",
  cancelled: "neutral",
  declined: "neutral",
  /* payments */
  authorized: "info",
  settled: "success",
  refunded: "neutral",
  failed: "destructive",
  credited: "success",
  in_payout: "info",
  paid_out: "success",
  processing: "info",
  processed: "success",
  /* tickets */
  open: "warning",
  in_review: "info",
  awaiting_response: "warning",
  resolved: "success",
  escalated: "destructive",
  /* proposals */
  passed: "success",
  draft: "neutral",
  closed: "neutral",
  submitted: "info",
  approved: "success",
  info_requested: "warning",
  /* priority */
  low: "neutral",
  medium: "info",
  high: "warning",
  urgent: "destructive",
};

const LABELS: Record<string, string> = {
  pending_acceptance: "Pending acceptance",
  en_route: "On the way",
  arrived: "Arrived",
  in_progress: "In progress",
  awaiting_confirmation: "Awaiting confirmation",
  needs_action: "Needs action",
  under_review: "Under review",
  not_started: "Not started",
  in_payout: "In payout",
  paid_out: "Paid out",
  opt_in: "Opt-in",
  info_requested: "Info requested",
};

export function statusLabel(status: string): string {
  return LABELS[status] ?? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({
  status,
  label,
  className,
  dotOnly,
}: {
  status: string;
  label?: string;
  className?: string;
  dotOnly?: boolean;
}) {
  const tone = TONES[STATUS_TONE[status] ?? "neutral"];
  if (dotOnly) {
    return <span className={cn("inline-block h-1.5 w-1.5 rounded-full", tone.dot, className)} aria-hidden />;
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-[11px] font-medium",
        tone.bg,
        tone.text,
        tone.border,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} aria-hidden />
      {label ?? statusLabel(status)}
    </span>
  );
}

/* typed re-exports for convenience */
export type StatusLike =
  | WorkerStatus
  | VerificationItemStatus
  | BookingStatus
  | PaymentStatus
  | TicketStatus
  | TicketPriority
  | ProposalStatus
  | BenefitStatus;
