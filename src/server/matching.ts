import type { MatchFactor, ServiceCategoryId, Worker, WorkerRecommendation } from "@/lib/types";
import { computePrice } from "@/lib/rates";
import { serviceById } from "./catalog";

/**
 * Explainable worker-job matching.
 * Weighted score across five factors — every factor produces a qualitative
 * assessment and a human-readable reason. No black box: the weights and
 * assessments are shown to customers and workers alike.
 */
export const MATCH_WEIGHTS = {
  skill: 35,
  location: 20,
  availability: 20,
  rating: 15,
  experience: 10,
} as const;

const assessment = (score: number): string =>
  score >= 85 ? "Excellent" : score >= 70 ? "Good" : score >= 50 ? "Fair" : "Limited";

export interface MatchInput {
  categoryId: ServiceCategoryId;
  serviceId?: string;
  scheduledAt: Date;
  customerLocality: string;
  /** base service charge for the price estimate */
  serviceCharge: number;
}

function slotOf(date: Date): "morning" | "afternoon" | "evening" {
  const h = date.getHours();
  if (h < 12) return "morning";
  if (h < 16) return "afternoon";
  return "evening";
}

const SLOT_RANGES: Record<string, [number, number]> = {
  morning: [8, 12],
  afternoon: [12, 16],
  evening: [16, 20],
};

function coversSlot(worker: Worker, date: Date): boolean {
  const slot = slotOf(date);
  const [start, end] = SLOT_RANGES[slot];
  const day = date.getDay();
  const dayAvail = worker.availability.find((a) => a.day === day);
  if (!dayAvail) return false;
  return dayAvail.slots.some((s) => {
    const [from, to] = s.split("–").map((x) => parseInt(x.replace(":", ""), 10));
    return from <= start * 100 && to >= end * 100;
  });
}

export function scoreWorker(worker: Worker, input: MatchInput): { score: number; factors: MatchFactor[] } {
  /* 1 — Skill match */
  const categoryMatch = worker.category === input.categoryId;
  const service = input.serviceId ? serviceById(input.categoryId, input.serviceId) : undefined;
  const skillKeywords = service?.name.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3) ?? [];
  const skillHits = skillKeywords.filter((k) =>
    worker.skills.some((s) => s.toLowerCase().includes(k) || k.includes(s.toLowerCase().split(" ")[0])),
  ).length;
  let skillScore = 0;
  if (categoryMatch) skillScore = 80;
  if (categoryMatch && service && skillHits > 0) skillScore = 92;
  if (categoryMatch && worker.certifications.length >= 2) skillScore = Math.min(100, skillScore + 8);
  if (!categoryMatch) skillScore = Math.max(0, 30 - 10);

  /* 2 — Location */
  const withinRadius = worker.distanceKm <= worker.preferredRadiusKm;
  const locationScore = withinRadius
    ? Math.max(45, Math.round(100 - worker.distanceKm * 7))
    : Math.max(25, Math.round(70 - worker.distanceKm * 4));

  /* 3 — Availability */
  const hasSlot = coversSlot(worker, input.scheduledAt);
  const availabilityScore = hasSlot ? 96 : worker.availability.length > 0 ? 45 : 20;

  /* 4 — Rating */
  const ratingScore = worker.completedJobs > 0 ? Math.round((worker.rating / 5) * 100) : 55;

  /* 5 — Experience */
  const experienceScore = Math.min(100, Math.round(55 + worker.experienceYears * 9));

  const factors: MatchFactor[] = [
    {
      id: "skill",
      label: "Skill match",
      score: skillScore,
      weightPct: MATCH_WEIGHTS.skill,
      assessment: assessment(skillScore),
      detail: categoryMatch
        ? service
          ? `Verified ${worker.tradeTitle.toLowerCase()} — handles ${service.name.toLowerCase()} regularly`
          : `Verified ${worker.tradeTitle.toLowerCase()} for this category`
        : "Works in a related category — not a primary skill area",
    },
    {
      id: "location",
      label: "Location",
      score: locationScore,
      weightPct: MATCH_WEIGHTS.location,
      assessment: assessment(locationScore),
      detail: `${worker.distanceKm} km from ${input.customerLocality}${withinRadius ? ` · within ${worker.preferredRadiusKm} km service radius` : " · outside usual service radius"}`,
    },
    {
      id: "availability",
      label: "Availability",
      score: availabilityScore,
      weightPct: MATCH_WEIGHTS.availability,
      assessment: assessment(availabilityScore),
      detail: hasSlot ? "Available for the exact requested time" : "May need to adjust the slot to confirmed availability",
    },
    {
      id: "rating",
      label: "Service rating",
      score: ratingScore,
      weightPct: MATCH_WEIGHTS.rating,
      assessment: assessment(ratingScore),
      detail: worker.completedJobs > 0 ? `${worker.rating.toFixed(1)} / 5 across ${worker.completedJobs} completed services` : "New member — building a service record",
    },
    {
      id: "experience",
      label: "Experience",
      score: experienceScore,
      weightPct: MATCH_WEIGHTS.experience,
      assessment: assessment(experienceScore),
      detail: `${worker.experienceYears} year${worker.experienceYears === 1 ? "" : "s"} of field experience`,
    },
  ];

  const score = Math.round(factors.reduce((acc, f) => acc + (f.score * f.weightPct) / 100, 0));
  return { score: Math.min(99, score), factors };
}

export function recommend(
  workers: Worker[],
  input: MatchInput,
  limit = 3,
): WorkerRecommendation[] {
  return workers
    .filter((w) => w.status === "verified")
    .map((worker) => {
      const { score, factors } = scoreWorker(worker, input);
      const strengths = factors.filter((f) => f.score >= 85).slice(0, 3).map((f) => f.label.toLowerCase());
      return {
        worker,
        score,
        factors,
        estimatedPrice: computePrice(input.serviceCharge),
        reasonSummary: `${strengths.join(" · ") || "balanced profile"} — ${worker.rating.toFixed(1)}★, ${worker.distanceKm} km away`,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
