import type { ForecastCell, ForecastData, ForecastPeak, ServiceCategoryId } from "@/lib/types";

/**
 * Deterministic 7-day demand forecast generator (simulated model output).
 * Patterns: weekend evenings peak for cleaning/electrical; weekday mornings
 * for gardening/community care. Historical = predicted ± small variance.
 */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260926);

const CATEGORY_DEMAND: Record<ServiceCategoryId, { base: number; eveningBoost: number; weekendBoost: number }> = {
  cleaning: { base: 7, eveningBoost: 3, weekendBoost: 4 },
  electrical: { base: 6, eveningBoost: 4, weekendBoost: 2 },
  plumbing: { base: 4, eveningBoost: 2, weekendBoost: 1 },
  gardening: { base: 4, eveningBoost: -2, weekendBoost: 3 },
  repairs: { base: 4, eveningBoost: 2, weekendBoost: 1 },
  "community-care": { base: 3, eveningBoost: 1, weekendBoost: 1 },
};

const SLOT_MULTIPLIER: Record<string, number> = { "08–12": 1.15, "12–16": 0.75, "16–20": 1.4 };
const WORKERS_PER_CATEGORY: Record<ServiceCategoryId, number> = {
  cleaning: 6,
  electrical: 8,
  plumbing: 5,
  gardening: 3,
  repairs: 4,
  "community-care": 4,
};

const ACTIONS = [
  "Open additional evening availability for {category} members",
  "Notify {category} members about the expected evening peak",
  "Consider weekend incentive shift for {category} coverage",
  "Pre-authorise overtime slots for {category} on {day}",
];

export function generateForecast(now = new Date()): ForecastData {
  const cells: ForecastCell[] = [];
  const slots = ["08–12", "12–16", "16–20"] as const;

  for (let day = 0; day < 7; day++) {
    const date = new Date(now.getTime() + day * 86400000);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    for (const slot of slots) {
      for (const [categoryId, pattern] of Object.entries(CATEGORY_DEMAND) as [ServiceCategoryId, typeof CATEGORY_DEMAND[ServiceCategoryId]][]) {
        const slotMul = SLOT_MULTIPLIER[slot];
        const eveningBoost = slot === "16–20" ? pattern.eveningBoost : 0;
        const predicted = Math.max(
          2,
          Math.round((pattern.base + eveningBoost) * slotMul * (isWeekend ? 1 + pattern.weekendBoost / 20 : 1) + rand() * 4 - 2),
        );
        const historical = Math.max(1, Math.round(predicted + rand() * 6 - 3));
        const availableWorkers = Math.max(1, Math.round(WORKERS_PER_CATEGORY[categoryId] * (slot === "16–20" ? 0.55 : 0.9) + rand() * 2));
        cells.push({
          day,
          slot,
          categoryId,
          predicted,
          historical,
          availableWorkers,
          confidence: Math.round(78 + rand() * 18),
        });
      }
    }
  }

  /* Peaks: cells with the largest demand-vs-capacity gaps */
  const withGap = cells.map((c) => ({ ...c, gap: Math.max(0, c.predicted - c.availableWorkers) }));
  const peaks: ForecastPeak[] = withGap
    .sort((a, b) => b.gap - a.gap || b.predicted - a.predicted)
    .slice(0, 4)
    .map((c, i): ForecastPeak => ({
      id: `peak-${i}`,
      day: c.day,
      slot: c.slot,
      categoryId: c.categoryId,
      demandLevel: c.predicted >= 22 ? "very_high" : c.predicted >= 16 ? "high" : c.predicted >= 10 ? "medium" : "low",
      predicted: c.predicted,
      availableWorkers: c.availableWorkers,
      gap: c.gap,
      recommendedAction: ACTIONS[i % ACTIONS.length]
        .replace("{category}", c.categoryId === "community-care" ? "community care" : c.categoryId)
        .replace("{day}", ["today", "tomorrow", "in 2 days", "in 3 days", "in 4 days", "in 5 days", "in 6 days"][c.day] ?? ""),
    }))
    .sort((a, b) => a.day - b.day);

  const weekSummary = {
    predictedBookings: cells.reduce((a, c) => a + c.predicted, 0),
    lastWeekBookings: cells.reduce((a, c) => a + c.historical, 0),
    avgConfidence: Math.round(cells.reduce((a, c) => a + c.confidence, 0) / cells.length),
    totalGap: withGap.reduce((a, c) => a + c.gap, 0),
  };

  return { cells, peaks, weekSummary, generatedAt: new Date().toISOString() };
}
