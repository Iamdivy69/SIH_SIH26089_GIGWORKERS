"use client";

import { useState } from "react";
import { CircleHelp, MessageSquarePlus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingPanel, PageHeader, SectionCard, StatusBadge } from "@/components/shared";
import { useBookings, useCreateTicket, useSupportTickets } from "@/hooks/use-api";
import { relativeTime } from "@/lib/format";
import type { SupportTicket } from "@/lib/types";
import { TICKET_CATEGORIES, TICKET_TYPES, ticketTypeLabel } from "../constants";

const FAQ_ITEMS = [
  {
    id: "faq-welfare",
    q: "What is the welfare contribution on my bill?",
    a: "Every booking adds a 3% welfare contribution on top of the service charge. It is credited in full to the fund of the member who served you — it pays for their health cover, accident cover and pension pot. Members see their own fund statement in their app, and the cooperative publishes a quarterly welfare summary.",
  },
  {
    id: "faq-cancellation",
    q: "What happens if I cancel a booking?",
    a: "You can cancel free of charge any time before the member starts travelling. Once they are on the way, a late-cancellation fee of 25% of the service charge applies — it compensates the member for the blocked slot. The rest of the held amount is refunded to your payment method.",
  },
  {
    id: "faq-verification",
    q: "How are members verified?",
    a: "Every joining member completes ID proof, address proof, a police record check and a trade skill assessment before they can accept bookings. Certifications are checked against issuing bodies. Verification renews yearly, and suspended members cannot receive new requests.",
  },
  {
    id: "faq-ratings",
    q: "How do ratings work?",
    a: "After you confirm a completed service you can rate it 1–5 with quick tags. Ratings are only accepted from verified bookings, both sides rate each other, and the member's cooperative record carries their running average. Ratings affect matching — better-rated members get offered more work.",
  },
];

export function SupportScreen() {
  const { data, isLoading, isError, refetch } = useSupportTickets();
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const tickets = data?.tickets ?? [];

  return (
    <div>
      <PageHeader
        eyebrow="Support"
        title="Help & requests"
        description="Raise a request with the member support desk — typical first response within 4 working hours. Disputes over a specific booking can be linked directly to it."
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <MessageSquarePlus className="h-4 w-4" strokeWidth={1.9} /> New request
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <SectionCard title="My requests" description="Your tickets with the support desk." className="self-start">
          {isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : isLoading ? (
            <LoadingPanel rows={3} className="border-0" />
          ) : tickets.length === 0 ? (
            <EmptyState
              icon={<CircleHelp className="h-5 w-5" />}
              title="No requests raised yet"
              description="Anything billing, booking or quality related — the desk is staffed by the cooperative's member support team."
              action={
                <Button variant="outline" size="sm" onClick={() => setNewOpen(true)}>
                  Raise a request
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border/70">
              {tickets.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(t)}
                    className="flex w-full flex-col gap-1.5 py-3.5 text-left transition-colors hover:bg-muted/40"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold">{t.subject}</span>
                      <StatusBadge status={t.status} />
                    </span>
                    <span className="tnum text-xs text-muted-foreground">
                      {t.reference} · {ticketTypeLabel(t.type)} · {t.category} · updated {relativeTime(t.updatedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Frequently asked" description="How the cooperative works, in plain terms.">
          <Accordion type="single" collapsible className="w-full">
            {FAQ_ITEMS.map((f) => (
              <AccordionItem key={f.id} value={f.id}>
                <AccordionTrigger className="text-left text-[13px] font-medium hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-[13px] leading-relaxed text-muted-foreground">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </SectionCard>
      </div>

      <TicketDialog ticket={selected} onClose={() => setSelected(null)} />
      <NewRequestDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}

function TicketDialog({ ticket, onClose }: { ticket: SupportTicket | null; onClose: () => void }) {
  if (!ticket) return null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
            {ticket.subject}
            <StatusBadge status={ticket.status} />
          </DialogTitle>
          <DialogDescription className="tnum">
            {ticket.reference} · {ticketTypeLabel(ticket.type)} · {ticket.category}
            {ticket.relatedBookingRef ? ` · booking ${ticket.relatedBookingRef}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[320px] space-y-3 overflow-y-auto scroll-slim pr-1">
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-[13px] leading-relaxed">{ticket.description}</p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              {ticket.raisedByName} · {relativeTime(ticket.createdAt)}
            </p>
          </div>
          {ticket.messages.map((m) => (
            <div key={m.id} className="rounded-md border p-3">
              <p className="text-[13px] leading-relaxed">{m.body}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {m.author} · {relativeTime(m.at)}
              </p>
            </div>
          ))}
          {ticket.resolution && (
            <div className="rounded-md border border-[oklch(0.88_0.05_155)] bg-[oklch(0.945_0.034_155)] p-3">
              <p className="micro-label mb-1 text-[oklch(0.40_0.09_155)]">Resolution</p>
              <p className="text-[13px] leading-relaxed">{ticket.resolution}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewRequestDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createTicket = useCreateTicket();
  const { data: bookingsData } = useBookings({ customerId: "c-ananya" });
  const bookings = (bookingsData?.items ?? []).slice(0, 8);

  const [type, setType] = useState<string>("complaint");
  const [category, setCategory] = useState<string>(TICKET_CATEGORIES[0]);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [bookingRef, setBookingRef] = useState<string>("none");

  const valid = subject.trim().length >= 5 && description.trim().length >= 15;

  const submit = () => {
    createTicket.mutate(
      {
        raisedByRole: "customer",
        type,
        category,
        subject: subject.trim(),
        description: description.trim(),
        relatedBookingRef: bookingRef !== "none" ? bookingRef : undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          setSubject("");
          setDescription("");
          setBookingRef("none");
          setType("complaint");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Raise a support request</DialogTitle>
          <DialogDescription>
            The member support desk replies within 4 working hours. For urgent on-site issues, call the member first from the booking page.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="tk-type" className="text-[13px]">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="tk-type" className="mt-1.5 text-[13px]" aria-label="Request type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tk-category" className="text-[13px]">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="tk-category" className="mt-1.5 text-[13px]" aria-label="Request category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="tk-subject" className="text-[13px]">Subject</Label>
            <Input
              id="tk-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="One line summary"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="tk-desc" className="text-[13px]">Description</Label>
            <Textarea
              id="tk-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened, and what would resolve it for you?"
              rows={4}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="tk-booking" className="text-[13px]">
              Related booking <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Select value={bookingRef} onValueChange={setBookingRef}>
              <SelectTrigger id="tk-booking" className="mt-1.5 text-[13px]" aria-label="Related booking">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific booking</SelectItem>
                {bookings.map((b) => (
                  <SelectItem key={b.id} value={b.reference}>
                    {b.reference} · {b.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || createTicket.isPending}>
            {createTicket.isPending ? (
              "Submitting…"
            ) : (
              <>
                <Send className="h-4 w-4" strokeWidth={1.9} /> Submit request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
