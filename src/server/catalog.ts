import type { ServiceCategory, ServiceCategoryId } from "@/lib/types";

export const CATEGORIES: ServiceCategory[] = [
  {
    id: "electrical",
    name: "Electrical",
    tagline: "Repairs, installations & safety checks",
    description:
      "Licensed electricians for fault repair, fixture installation, wiring inspections and backup setup. Every job closes with a written safety summary.",
    coverage: ["Fan & light repair", "Switchboards", "Wiring inspection", "Inverter setup"],
    services: [
      { id: "svc-e1", name: "Fan installation or repair", description: "Ceiling fan install, wobble or noise fix, regulator replacement", basePrice: 599, durationMin: 60, unit: "visit" },
      { id: "svc-e2", name: "Switchboard & socket repair", description: "Faulty switches, spark-prone sockets, MCB checks", basePrice: 649, durationMin: 60, unit: "visit" },
      { id: "svc-e3", name: "Light fixture & wiring repair", description: "Flickering lights, fixture replacement, minor wiring faults", basePrice: 749, durationMin: 75, unit: "visit" },
      { id: "svc-e4", name: "Full wiring safety inspection", description: "Load check, earthing test, written safety summary for your home", basePrice: 1199, durationMin: 120, unit: "visit" },
      { id: "svc-e5", name: "Inverter & backup setup", description: "Inverter installation, battery health check, load wiring", basePrice: 1499, durationMin: 150, unit: "visit" },
      { id: "svc-e6", name: "General electrical repair", description: "Diagnosis and repair of general electrical faults at home", basePrice: 800, durationMin: 90, unit: "visit" },
    ],
  },
  {
    id: "plumbing",
    name: "Plumbing",
    tagline: "Leaks, blockages & fixture fitting",
    description:
      "Plumbers for everyday leaks, blockages, fixture installation and bathroom plumbing checks — with flow testing after every repair.",
    coverage: ["Leak repair", "Blockage clearing", "Fixture fitting", "Tank repair"],
    services: [
      { id: "svc-p1", name: "Tap, leak & pipe repair", description: "Dripping taps, pipe leaks, joint sealing", basePrice: 499, durationMin: 45, unit: "visit" },
      { id: "svc-p2", name: "Drain & blockage clearing", description: "Blocked sinks, floor traps and bathroom drains", basePrice: 649, durationMin: 60, unit: "visit" },
      { id: "svc-p3", name: "Fixture installation", description: "Taps, showers, health faucets and fittings", basePrice: 749, durationMin: 75, unit: "visit" },
      { id: "svc-p4", name: "Water tank & flush system repair", description: "Flush tanks, float valves, overhead tank fittings", basePrice: 899, durationMin: 90, unit: "visit" },
      { id: "svc-p5", name: "Bathroom plumbing inspection", description: "Full check of fittings, pressure and drainage", basePrice: 599, durationMin: 60, unit: "visit" },
    ],
  },
  {
    id: "cleaning",
    name: "Cleaning",
    tagline: "Deep cleans & home care",
    description:
      "Trained cleaning members for full-home deep cleans, kitchen and bathroom care, and upholstery shampooing with a final walkthrough.",
    coverage: ["Full-home deep clean", "Kitchen deep clean", "Bathroom care", "Sofa shampoo"],
    services: [
      { id: "svc-c1", name: "Full home deep clean (1 BHK)", description: "Every room, kitchen and bathrooms — 2 members, equipment included", basePrice: 1499, durationMin: 240, unit: "visit" },
      { id: "svc-c2", name: "Full home deep clean (2 BHK)", description: "Every room, kitchen and bathrooms — 2 members, equipment included", basePrice: 1999, durationMin: 300, unit: "visit" },
      { id: "svc-c3", name: "Kitchen deep clean", description: "Degreasing, chimney exterior, cabinets and sink area", basePrice: 899, durationMin: 150, unit: "visit" },
      { id: "svc-c4", name: "Bathroom deep clean (2 baths)", description: "Descaling, sanitisation and fittings polish", basePrice: 699, durationMin: 120, unit: "visit" },
      { id: "svc-c5", name: "Sofa & carpet shampoo", description: "Machine shampoo, stain treatment and drying", basePrice: 749, durationMin: 120, unit: "visit" },
    ],
  },
  {
    id: "gardening",
    name: "Gardening",
    tagline: "Maintenance & seasonal care",
    description:
      "Gardening members for routine maintenance, lawn care and seasonal planting with green-waste clearance included.",
    coverage: ["Garden upkeep", "Lawn mowing", "Planting", "Hedge trimming"],
    services: [
      { id: "svc-g1", name: "Garden maintenance visit", description: "Weeding, pruning, watering and general upkeep", basePrice: 499, durationMin: 90, unit: "visit" },
      { id: "svc-g2", name: "Lawn mowing & edging", description: "Mow, edge and clear clippings", basePrice: 799, durationMin: 120, unit: "visit" },
      { id: "svc-g3", name: "Planting & seasonal care", description: "Seasonal plants, soil care and replanting", basePrice: 649, durationMin: 90, unit: "visit" },
      { id: "svc-g4", name: "Tree & hedge trimming", description: "Shaping, height control and clearance", basePrice: 899, durationMin: 150, unit: "visit" },
    ],
  },
  {
    id: "repairs",
    name: "Repairs",
    tagline: "Furniture, appliances & fixtures",
    description:
      "Repair technicians for furniture, household appliances, doors, locks and mounting jobs — diagnosed before charging.",
    coverage: ["Furniture repair", "Appliance repair", "Doors & locks", "Mounting"],
    services: [
      { id: "svc-r1", name: "Furniture repair & assembly", description: "Repair, alignment and assembly of home furniture", basePrice: 549, durationMin: 75, unit: "visit" },
      { id: "svc-r2", name: "Appliance repair", description: "Washing machines, microwaves, mixers and small appliances", basePrice: 749, durationMin: 90, unit: "visit" },
      { id: "svc-r3", name: "Door, lock & window repair", description: "Locks, hinges, handles and alignment", basePrice: 499, durationMin: 60, unit: "visit" },
      { id: "svc-r4", name: "Wall & fixture mounting", description: "TVs, shelves, mirrors and fixtures — with anchors", basePrice: 399, durationMin: 45, unit: "visit" },
    ],
  },
  {
    id: "community-care",
    name: "Community Care",
    tagline: "Elder support & errands",
    description:
      "Vetted care associates for elder companionship, errands and post-hospitalisation support, with visit notes for families.",
    coverage: ["Elder companionship", "Errands", "Post-hospital support", "Wellbeing checks"],
    services: [
      { id: "svc-cc1", name: "Elder care companion visit (2 hrs)", description: "Companionship, light assistance and activity support", basePrice: 599, durationMin: 120, unit: "hour" },
      { id: "svc-cc2", name: "Grocery & errand assistance", description: "Shopping, pharmacy pickup and bill payments", basePrice: 299, durationMin: 90, unit: "visit" },
      { id: "svc-cc3", name: "Post-hospitalisation support visit", description: "Recovery support, meals help and mobility assistance", basePrice: 749, durationMin: 150, unit: "visit" },
      { id: "svc-cc4", name: "Weekly wellbeing check-in", description: "Health check, medication reminders and family update", basePrice: 499, durationMin: 60, unit: "visit" },
    ],
  },
];

