"use client";

import { useState } from "react";
import { LifeBuoy, MessageSquareWarning, Plus, Scale, ShieldQuestion, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, SectionCard, StatusBadge } from "@/components/shared";
import { useCreateTicket, useSupportTickets } from "@/hooks/use-api";
import { relativeTime } from "@/lib/format";
import type { SupportTicket, TicketPriority, TicketStatus } from "@/lib/types";
import { QueryGate } from "../parts";

const ISSUE_TYPES: { type: SupportTicket["type"]; label: string; description: string; icon: LucideIcon }[] = [
  {
    type: "grievance",
    label: "Grievance",
    description: "Scheduling, conduct or anything affecting your work",
    icon: MessageSquareWarning,
  },
  {
    type: "payout_issue",
    label: "Payout issue",
    description: "Missing amounts, batch errors, settlement holds",
    icon: Wallet,
  },
  {
    type: "dispute",
    label: "Customer dispute",
    description: "Disagreement about scope, quality or charges",
    icon: Scale,
  },
  {
    type: "verification_issue",
    label: "Verification issue",
    description: "Documents, credentials or renewal problems",
    icon: ShieldQuestion,
  },
];

const TICKET_CATEGORIES = ["Payments", "Scheduling", "Service quality", "Onboarding", "App & technology", "Other"];

const PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

function NewTicketDialog({ open, onOpenChange, presetType }: { open: boolean; onOpenChange: (open: boolean) => void; presetType?: SupportTicket["type"] }) {
  const create = useCreateTicket();
  const [type, setType] = useState<SupportTicket["type"]>(presetType ?? "grievance");
  const [category, setCategory] = useState(TICKET_CATEGORIES[0]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [bookingRef, setBookingRef] = useState("");
  const valid = subject.trim().length >= 5 && description.trim().length >= 15;

  const submit = () => {
    create.mutate(
      {
        raisedByRole: "worker",
        type,
        category,
        subject: subject.trim(),
        description: description.trim(),
        relatedBookingRef: bookingRef.trim() || undefined,
      },
      {
        onSuccess: () => {
          setSubject("");
          setDescription("");
          setBookingRef("");
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Raise a request</DialogTitle>
          <DialogDescription>The member support desk responds within 4 working hours. Urgent payout issues are escalated same-day.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ticket-type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as SupportTicket["type"])}>
              <SelectTrigger id="ticket-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ISSUE_TYPES.map((t) => (
                  <SelectItem key={t.type} value={t.type}>
                    {t.label}
                  </SelectItem>
                ))}
                <SelectItem value="question">General question</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="ticket-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TICKET_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket-subject">Subject</Label>
            <Input
              id="ticket-subject"
              placeholder="One line summary"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket-description">Description</Label>
            <Textarea
              id="ticket-description"
              placeholder="What happened? Include dates, references and what you'd like done."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket-ref">Related booking reference <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input
              id="ticket-ref"
              placeholder="e.g. SG-2094"
              value={bookingRef}
              onChange={(e) => setBookingRef(e.target.value)}
              className="font-mono"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={!valid || create.isPending}>
            {create.isPending ? "Submitting…" : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TicketDialog({ ticket, onClose }: { ticket: SupportTicket | null; onClose: () => void }) {
  return (
    <Dialog open={ticket !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6">{ticket?.subject}</DialogTitle>
          <DialogDescription className="tnum">
            {ticket?.reference} · raised {ticket ? relativeTime(ticket.createdAt) : ""}
          </DialogDescription>
        </DialogHeader>
        {ticket && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={ticket.status as TicketStatus} />
              <StatusBadge status={ticket.priority} label={`${PRIORITY_LABEL[ticket.priority]} priority`} />
              {ticket.assignedTo && <span className="text-xs text-muted-foreground">Assigned to {ticket.assignedTo}</span>}
            </div>
            {ticket.relatedBookingRef && (
              <p className="text-xs text-muted-foreground">
                Related booking <span className="font-mono">{ticket.relatedBookingRef}</span>
              </p>
            )}
            <div className="space-y-3">
              {ticket.messages.map((m) => (
                <div key={m.id} className={m.internal ? "hidden" : "rounded-lg border p-3.5"}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-[13px] font-medium">{m.author}</p>
                    <p className="tnum text-[11px] text-muted-foreground">{relativeTime(m.at)}</p>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{m.body}</p>
                </div>
              ))}
            </div>
            {ticket.resolution && (
              <div className="rounded-md border border-success/40 bg-primary-muted px-3.5 py-3">
                <p className="text-[13px] font-medium text-success-deep">Resolution</p>
                <p className="mt-1 text-[13px] leading-relaxed text-success-deep/85">{ticket.resolution}</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function WorkerSupport() {
  const q = useSupportTickets();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [presetType, setPresetType] = useState<SupportTicket["type"] | undefined>(undefined);
  const [selected, setSelected] = useState<SupportTicket | null>(null);

  const openNew = (type?: SupportTicket["type"]) => {
    setPresetType(type);
    setDialogOpen(true);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Support & account"
        title="Support"
        description="The member support desk is run by the cooperative — Meera handles member issues directly, and anything unresolved goes to the elected grievance committee."
        actions={
          <Button size="sm" onClick={() => openNew()}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.9} />
            New request
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="My requests" description="Everything you've raised, with the full response thread.">
            <QueryGate query={q}>
              {(data) =>
                data.tickets.length > 0 ? (
                  <ul className="space-y-2.5">
                    {data.tickets.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(t)}
                          className="w-full cursor-pointer rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/30 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium leading-snug">{t.subject}</p>
                              <p className="tnum mt-1 text-xs text-muted-foreground">
                                {t.reference} · updated {relativeTime(t.updatedAt)}
                                {t.assignedTo ? ` · ${t.assignedTo}` : ""}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <StatusBadge status={t.status} />
                              <StatusBadge status={t.priority} label={PRIORITY_LABEL[t.priority]} />
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-lg border border-dashed bg-muted/30 px-6 py-12 text-center">
                    <LifeBuoy className="mx-auto mb-3 h-5 w-5 text-muted-foreground" strokeWidth={1.9} />
                    <p className="text-sm font-medium">No requests yet</p>
                    <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-muted-foreground">
                      Payout questions, disputes and verification issues all start here. Median first response: 47 minutes.
                    </p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => openNew()}>
                      Raise a request
                    </Button>
                  </div>
                )
              }
            </QueryGate>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Most common for members" description="Pick a category to start.">
            <ul className="space-y-2">
              {ISSUE_TYPES.map((t) => (
                <li key={t.type}>
                  <button
                    type="button"
                    onClick={() => openNew(t.type)}
                    className="flex w-full cursor-pointer items-start gap-3 rounded-lg border bg-card p-3.5 text-left transition-colors hover:border-primary/30 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
                      <t.icon className="h-4 w-4" strokeWidth={1.9} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium">{t.label}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{t.description}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="How support works">
            <ul className="space-y-2.5 text-[13px] leading-relaxed text-muted-foreground">
              <li>First response within 4 working hours; payout issues same-day.</li>
              <li>Unresolved cases after 3 days go to the elected grievance committee — three members, not staff.</li>
              <li>Everything is on the record: every reply is logged against your membership.</li>
            </ul>
          </SectionCard>
        </div>
      </div>

      <NewTicketDialog key={presetType ?? "none"} open={dialogOpen} onOpenChange={setDialogOpen} presetType={presetType} />
      <TicketDialog ticket={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
