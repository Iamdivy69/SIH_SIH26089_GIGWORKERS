"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  Clock,
  Lock,
  Repeat,
  RotateCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ErrorState,
  FactorBars,
  MatchBadge,
  MatchReasonChips,
  PageHeader,
  PersonAvatar,
  RatingStars,
  ScoreDial,
  SectionCard,
  CustomerPriceLines,
  PaymentAllocation,
} from "@/components/shared";
import {
  useCategories,
  useCreateBooking,
  useMatching,
  useWorkerProfile,
  type CreateBookingInput,
} from "@/hooks/use-api";
import { useAppStore } from "@/store/app-store";
import { computePrice } from "@/lib/rates";
import { money, duration } from "@/lib/format";
import type {
  Booking,
  PriceBreakdown,
  ServiceCategory,
  ServiceCategoryId,
  ServiceItem,
  Worker,
  WorkerRecommendation,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  addressById,
  addressLine,
  CATEGORY_ICONS,
  dayChipLabel,
  DEMO_ADDRESSES,
  isSlotBookable,
  nextDays,
  PAYMENT_METHODS,
  provisionalScheduledAt,
  RECURRENCE_OPTIONS,
  recurrenceLabel,
  slotToISO,
  SLOT_GROUPS,
  workerCoversGroup,
  type RecurrenceChoice,
} from "../constants";
import { setWorkerMatchContext, peekBookingPrefill, clearBookingPrefill, type BookingPrefill } from "../prefill";
import { FlowStepper } from "../parts/flow-stepper";
import { FlowSummaryPanel, FlowSummaryStrip } from "../parts/flow-summary";

/* ------------------------------------------------------------------ */
/* Flow state (survives navigation away and back within the session)    */
/* ------------------------------------------------------------------ */

interface FlowState {
  categoryId: ServiceCategoryId | null;
  serviceId: string | null;
  description: string;
  addressId: string;
  notes: string;
  selectedWorkerId: string | null;
  slotDate: string | null;
  slotTime: string | null;
  paymentMethod: string;
  descriptionTouched: boolean;
  /** One-time by default; weekly/monthly create a standing order. */
  recurrence: RecurrenceChoice;
}

interface MatchCache {
  key: string;
  recommendations: WorkerRecommendation[];
  weights: Record<string, number>;
  provisionalAt: string;
}

const FRESH_STATE: FlowState = {
  categoryId: null,
  serviceId: null,
  description: "",
  addressId: DEMO_ADDRESSES[0].id,
  notes: "",
  selectedWorkerId: null,
  slotDate: null,
  slotTime: null,
  paymentMethod: PAYMENT_METHODS[0].id,
  descriptionTouched: false,
  recurrence: "one-time",
};

/** Module-scoped snapshot so the flow survives "View profile" detours. */
let flowSnapshot: { state: FlowState; match: MatchCache | null; prefillWorkerId?: string; step: number } | null = null;

const WEIGHT_LABELS: Record<string, string> = {
  skill: "skills",
  location: "location",
  availability: "availability",
  rating: "rating",
  experience: "experience",
};