export const CATEGORY_MAP: Record<ServiceCategoryId, ServiceCategory> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c]),
) as Record<ServiceCategoryId, ServiceCategory>;

export function serviceById(categoryId: ServiceCategoryId, serviceId: string) {
  return CATEGORY_MAP[categoryId]?.services.find((s) => s.id === serviceId);
}

export const CHECKLISTS: Record<ServiceCategoryId, string[]> = {
  electrical: ["Switch off mains and verify safety", "Diagnose fault with tester", "Repair or replace faulty component", "Test operation after repair", "Tidy work area and hand over"],
  plumbing: ["Shut off water supply", "Diagnose leak or blockage", "Carry out repair", "Run flow and pressure test", "Clean work area"],
  cleaning: ["Inspect home and confirm scope with resident", "Dust and wipe all surfaces", "Deep clean kitchen and bathrooms", "Sweep and mop floors", "Final walkthrough with resident"],
  gardening: ["Inspect garden and confirm scope", "Weed and prune", "Mow and trim as agreed", "Clear green waste", "Water and tidy up"],
  repairs: ["Inspect item and confirm scope", "Repair or replace part", "Test operation", "Clean up work area"],
  "community-care": ["Confirm wellbeing and today's needs", "Assist with agreed tasks", "Record visit notes for family", "Confirm next visit if required"],
};
