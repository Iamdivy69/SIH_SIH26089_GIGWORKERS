"use client";

import { useState } from "react";
import { BellRing, CalendarDays, Plus, Vote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  EmptyState,
  ErrorState,
  LineTrend,
  PageHeader,
  SectionCard,
  StatusBadge,
} from "@/components/shared";
import { FineNote, KpiStrip, KpiStripSkeleton } from "./ui";
import { useAdminGovernance, useCreateProposal } from "@/hooks/use-api";
import { dateFull, money, moneyCompact, num, pctLabel } from "@/lib/format";
import type { GovernanceProposal } from "@/lib/types";
import { cn } from "@/lib/utils";

const DAY_MS = 86_400_000;

const PROPOSAL_CATEGORIES = ["Member development", "Welfare", "Scheduling", "Finance", "General"];

/** Governance desk — member democracy, run cooperatively. */
export function AdminGovernanceScreen() {
  const governance = useAdminGovernance();

  if (governance.isError) {
    return (
      <>
        <PageHeader eyebrow="Cooperative · governance" title="Governance" />
        <ErrorState message="Governance data could not be loaded." onRetry={() => governance.refetch()} />
      </>
    );
  }

  const loading = governance.isLoading || !governance.data;
  const d = governance.data;
  const currentParticipation = d?.participationSeries[d.participationSeries.length - 1]?.value ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Cooperative · governance"
        title="Governance"
        description="One member, one vote — 216 member-owners set the cooperative's policy. This desk publishes proposals, monitors participation and records outcomes."
        actions={<PublishProposalDialog />}
      />

      {loading ? (
        <KpiStripSkeleton count={4} className="mb-6" />
      ) : (
        <KpiStrip
          className="mb-6"
          cells={[
            { label: "Eligible voters", value: num(d.activeProposals[0]?.eligibleMembers ?? 216), sub: "member-owners" },
            { label: "Active proposals", value: num(d.activeProposals.length), sub: "voting open now" },
            {
              label: "Current participation",
              value: pctLabel(currentParticipation),
              sub: "of eligible members",
              tone: currentParticipation >= 50 ? "positive" : "attention",
            },
            { label: "Quorum required", value: pctLabel(d.activeProposals[0]?.quorumPct ?? 50), sub: "for a valid outcome" },
          ]}
        />
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Voter participation"
          description="Share of eligible members casting a vote, by quarter."
        >
          {loading ? <Skeleton className="h-[208px] w-full" /> : <LineTrend data={d.participationSeries} suffix="%" max={100} height={212} />}
        </SectionCard>

        <SectionCard title="Member dividend" description="FY 2025-26 — surplus returned to members.">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ) : (
            <div className="space-y-3.5">
              <div>
                <p className="micro-label">Surplus generated</p>
                <p className="tnum mt-0.5 text-xl font-semibold tracking-tight">{moneyCompact(d.dividend.surplus)}</p>
              </div>
              <div>
                <p className="micro-label">Patronage bonus distributed</p>
                <p className="tnum mt-0.5 text-xl font-semibold tracking-tight text-success-deep">
                  {moneyCompact(d.dividend.patronageBonus)}
                </p>
              </div>
              <FineNote>
                {money(d.dividend.myShare)} average share · 216 members · distributed {dateFull(d.dividend.distributedAt)}.
                Proportional to completed service value — votes are not.
              </FineNote>
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        className="mb-6"
        title="Active proposals"
        description="Live votes. Tallies update in real time as members vote; outcomes apply once quorum is met at closing."
      >
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-[220px] rounded-lg" />
            ))}
          </div>
        ) : d.activeProposals.length === 0 ? (
          <EmptyState
            icon={<Vote className="h-5 w-5" strokeWidth={1.9} />}
            title="No active proposals"
            description="Publish a proposal to open a member vote — all 216 members are notified."
          />
        ) : (
          <div className="space-y-5">
            {d.activeProposals.map((p) => (
              <ProposalCard key={p.id} proposal={p} />
            ))}
          </div>
        )}
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Past outcomes" description="Closed proposals with recorded results.">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <ul className="space-y-3">
              {d.pastProposals.map((p) => (
                <li key={p.id} className="rounded-md border px-3.5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="tnum text-[11px] font-medium text-muted-foreground">{p.code}</p>
                      <p className="mt-0.5 text-[13px] font-medium leading-snug">{p.title}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="tnum mt-2 text-xs text-muted-foreground">
                    {p.participationPct}% participation · {num(p.votes.approve)} approve / {num(p.votes.reject)} reject / {num(p.votes.abstain)} abstain
                  </p>
                  {p.outcomeNote && <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{p.outcomeNote}</p>}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="General body & ward meetings" description="The calendar members see in their app.">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <ul className="space-y-3">
              {d.meetings.map((m) => (
                <li key={m.id} className="rounded-md border px-3.5 py-3">
                  <div className="flex items-start gap-3">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.9} />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium leading-snug">{m.title}</p>
                      <p className="tnum mt-1 text-xs text-muted-foreground">
                        {dateFull(m.date)} · {m.time} · {m.venue}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{m.mode}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <div className="mt-4 rounded-lg border bg-muted/30 p-4">
        <FineNote>
          Quorum rules: a proposal passes with a simple majority of votes cast, provided at least 50% of eligible members vote.
          Members vote in-app; ward circles collect paper proxies for members without smartphones. The cooperative secretary
          certifies outcomes in the audit log.
        </FineNote>
      </div>
    </>
  );
}

function ProposalCard({ proposal: p }: { proposal: GovernanceProposal }) {
  const totalVotes = p.votes.approve + p.votes.reject + p.votes.abstain;
  const daysLeft = Math.max(0, Math.ceil((+new Date(p.closesAt) - Date.now()) / DAY_MS));
  const quorumMet = p.participationPct >= p.quorumPct;

  return (
    <article className="rounded-lg border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <p className="tnum text-[11px] font-medium text-muted-foreground">
            {p.code} · {p.category} · proposed by {p.proposedBy}
          </p>
          <h3 className="mt-1 text-[15px] font-semibold leading-snug tracking-tight">{p.title}</h3>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{p.summary}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn("tnum text-lg font-semibold leading-tight", quorumMet ? "text-success-deep" : "text-warning-deep")}>
            {pctLabel(p.participationPct)}
          </p>
          <p className="micro-label mt-0.5">participation</p>
          <p className={cn("tnum mt-1.5 text-[11px]", quorumMet ? "text-success-deep" : "text-muted-foreground")}>
            {quorumMet ? "quorum met" : `quorum ${pctLabel(p.quorumPct)}`}
          </p>
        </div>
      </div>

      <div className="grid gap-5 px-5 py-4 md:grid-cols-2">
        <div>
          <p className="micro-label mb-2">Tally — {num(totalVotes)} votes cast</p>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="bg-chart-2" style={{ width: `${(p.votes.approve / Math.max(1, totalVotes)) * 100}%` }} />
            <div className="bg-destructive" style={{ width: `${(p.votes.reject / Math.max(1, totalVotes)) * 100}%` }} />
            <div className="bg-muted-foreground/40" style={{ width: `${(p.votes.abstain / Math.max(1, totalVotes)) * 100}%` }} />
          </div>
          <dl className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="tnum flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[2px] bg-chart-2" /> Approve {num(p.votes.approve)}
            </span>
            <span className="tnum flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[2px] bg-destructive" /> Reject {num(p.votes.reject)}
            </span>
            <span className="tnum flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-[2px] bg-muted-foreground/40" /> Abstain {num(p.votes.abstain)}
            </span>
          </dl>
          <div className="relative mt-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, p.participationPct)}%` }} />
            </div>
            <span
              className="absolute -top-1 h-3.5 w-px bg-foreground/60"
              style={{ left: `${p.quorumPct}%` }}
              aria-hidden
              title={`Quorum ${p.quorumPct}%`}
            />
            <p className="tnum mt-1.5 text-[11px] text-muted-foreground">
              {num(Math.round((p.participationPct / 100) * p.eligibleMembers))} of {num(p.eligibleMembers)} members voted · marker = quorum
            </p>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3">
          <div className="space-y-1.5 text-[13px]">
            <p className="tnum text-muted-foreground">
              Opened {dateFull(p.openedAt)} · closes {dateFull(p.closesAt)}
            </p>
            <p className="font-medium">
              {daysLeft} {daysLeft === 1 ? "day" : "days"} left to vote
            </p>
            {p.fiscalNote && (
              <p className="rounded-md bg-muted/60 px-2.5 py-1.5 text-xs leading-relaxed text-muted-foreground">
                Fiscal note: {p.fiscalNote}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() =>
              toast.success("Reminder drafted", {
                description: `${num(p.eligibleMembers - Math.round((p.participationPct / 100) * p.eligibleMembers))} members who haven't voted yet will receive a nudge. (Simulated delivery)`,
              })
            }
          >
            <BellRing className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.9} />
            Remind non-voters
          </Button>
        </div>
      </div>
    </article>
  );
}

function PublishProposalDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(PROPOSAL_CATEGORIES[0]);
  const create = useCreateProposal();

  const valid = title.trim().length >= 10 && summary.trim().length >= 25 && description.trim().length >= 40;
  const pending = create.isPending;

  const submit = () => {
    if (!valid) return;
    create.mutate(
      { title: title.trim(), summary: summary.trim(), description: description.trim(), category },
      {
        onSuccess: () => {
          setOpen(false);
          setTitle("");
          setSummary("");
          setDescription("");
          setCategory(PROPOSAL_CATEGORIES[0]);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.9} />
          Publish proposal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish a proposal for member voting</DialogTitle>
          <DialogDescription>
            The proposal opens immediately for all 216 members with a 14-day voting window and 50% quorum. Members are notified
            in-app.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <label className="text-[13px] font-medium" htmlFor="proposal-title">
              Title <span className="text-destructive">*</span>
            </label>
            <Input
              id="proposal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Expand the tool bank for field members"
              className="text-[13px]"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-[13px] font-medium" htmlFor="proposal-summary">
              One-line summary <span className="text-destructive">*</span>
            </label>
            <Input
              id="proposal-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="What members are voting on, in one sentence"
              className="text-[13px]"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-[13px] font-medium" htmlFor="proposal-description">
              Full description <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="proposal-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Background, what changes, who it affects, funding source…"
              rows={5}
              className="text-[13px]"
            />
          </div>
          <div className="grid gap-1.5">
            <label className="text-[13px] font-medium" htmlFor="proposal-category">
              Category
            </label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="proposal-category" className="h-9 w-full text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROPOSAL_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c} className="text-[13px]">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!valid || pending} onClick={submit}>
            {pending ? "Publishing…" : "Publish for voting"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
