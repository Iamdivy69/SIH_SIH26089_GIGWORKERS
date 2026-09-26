"use client";

import { useState } from "react";
import { GraduationCap, HandCoins, HeartPulse, Landmark, Plus, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, PageHeader, SectionCard, StatTile, StatusBadge } from "@/components/shared";
import type { Column } from "@/components/shared";
import { useSubmitClaim, useWelfare } from "@/hooks/use-api";
import { dateShort, money } from "@/lib/format";
import type { WelfareBenefit, WelfareContribution } from "@/lib/types";
import { QueryGate } from "../parts";

const BENEFIT_ICONS: Record<string, LucideIcon> = {
  "ben-health": HeartPulse,
  "ben-accident": ShieldCheck,
  "ben-pension": Landmark,
  "ben-skill": GraduationCap,
  "ben-emergency": HandCoins,
};

const CLAIM_TYPES = [
  "Health check-up reimbursement",
  "Accident & injury claim",
  "Emergency advance request",
  "Skill course fee reimbursement",
  "Other",
];

function BenefitCard({ benefit }: { benefit: WelfareBenefit }) {
  const Icon = BENEFIT_ICONS[benefit.id] ?? HeartPulse;
  return (
    <article className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted/50 text-muted-foreground">
            <Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden />
          </span>
          <h3 className="text-[15px] font-semibold leading-tight tracking-tight">{benefit.name}</h3>
        </div>
        <StatusBadge status={benefit.status} />
      </div>
      <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">{benefit.description}</p>
      {benefit.value && <p className="tnum mt-3 text-sm font-semibold">{benefit.value}</p>}
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{benefit.meta}</p>
      {benefit.policyRef && <p className="mt-2.5 font-mono text-[11px] text-muted-foreground/80">Policy {benefit.policyRef}</p>}
    </article>
  );
}

function NewClaimDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const claim = useSubmitClaim();
  const [type, setType] = useState(CLAIM_TYPES[0]);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const valid = Number(amount) > 0 && description.trim().length >= 10;

  const submit = () => {
    claim.mutate(
      { type, amount: Math.round(Number(amount)), description: description.trim() },
      {
        onSuccess: () => {
          setAmount("");
          setDescription("");
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Submit a welfare claim</DialogTitle>
          <DialogDescription>
            The welfare committee reviews claims within 3 working days. Approved amounts settle to Bank ••4417 (simulated).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="claim-type">Claim type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="claim-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLAIM_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="claim-amount">Amount (₹)</Label>
            <Input
              id="claim-amount"
              type="number"
              min={1}
              placeholder="e.g. 1850"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="tnum"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="claim-description">Details</Label>
            <Textarea
              id="claim-description"
              placeholder="What is this claim for? Include dates, provider and any bill references."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">At least 10 characters — this note goes to the welfare committee.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={!valid || claim.isPending}>
            {claim.isPending ? "Submitting…" : "Submit claim"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WorkerWelfare() {
  const q = useWelfare();
  const [claimOpen, setClaimOpen] = useState(false);

  const contributionColumns: Column<WelfareContribution>[] = [
    { key: "date", header: "Date", cell: (c) => <span className="tnum text-muted-foreground">{dateShort(c.date)}</span> },
    { key: "booking", header: "From booking", cell: (c) => <span className="font-mono text-[12px]">{c.bookingRef}</span> },
    {
      key: "amount",
      header: "Contribution",
      align: "right",
      cell: (c) => <span className="tnum font-medium text-success-deep">+ {money(c.amount)}</span>,
    },
    { key: "balance", header: "Balance after", align: "right", cell: (c) => <span className="tnum text-muted-foreground">{money(c.balanceAfter)}</span> },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Earnings & benefits"
        title="Welfare & benefits"
        description="Your cooperative safety net. Every completed job adds 3% to your fund — and the cooperative matches part of it. Nothing here is charity; you earned it."
        actions={
          <Button size="sm" onClick={() => setClaimOpen(true)}>
            <Plus className="h-3.5 w-3.5" strokeWidth={1.9} />
            New claim
          </Button>
        }
      />
      <QueryGate query={q}>
        {(data) => (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile label="Welfare fund balance" value={money(data.fundBalance)} sub="Grows with every completed job" emphasis />
              <StatTile label="Contributed this year" value={money(data.ytdContribution)} sub="Your 3% share of service charges" />
              <StatTile label="Cooperative match" value={money(data.coopMatchYtd)} sub="1:1 on the first ₹500 per quarter" />
              <StatTile label="Emergency assistance" value={money(data.emergencyAssistanceLimit)} sub="Interest-free advance limit" />
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="min-w-0 space-y-6 lg:col-span-2">
                <SectionCard title="Your benefits" description="Negotiated by the cooperative — group rates no individual gig worker gets.">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {data.benefits.map((b) => (
                      <BenefitCard key={b.id} benefit={b} />
                    ))}
                  </div>
                </SectionCard>

                <SectionCard
                  title="Contributions"
                  description="Every rupee traced to the booking that generated it."
                  forTable
                >
                  <div className="max-h-[380px] overflow-y-auto scroll-slim">
                    <DataTable
                      columns={contributionColumns}
                      rows={data.contributions}
                      getRowKey={(c) => c.id}
                      dense
                      emptyTitle="No contributions yet"
                      emptyDescription="Contributions appear as customers confirm completed services."
                    />
                  </div>
                </SectionCard>
              </div>

              <div className="space-y-6">
                <SectionCard title="Pension pot" description="Your welfare balance doubles as your retirement corpus.">
                  <p className="tnum text-2xl font-semibold tracking-tight">{money(data.pensionPot)}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    Withdrawable from age 58, or in full if you exit the cooperative after two years of membership. The cooperative match is
                    already included.
                  </p>
                </SectionCard>

                <SectionCard title="Claims" description="Submitted, under review and settled.">
                  <ul className="max-h-[400px] space-y-3 overflow-y-auto scroll-slim pr-1">
                    {data.claims.map((c) => (
                      <li key={c.id} className="rounded-lg border p-3.5">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[13px] font-medium leading-snug">{c.type}</p>
                          <StatusBadge status={c.status} />
                        </div>
                        <p className="tnum mt-1 text-sm font-semibold">{money(c.amount)}</p>
                        <p className="tnum mt-0.5 text-xs text-muted-foreground">
                          {c.reference} · submitted {dateShort(c.submittedAt)}
                        </p>
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{c.description}</p>
                        {c.decisionNote && (
                          <p className="mt-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs leading-relaxed text-muted-foreground">
                            <span className="font-medium text-foreground/80">Decision:</span> {c.decisionNote}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </SectionCard>

                <SectionCard title="Eligibility & rules">
                  <Accordion type="multiple" className="px-0">
                    <AccordionItem value="funding">
                      <AccordionTrigger className="text-[13px]">Who funds your welfare account?</AccordionTrigger>
                      <AccordionContent className="text-[13px] leading-relaxed text-muted-foreground">
                        3% of every service charge you earn is credited to your fund (customers pay it as part of their bill), and the
                        cooperative matches your contributions 1:1 on the first ₹500 per quarter from surplus. Members voted on this model in
                        2024.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="claims">
                      <AccordionTrigger className="text-[13px]">What can you claim?</AccordionTrigger>
                      <AccordionContent className="text-[13px] leading-relaxed text-muted-foreground">
                        Health check-up reimbursements, occupational injury costs (accident cover applies first), emergency advances up to
                        ₹15,000 (interest-free, repayable over 6 months) and skill course fees for approved certifications.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="timeline">
                      <AccordionTrigger className="text-[13px]">How are claims decided?</AccordionTrigger>
                      <AccordionContent className="text-[13px] leading-relaxed text-muted-foreground">
                        The five-member welfare committee (elected at the general body) reviews claims every Tuesday and Friday. Decisions
                        within 3 working days; settlements go to your registered bank account. You can appeal to the general body.
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="exit">
                      <AccordionTrigger className="text-[13px]">What if you leave the cooperative?</AccordionTrigger>
                      <AccordionContent className="text-[13px] leading-relaxed text-muted-foreground">
                        Your own contributions and the pension pot are always yours. Cooperative matches vest after two years of membership.
                        Share capital is refunded per the bye-laws on exit.
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </SectionCard>
              </div>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Insurance covers, claim decisions and fund transfers are simulated in this prototype. The contribution mathematics, however, is
              real: every contribution row above is derived from an actual settled booking.
            </p>
          </div>
        )}
      </QueryGate>
      <NewClaimDialog open={claimOpen} onOpenChange={setClaimOpen} />
    </div>
  );
}
