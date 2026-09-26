"use client";

import { useState } from "react";
import { BadgeCheck, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
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
  PersonAvatar,
  SectionCard,
  StatusBadge,
} from "@/components/shared";
import { FineNote, KpiStrip, MasterDetail, SelectPrompt, useIsDesktop } from "./ui";
import { useVerifications, useVerificationDecision } from "@/hooks/use-api";
import { dateFull, dateShort, num } from "@/lib/format";
import type { Worker } from "@/lib/types";
import { cn } from "@/lib/utils";

type Decision = "approved" | "rejected" | "needs_action";

/** Verification queue — the cooperative's onboarding control gate. */
export function AdminVerificationsScreen() {
  const verifications = useVerifications();
  const decision = useVerificationDecision();
  const isDesktop = useIsDesktop();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const queue = verifications.data?.queue ?? [];
  const selected = queue.find((q) => q.worker.id === selectedId) ?? queue[0] ?? null;

  const activeQueue = queue.filter((q) => q.worker.status !== "rejected");
  const avgDays = activeQueue.length ? Math.round((activeQueue.reduce((a, q) => a + q.daysInQueue, 0) / activeQueue.length) * 10) / 10 : 0;
  const needsAction = queue.filter((q) => q.worker.status === "needs_action").length;

  if (verifications.isError) {
    return (
      <>
        <PageHeader eyebrow="Workforce · onboarding" title="Verification queue" />
        <ErrorState message="The verification queue could not be loaded." onRetry={() => verifications.refetch()} />
      </>
    );
  }

  const loading = verifications.isLoading;

  return (
    <>
      <PageHeader
        eyebrow="Workforce · onboarding"
        title="Verification queue"
        description="Every applicant passes identity, address, skill and background checks before membership is granted. Approvals issue a cooperative member ID and unlock job offers."
      />

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-[76px] rounded-lg" />
          <Skeleton className="h-[420px] rounded-lg" />
        </div>
      ) : queue.length === 0 ? (
        <EmptyState
          icon={<BadgeCheck className="h-5 w-5" strokeWidth={1.9} />}
          title="The queue is clear"
          description="No applications are pending review. New applicants appear here automatically as they submit documents."
        />
      ) : (
        <>
          <KpiStrip
            className="mb-4"
            cells={[
              { label: "In queue", value: num(activeQueue.length), sub: "active applications" },
              { label: "Avg time in queue", value: `${num(avgDays)} days`, sub: "target ≤ 7 days", tone: avgDays > 7 ? "attention" : "default" },
              { label: "Needs action", value: num(needsAction), sub: "applicant follow-up pending", tone: needsAction > 0 ? "attention" : "default" },
              { label: "Verified members", value: num(verifications.data?.verifiedCount ?? 0), sub: "all-time approvals" },
            ]}
          />

          <MasterDetail
            selectedKey={selected?.worker.id ?? null}
            list={
              <SectionCard title="Applicants" description="Select an application to review its checks." forTable>
                <ul className="divide-y">
                  {queue.map((q) => {
                    const w = q.worker;
                    const active = selected?.worker.id === w.id;
                    return (
                      <li key={w.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(w.id);
                            if (!isDesktop) setDialogOpen(true);
                          }}
                          aria-current={active}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring",
                            active && "bg-primary-muted",
                          )}
                        >
                          <PersonAvatar name={w.name} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-[13px] font-medium leading-tight">{w.name}</p>
                              <StatusBadge status={w.status} />
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {w.tradeTitle.split("—")[0].trim()} · {w.locality} · applied {dateShort(w.memberSince)}
                            </p>
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="flex items-center gap-1" aria-label="Verification check statuses">
                                {w.verification.map((v) => (
                                  <StatusBadge key={v.id} status={v.status} dotOnly />
                                ))}
                              </span>
                              <span className={cn("tnum text-[11px]", q.daysInQueue > 7 ? "text-warning-deep" : "text-muted-foreground")}>
                                {q.daysInQueue} days in queue
                              </span>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </SectionCard>
            }
            detail={
              selected ? (
                <SectionCard title="Application file" description={`Reviewing ${selected.worker.name} — applied ${dateFull(selected.worker.memberSince)}.`}>
                  <VerificationDetail worker={selected.worker} daysInQueue={selected.daysInQueue} decision={decision} />
                </SectionCard>
              ) : (
                <SelectPrompt
                  title="No application selected"
                  description="Pick an applicant from the queue to review their verification checks and make a decision."
                />
              )
            }
          />
        </>
      )}

      {/* Mobile detail dialog */}
      <Dialog open={dialogOpen && !isDesktop} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto scroll-slim sm:max-w-lg">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.worker.name}</DialogTitle>
                <DialogDescription>Applied {dateFull(selected.worker.memberSince)} · {selected.daysInQueue} days in queue</DialogDescription>
              </DialogHeader>
              <VerificationDetail worker={selected.worker} daysInQueue={selected.daysInQueue} decision={decision} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* The detail body shared by desktop panel and mobile dialog. */
function VerificationDetail({
  worker,
  daysInQueue,
  decision,
}: {
  worker: Worker;
  daysInQueue: number;
  decision: ReturnType<typeof useVerificationDecision>;
}) {
  const [dialog, setDialog] = useState<Decision | null>(null);
  const [note, setNote] = useState("");

  const noteRequired = dialog === "rejected" || dialog === "needs_action";
  const noteValid = !noteRequired || note.trim().length >= 10;
  const pending = decision.isPending && dialog !== null;

  const submit = () => {
    if (!dialog || !noteValid) return;
    decision.mutate(
      { workerId: worker.id, decision: dialog, note: note.trim() || undefined },
      {
        onSuccess: () => {
          setDialog(null);
          setNote("");
        },
      },
    );
  };

  const dialogCopy: Record<Decision, { title: string; body: string; action: string; destructive?: boolean }> = {
    approved: {
      title: `Approve ${worker.name.split(" ")[0]}'s membership?`,
      body: "All pending checks will be marked verified, a cooperative member ID will be issued, and the applicant will be notified that they can start receiving job offers. One member, one vote — they become a full member-owner.",
      action: "Approve membership",
    },
    needs_action: {
      title: `Request action from ${worker.name.split(" ")[0]}?`,
      body: "The application stays open and the applicant receives your note explaining exactly what to update or re-upload. They keep their place in the queue.",
      action: "Request action",
    },
    rejected: {
      title: `Reject ${worker.name.split(" ")[0]}'s application?`,
      body: "This closes the application. The applicant is informed with your note and may reapply after 6 months. Rejection is recorded in the audit log.",
      action: "Reject application",
      destructive: true,
    },
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
        <PersonAvatar name={worker.name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-semibold leading-tight">{worker.name}</p>
            <StatusBadge status={worker.status} />
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{worker.tradeTitle}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{worker.bio}</p>
          <p className="tnum mt-1.5 text-[11px] text-muted-foreground">
            {worker.locality} · {worker.languages.join(", ")} · {daysInQueue} days in queue
          </p>
        </div>
      </div>

      <section aria-label="Verification checks">
        <h4 className="micro-label mb-2">Verification checks</h4>
        <ul className="space-y-2">
          {worker.verification.map((v) => (
            <li key={v.id} className="flex items-start justify-between gap-3 rounded-md border px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[13px] font-medium leading-snug">{v.label}</p>
                {v.note && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{v.note}</p>}
                <p className="tnum mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground/80">
                  {v.reference && <span>Ref {v.reference}</span>}
                  {v.verifiedAt && <span>Verified {dateFull(v.verifiedAt)}</span>}
                </p>
              </div>
              <div className="shrink-0">
                <StatusBadge status={v.status} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Certifications">
        <h4 className="micro-label mb-2">Certifications submitted</h4>
        {worker.certifications.length > 0 ? (
          <ul className="space-y-2">
            {worker.certifications.map((c) => (
              <li key={c.id} className="rounded-md border px-3 py-2 text-[13px]">
                {c.name}
                <span className="tnum ml-2 text-xs text-muted-foreground">{c.issuer} · {c.credentialId}</span>
              </li>
            ))}
          </ul>
        ) : (
          <FineNote>No certifications submitted — skill assessment is scheduled as part of the checks above.</FineNote>
        )}
      </section>

      {worker.status !== "rejected" && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button size="sm" onClick={() => setDialog("approved")}>
            <BadgeCheck className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.9} />
            Approve
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDialog("needs_action")}>
            <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.9} />
            Request action
          </Button>
          <Button variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/5" onClick={() => setDialog("rejected")}>
            Reject
          </Button>
        </div>
      )}

      <AlertDialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialog && dialogCopy[dialog].title}</AlertDialogTitle>
            <AlertDialogDescription>{dialog && dialogCopy[dialog].body}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-1.5">
            <label className="text-[13px] font-medium" htmlFor="decision-note">
              Note to applicant {noteRequired ? <span className="text-destructive">*</span> : <span className="font-normal text-muted-foreground">(optional)</span>}
            </label>
            <Textarea
              id="decision-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={noteRequired ? "What should be updated or considered…" : "Anything to record with this decision…"}
              rows={3}
              className="text-[13px]"
            />
            {noteRequired && note.trim().length > 0 && note.trim().length < 10 && (
              <p className="text-xs text-destructive-deep">Add a little more detail (min 10 characters) so the applicant knows what to do.</p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!noteValid || pending}
              onClick={(e) => {
                e.preventDefault();
                submit();
              }}
              className={cn(dialog === "rejected" && "bg-destructive text-white hover:bg-destructive/90")}
            >
              {pending ? "Recording…" : dialog && dialogCopy[dialog].action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