function timeLabel(time: string): string {
  return format(parseISO(`2000-01-01T${time}:00`), "h:mm a");
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export function BookingFlowScreen({ categoryIdParam }: { categoryIdParam?: string }) {
  const navigate = useAppStore((s) => s.navigate);

  /* ----- one-time init: prefill > snapshot > route param > fresh ----- */
  const [init] = useState<{ prefill: BookingPrefill | null; restored: boolean; paramCategory: ServiceCategoryId | null }>(() => {
    const prefill = peekBookingPrefill();
    const paramCategory = (categoryIdParam as ServiceCategoryId) ?? null;
    if (prefill) return { prefill, restored: false, paramCategory };
    if (flowSnapshot && (!paramCategory || flowSnapshot.state.categoryId === paramCategory)) {
      return { prefill: null, restored: true, paramCategory };
    }
    return { prefill: null, restored: false, paramCategory };
  });

  /* consume the prefill mailbox once mounted (idempotent) */
  useEffect(() => {
    clearBookingPrefill();
  }, []);

  const [state, setState] = useState<FlowState>(() => {
    if (init.prefill) {
      return {
        ...FRESH_STATE,
        categoryId: init.prefill.categoryId ?? null,
        serviceId: init.prefill.serviceId ?? null,
      };
    }
    if (init.restored && flowSnapshot) return flowSnapshot.state;
    return { ...FRESH_STATE, categoryId: init.paramCategory };
  });
  const [match, setMatch] = useState<MatchCache | null>(() => (init.restored ? flowSnapshot?.match ?? null : null));
  const [prefillWorkerId] = useState<string | undefined>(() => init.prefill?.workerId ?? (init.restored ? flowSnapshot?.prefillWorkerId : undefined));
  const [step, setStep] = useState<number>(() => {
    if (init.prefill) return init.prefill.serviceId ? 2 : 1;
    if (init.restored && flowSnapshot) return flowSnapshot.step;
    return 1;
  });
  const [created, setCreated] = useState<Booking | null>(null);

  const patch = useCallback((p: Partial<FlowState>) => setState((s) => ({ ...s, ...p })), []);
  const goto = (n: number) => {
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ----- persist snapshot ----- */
  useEffect(() => {
    if (!created) flowSnapshot = { state, match, prefillWorkerId, step };
  }, [state, match, prefillWorkerId, step, created]);

  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const categoryList: ServiceCategory[] = categories ?? [];
  const category = useMemo(() => categoryList.find((c) => c.id === state.categoryId), [categoryList, state.categoryId]);
  const service = useMemo(
    () => category?.services.find((s) => s.id === state.serviceId) ?? null,
    [category, state.serviceId],
  );
  /* charge is fully derived from the selected service */
  const charge = service?.basePrice ?? 0;
  const price = useMemo(() => computePrice(charge), [charge]);

  /* ----- matching (step 3) ----- */
  const matching = useMatching();
  const requestedKeyRef = useRef<string | null>(null);
  const matchKey = state.categoryId && state.serviceId ? `${state.categoryId}:${state.serviceId}` : null;

  useEffect(() => {
    if (step !== 3 || !matchKey || match?.key === matchKey || requestedKeyRef.current === matchKey) return;
    requestedKeyRef.current = matchKey;
    const provisionalAt = provisionalScheduledAt();
    matching.mutate(
      {
        categoryId: state.categoryId!,
        serviceId: state.serviceId!,
        description: state.description,
        scheduledAt: provisionalAt,
        charge,
      },
      {
        onSuccess: (data) =>
          setMatch({ key: matchKey, recommendations: data.recommendations, weights: data.weights, provisionalAt }),
      },
    );
  }, [step, matchKey, match?.key, matching, state.categoryId, state.serviceId, state.description, charge]);

  const runMatch = () => {
    requestedKeyRef.current = null;
    if (matchKey) {
      const provisionalAt = provisionalScheduledAt();
      matching.mutate(
        {
          categoryId: state.categoryId!,
          serviceId: state.serviceId!,
          description: state.description,
          scheduledAt: provisionalAt,
          charge,
        },
        {
          onSuccess: (data) =>
            setMatch({ key: matchKey, recommendations: data.recommendations, weights: data.weights, provisionalAt }),
        },
      );
    }
  };

  /* ----- selected worker resolution (derived — a directly chosen member
     is auto-selected until the customer picks someone else) ----- */
  const recommendations = match?.recommendations ?? [];
  const directInRecs = Boolean(prefillWorkerId && recommendations.some((r) => r.worker.id === prefillWorkerId));
  const { data: directProfile } = useWorkerProfile(prefillWorkerId && !directInRecs ? prefillWorkerId : undefined);
  const autoSelectedId =
    prefillWorkerId && (recommendations.length > 0 || directProfile) && !state.selectedWorkerId
      ? prefillWorkerId
      : null;
  const selectedWorkerId = state.selectedWorkerId ?? autoSelectedId;
  const selectedRec = recommendations.find((r) => r.worker.id === selectedWorkerId) ?? null;
  const selectedWorker: Worker | undefined =
    selectedRec?.worker ?? (directProfile?.worker.id === selectedWorkerId ? directProfile.worker : undefined);
  const selectedScore = selectedRec?.score;

  const slotLabel =
    state.slotDate && state.slotTime ? `${dayChipLabel(state.slotDate)} · ${timeLabel(state.slotTime)}` : undefined;

  /* ----- booking creation ----- */
  const createBooking = useCreateBooking();
  const pay = () => {
    if (!state.categoryId || !state.serviceId || !selectedWorkerId || !state.slotDate || !state.slotTime) return;
    const input: CreateBookingInput = {
      workerId: selectedWorkerId,
      categoryId: state.categoryId,
      serviceId: state.serviceId,
      description: state.description.trim(),
      addressId: state.addressId,
      scheduledAt: slotToISO(state.slotDate, state.slotTime),
      customerNotes: state.notes.trim() || undefined,
      matchScore: selectedScore,
      charge,
      recurrence: state.recurrence === "one-time" ? undefined : state.recurrence,
    };
    createBooking.mutate(input, {
      onSuccess: (data) => {
        flowSnapshot = null;
        setCreated(data.booking);
        goto(6);
        toast.success("Payment authorized", { description: "Your request has been sent to the member." });
      },
    });
  };

  /* ----- validation ----- */
  const stepValid = (n: number): boolean => {
    switch (n) {
      case 1:
        return Boolean(state.categoryId && state.serviceId && charge > 0);
      case 2:
        return state.description.trim().length >= 15;
      case 3:
        return Boolean(selectedWorkerId);
      case 4:
        return Boolean(state.slotDate && state.slotTime);
      default:
        return true;
    }
  };
  const canContinue = stepValid(step);

  const startOver = () => {
    flowSnapshot = null;
    setState({ ...FRESH_STATE });
    setMatch(null);
    setCreated(null);
    goto(1);
  };

  if (categoriesLoading) {
    return (
      <PageHeader eyebrow="New request" title="Book a service" description="Loading the cooperative service catalogue…" />
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="New service request"
        title="Book a service"
        description="Six steps — service, requirements, an explainable member match, your slot, and a transparent review before you pay."
        onBack={() => navigate("customer-home")}
        actions={
          step < 6 ? (
            <Button variant="ghost" size="sm" onClick={startOver} className="text-muted-foreground">
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.9} /> Start over
            </Button>
          ) : undefined
        }
      />

      <div className="rounded-lg border bg-card px-4 py-4 sm:px-5">
        <FlowStepper step={step} onJump={(n) => n < step && goto(n)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-[76px]">
            <FlowSummaryPanel
              category={category}
              serviceName={service?.name}
              charge={charge}
              worker={selectedWorker}
              matchScore={selectedScore}
              slotLabel={slotLabel}
              addressId={state.addressId}
              recurrence={state.recurrence}
            />
          </div>
        </aside>

        <div className="min-w-0">
          <FlowSummaryStrip
            className="mb-4 lg:hidden"
            category={category}
            serviceName={service?.name}
            charge={charge}
            worker={selectedWorker}
            matchScore={selectedScore}
            slotLabel={slotLabel}
            addressId={state.addressId}
            recurrence={state.recurrence}
          />

          {step === 1 && (
            <ServiceStep
              categories={categoryList}
              state={state}
              patch={patch}
              footer={
                <StepFooter
                  onNext={() => goto(2)}
                  nextDisabled={!canContinue}
                  nextLabel="Continue to requirements"
                />
              }
            />
          )}

          {step === 2 && (
            <RequirementsStep
              state={state}
              patch={patch}
              footer={
                <StepFooter
                  onBack={() => goto(1)}
                  onNext={() => goto(3)}
                  nextDisabled={!canContinue}
                  nextLabel="Find my member"
                />
              }
            />
          )}

          {step === 3 && (
            <MatchStep
              selectedWorkerId={selectedWorkerId}
              patch={patch}
              match={match}
              matchingPending={matching.isPending}
              matchingError={matching.isError}
              onRetry={runMatch}
              prefillWorkerId={directInRecs ? undefined : prefillWorkerId}
              onViewProfile={(worker, score, factors) => {
                setWorkerMatchContext({ workerId: worker.id, score, factors });
                navigate("customer-worker", { workerId: worker.id });
              }}
              footer={
                <StepFooter
                  onBack={() => goto(2)}
                  onNext={() => goto(4)}
                  nextDisabled={!canContinue}
                  nextLabel="Choose a slot"
                />
              }
            />
          )}

          {step === 4 && (
            <SlotStep
              state={state}
              patch={patch}
              worker={selectedWorker}
              footer={
                <StepFooter
                  onBack={() => goto(3)}
                  onNext={() => goto(5)}
                  nextDisabled={!canContinue}
                  nextLabel="Review & pay"
                />
              }
            />
          )}

          {step === 5 && (
            <ReviewStep
              state={state}
              patch={patch}
              category={category}
              service={service}
              worker={selectedWorker}
              score={selectedScore}
              slotLabel={slotLabel ?? ""}
              price={price}
              pending={createBooking.isPending}
              error={createBooking.error instanceof Error ? createBooking.error.message : undefined}
              onPay={pay}
              onBack={() => goto(4)}
            />
          )}

          {step === 6 && created && <ConfirmationStep booking={created} worker={selectedWorker} />}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step footer                                                         */
/* ------------------------------------------------------------------ */

function StepFooter({
  onBack,
  onNext,
  nextDisabled,
  nextLabel,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextDisabled: boolean;
  nextLabel: string;
}) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3 border-t pt-5">
      {onBack ? (
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.9} /> Back
        </Button>
      ) : (
        <span aria-hidden />
      )}
      <Button onClick={onNext} disabled={nextDisabled}>
        {nextLabel}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 1 — Service                                                    */
/* ------------------------------------------------------------------ */

function ServiceStep({
  categories,
  state,
  patch,
  footer,
}: {
  categories: ServiceCategory[];
  state: FlowState;
  patch: (p: Partial<FlowState>) => void;
  footer: React.ReactNode;
}) {
  const category = categories.find((c) => c.id === state.categoryId);
  if (!category) {
    return (
      <SectionCard title="What do you need help with?" description="Choose a service category — all are covered by verified cooperative members.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {categories.map((c) => {
            const Icon = CATEGORY_ICONS[c.id];
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => patch({ categoryId: c.id, serviceId: null })}
                className="group flex flex-col rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-md border bg-muted/50 text-foreground">
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </span>
                <span className="mt-3 text-[15px] font-semibold leading-tight">{c.name}</span>
                <span className="mt-1 text-[13px] leading-snug text-muted-foreground">{c.tagline}</span>
                <span className="tnum mt-3 text-xs text-muted-foreground">
                  From {money(Math.min(...c.services.map((s) => s.basePrice)))} · {c.services.length} services
                </span>
              </button>
            );
          })}
        </div>
        {footer}
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={`${category.name} — choose a service`}
      description={category.description}
      actions={
        <Button variant="ghost" size="sm" onClick={() => patch({ categoryId: null, serviceId: null })} className="text-muted-foreground">
          Change category
        </Button>
      }
    >
      <fieldset className="space-y-2.5">
        <legend className="sr-only">Services in {category.name}</legend>
        {category.services.map((s) => {
          const active = state.serviceId === s.id;
          return (
            <label
              key={s.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
                active ? "border-primary bg-[oklch(0.975_0.012_155)]" : "hover:border-primary/30 hover:bg-muted/40",
              )}
            >
              <input
                type="radio"
                name="service"
                className="sr-only"
                checked={active}
                onChange={() => patch({ serviceId: s.id })}
              />
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                  active ? "border-primary" : "border-muted-foreground/40",
                )}
              >
                {active && <span className="h-2 w-2 rounded-full bg-primary" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="text-[14px] font-medium">{s.name}</span>
                  <span className="tnum text-[14px] font-semibold">{money(s.basePrice)}</span>
                </span>
                <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{s.description}</span>
                <span className="tnum mt-1.5 block text-xs text-muted-foreground">
                  {duration(s.durationMin)} · per {s.unit}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>
      {footer}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/* Step 2 — Requirements                                               */
/* ------------------------------------------------------------------ */

function RequirementsStep({
  state,
  patch,
  footer,
}: {
  state: FlowState;
  patch: (p: Partial<FlowState>) => void;
  footer: React.ReactNode;
}) {
  const descLength = state.description.trim().length;
  const descValid = descLength >= 15;
  return (
    <SectionCard title="Describe the work" description="This is shared with matched members — the more specific, the better the first-visit fix rate.">
      <div className="space-y-6">
        <div>
          <Label htmlFor="bf-description" className="text-[13px] font-medium">
            What is the issue? <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="bf-description"
            value={state.description}
            onChange={(e) => patch({ description: e.target.value, descriptionTouched: true })}
            rows={4}
            placeholder="e.g. Bedroom lights flicker when the fan is on; two sockets in the study have stopped working since Monday."
            className="mt-1.5"
            aria-describedby="bf-description-help"
          />
          <p id="bf-description-help" className={cn("mt-1.5 text-xs", state.descriptionTouched && !descValid ? "text-destructive" : "text-muted-foreground")}>
            {state.descriptionTouched && !descValid
              ? `Add a little more detail — at least 15 characters (${descLength}/15).`
              : `${descLength} characters · minimum 15`}
          </p>
        </div>

        <div>
          <p className="text-[13px] font-medium">Service address</p>
          <fieldset className="mt-2 space-y-2.5">
            <legend className="sr-only">Service address</legend>
            {DEMO_ADDRESSES.map((a) => {
              const active = state.addressId === a.id;
              return (
                <label
                  key={a.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors",
                    active ? "border-primary bg-[oklch(0.975_0.012_155)]" : "hover:border-primary/30 hover:bg-muted/40",
                  )}
                >
                  <input
                    type="radio"
                    name="address"
                    className="sr-only"
                    checked={active}
                    onChange={() => patch({ addressId: a.id })}
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      active ? "border-primary" : "border-muted-foreground/40",
                    )}
                  >
                    {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </span>
                  <span className="min-w-0">
                    <span className="text-[14px] font-medium">{a.label}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{addressLine(a)}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
        </div>

        <div>
          <Label htmlFor="bf-notes" className="text-[13px] font-medium">
            Notes for the member <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="bf-notes"
            value={state.notes}
            onChange={(e) => patch({ notes: e.target.value })}
            placeholder="Gate code, parking, pets at home, best phone number…"
            className="mt-1.5"
          />
        </div>
      </div>
      {footer}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/* Step 3 — Match                                                      */
/* ------------------------------------------------------------------ */

function MatchStep({
  selectedWorkerId,
  patch,
  match,
  matchingPending,
  matchingError,
  onRetry,
  prefillWorkerId,
  onViewProfile,
  footer,
}: {
  selectedWorkerId: string | null;
  patch: (p: Partial<FlowState>) => void;
  match: MatchCache | null;
  matchingPending: boolean;
  matchingError: boolean;
  onRetry: () => void;
  prefillWorkerId?: string;
  onViewProfile: (worker: Worker, score: number | undefined, factors: WorkerRecommendation["factors"]) => void;
  footer: React.ReactNode;
}) {
  const recs = match?.recommendations ?? [];
  const prefillRec = prefillWorkerId ? recs.find((r) => r.worker.id === prefillWorkerId) : undefined;
  const { data: prefillProfile } = useWorkerProfile(prefillWorkerId && !prefillRec ? prefillWorkerId : undefined);
  const directWorker = prefillRec?.worker ?? prefillProfile?.worker;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-card px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Your matched members</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              Scored against your request — never a black box. Every factor is shown before you choose.
            </p>
          </div>
          {match && (
            <p className="tnum text-xs text-muted-foreground">
              {Object.entries(match.weights)
                .map(([k, v]) => `${WEIGHT_LABELS[k] ?? k} ${v}%`)
                .join(" · ")}
            </p>
          )}
        </div>
      </section>

      {matchingPending && (
        <SectionCard>
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted/40">
              <Search className="h-5 w-5 animate-pulse text-primary" strokeWidth={1.9} />
            </div>
            <p className="mt-4 text-sm font-medium">Scoring verified members near you…</p>
            <p className="mt-1 text-[13px] text-muted-foreground">Skill, location, availability, rating and experience — weighted and explained.</p>
          </div>
        </SectionCard>
      )}

      {!matchingPending && matchingError && (
        <SectionCard>
          <ErrorState message="The matching service could not be reached." onRetry={onRetry} />
        </SectionCard>
      )}

      {!matchingPending && !matchingError && match && (
        <>
          {directWorker && !prefillRec && (
            <DirectWorkerCard
              worker={directWorker}
              selected={selectedWorkerId === directWorker.id}
              onSelect={() => patch({ selectedWorkerId: directWorker.id })}
              onView={() => onViewProfile(directWorker, undefined, [])}
            />
          )}
          <p className="micro-label px-1">
            {prefillRec ? "Best matches — including your chosen member" : `Top ${recs.length} of the cooperative's verified members`}
          </p>
          <fieldset className="space-y-3">
            <legend className="sr-only">Recommended members</legend>
            {recs.map((r) => (
              <RecommendationCard
                key={r.worker.id}
                rec={r}
                selected={selectedWorkerId === r.worker.id}
                onSelect={() => patch({ selectedWorkerId: r.worker.id })}
                onView={() => onViewProfile(r.worker, r.score, r.factors)}
              />
            ))}
          </fieldset>
        </>
      )}

      {footer}
    </div>
  );
}

function RecommendationCard({
  rec,
  selected,
  onSelect,
  onView,
}: {
  rec: WorkerRecommendation;
  selected: boolean;
  onSelect: () => void;
  onView: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <label
      className={cn(
        "block cursor-pointer rounded-lg border bg-card p-5 transition-colors",
        selected ? "border-primary bg-[oklch(0.975_0.012_155)]" : "hover:border-primary/30",
      )}
    >
      <div className="flex items-start gap-4">
        <input type="radio" name="worker" className="sr-only" checked={selected} onChange={onSelect} />
        <div className="hidden shrink-0 sm:block" aria-hidden>
          <ScoreDial score={rec.score} size={64} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <PersonAvatar name={rec.worker.name} size="sm" />
            <span className="text-[15px] font-semibold leading-tight">{rec.worker.name}</span>
            <MatchBadge score={rec.score} size="sm" className="sm:hidden" />
            <span className="text-[13px] text-muted-foreground">{rec.worker.tradeTitle}</span>
            {selected && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-sm border border-[oklch(0.88_0.03_155)] bg-[oklch(0.945_0.034_155)] px-1.5 py-0.5 text-[11px] font-medium text-[oklch(0.40_0.09_155)]">
                <Check className="h-3 w-3" strokeWidth={2.4} /> Selected
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">{rec.reasonSummary}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
            <RatingStars value={rec.worker.rating} count={rec.worker.reviewCount} />
            <span className="tnum">{rec.worker.completedJobs} services</span>
            <span className="tnum">{rec.worker.distanceKm} km away</span>
            <span className="tnum font-medium text-foreground">Est. total {money(rec.estimatedPrice.customerTotal)}</span>
          </div>
          <div className="mt-3">
            <MatchReasonChips factors={rec.factors} max={3} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Collapsible open={open} onOpenChange={setOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground">
                  Why this score
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} strokeWidth={1.9} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 rounded-md border bg-muted/30 p-4">
                  <FactorBars factors={rec.factors} />
                </div>
              </CollapsibleContent>
            </Collapsible>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={(e) => {
                e.preventDefault();
                onView();
              }}
            >
              View profile
            </Button>
          </div>
        </div>
      </div>
    </label>
  );
}

function DirectWorkerCard({
  worker,
  selected,
  onSelect,
  onView,
}: {
  worker: Worker;
  selected: boolean;
  onSelect: () => void;
  onView: () => void;
}) {
  return (
    <label
      className={cn(
        "block cursor-pointer rounded-lg border bg-card p-5 transition-colors",
        selected ? "border-primary bg-[oklch(0.975_0.012_155)]" : "hover:border-primary/30",
      )}
    >
      <div className="flex items-start gap-4">
        <input type="radio" name="worker" className="sr-only" checked={selected} onChange={onSelect} />
        <PersonAvatar name={worker.name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <span className="text-[15px] font-semibold leading-tight">{worker.name}</span>
            <span className="rounded-sm border bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Your selection</span>
            {selected && (
              <span className="ml-auto inline-flex items-center gap-1 rounded-sm border border-[oklch(0.88_0.03_155)] bg-[oklch(0.945_0.034_155)] px-1.5 py-0.5 text-[11px] font-medium text-[oklch(0.40_0.09_155)]">
                <Check className="h-3 w-3" strokeWidth={2.4} /> Selected
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {worker.tradeTitle} · direct request to the member you picked
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
            <RatingStars value={worker.rating} count={worker.reviewCount} />
            <span className="tnum">{worker.completedJobs} services</span>
            <span className="tnum">{worker.distanceKm} km away</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-7 px-2 text-xs text-muted-foreground"
            onClick={(e) => {
              e.preventDefault();
              onView();
            }}
          >
            View profile
          </Button>
        </div>
      </div>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Step 4 — Slot                                                       */
/* ------------------------------------------------------------------ */

function SlotStep({
  state,
  patch,
  worker,
  footer,
}: {
  state: FlowState;
  patch: (p: Partial<FlowState>) => void;
  worker?: Worker;
  footer: React.ReactNode;
}) {
  const days = useMemo(() => nextDays(7), []);
  const selectedOutsideHours =
    state.slotDate && state.slotTime
      ? !workerCoversGroup(
          worker,
          state.slotDate,
          SLOT_GROUPS.find((g) => g.times.includes(state.slotTime!)) ?? SLOT_GROUPS[0],
        )
      : false;

  return (
    <SectionCard
      title="Pick a date and time"
      description={
        worker
          ? `${worker.name}'s usual weekly hours are shown against each window — the exact slot is confirmed on acceptance.`
          : "Choose when the member should visit."
      }
    >
      <div className="space-y-6">
        <fieldset>
          <legend className="micro-label mb-2">Date</legend>
          <div className="flex flex-wrap gap-2">
            {days.map((d) => {
              const active = state.slotDate === d;
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={active}
                  onClick={() => patch({ slotDate: d, slotTime: state.slotTime && isSlotBookable(d, state.slotTime) ? state.slotTime : null })}
                  className={cn(
                    "min-w-[76px] rounded-md border px-3 py-2 text-[13px] font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-foreground hover:border-primary/40 hover:bg-muted/40",
                  )}
                >
                  {dayChipLabel(d)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="space-y-4">
          {SLOT_GROUPS.map((g) => {
            const covered = state.slotDate ? workerCoversGroup(worker, state.slotDate, g) : true;
            return (
              <div key={g.id} className={cn("rounded-lg border p-4", !covered && "bg-muted/20")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold">
                    {g.label} <span className="ml-1.5 font-normal text-muted-foreground">{g.hint}</span>
                  </p>
                  {state.slotDate && (
                    <p className={cn("inline-flex items-center gap-1 text-xs", covered ? "text-[oklch(0.40_0.09_155)]" : "text-[oklch(0.55_0.12_65)]")}>
                      {covered ? (
                        <>
                          <Check className="h-3.5 w-3.5" strokeWidth={2.2} /> In {worker?.name ?? "member"}'s usual hours
                        </>
                      ) : (
                        <>
                          <Clock className="h-3.5 w-3.5" strokeWidth={1.9} /> Outside usual hours
                        </>
                      )}
                    </p>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {g.times.map((t) => {
                    const bookable = state.slotDate ? isSlotBookable(state.slotDate, t) : false;
                    const active = state.slotTime === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        disabled={!state.slotDate || !bookable}
                        aria-pressed={active}
                        title={!bookable && state.slotDate ? "This time has passed" : undefined}
                        onClick={() => patch({ slotTime: t })}
                        className={cn(
                          "tnum rounded-md border px-3.5 py-2 text-[13px] font-medium transition-colors",
                          active && "border-primary bg-primary text-primary-foreground",
                          !active && bookable && "hover:border-primary/40 hover:bg-muted/40",
                          !active && !bookable && "cursor-not-allowed text-muted-foreground/50",
                        )}
                      >
                        {timeLabel(t)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {selectedOutsideHours && worker && (
          <p className="flex items-start gap-2 rounded-md border border-[oklch(0.90_0.06_80)] bg-[oklch(0.965_0.035_85)] px-3 py-2.5 text-xs leading-relaxed text-[oklch(0.45_0.10_65)]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
            {worker.name} is not usually available in this window — they may propose a nearby slot after accepting, or you can pick another time.
          </p>
        )}

        {/* Standing orders — the cooperative's stable-income promise */}
        <div className="border-t border-border/70 pt-5">
          <fieldset>
            <legend className="micro-label mb-2.5">Repeat this booking</legend>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {RECURRENCE_OPTIONS.map((o) => {
                const active = state.recurrence === o.id;
                return (
                  <label
                    key={o.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3.5 transition-colors",
                      active ? "border-primary bg-[oklch(0.975_0.012_155)]" : "hover:border-primary/30 hover:bg-muted/40",
                    )}
                  >
                    <input
                      type="radio"
                      name="recurrence"
                      className="sr-only"
                      checked={active}
                      onChange={() => patch({ recurrence: o.id })}
                    />
                    <span
                      aria-hidden
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        active ? "border-primary" : "border-muted-foreground/40",
                      )}
                    >
                      {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[14px] font-medium">{o.label}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{o.hint}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <p className="mt-3 flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            <Repeat className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[oklch(0.5_0.105_155)]" strokeWidth={1.9} />
            Standing orders give our members stable, predictable income — the cooperative's core promise. Same member, same rate, priority scheduling.
          </p>
          {state.recurrence !== "one-time" && (
            <p className="mt-2 flex items-start gap-1.5 pl-3 text-xs leading-relaxed text-[oklch(0.45_0.10_155)]">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />
              + next occurrence auto-scheduled after each completed visit — same time, same rate, cancel anytime.
            </p>
          )}
        </div>
      </div>
      {footer}
    </SectionCard>
  );
}

/* ------------------------------------------------------------------ */
/* Step 5 — Review & pay                                               */
/* ------------------------------------------------------------------ */

function ReviewStep({
  state,
  patch,
  category,
  service,
  worker,
  score,
  slotLabel,
  price,
  pending,
  error,
  onPay,
  onBack,
}: {
  state: FlowState;
  patch: (p: Partial<FlowState>) => void;
  category?: ServiceCategory;
  service: ServiceItem | null;
  worker?: Worker;
  score?: number;
  slotLabel: string;
  price: PriceBreakdown;
  pending: boolean;
  error?: string;
  onPay: () => void;
  onBack: () => void;
}) {
  const address = addressById(state.addressId);
  return (
    <div className="space-y-4">
      <SectionCard title="Review your request" description="Check the details — you'll only be charged once you confirm below.">
        <dl className="divide-y divide-border/70 text-sm">
          <div className="flex items-start gap-4 py-3">
            <dt className="w-28 shrink-0 text-[13px] text-muted-foreground">Member</dt>
            <dd className="min-w-0 flex-1">
              {worker ? (
                <span className="flex flex-wrap items-center gap-2">
                  <PersonAvatar name={worker.name} size="sm" />
                  <span className="font-medium">{worker.name}</span>
                  <span className="text-muted-foreground">{worker.tradeTitle}</span>
                  {typeof score === "number" && <MatchBadge score={score} size="sm" />}
                </span>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="flex items-start gap-4 py-3">
            <dt className="w-28 shrink-0 text-[13px] text-muted-foreground">Service</dt>
            <dd className="min-w-0 flex-1">
              <span className="font-medium">{service?.name}</span>
              <span className="mt-0.5 block text-[13px] text-muted-foreground">
                {category?.name}
                {service ? ` · ${duration(service.durationMin)}` : ""}
              </span>
            </dd>
          </div>
          <div className="flex items-start gap-4 py-3">
            <dt className="w-28 shrink-0 text-[13px] text-muted-foreground">Visit</dt>
            <dd className="tnum min-w-0 flex-1 font-medium">{slotLabel}</dd>
          </div>
          <div className="flex items-start gap-4 py-3">
            <dt className="w-28 shrink-0 text-[13px] text-muted-foreground">Frequency</dt>
            <dd className="min-w-0 flex-1">
              <span className="inline-flex items-center gap-1.5 font-medium">
                {state.recurrence !== "one-time" && <Repeat className="h-3.5 w-3.5 text-[oklch(0.5_0.105_155)]" strokeWidth={1.9} aria-hidden />}
                {state.recurrence === "one-time" ? "One-time visit" : `${recurrenceLabel(state.recurrence)} standing order`}
              </span>
              {state.recurrence !== "one-time" && (
                <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground">
                  Next occurrence auto-scheduled after each completed visit — same member, same rate. End anytime from the booking page.
                </span>
              )}
            </dd>
          </div>
          <div className="flex items-start gap-4 py-3">
            <dt className="w-28 shrink-0 text-[13px] text-muted-foreground">Address</dt>
            <dd className="min-w-0 flex-1">
              <span className="font-medium">{address.label}</span>
              <span className="mt-0.5 block text-[13px] text-muted-foreground">{addressLine(address)}</span>
            </dd>
          </div>
          <div className="flex items-start gap-4 py-3">
            <dt className="w-28 shrink-0 text-[13px] text-muted-foreground">Description</dt>
            <dd className="min-w-0 flex-1 text-[13px] leading-relaxed">{state.description.trim()}</dd>
          </div>
          {state.notes.trim() && (
            <div className="flex items-start gap-4 py-3">
              <dt className="w-28 shrink-0 text-[13px] text-muted-foreground">Notes</dt>
              <dd className="min-w-0 flex-1 text-[13px] leading-relaxed">{state.notes.trim()}</dd>
            </div>
          )}
        </dl>
      </SectionCard>

      <SectionCard title="Your bill — line by line" description="The same breakdown appears on your invoice. Nothing is added later.">
        <CustomerPriceLines price={price} />
        <div className="mt-5 border-t pt-5">
          <p className="micro-label mb-3">Where every rupee goes</p>
          <PaymentAllocation price={price} />
        </div>
      </SectionCard>

      <SectionCard title="Payment method" description="UPI is simulated in this prototype — no money moves.">
        <fieldset className="space-y-2.5">
          <legend className="sr-only">Payment method</legend>
          {PAYMENT_METHODS.map((m) => {
            const active = state.paymentMethod === m.id;
            return (
              <label
                key={m.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3.5 transition-colors",
                  active ? "border-primary bg-[oklch(0.975_0.012_155)]" : "hover:border-primary/30 hover:bg-muted/40",
                )}
              >
                <input
                  type="radio"
                  name="payment"
                  className="sr-only"
                  checked={active}
                  onChange={() => patch({ paymentMethod: m.id })}
                />
                <span
                  aria-hidden
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                    active ? "border-primary" : "border-muted-foreground/40",
                  )}
                >
                  {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-[14px] font-medium">{m.label}</span>
                  <span className="block text-xs text-muted-foreground">{m.note}</span>
                </span>
                <span className="shrink-0 rounded-sm border bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {m.tag}
                </span>
              </label>
            );
          })}
        </fieldset>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs leading-relaxed text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
            {error}
          </div>
        )}

        <div className="mt-5 space-y-3">
          <Button className="w-full" size="lg" onClick={onPay} disabled={pending}>
            {pending ? (
              "Authorizing payment…"
            ) : (
              <>
                <Lock className="h-4 w-4" strokeWidth={1.9} /> Pay {money(price.customerTotal)} securely
              </>
            )}
          </Button>
          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[oklch(0.5_0.105_155)]" strokeWidth={1.9} />
            Payment is held securely and settled to your member only after you confirm completion. Simulated UPI — prototype only.
          </p>
        </div>
      </SectionCard>

      <div className="flex items-center justify-between border-t pt-5">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.9} /> Back
        </Button>
        <span aria-hidden />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Step 6 — Confirmation                                               */
/* ------------------------------------------------------------------ */

function ConfirmationStep({ booking, worker }: { booking: Booking; worker?: Worker }) {
  const navigate = useAppStore((s) => s.navigate);
  return (
    <section className="rounded-lg border bg-card p-6 sm:p-8">
      <div className="flex flex-col items-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-[oklch(0.88_0.03_155)] bg-[oklch(0.945_0.034_155)]">
          <Check className="h-7 w-7 text-[oklch(0.45_0.10_155)]" strokeWidth={2} />
        </span>
        <h2 className="mt-4 text-xl font-semibold tracking-tight">Request sent to {worker?.name ?? "your member"}</h2>
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
          Booking <span className="tnum font-semibold text-foreground">{booking.reference}</span> · payment of{" "}
          <span className="tnum font-semibold text-foreground">{money(booking.price.customerTotal)}</span> authorized and held securely.
        </p>
      </div>

      <div className="mx-auto mt-7 max-w-md space-y-3">
        <p className="micro-label">What happens next</p>
        {[
          {
            title: `${worker?.name ?? "The member"} responds`,
            detail: worker ? `Typically within ${worker.responseMins} minutes — you'll get a notification when they accept.` : "You'll be notified when they accept.",
          },
          {
            title: "Visit and fix",
            detail: `${booking.title} — the member follows a shared checklist and documents the work.`,
          },
          {
            title: "You confirm, payment settles",
            detail: "Confirm completion to release payment to the member, then rate the service if you'd like.",
          },
          ...(booking.recurrence
            ? [
                {
                  title: "Your standing order continues",
                  detail: `After you confirm each visit, the next one is scheduled automatically — ${recurrenceLabel(booking.recurrence).toLowerCase()}, same time and rate. End it anytime from the booking page.`,
                },
              ]
            : []),
        ].map((s, i) => (
          <div key={s.title} className="flex items-start gap-3 rounded-lg border p-4">
            <span className="tnum flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-muted/50 text-xs font-semibold">
              {i + 1}
            </span>
            <div>
              <p className="text-[13px] font-semibold">{s.title}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{s.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
        <Button onClick={() => navigate("customer-booking", { bookingId: booking.id })}>View booking</Button>
        <Button variant="outline" onClick={() => navigate("customer-home")}>
          Back home
        </Button>
      </div>
    </section>
  );
}
