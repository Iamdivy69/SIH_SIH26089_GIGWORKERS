"use client";

import { useState } from "react";
import { CheckCircle2, ChevronDown, Landmark, Users, Vote as VoteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PageHeader, SectionCard, StatusBadge } from "@/components/shared";
import { cn } from "@/lib/utils";
import { useGovernance, useVote } from "@/hooks/use-api";
import { dateFull, dateShort, money } from "@/lib/format";
import type { GovernanceProposal } from "@/lib/types";
import { QueryGate } from "../parts";

function daysLeft(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}

const VOTE_LABELS: Record<"approve" | "reject" | "abstain", string> = {
  approve: "Approve",
  reject: "Reject",
  abstain: "Abstain",
};

/** Participation bar with a quorum marker. */
function ParticipationBar({ proposal }: { proposal: GovernanceProposal }) {
  const voted = proposal.votes.approve + proposal.votes.reject + proposal.votes.abstain;
  const reached = proposal.participationPct >= proposal.quorumPct;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted-foreground">Participation</span>
        <span className="tnum font-medium">
          {voted} / {proposal.eligibleMembers} members · {proposal.participationPct}%
        </span>
      </div>
      <div className="relative mt-1.5 h-1.5 rounded-full bg-muted">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: `${Math.min(100, proposal.participationPct)}%` }}
          aria-hidden
        />
        <span
          className="absolute -top-1 h-3.5 w-px bg-muted-foreground"
          style={{ left: `${proposal.quorumPct}%` }}
          aria-label={`Quorum ${proposal.quorumPct}%`}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        Quorum {proposal.quorumPct}% — {reached ? "reached, the proposal is decidable" : "not yet reached"}
      </p>
    </div>
  );
}

