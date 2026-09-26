"use client";

import { useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@/components/shared";
import { FilterChips, FineNote, KpiStrip, MasterDetail, RoleChip, SelectPrompt, useIsDesktop } from "./ui";
import { useDisputes, useResolveDispute } from "@/hooks/use-api";
import { dateTimeLabel, num, relativeTime } from "@/lib/format";
import type { SupportTicket } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPE_CHIPS = [
  { value: "all", label: "All" },
  { value: "dispute", label: "Disputes" },
  { value: "complaint", label: "Complaints" },
  { value: "grievance", label: "Grievances" },
  { value: "payout_issue", label: "Payout" },
  { value: "verification_issue", label: "Verification" },
  { value: "question", label: "Questions" },
];

const ASSIGNEES = ["Meera Kulkarni (Member Support)", "Kiran Rao (Operations)", "Finance Desk"];

const TYPE_LABEL: Record<SupportTicket["type"], string> = {
  complaint: "Complaint",
  dispute: "Dispute",
  grievance: "Grievance",
  payout_issue: "Payout issue",
  verification_issue: "Verification",
  question: "Question",
};

const STATUS_RANK: Record<SupportTicket["status"], number> = {
  escalated: 0,
  open: 1,
  in_review: 2,
  awaiting_response: 3,
  resolved: 4,
};

type LocalMessage = { id: string; at: string; author: string; body: string; staff?: boolean };

/** Disputes & support — case management for members and customers. */
export function AdminDisputesScreen() {
  const disputes = useDisputes();
  const resolve = useResolveDispute();
  const isDesktop = useIsDesktop();

  const [type, setType] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [replies, setReplies] = useState<Record<string, LocalMessage[]>>({});

  const items = disputes.data?.items ?? [];

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || +new Date(b.updatedAt) - +new Date(a.updatedAt),
      ),
    [items],
  );

  const filtered = useMemo(
    () => sorted.filter((t) => type === "all" || t.type === type),
    [sorted, type],
  );

  const selected = filtered.find((t) => t.id === selectedId) ?? sorted.find((t) => t.id === selectedId) ?? sorted[0] ?? null;

  const stats = useMemo(
    () => ({
      open: items.filter((t) => t.status === "open").length,
      escalated: items.filter((t) => t.status === "escalated").length,
      awaiting: items.filter((t) => t.status === "awaiting_response").length,
      resolved: items.filter((t) => t.status === "resolved").length,
    }),
    [items],
  );

  if (disputes.isError) {
    return (
      <>
        <PageHeader eyebrow="Resolution" title="Disputes & support" />
        <ErrorState message="The case list could not be loaded." onRetry={() => disputes.refetch()} />
      </>
    );
  }

  const loading = disputes.isLoading;

  return (
    <>
      <PageHeader
        eyebrow="Resolution · case management"
        title="Disputes & support"
        description="Every complaint, dispute and grievance from members and customers, with the full correspondence thread. Escalations reach this desk first."
      />

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-[76px] rounded-lg" />
          <Skeleton className="h-[420px] rounded-lg" />
        </div>
      ) : (
        <>
          <KpiStrip
            className="mb-4"
            cells={[
              { label: "Open", value: num(stats.open), sub: "awaiting first response" },
              { label: "Escalated", value: num(stats.escalated), sub: "operations lead", tone: stats.escalated > 0 ? "critical" : "default" },
              { label: "Awaiting party", value: num(stats.awaiting), sub: "waiting on customer/member" },
              { label: "Resolved", value: num(stats.resolved), sub: "incl. this month" },
            ]}
          />

          <div className="mb-4">
            <FilterChips ariaLabel="Filter cases by type" value={type} onChange={setType} options={TYPE_CHIPS} />
          </div>

          <MasterDetail
            selectedKey={selected?.id ?? null}
            list={
              <SectionCard title="Cases" description="Unresolved first, then most recently updated." forTable>
                <ul className="divide-y">
                  {filtered.map((t) => {
                    const active = selected?.id === t.id;
                    return (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(t.id);
                            if (!isDesktop) setDialogOpen(true);
                          }}
                          aria-current={active}
                          className={cn(
                            "w-full px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring",
                            active && "bg-primary-muted",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="tnum text-xs font-medium">{t.reference}</span>
                            <StatusBadge status={t.priority} />
                          </div>
                          <p className="mt-1 text-[13px] font-medium leading-snug">{t.subject}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <RoleChip role={t.raisedByRole} />
                            <span className="truncate">{t.raisedByName}</span>
                            <span aria-hidden>·</span>
                            <span>{TYPE_LABEL[t.type]}</span>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <StatusBadge status={t.status} />
                            <span className="tnum text-[11px] text-muted-foreground">{relativeTime(t.updatedAt)}</span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {filtered.length === 0 && (
                  <div className="p-5">
                    <EmptyState title="No cases of this type" description="Switch the filter to see other case types." />
                  </div>
                )}
              </SectionCard>
            }
            detail={
              selected ? (
                <SectionCard title="Case file" description={`${selected.reference} · raised by ${selected.raisedByName}`}>
                  <CaseDetail
                    ticket={selected}
                    assignedOverride={assignments[selected.id]}
                    localMessages={replies[selected.id] ?? []}
                    onResolved={() => setSelectedId(selected.id)}
                    onAssign={(a) => {
                      setAssignments((prev) => ({ ...prev, [selected.id]: a }));
                      toast.success("Case assigned", { description: `${selected.reference} assigned to ${a}. (Simulated assignment)` });
                    }}
                    onReply={(body) => {
                      const msg: LocalMessage = {
                        id: `local-${Date.now()}`,
                        at: new Date().toISOString(),
                        author: "Kiran Rao (Operations)",
                        body,
                        staff: true,
                      };
                      setReplies((prev) => ({ ...prev, [selected.id]: [...(prev[selected.id] ?? []), msg] }));
                      toast.success("Reply sent", { description: `${selected.raisedByName} has been notified. (Simulated delivery)` });
                    }}
                    resolve={resolve}
                  />
                </SectionCard>
              ) : (
                <SelectPrompt title="No case selected" description="Pick a case from the list to read the thread and take action." />
              )
            }
          />
        </>
      )}

      <Dialog open={dialogOpen && !isDesktop} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto scroll-slim sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="tnum">{selected.reference}</DialogTitle>
                <DialogDescription>
                  {selected.subject} · raised by {selected.raisedByName}
                </DialogDescription>
              </DialogHeader>
              <CaseDetail
                ticket={selected}
                assignedOverride={assignments[selected.id]}
                localMessages={replies[selected.id] ?? []}
                onResolved={() => setSelectedId(selected.id)}
                onAssign={(a) => {
                  setAssignments((prev) => ({ ...prev, [selected.id]: a }));
                  toast.success("Case assigned", { description: `${selected.reference} assigned to ${a}. (Simulated assignment)` });
                }}
                onReply={(body) => {
                  const msg: LocalMessage = {
                    id: `local-${Date.now()}`,
                    at: new Date().toISOString(),
                    author: "Kiran Rao (Operations)",
                    body,
                    staff: true,
                  };
                  setReplies((prev) => ({ ...prev, [selected.id]: [...(prev[selected.id] ?? []), msg] }));
                  toast.success("Reply sent", { description: `${selected.raisedByName} has been notified. (Simulated delivery)` });
                }}
                resolve={resolve}
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function CaseDetail({
  ticket,
  assignedOverride,
  localMessages,
  onAssign,
  onReply,
  onResolved,
  resolve,
}: {
  ticket: SupportTicket;
  assignedOverride?: string;
  localMessages: LocalMessage[];
  onAssign: (assignee: string) => void;
  onReply: (body: string) => void;
  onResolved: () => void;
  resolve: ReturnType<typeof useResolveDispute>;
}) {
  const [draft, setDraft] = useState("");
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolution, setResolution] = useState("");

  const assigned = assignedOverride ?? ticket.assignedTo ?? "Unassigned";
  const messages: LocalMessage[] = [
    ...ticket.messages.map((m) => ({ ...m, staff: /(Kiran|Meera|Finance)/.test(m.author) })),
    ...localMessages,
  ];
  const isStaffAuthor = (author: string) => /(Kiran|Meera|Finance)/.test(author);
  const resolutionValid = resolution.trim().length >= 20;
  const pending = resolve.isPending;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-y py-4 sm:grid-cols-4">
        <Field label="Status" value={<StatusBadge status={ticket.status} />} />
        <Field label="Priority" value={<StatusBadge status={ticket.priority} />} />
        <Field label="Raised by" value={<span className="flex items-center gap-1.5"><RoleChip role={ticket.raisedByRole} />{ticket.raisedByName.split(" ")[0]}</span>} />
        <Field label="Type" value={<span>{TYPE_LABEL[ticket.type]} · {ticket.category}</span>} />
        <Field label="Created" value={<span className="tnum">{dateTimeLabel(ticket.createdAt)}</span>} />
        <Field label="Last update" value={<span className="tnum">{relativeTime(ticket.updatedAt)}</span>} />
        <div className="col-span-2">
          <Field label="Assigned to" value={<span className="text-[13px]">{assigned}</span>} />
        </div>
      </div>

      <section aria-label="Case description">
        <h4 className="micro-label mb-2">Description</h4>
        <p className="rounded-md border bg-muted/30 px-3 py-2.5 text-[13px] leading-relaxed">{ticket.description}</p>
        {ticket.relatedBookingRef && (
          <p className="tnum mt-2 text-xs text-muted-foreground">
            Related booking <span className="font-medium text-foreground">{ticket.relatedBookingRef}</span>
          </p>
        )}
      </section>

      <section aria-label="Correspondence">
        <h4 className="micro-label mb-2">Correspondence ({num(messages.length)})</h4>
        <ul className="space-y-3">
          {messages.map((m) => (
            <li
              key={m.id}
              className={cn(
                "rounded-md border px-3 py-2.5",
                isStaffAuthor(m.author) ? "border-primary/40/60 bg-primary-muted/60" : "bg-card",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-medium leading-tight">
                  {m.author}
                  {isStaffAuthor(m.author) && <span className="micro-label ml-2 text-muted-foreground">Sahyog desk</span>}
                </p>
                <time className="tnum shrink-0 text-[11px] text-muted-foreground" dateTime={m.at}>
                  {dateTimeLabel(m.at)}
                </time>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/90">{m.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {ticket.status === "resolved" ? (
        <section aria-label="Resolution">
          <h4 className="micro-label mb-2">Resolution</h4>
          <p className="rounded-md border border-success/40 bg-primary-muted px-3 py-2.5 text-[13px] leading-relaxed">
            <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5 text-success-deep" strokeWidth={1.9} />
            {ticket.resolution ?? "Resolved by the support desk."}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 text-muted-foreground"
            onClick={() => toast("Reopen request noted", { description: "The case will return to the open queue after review. (Simulated)" })}
          >
            Request reopen
          </Button>
        </section>
      ) : (
        <section aria-label="Actions" className="space-y-4 border-t pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={assigned} onValueChange={onAssign}>
              <SelectTrigger className="h-8 w-full max-w-[280px] text-[13px]" aria-label="Assign case">
                <SelectValue placeholder="Assign to" />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNEES.map((a) => (
                  <SelectItem key={a} value={a} className="text-[13px]">
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => {
                if (draft.trim().length < 5) {
                  toast.error("Reply is too short", { description: "Write a few words so the customer knows where things stand." });
                  return;
                }
                onReply(draft.trim());
                setDraft("");
              }}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.9} />
              Send reply
            </Button>
          </div>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Reply to ${ticket.raisedByName.split(" ")[0]} — visible to both parties…`}
            rows={3}
            className="text-[13px]"
            aria-label="Reply message"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FineNote>Replies are delivered in-app and by SMS. Assignment changes are logged.</FineNote>
            <Button size="sm" onClick={() => setResolveOpen(true)}>
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.9} />
              Resolve case
            </Button>
          </div>
        </section>
      )}

      <AlertDialog open={resolveOpen} onOpenChange={(open) => !open && setResolveOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resolve {ticket.reference}?</AlertDialogTitle>
            <AlertDialogDescription>
              The resolution note is shared with {ticket.raisedByName} and recorded on the case. Both parties are notified, and the
              outcome feeds the monthly service-quality report.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-1.5">
            <label className="text-[13px] font-medium" htmlFor="resolution-note">
              Resolution note <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="resolution-note"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="What was decided, and what happens next for the customer/member…"
              rows={4}
              className="text-[13px]"
            />
            {resolution.trim().length > 0 && !resolutionValid && (
              <p className="text-xs text-destructive-deep">A little more detail please (min 20 characters) — this note is shared verbatim.</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!resolutionValid || pending}
              onClick={(e) => {
                e.preventDefault();
                if (!resolutionValid) return;
                resolve.mutate(
                  { ticketId: ticket.id, resolution: resolution.trim() },
                  {
                    onSuccess: () => {
                      setResolveOpen(false);
                      setResolution("");
                      onResolved();
                    },
                  },
                );
              }}
            >
              {pending ? "Resolving…" : "Resolve case"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="micro-label">{label}</p>
      <div className="mt-1 text-[13px] font-medium">{value}</div>
    </div>
  );
}