/** Segmented tally: approve / reject / abstain. */
function TallyBar({ proposal }: { proposal: GovernanceProposal }) {
  const { approve, reject, abstain } = proposal.votes;
  const total = Math.max(1, approve + reject + abstain);
  const seg = [
    { key: "approve", label: "Approve", value: approve, cls: "bg-success" },
    { key: "reject", label: "Reject", value: reject, cls: "bg-destructive" },
    { key: "abstain", label: "Abstain", value: abstain, cls: "bg-muted-foreground/50" },
  ];
  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Vote tally">
        {seg.map((s) =>
          s.value > 0 ? (
            <span key={s.key} className={cn("h-full", s.cls)} style={{ width: `${(s.value / total) * 100}%` }} />
          ) : null,
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {seg.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className={cn("h-2 w-2 rounded-[2px]", s.cls)} aria-hidden />
            {s.label}
            <span className="tnum font-medium text-foreground">
              {s.value} <span className="font-normal text-muted-foreground">({Math.round((s.value / total) * 100)}%)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VoteButtons({ proposal }: { proposal: GovernanceProposal }) {
  const vote = useVote();
  const cast = (v: "approve" | "reject" | "abstain") => vote.mutate({ proposalId: proposal.id, vote: v });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="sm" disabled={vote.isPending}>
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.9} />
            Approve
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Vote Approve on {proposal.code}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {proposal.summary} One member, one vote — your vote is final and cannot be changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review again</AlertDialogCancel>
            <AlertDialogAction onClick={() => cast("approve")}>Cast vote</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" disabled={vote.isPending}>
            Reject
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vote Reject on {proposal.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              {proposal.summary} One member, one vote — your vote is final and cannot be changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review again</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => cast("reject")}>
              Cast vote
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={vote.isPending}>
            Abstain
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Abstain on {proposal.code}?</AlertDialogTitle>
            <AlertDialogDescription>
              Abstaining counts toward quorum but not the tally. One member, one vote — your choice is final.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review again</AlertDialogCancel>
            <AlertDialogAction onClick={() => cast("abstain")}>Abstain</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ActiveProposalCard({ proposal }: { proposal: GovernanceProposal }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="rounded-lg border bg-card p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-semibold text-primary">{proposal.code}</span>
            <span className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">{proposal.category}</span>
            <StatusBadge status={proposal.status} />
          </div>
          <h3 className="mt-1.5 max-w-2xl text-[15px] font-semibold leading-snug tracking-tight">{proposal.title}</h3>
        </div>
        <div className="shrink-0 text-right">
          <p className="tnum text-sm font-semibold">{daysLeft(proposal.closesAt)} days left</p>
          <p className="mt-0.5 text-xs text-muted-foreground">closes {dateShort(proposal.closesAt)}</p>
        </div>
      </header>

      <p className="mt-2.5 text-[13px] leading-relaxed">{proposal.summary}</p>

      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="-ml-2 mt-1 h-7 text-[13px] text-muted-foreground">
            Read full proposal
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} strokeWidth={1.9} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-3 rounded-md border border-border/70 bg-muted/30 p-4">
            <p className="text-[13px] leading-relaxed">{proposal.description}</p>
            {proposal.fiscalNote && (
              <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
                <span>
                  <span className="font-medium text-foreground/80">Fiscal note:</span> {proposal.fiscalNote}
                </span>
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Proposed by {proposal.proposedBy} · opened {dateFull(proposal.openedAt)}
            </p>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="mt-4 grid gap-5 border-t border-border/70 pt-4 sm:grid-cols-2">
        <ParticipationBar proposal={proposal} />
        <TallyBar proposal={proposal} />
      </div>

      <div className="mt-4">
        {proposal.myVote ? (
          <p className="inline-flex flex-wrap items-center gap-2 rounded-md border border-success/40 bg-primary-muted px-3 py-2 text-[13px] font-medium text-success-deep">
            <CheckCircle2 className="h-4 w-4" strokeWidth={1.9} />
            You voted {VOTE_LABELS[proposal.myVote]} — one member, one vote. Thank you for participating.
          </p>
        ) : (
          <VoteButtons proposal={proposal} />
        )}
      </div>
    </article>
  );
}

export function WorkerGovernance() {
  const q = useGovernance();

  return (
    <div>
      <PageHeader
        eyebrow="Cooperative"
        title="Governance"
        description="You own this platform together with 215 other members. Rates, policies and surplus spending are decided here — one member, one vote, regardless of shares."
      />
      <QueryGate query={q}>
        {(data) => {
          const unvoted = data.activeProposals.filter((p) => !p.myVote);
          return (
            <div className="space-y-6">
              {/* Membership card */}
              <section className="rounded-lg border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-primary-foreground">
                      <Landmark className="h-5 w-5" strokeWidth={1.9} aria-hidden />
                    </span>
                    <div>
                      <p className="micro-label">Membership</p>
                      <p className="tnum text-lg font-semibold tracking-tight">{data.membershipId}</p>
                      <p className="tnum mt-0.5 text-xs text-muted-foreground">
                        Member since {dateFull(data.memberSince)} · Share capital {money(data.shareCapital)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                    <VoteIcon className="h-4 w-4 text-primary" strokeWidth={1.9} aria-hidden />
                    <p className="text-[13px] font-medium">One member · one vote</p>
                  </div>
                </div>
              </section>

              {unvoted.length > 0 && (
                <p className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning-muted px-4 py-2.5 text-[13px] font-medium text-warning-deep">
                  <Users className="h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden />
                  {unvoted.length} proposal{unvoted.length === 1 ? "" : "s"} still need your vote — voting closes soon.
                </p>
              )}

              {/* Active proposals */}
              <div>
                <h2 className="micro-label mb-3">Open for voting — {data.activeProposals.length} proposals</h2>
                <div className="space-y-4">
                  {data.activeProposals.map((p) => (
                    <ActiveProposalCard key={p.id} proposal={p} />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                  <SectionCard title="Past proposals" description="Outcomes of last quarter's votes — with your own vote on record.">
                    <ul className="space-y-4">
                      {data.pastProposals.map((p) => (
                        <li key={p.id} className="rounded-lg border p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs font-semibold text-primary">{p.code}</span>
                                <StatusBadge status={p.status} />
                              </div>
                              <p className="mt-1.5 text-[13px] font-medium leading-snug">{p.title}</p>
                            </div>
                            <p className="tnum shrink-0 text-xs text-muted-foreground">
                              closed {dateShort(p.closesAt)} · {p.participationPct}% participation
                            </p>
                          </div>
                          <p className="tnum mt-2 text-xs text-muted-foreground">
                            Approve {p.votes.approve} · Reject {p.votes.reject} · Abstain {p.votes.abstain}
                            {p.myVote && <span className="ml-2 font-medium text-foreground">You voted {VOTE_LABELS[p.myVote]}</span>}
                          </p>
                          {p.outcomeNote && (
                            <p className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-xs leading-relaxed text-muted-foreground">{p.outcomeNote}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </SectionCard>

                  <SectionCard title="Announcements" description="From the cooperative office.">
                    <ul className="space-y-4">
                      {data.announcements.map((a) => (
                        <li key={a.id} className="border-l-2 border-primary/40 pl-4">
                          <p className="tnum text-xs text-muted-foreground">{dateFull(a.date)}</p>
                          <p className="mt-0.5 text-[13px] font-medium">{a.title}</p>
                          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{a.body}</p>
                        </li>
                      ))}
                    </ul>
                  </SectionCard>
                </div>

                <div className="space-y-6">
                  <SectionCard title="General body & circles" description="Where decisions get debated before they get voted.">
                    <ul className="space-y-4">
                      {data.meetings.map((m) => (
                        <li key={m.id} className="rounded-lg border p-4">
                          <p className="text-[13px] font-semibold leading-snug">{m.title}</p>
                          <p className="tnum mt-1 text-xs text-muted-foreground">
                            {dateFull(m.date)} · {m.time}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{m.venue}</p>
                          <p className="mt-1.5 text-[11px] uppercase tracking-wide text-muted-foreground/80">{m.mode}</p>
                          <ul className="mt-2.5 space-y-1">
                            {m.agenda.map((item) => (
                              <li key={item} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" aria-hidden />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </SectionCard>

                  <SectionCard title="Patronage dividend" description="Your share of the cooperative surplus.">
                    <p className="micro-label">{data.dividend.fiscalYear} surplus</p>
                    <p className="tnum mt-0.5 text-2xl font-semibold tracking-tight">{money(data.dividend.surplus)}</p>
                    <dl className="mt-3 space-y-2 text-[13px]">
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted-foreground">Patronage bonus pool</dt>
                        <dd className="tnum font-medium">{money(data.dividend.patronageBonus)}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <dt className="text-muted-foreground">Shared among</dt>
                        <dd className="tnum font-medium">{data.dividend.members} members</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-3 border-t border-border/70 pt-2">
                        <dt className="font-semibold">Your share</dt>
                        <dd className="tnum font-semibold text-success-deep">{money(data.dividend.myShare)}</dd>
                      </div>
                    </dl>
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                      Distributed {dateShort(data.dividend.distributedAt)}. {data.dividend.note}
                    </p>
                  </SectionCard>
                </div>
              </div>
            </div>
          );
        }}
      </QueryGate>
    </div>
  );
}
