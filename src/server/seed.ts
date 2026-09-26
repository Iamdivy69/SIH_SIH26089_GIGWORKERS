import type {
  AppNotification,
  AuditEntry,
  Booking,
  BookingRecurrence,
  Customer,
  EvidencePhoto,
  Payout,
  PlatformPolicy,
  Review,
  SkillCourse,
  SupportTicket,
  Transaction,
  TrainingCourse,
  TrainingEnrollment,
  VerificationItem,
  Worker,
  WorkerAvailabilitySlot,
} from "@/lib/types";
import { computePrice } from "@/lib/rates";
import { CHECKLISTS, serviceById } from "./catalog";

/* ------------------------------------------------------------------ */
/* Deterministic PRNG so the demo data is stable across reloads        */
/* ------------------------------------------------------------------ */
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
const rand = mulberry32(26089);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) => min + rand() * (max - min);
const intBetween = (min: number, max: number) => Math.round(between(min, max));

const NOW = new Date();
const HOUR = 3600_000;
const DAY = 24 * HOUR;
const iso = (d: Date) => d.toISOString();
const daysAgo = (n: number, hour = 10, minute = 0) => {
  const d = new Date(NOW.getTime() - n * DAY);
  d.setHours(hour, minute, 0, 0);
  return d;
};
const daysAhead = (n: number, hour = 10, minute = 0) => daysAgo(-n, hour, minute);

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

const availability = (days: number[], slots: string[]): WorkerAvailabilitySlot[] =>
  days.map((d) => ({ day: d, slots: [...slots] }));

const FULL_WEEK = availability([0, 1, 2, 3, 4, 5, 6], ["08:00–12:00", "12:00–16:00", "16:00–20:00"]);
const WEEKDAY_DAYS = availability([1, 2, 3, 4, 5], ["08:00–12:00", "12:00–16:00"]);

const verified = (dateAgo = 400): VerificationItem[] => [
  { id: "vf-id", label: "Identity verification (Aadhaar-based, simulated)", status: "verified", verifiedAt: iso(daysAgo(dateAgo + 40)), reference: "IDV-2023-01142" },
  { id: "vf-addr", label: "Address verification", status: "verified", verifiedAt: iso(daysAgo(dateAgo + 38)), reference: "ADV-2023-00871" },
  { id: "vf-skill", label: "Skill certification", status: "verified", verifiedAt: iso(daysAgo(dateAgo)), reference: "SKV-2024-00415" },
  { id: "vf-bg", label: "Background verification", status: "verified", verifiedAt: iso(daysAgo(dateAgo + 20)), reference: "BGC-2023-00256" },
];

export const WORKERS: Worker[] = [
  {
    id: "w-priya",
    name: "Priya Sharma",
    category: "electrical",
    tradeTitle: "Certified Electrician",
    locality: "Kothrud",
    city: "Pune",
    distanceKm: 1.4,
    rating: 4.8,
    reviewCount: 187,
    completedJobs: 312,
    experienceYears: 6,
    status: "verified",
    memberSince: iso(daysAgo(1280)),
    cooperativeMemberId: "SGW-0117",
    preferredRadiusKm: 6,
    onTimeRate: 96,
    repeatCustomerRate: 71,
    responseMins: 8,
    baseRateNote: "Visit rate ₹599–1,499 · estimate confirmed after diagnosis",
    certifications: [
      { id: "cert-p1", name: "ITI — Electrician (2-year trade)", issuer: "Sahyog Skill Academy (verified credential)", issuedAt: iso(daysAgo(1500)), credentialId: "SSA-ELC-2019-0211" },
      { id: "cert-p2", name: "Residential Wiring Safety — Level 2", issuer: "Sahyog Skill Academy", issuedAt: iso(daysAgo(420)), validTill: iso(daysAhead(310)), credentialId: "SSA-SAF-2024-0088" },
      { id: "cert-p3", name: "Customer Communication for Field Services", issuer: "Sahyog Skill Academy", issuedAt: iso(daysAgo(180)), credentialId: "SSA-COM-2025-0132" },
    ],
    verification: verified(420),
    availability: availability([0, 1, 2, 3, 4, 5, 6], ["08:00–12:00", "16:00–20:00"]),
    bio: "Six years of residential electrical work across west Pune. I specialise in fault diagnosis and wiring safety, and close every job with a written safety summary so families know exactly what was checked.",
    languages: ["Marathi", "Hindi", "English"],
    skills: ["Fault diagnosis", "Wiring & rewiring", "Fan & fixture installation", "MCB & safety checks", "Inverter setup"],
  },
  {
    id: "w-rakesh",
    name: "Rakesh Patil",
    category: "plumbing",
    tradeTitle: "Licensed Plumber",
    locality: "Warje",
    city: "Pune",
    distanceKm: 2.1,
    rating: 4.7,
    reviewCount: 154,
    completedJobs: 267,
    experienceYears: 5,
    status: "verified",
    memberSince: iso(daysAgo(1100)),
    cooperativeMemberId: "SGW-0121",
    preferredRadiusKm: 7,
    onTimeRate: 94,
    repeatCustomerRate: 64,
    responseMins: 12,
    baseRateNote: "Visit rate ₹499–899 · free follow-up within 7 days",
    certifications: [
      { id: "cert-rk1", name: "ITI — Plumber (2-year trade)", issuer: "Sahyog Skill Academy (verified credential)", issuedAt: iso(daysAgo(1400)), credentialId: "SSA-PLB-2019-0176" },
      { id: "cert-rk2", name: "Water Conservation Fittings", issuer: "Sahyog Skill Academy", issuedAt: iso(daysAgo(300)), credentialId: "SSA-WAT-2024-0054" },
    ],
    verification: verified(300),
    availability: FULL_WEEK,
    bio: "Plumber serving Warje and Kothrud for five years. I believe in fixing the root cause, not the symptom — every repair ends with a flow test.",
    languages: ["Marathi", "Hindi"],
    skills: ["Leak repair", "Blockage clearing", "Fixture installation", "Tank systems"],
  },
  {
    id: "w-meena",
    name: "Meena Joshi",
    category: "cleaning",
    tradeTitle: "Home Cleaning Specialist",
    locality: "Kothrud",
    city: "Pune",
    distanceKm: 1.8,
    rating: 4.9,
    reviewCount: 244,
    completedJobs: 421,
    experienceYears: 4,
    status: "verified",
    memberSince: iso(daysAgo(980)),
    cooperativeMemberId: "SGW-0133",
    preferredRadiusKm: 5,
    onTimeRate: 98,
    repeatCustomerRate: 78,
    responseMins: 6,
    baseRateNote: "Deep clean ₹699–1,999 · eco-friendly supplies included",
    certifications: [
      { id: "cert-mn1", name: "Professional Home Cleaning — Level 2", issuer: "Sahyog Skill Academy", issuedAt: iso(daysAgo(650)), credentialId: "SSA-CLN-2023-0031" },
      { id: "cert-mn2", name: "Safe Use of Cleaning Chemicals", issuer: "Sahyog Skill Academy", issuedAt: iso(daysAgo(240)), credentialId: "SSA-SAF-2025-0061" },
    ],
    verification: verified(240),
    availability: availability([1, 2, 3, 4, 5, 6], ["08:00–12:00", "12:00–16:00"]),
    bio: "Four years and 400+ deep cleans. I work with a two-member team, bring our own eco-friendly supplies, and always do a final walkthrough with the resident.",
    languages: ["Marathi", "Hindi"],
    skills: ["Full-home deep clean", "Kitchen degreasing", "Upholstery shampoo", "Eco-safe products"],
  },
  {
    id: "w-arjun",
    name: "Arjun Kamble",
    category: "gardening",
    tradeTitle: "Gardening & Greens Specialist",
    locality: "Baner",
    city: "Pune",
    distanceKm: 5.2,
    rating: 4.6,
    reviewCount: 112,
    completedJobs: 188,
    experienceYears: 3,
    status: "verified",
    memberSince: iso(daysAgo(760)),
    cooperativeMemberId: "SGW-0142",
    preferredRadiusKm: 8,
    onTimeRate: 93,
    repeatCustomerRate: 69,
    responseMins: 15,
    baseRateNote: "Maintenance visits ₹499–899 · seasonal advice included",
    certifications: [
      { id: "cert-aj1", name: "Ornamental & Kitchen Gardening", issuer: "Sahyog Skill Academy", issuedAt: iso(daysAgo(700)), credentialId: "SSA-GRD-2023-0019" },
    ],
    verification: verified(700),
    availability: availability([2, 3, 4, 5, 6, 0], ["08:00–12:00", "16:00–20:00"]),
    bio: "Gardener for societies and homes in Baner–Balewadi. I suggest seasonal, low-water planting so gardens stay healthy through summer.",
    languages: ["Marathi", "Hindi"],
    skills: ["Lawn care", "Seasonal planting", "Hedge trimming", "Composting setup"],
  },
  {
    id: "w-sunita",
    name: "Sunita Pawar",
    category: "community-care",
    tradeTitle: "Community Care Associate",
    locality: "Aundh",
    city: "Pune",
    distanceKm: 6.4,
    rating: 4.9,
    reviewCount: 201,
    completedJobs: 356,
    experienceYears: 7,
    status: "verified",
    memberSince: iso(daysAgo(1500)),
    cooperativeMemberId: "SGW-0098",
    preferredRadiusKm: 6,
    onTimeRate: 97,
    repeatCustomerRate: 82,
    responseMins: 9,
    baseRateNote: "Companion visits ₹499–749 · family notes after every visit",
    certifications: [
      { id: "cert-sn1", name: "Elder Care Fundamentals", issuer: "Sahyog Skill Academy", issuedAt: iso(daysAgo(1200)), credentialId: "SSA-CAR-2022-0027" },
      { id: "cert-sn2", name: "First Aid & Emergency Response", issuer: "Sahyog Skill Academy", issuedAt: iso(daysAgo(400)), validTill: iso(daysAhead(330)), credentialId: "SSA-AID-2024-0093" },
    ],
    verification: verified(400),
    availability: FULL_WEEK,
    bio: "Seven years supporting elders and families in Aundh. Every visit ends with written notes for the family — small updates that matter.",
    languages: ["Marathi", "Hindi", "English"],
    skills: ["Elder companionship", "Post-hospital support", "Errand assistance", "Wellbeing checks"],
  },
  {
    id: "w-vikas",
    name: "Vikas Shinde",
    category: "electrical",
    tradeTitle: "Electrician",
    locality: "Hadapsar",
    city: "Pune",
    distanceKm: 11.2,
    rating: 4.4,
    reviewCount: 78,
    completedJobs: 142,
    experienceYears: 2,
    status: "verified",
    memberSince: iso(daysAgo(520)),
    cooperativeMemberId: "SGW-0155",
    preferredRadiusKm: 10,
    onTimeRate: 88,
    repeatCustomerRate: 52,
    responseMins: 22,
    baseRateNote: "Visit rate ₹599–1,199 · first-visit diagnosis free",
    certifications: [
      { id: "cert-vk1", name: "ITI — Electrician (2-year trade)", issuer: "Sahyog Skill Academy (verified credential)", issuedAt: iso(daysAgo(560)), credentialId: "SSA-ELC-2024-0119" },
    ],
    verification: verified(500),
    availability: WEEKDAY_DAYS,
    bio: "Two years into the trade, focusing on quick fault-finding and honest assessments for homes in east Pune.",
    languages: ["Marathi", "Hindi"],
    skills: ["Fault diagnosis", "Fixture installation", "Basic wiring"],
  },
  {
    id: "w-deepak",
    name: "Deepak Jadhav",
    category: "repairs",
    tradeTitle: "Carpenter & Repair Technician",
    locality: "Wakad",
    city: "Pune",
    distanceKm: 7.8,
    rating: 4.5,
    reviewCount: 121,
    completedJobs: 203,
    experienceYears: 4,
    status: "verified",
    memberSince: iso(daysAgo(830)),
    cooperativeMemberId: "SGW-0129",
    preferredRadiusKm: 9,
    onTimeRate: 91,
    repeatCustomerRate: 58,
    responseMins: 14,
    baseRateNote: "Repairs ₹399–749 · quote after inspection, before work",
    certifications: [
      { id: "cert-dp1", name: "Carpentry & Furniture Repair", issuer: "Sahyog Skill Academy", issuedAt: iso(daysAgo(900)), credentialId: "SSA-REP-2022-0064" },
    ],
    verification: verified(850),
    availability: availability([1, 2, 3, 4, 5, 6], ["12:00–16:00", "16:00–20:00"]),
    bio: "Carpenter for four years — furniture, appliance mounts, doors and locks. I quote before starting so there are no surprises.",
    languages: ["Marathi", "Hindi"],
    skills: ["Furniture repair", "Appliance installation", "Doors & locks", "Wall mounting"],
  },
  {
    id: "w-kavita",
    name: "Kavita More",
    category: "cleaning",
    tradeTitle: "Cleaning Specialist",
    locality: "Viman Nagar",
    city: "Pune",
    distanceKm: 10.5,
    rating: 4.7,
    reviewCount: 163,
    completedJobs: 289,
    experienceYears: 3,
    status: "verified",
    memberSince: iso(daysAgo(690)),
    cooperativeMemberId: "SGW-0148",
    preferredRadiusKm: 8,
    onTimeRate: 95,
    repeatCustomerRate: 66,
    responseMins: 11,
    baseRateNote: "Deep clean ₹699–1,999 · society references available",
    certifications: [
      { id: "cert-kv1", name: "Professional Home Cleaning — Level 1", issuer: "Sahyog Skill Academy", issuedAt: iso(daysAgo(680)), credentialId: "SSA-CLN-2023-0058" },
    ],
    verification: verified(680),
    availability: availability([1, 2, 3, 4, 5, 6], ["08:00–12:00", "12:00–16:00"]),
    bio: "Cleaning specialist covering Viman Nagar and Kalyani Nagar. Society references available on request.",
    languages: ["Marathi", "Hindi"],
    skills: ["Full-home deep clean", "Bathroom care", "Move-in cleaning"],
  },
  {
    id: "w-sandeep",
    name: "Sandeep Gaikwad",
    category: "plumbing",
    tradeTitle: "Plumbing Technician",
    locality: "Hinjewadi",
    city: "Pune",
    distanceKm: 10.2,
    rating: 4.3,
    reviewCount: 54,
    completedJobs: 96,
    experienceYears: 1,
    status: "verified",
    memberSince: iso(daysAgo(310)),
    cooperativeMemberId: "SGW-0161",
    preferredRadiusKm: 10,
    onTimeRate: 86,
    repeatCustomerRate: 47,
    responseMins: 26,
    baseRateNote: "Visit rate ₹499–899",
    certifications: [
      { id: "cert-sd1", name: "Plumbing Assistant — Level 1", issuer: "Sahyog Skill Academy", issuedAt: iso(daysAgo(300)), credentialId: "SSA-PLB-2024-0143" },
    ],
    verification: verified(300),
    availability: availability([2, 3, 4, 5, 6], ["08:00–12:00", "12:00–16:00"]),
    bio: "New member building a record in Hinjewadi — prompt, careful, and growing fast.",
    languages: ["Marathi", "Hindi"],
    skills: ["Leak repair", "Fixture installation"],
  },
  {
    id: "w-anita",
    name: "Anita Deshmukh",
    category: "community-care",
    tradeTitle: "Senior Care Associate",
    locality: "Kalyani Nagar",
    city: "Pune",
    distanceKm: 8.6,
    rating: 4.8,
    reviewCount: 139,
    completedJobs: 234,
    experienceYears: 5,
    status: "verified",
    memberSince: iso(daysAgo(940)),
    cooperativeMemberId: "SGW-0136",
    preferredRadiusKm: 7,
    onTimeRate: 96,
    repeatCustomerRate: 74,
    responseMins: 10,
    baseRateNote: "Care visits ₹499–749 · families get daily visit notes",
    certifications: [
      { id: "cert-an1", name: "Elder Care Fundamentals", issuer: "Sahyog Skill Academy", issuedAt: iso(daysAgo(1000)), credentialId: "SSA-CAR-2022-0071" },
      { id: "cert-an2", name: "Mobility Assistance Training", issuer: "Sahyog Skill Academy", issuedAt: iso(daysAgo(500)), credentialId: "SSA-CAR-2024-0117" },
    ],
    verification: verified(500),
    availability: availability([1, 2, 3, 4, 5], ["08:00–12:00", "12:00–16:00", "16:00–20:00"]),
    bio: "Five years of senior care experience. I work closely with families on routines, medication reminders and gentle mobility support.",
    languages: ["Marathi", "Hindi", "English"],
    skills: ["Senior care", "Mobility assistance", "Wellbeing checks"],
  },
  {
    id: "w-farhan",
    name: "Farhan Shaikh",
    category: "electrical",
    tradeTitle: "Electrician & Appliance Technician",
    locality: "Kharadi",
    city: "Pune",
    distanceKm: 12.8,
    rating: 4.6,
    reviewCount: 98,
    completedJobs: 178,
    experienceYears: 3,
    status: "verified",
    memberSince: iso(daysAgo(640)),
    cooperativeMemberId: "SGW-0151",
    preferredRadiusKm: 12,
    onTimeRate: 92,
    repeatCustomerRate: 61,
    responseMins: 13,
    baseRateNote: "Visit rate ₹599–1,499 · appliance + electrical combo",
    certifications: [
      { id: "cert-fs1", name: "ITI — Electrician (2-year trade)", issuer: "Sahyog Skill Academy (verified credential)", issuedAt: iso(daysAgo(800)), credentialId: "SSA-ELC-2023-0090" },
    ],
    verification: verified(780),
    availability: availability([1, 2, 3, 4, 5, 6], ["12:00–16:00", "16:00–20:00"]),
    bio: "Electrician covering Kharadi and Vadgaonsheri — homes and small offices, appliances welcome.",
    languages: ["Hindi", "Marathi", "English"],
    skills: ["Fault diagnosis", "Appliance wiring", "Inverter setup"],
  },
  {
    id: "w-mangesh",
    name: "Mangesh Thorat",
    category: "repairs",
    tradeTitle: "Appliance Repair Technician",
    locality: "Bibvewadi",
    city: "Pune",
    distanceKm: 5.8,
    rating: 4.4,
    reviewCount: 66,
    completedJobs: 121,
    experienceYears: 2,
    status: "verified",
    memberSince: iso(daysAgo(450)),
    cooperativeMemberId: "SGW-0158",
    preferredRadiusKm: 8,
    onTimeRate: 90,
    repeatCustomerRate: 55,
    responseMins: 18,
    baseRateNote: "Appliance repairs ₹749 · 30-day workmanship guarantee",
    certifications: [
      { id: "cert-mg1", name: "Home Appliance Repair", issuer: "Sahyog Skill Academy", issuedAt: iso(daysAgo(460)), credentialId: "SSA-REP-2024-0165" },
    ],
    verification: verified(440),
    availability: availability([1, 2, 3, 4, 5, 6], ["08:00–12:00", "16:00–20:00"]),
    bio: "Washing machines, microwaves and mixers — diagnosed on the spot, with a 30-day workmanship guarantee.",
    languages: ["Marathi", "Hindi"],
    skills: ["Appliance repair", "Washing machines", "Small appliances"],
  },
  /* --- Verification pipeline (admin workflow) --- */
  {
    id: "w-shalini",
    name: "Shalini Kadam",
    category: "cleaning",
    tradeTitle: "Cleaning Specialist — Applicant",
    locality: "Warje",
    city: "Pune",
    distanceKm: 2.4,
    rating: 0,
    reviewCount: 0,
    completedJobs: 0,
    experienceYears: 0,
    status: "pending",
    memberSince: iso(daysAgo(6)),
    cooperativeMemberId: "—",
    preferredRadiusKm: 5,
    onTimeRate: 0,
    repeatCustomerRate: 0,
    responseMins: 0,
    baseRateNote: "Awaiting onboarding",
    certifications: [],
    verification: [
      { id: "vf-sh1", label: "Identity verification (Aadhaar-based, simulated)", status: "verified", verifiedAt: iso(daysAgo(5)), reference: "IDV-2025-04318" },
      { id: "vf-sh2", label: "Address verification", status: "pending", note: "Address proof uploaded — queued for field verification" },
      { id: "vf-sh3", label: "Skill certification", status: "pending", note: "Assessment slot booked" },
      { id: "vf-sh4", label: "Background verification", status: "under_review", note: "Report expected in 3 working days" },
    ],
    availability: [],
    bio: "Applicant with 3 years informal cleaning experience in societies; joining via the Kothrud ward circle.",
    languages: ["Marathi", "Hindi"],
    skills: ["Home cleaning"],
  },
  {
    id: "w-prasad",
    name: "Prasad Kale",
    category: "gardening",
    tradeTitle: "Gardening Technician — Applicant",
    locality: "Karve Nagar",
    city: "Pune",
    distanceKm: 3.1,
    rating: 0,
    reviewCount: 0,
    completedJobs: 0,
    experienceYears: 0,
    status: "under_review",
    memberSince: iso(daysAgo(12)),
    cooperativeMemberId: "—",
    preferredRadiusKm: 6,
    onTimeRate: 0,
    repeatCustomerRate: 0,
    responseMins: 0,
    baseRateNote: "Awaiting onboarding",
    certifications: [],
    verification: [
      { id: "vf-pr1", label: "Identity verification (Aadhaar-based, simulated)", status: "verified", verifiedAt: iso(daysAgo(11)), reference: "IDV-2025-04291" },
      { id: "vf-pr2", label: "Address verification", status: "verified", verifiedAt: iso(daysAgo(10)), reference: "ADV-2025-02104" },
      { id: "vf-pr3", label: "Skill certification", status: "under_review", note: "Practical assessment scheduled for next Tuesday" },
      { id: "vf-pr4", label: "Background verification", status: "verified", verifiedAt: iso(daysAgo(8)), reference: "BGC-2025-01987" },
    ],
    availability: [],
    bio: "Nursery worker for 5 years, applying for gardening services in Karve Nagar ward.",
    languages: ["Marathi"],
    skills: ["Plant care", "Nursery work"],
  },
  {
    id: "w-ganesh",
    name: "Ganesh Salunke",
    category: "plumbing",
    tradeTitle: "Plumber — Applicant",
    locality: "Sinhagad Road",
    city: "Pune",
    distanceKm: 3.8,
    rating: 0,
    reviewCount: 0,
    completedJobs: 0,
    experienceYears: 0,
    status: "needs_action",
    memberSince: iso(daysAgo(20)),
    cooperativeMemberId: "—",
    preferredRadiusKm: 7,
    onTimeRate: 0,
    repeatCustomerRate: 0,
    responseMins: 0,
    baseRateNote: "Awaiting onboarding",
    certifications: [],
    verification: [
      { id: "vf-gn1", label: "Identity verification (Aadhaar-based, simulated)", status: "verified", verifiedAt: iso(daysAgo(19)), reference: "IDV-2025-04233" },
      { id: "vf-gn2", label: "Address verification", status: "needs_action", note: "Uploaded rent agreement expired last month — fresh proof requested on " },
      { id: "vf-gn3", label: "Skill certification", status: "verified", verifiedAt: iso(daysAgo(14)), reference: "SKV-2025-01240" },
      { id: "vf-gn4", label: "Background verification", status: "verified", verifiedAt: iso(daysAgo(9)), reference: "BGC-2025-01966" },
    ],
    availability: [],
    bio: "Assistant plumber with 2 years experience on Sinhagad Road.",
    languages: ["Marathi", "Hindi"],
    skills: ["Pipe fitting", "Leak repair"],
  },
  {
    id: "w-rekha",
    name: "Rekha Bhalerao",
    category: "community-care",
    tradeTitle: "Care Associate — Applicant",
    locality: "Hadapsar",
    city: "Pune",
    distanceKm: 10.9,
    rating: 0,
    reviewCount: 0,
    completedJobs: 0,
    experienceYears: 0,
    status: "rejected",
    memberSince: iso(daysAgo(34)),
    cooperativeMemberId: "—",
    preferredRadiusKm: 6,
    onTimeRate: 0,
    repeatCustomerRate: 0,
    responseMins: 0,
    baseRateNote: "Application closed",
    certifications: [],
    verification: [
      { id: "vf-rk1", label: "Identity verification (Aadhaar-based, simulated)", status: "verified", verifiedAt: iso(daysAgo(33)), reference: "IDV-2025-04187" },
      { id: "vf-rk2", label: "Address verification", status: "verified", verifiedAt: iso(daysAgo(32)), reference: "ADV-2025-02088" },
      { id: "vf-rk3", label: "Skill certification", status: "pending", note: "Assessment deferred" },
      { id: "vf-rk4", label: "Background verification", status: "rejected", note: "Verification report could not be cleared for care-role eligibility (details shared with applicant). Reapplication possible after 6 months." },
    ],
    availability: [],
    bio: "Applicant for community care role.",
    languages: ["Marathi"],
    skills: [],
  },
];

export const CUSTOMERS: Customer[] = [
  {
    id: "c-ananya",
    name: "Ananya Deshpande",
    locality: "Kothrud",
    city: "Pune",
    memberSince: iso(daysAgo(420)),
    totalBookings: 5,
    lifetimeValue: 6384,
    addresses: [
      { id: "addr-home", label: "Home", line: "Flat 402, Sunshree Residency, Paud Road", locality: "Kothrud", city: "Pune", pincode: "411038" },
      { id: "addr-parents", label: "Parents' home", line: "Row House 12, Sai Colony, Karve Nagar", locality: "Karve Nagar", city: "Pune", pincode: "411052" },
    ],
    preferredCategories: ["cleaning", "electrical", "gardening"],
  },
  { id: "c-rohan", name: "Rohan Mehta", locality: "Baner", city: "Pune", memberSince: iso(daysAgo(280)), totalBookings: 7, lifetimeValue: 9420, addresses: [{ id: "addr-rohan", label: "Home", line: "B-1104, Skyline Heights, Baner Road", locality: "Baner", city: "Pune", pincode: "411045" }], preferredCategories: ["electrical", "cleaning"] },
  { id: "c-sneha", name: "Sneha Kulkarni", locality: "Aundh", city: "Pune", memberSince: iso(daysAgo(210)), totalBookings: 4, lifetimeValue: 6992, addresses: [{ id: "addr-sneha", label: "Home", line: "Flat 7, Sterling Park, Aundh Gaon", locality: "Aundh", city: "Pune", pincode: "411007" }], preferredCategories: ["cleaning", "community-care"] },
  { id: "c-aditya", name: "Aditya Joshi", locality: "Viman Nagar", city: "Pune", memberSince: iso(daysAgo(360)), totalBookings: 6, lifetimeValue: 7750, addresses: [{ id: "addr-aditya", label: "Home", line: "C-302, Konark Greens, Viman Nagar", locality: "Viman Nagar", city: "Pune", pincode: "411014" }], preferredCategories: ["repairs", "electrical"] },
  { id: "c-farida", name: "Farida Sheikh", locality: "Kharadi", city: "Pune", memberSince: iso(daysAgo(150)), totalBookings: 3, lifetimeValue: 4386, addresses: [{ id: "addr-farida", label: "Home", line: "802, Riverdale Towers, Kharadi", locality: "Kharadi", city: "Pune", pincode: "411014" }], preferredCategories: ["community-care", "cleaning"] },
  { id: "c-manish", name: "Manish Agarwal", locality: "Wakad", city: "Pune", memberSince: iso(daysAgo(95)), totalBookings: 2, lifetimeValue: 2278, addresses: [{ id: "addr-manish", label: "Home", line: "Flat 1109, Sai Symphony, Wakad", locality: "Wakad", city: "Pune", pincode: "411057" }], preferredCategories: ["cleaning"] },
  { id: "c-divya", name: "Divya Nair", locality: "Kalyani Nagar", city: "Pune", memberSince: iso(daysAgo(330)), totalBookings: 5, lifetimeValue: 5167, addresses: [{ id: "addr-divya", label: "Home", line: "Villa 4, Nagar Road Residency, Kalyani Nagar", locality: "Kalyani Nagar", city: "Pune", pincode: "411006" }], preferredCategories: ["community-care", "gardening"] },
  { id: "c-sameer", name: "Sameer Rane", locality: "Hadapsar", city: "Pune", memberSince: iso(daysAgo(60)), totalBookings: 2, lifetimeValue: 1898, addresses: [{ id: "addr-sameer", label: "Home", line: "Plot 18, Gandhi Nagar, Hadapsar", locality: "Hadapsar", city: "Pune", pincode: "411028" }], preferredCategories: ["plumbing", "electrical"] },
];

export const DEMO_USERS = {
  customer: "c-ananya",
  worker: "w-priya",
  admin: "u-admin",
};

/* ------------------------------------------------------------------ */
/* Bookings                                                            */
/* ------------------------------------------------------------------ */

interface BookingSeed {
  id: string;
  customerId: string;
  workerId: string;
  categoryId: Booking["categoryId"];
  serviceId: string;
  title: string;
  description: string;
  when: Date;
  status: Booking["status"];
  rating?: number;
  reviewComment?: string;
  reviewTags?: string[];
  matchScore?: number;
  customerNotes?: string;
  /** Standing-order fields — set on every occurrence of a series. */
  recurrence?: BookingRecurrence;
  seriesId?: string;
  occurrenceIndex?: number;
  /** Fixed charge override — standing orders keep the same rate across occurrences. */
  charge?: number;
  /** Hours before the slot this request was created (auto-scheduled occurrences are created at the previous visit's confirmation). */
  createdHoursBefore?: number;
  /** Seeded booking-scoped chat — hours offset relative to the scheduled slot (negative = before the visit). */
  messages?: { role: "customer" | "worker"; text: string; hoursOffset: number }[];
}

const seeds: BookingSeed[] = [
  /* --- Ananya (demo customer) history --- */
  { id: "bk-101", customerId: "c-ananya", workerId: "w-meena", categoryId: "cleaning", serviceId: "svc-c2", title: "Full home deep clean (2 BHK)", description: "Post-Diwali deep clean, include balconies and windows.", when: daysAgo(28, 10, 0), status: "completed", rating: 5, reviewComment: "Meena's team was thorough — the kitchen looks brand new. They even did the balcony grills without being asked.", reviewTags: ["Thorough", "Punctual", "Tidy"], matchScore: 96 },
  { id: "bk-102", customerId: "c-ananya", workerId: "w-rakesh", categoryId: "plumbing", serviceId: "svc-p1", title: "Tap, leak & pipe repair", description: "Kitchen sink tap dripping continuously; bathroom health faucet loose.", when: daysAgo(21, 16, 30), status: "completed", rating: 5, reviewComment: "Diagnosed both issues quickly, replaced the washer and cartridge. No mess left behind.", reviewTags: ["Skilled", "Tidy"], matchScore: 93 },
  { id: "bk-103", customerId: "c-ananya", workerId: "w-meena", categoryId: "cleaning", serviceId: "svc-c3", title: "Kitchen deep clean", description: "Degreasing after heavy festive cooking.", when: daysAgo(12, 11, 0), status: "completed", rating: 5, reviewComment: "Second time booking Meena. Consistent quality and very professional about moving things back.", reviewTags: ["Repeat visit", "Professional"], matchScore: 97 },
  { id: "bk-104", customerId: "c-ananya", workerId: "w-vikas", categoryId: "electrical", serviceId: "svc-e1", title: "Fan installation or repair", description: "Study room fan making grinding noise.", when: daysAgo(8, 18, 0), status: "completed", rating: 4, reviewComment: "Fixed the bearing issue. Took a little longer than expected but explained the problem clearly.", reviewTags: ["Clear explanation"], matchScore: 88 },
  /* --- Ananya upcoming --- */
  { id: "bk-105", customerId: "c-ananya", workerId: "w-arjun", categoryId: "gardening", serviceId: "svc-g1", title: "Garden maintenance visit", description: "Terrace garden upkeep — pruning, watering, check the soil in planters.", when: daysAhead(1, 10, 0), status: "confirmed", matchScore: 92, customerNotes: "Please ring the doorbell twice; the intercom is being repaired.", messages: [
    { role: "customer", text: "Hi Arjun — the terrace tap drips a little; could you check the planter drainage while you're here?", hoursOffset: -16 },
    { role: "worker", text: "Yes, I'll bring a spare washer and check the drainage slope. I'll also trim the ficus hedge as part of the visit.", hoursOffset: -13 },
  ] },
  /* --- Other customers: completed history (past 35 days) --- */
  { id: "bk-201", customerId: "c-rohan", workerId: "w-priya", categoryId: "electrical", serviceId: "svc-e3", title: "Light fixture & wiring repair", description: "Bedroom lights flickering; two holders need replacement.", when: daysAgo(31, 17, 30), status: "completed", rating: 5, reviewComment: "Priya arrived with all parts, finished in an hour and gave a written safety summary. Rare professionalism.", reviewTags: ["Professional", "Punctual", "Skilled"], matchScore: 95 },
  { id: "bk-202", customerId: "c-sneha", workerId: "w-meena", categoryId: "cleaning", serviceId: "svc-c4", title: "Bathroom deep clean (2 baths)", description: "Both bathrooms need descaling before guests arrive.", when: daysAgo(30, 9, 30), status: "completed", rating: 4, reviewComment: "Good work. The second bathroom could have been detailed a bit more, but overall satisfied.", reviewTags: ["Tidy"], matchScore: 91 },
  { id: "bk-203", customerId: "c-divya", workerId: "w-sunita", categoryId: "community-care", serviceId: "svc-cc1", title: "Elder care companion visit (2 hrs)", description: "Companion visit for my father — walk in the park, chess, medication reminder.", when: daysAgo(29, 16, 0), status: "completed", rating: 5, reviewComment: "Sunita aunty is wonderful with my father. The visit notes she writes are so reassuring for us.", reviewTags: ["Caring", "Reliable"], matchScore: 94 },
  { id: "bk-204", customerId: "c-aditya", workerId: "w-deepak", categoryId: "repairs", serviceId: "svc-r2", title: "Appliance repair", description: "Washing machine not spinning; makes clicking sound.", when: daysAgo(27, 12, 0), status: "completed", rating: 5, reviewComment: "Deepak found the lid switch fault in ten minutes. Fair quote, quick fix.", reviewTags: ["Skilled", "Fair pricing"], matchScore: 90 },
  { id: "bk-205", customerId: "c-farida", workerId: "w-kavita", categoryId: "cleaning", serviceId: "svc-c1", title: "Full home deep clean (1 BHK)", description: "Move-in clean before occupancy.", when: daysAgo(26, 8, 30), status: "completed", rating: 5, reviewComment: "Spotless move-in clean. Kavita brought her own supplies and was very systematic.", reviewTags: ["Thorough", "Tidy"], matchScore: 89 },
  { id: "bk-206", customerId: "c-manish", workerId: "w-priya", categoryId: "electrical", serviceId: "svc-e2", title: "Switchboard & socket repair", description: "Sparking observed in one socket; old switchboard needs replacement.", when: daysAgo(24, 10, 30), status: "completed", rating: 5, reviewComment: "Replaced the board neatly, labelled every switch. She insisted on testing each point before leaving.", reviewTags: ["Skilled", "Professional"], matchScore: 96 },
  { id: "bk-207", customerId: "c-sameer", workerId: "w-sandeep", categoryId: "plumbing", serviceId: "svc-p2", title: "Drain & blockage clearing", description: "Bathroom floor trap blocked, water pooling.", when: daysAgo(22, 9, 0), status: "completed", rating: 4, reviewComment: "Cleared the blockage. Slight delay in arrival but informed in advance.", reviewTags: ["Communicative"], matchScore: 84 },
  { id: "bk-208", customerId: "c-divya", workerId: "w-arjun", categoryId: "gardening", serviceId: "svc-g2", title: "Lawn mowing & edging", description: "Front lawn overgrown after the rains.", when: daysAgo(20, 8, 0), status: "completed", rating: 4, reviewComment: "Lawn looks much better now. Took one star off because some edging was uneven near the gate.", reviewTags: ["Tidy"], matchScore: 87 },
  { id: "bk-209", customerId: "c-rohan", workerId: "w-farhan", categoryId: "electrical", serviceId: "svc-e5", title: "Inverter & backup setup", description: "Install new inverter for 3 fans + 4 lights backup.", when: daysAgo(19, 17, 0), status: "completed", rating: 4, reviewComment: "Clean installation and explained load calculations before finalising. Good experience.", reviewTags: ["Clear explanation", "Skilled"], matchScore: 86 },
  { id: "bk-210", customerId: "c-sneha", workerId: "w-anita", categoryId: "community-care", serviceId: "svc-cc4", title: "Weekly wellbeing check-in", description: "Weekly check for my mother — BP log, medication reminders.", when: daysAgo(18, 11, 0), status: "completed", rating: 5, reviewComment: "Anita is punctual and warm. The weekly notes template she shares is excellent.", reviewTags: ["Caring", "Punctual"], matchScore: 93 },
  { id: "bk-211", customerId: "c-aditya", workerId: "w-mangesh", categoryId: "repairs", serviceId: "svc-r2", title: "Appliance repair", description: "Microwave tray not rotating; heating uneven.", when: daysAgo(17, 19, 0), status: "completed", rating: 4, reviewComment: "Fixed the motor and roller. Carried spare parts, which saved a second visit.", reviewTags: ["Skilled"], matchScore: 88 },
  { id: "bk-212", customerId: "c-farida", workerId: "w-sunita", categoryId: "community-care", serviceId: "svc-cc2", title: "Grocery & errand assistance", description: "Monthly grocery pickup + pharmacy for mother-in-law.", when: daysAgo(15, 10, 0), status: "completed", rating: 5, reviewComment: "So helpful — receipts for everything, and she waited at the pharmacy counter patiently.", reviewTags: ["Reliable", "Caring"], matchScore: 92 },
  { id: "bk-213", customerId: "c-rohan", workerId: "w-meena", categoryId: "cleaning", serviceId: "svc-c3", title: "Kitchen deep clean", description: "Chimney and hob degreasing.", when: daysAgo(14, 14, 0), status: "completed", rating: 5, reviewComment: "Chimney looks like new. Very systematic work.", reviewTags: ["Thorough"], matchScore: 90 },
  { id: "bk-214", customerId: "c-sameer", workerId: "w-vikas", categoryId: "electrical", serviceId: "svc-e6", title: "General electrical repair", description: "Two fans and a tube light not working after voltage fluctuation.", when: daysAgo(13, 18, 30), status: "completed", rating: 4, reviewComment: "Fixed all three. Honest about what could be repaired vs replaced.", reviewTags: ["Honest", "Fair pricing"], matchScore: 85 },
  { id: "bk-215", customerId: "c-manish", workerId: "w-rakesh", categoryId: "plumbing", serviceId: "svc-p3", title: "Fixture installation", description: "New shower set + health faucet installation.", when: daysAgo(11, 11, 30), status: "completed", rating: 5, reviewComment: "Perfect installation, and he took the old fittings away for proper disposal.", reviewTags: ["Skilled", "Tidy"], matchScore: 91 },
  { id: "bk-216", customerId: "c-divya", workerId: "w-sunita", categoryId: "community-care", serviceId: "svc-cc1", title: "Elder care companion visit (2 hrs)", description: "Father's afternoon walk and company.", when: daysAgo(9, 16, 0), status: "completed", rating: 5, reviewComment: "Father specifically asks for Sunita now. That says everything.", reviewTags: ["Caring", "Repeat visit"], matchScore: 95 },
  { id: "bk-217", customerId: "c-aditya", workerId: "w-priya", categoryId: "electrical", serviceId: "svc-e4", title: "Full wiring safety inspection", description: "35-year-old society flat — full load and earthing check before renovation.", when: daysAgo(7, 9, 30), status: "completed", rating: 5, reviewComment: "Extremely detailed inspection with a written report. She flagged two earthing issues the society electrician missed.", reviewTags: ["Professional", "Detailed report", "Skilled"], matchScore: 97 },
  { id: "bk-218", customerId: "c-sneha", workerId: "w-kavita", categoryId: "cleaning", serviceId: "svc-c5", title: "Sofa & carpet shampoo", description: "3-seater fabric sofa + one rug.", when: daysAgo(6, 15, 0), status: "completed", rating: 4, reviewComment: "Stains mostly gone, sofa dried by evening. Slight damp smell for a day.", reviewTags: ["Tidy"], matchScore: 88 },
  { id: "bk-219", customerId: "c-farida", workerId: "w-farhan", categoryId: "electrical", serviceId: "svc-e1", title: "Fan installation or repair", description: "New fan installation in kids' room.", when: daysAgo(5, 19, 0), status: "completed", rating: 5, reviewComment: "Quick, neat and cleaned up after. Booked him again for next month.", reviewTags: ["Punctual", "Tidy", "Repeat visit"], matchScore: 90 },
  /* --- Priya's completed jobs this week (worker earnings context) --- */
  { id: "bk-301", customerId: "c-manish", workerId: "w-priya", categoryId: "electrical", serviceId: "svc-e6", title: "General electrical repair", description: "Socket sparking in kitchen; MCB tripping.", when: daysAgo(3, 10, 30), status: "completed", rating: 5, reviewComment: "Found a loose neutral wire behind the socket. Very careful work.", reviewTags: ["Skilled", "Professional"], matchScore: 94 },
  { id: "bk-302", customerId: "c-divya", workerId: "w-priya", categoryId: "electrical", serviceId: "svc-e1", title: "Fan installation or repair", description: "Two fans serviced, one regulator replaced.", when: daysAgo(2, 17, 30), status: "completed", rating: 5, reviewComment: "Fast and friendly. Explained the regulator fault simply.", reviewTags: ["Punctual", "Skilled"], matchScore: 93 },
  { id: "bk-303", customerId: "c-sameer", workerId: "w-priya", categoryId: "electrical", serviceId: "svc-e3", title: "Light fixture & wiring repair", description: "Three holders + a flickering tube light.", when: daysAgo(1, 18, 0), status: "completed", rating: 5, reviewComment: "Punctual, neat, and priced as quoted.", reviewTags: ["Punctual", "Fair pricing"], matchScore: 95 },
  { id: "bk-304", customerId: "c-rohan", workerId: "w-priya", categoryId: "electrical", serviceId: "svc-e2", title: "Switchboard & socket repair", description: "Replace old switchboard in living room.", when: daysAgo(0, 10, 30), status: "completed", rating: 5, reviewComment: "Labelled every point and tested each one. Excellent as always.", reviewTags: ["Professional", "Tidy"], matchScore: 96 },
  /* --- Priya: awaiting customer confirmation (pending settlement) --- */
  { id: "bk-305", customerId: "c-aditya", workerId: "w-priya", categoryId: "electrical", serviceId: "svc-e6", title: "General electrical repair", description: "Corridor lights not turning on; suspected wiring fault.", when: daysAgo(1, 8, 0), status: "awaiting_confirmation", matchScore: 91, messages: [
    { role: "customer", text: "Corridor lights are working now — thank you for clearing up the wiring so neatly.", hoursOffset: 3 },
    { role: "worker", text: "Glad it's sorted! If the flicker returns within 30 days, message here and I'll visit free of charge under the service warranty.", hoursOffset: 5 },
  ] },
  /* --- Priya upcoming --- */
  { id: "bk-306", customerId: "c-sneha", workerId: "w-priya", categoryId: "electrical", serviceId: "svc-e4", title: "Full wiring safety inspection", description: "Pre-monsoon inspection for 2 BHK.", when: daysAhead(1, 11, 0), status: "confirmed", matchScore: 96, messages: [
    { role: "customer", text: "Hi Priya — the inspection is for a 2 BHK, 12-year-old building. Will you need the mains power off for long?", hoursOffset: -15 },
    { role: "worker", text: "Only about 30–40 minutes per circuit, and one room at a time so your fridge stays on. I'll bring the earth-resistance tester.", hoursOffset: -13 },
    { role: "customer", text: "Perfect. The society gate code is 1947# — please call if it doesn't work.", hoursOffset: -2 },
  ] },
  /* --- Other workers today (admin ops numbers) --- */
  { id: "bk-401", customerId: "c-sneha", workerId: "w-meena", categoryId: "cleaning", serviceId: "svc-c3", title: "Kitchen deep clean", description: "Festive season kitchen refresh.", when: daysAgo(0, new Date().getHours() >= 12 ? new Date().getHours() - 2 : 11, 0), status: "in_progress", matchScore: 92 },
  { id: "bk-402", customerId: "c-rohan", workerId: "w-rakesh", categoryId: "plumbing", serviceId: "svc-p1", title: "Tap, leak & pipe repair", description: "Terrace tap leaking.", when: daysAgo(0, 8, 30), status: "completed", rating: 5, reviewComment: "Quick fix before office hours. Appreciated.", reviewTags: ["Punctual"], matchScore: 93 },
  { id: "bk-403", customerId: "c-sameer", workerId: "w-sandeep", categoryId: "plumbing", serviceId: "svc-p5", title: "Bathroom plumbing inspection", description: "Low pressure in shower since a week.", when: daysAgo(0, 12, 30), status: "completed", rating: 4, reviewComment: "Cleaned the aerator and fixed a kinked hose. Honest about not needing parts.", reviewTags: ["Honest"], matchScore: 82 },
  { id: "bk-404", customerId: "c-farida", workerId: "w-anita", categoryId: "community-care", serviceId: "svc-cc4", title: "Weekly wellbeing check-in", description: "Mother-in-law BP + medication check.", when: daysAgo(0, 9, 0), status: "completed", rating: 5, reviewComment: "Weekly notes on time again.", reviewTags: ["Reliable"], matchScore: 94 },
  { id: "bk-405", customerId: "c-manish", workerId: "w-kavita", categoryId: "cleaning", serviceId: "svc-c4", title: "Bathroom deep clean (2 baths)", description: "Regular monthly bathroom care.", when: daysAgo(0, 17, 0), status: "confirmed", matchScore: 87 },
  { id: "bk-406", customerId: "c-divya", workerId: "w-arjun", categoryId: "gardening", serviceId: "svc-g1", title: "Garden maintenance visit", description: "Fortnightly maintenance.", when: daysAgo(0, 15, 30), status: "confirmed", matchScore: 89 },
  /* --- Offers pending acceptance (worker workflow) --- */
  { id: "bk-501", customerId: "c-rohan", workerId: "w-rakesh", categoryId: "plumbing", serviceId: "svc-p2", title: "Drain & blockage clearing", description: "Kitchen sink draining very slowly; water pools.", when: daysAhead(1, 10, 0), status: "pending_acceptance", matchScore: 92 },
  { id: "bk-502", customerId: "c-aditya", workerId: "w-deepak", categoryId: "repairs", serviceId: "svc-r1", title: "Furniture repair & assembly", description: "Wardrobe hinge broken; study chair wobbly.", when: daysAhead(2, 18, 30), status: "pending_acceptance", matchScore: 90 },
  /* --- Upcoming confirmed --- */
  { id: "bk-503", customerId: "c-sneha", workerId: "w-meena", categoryId: "cleaning", serviceId: "svc-c2", title: "Full home deep clean (2 BHK)", description: "Pre-wedding function clean at parents' place.", when: daysAhead(3, 9, 0), status: "confirmed", matchScore: 95 },
  { id: "bk-504", customerId: "c-farida", workerId: "w-sunita", categoryId: "community-care", serviceId: "svc-cc3", title: "Post-hospitalisation support visit", description: "Mother-in-law discharged Friday; need assistance through the weekend.", when: daysAhead(4, 10, 0), status: "confirmed", matchScore: 97, customerNotes: "Please call on arrival — the building gate code will be shared." },
  { id: "bk-505", customerId: "c-sameer", workerId: "w-mangesh", categoryId: "repairs", serviceId: "svc-r2", title: "Appliance repair", description: "Mixer jar coupling replacement.", when: daysAhead(5, 18, 0), status: "confirmed", matchScore: 86 },
  { id: "bk-506", customerId: "c-divya", workerId: "w-vikas", categoryId: "electrical", serviceId: "svc-e1", title: "Fan installation or repair", description: "Install two new fans before summer.", when: daysAhead(6, 9, 30), status: "confirmed", matchScore: 85 },
  /* --- Cancelled --- */
  { id: "bk-601", customerId: "c-manish", workerId: "w-kavita", categoryId: "cleaning", serviceId: "svc-c1", title: "Full home deep clean (1 BHK)", description: "Scheduled clean; customer travelling.", when: daysAgo(4, 9, 0), status: "cancelled", matchScore: 88 },
];

/* ------------------------------------------------------------------ */
/* Priya's 8-week work history (generated for organic-looking          */
/* earnings charts, transaction tables and welfare statements)         */
/* ------------------------------------------------------------------ */
const PRIYA_HISTORY_CUSTOMERS = ["c-rohan", "c-sneha", "c-aditya", "c-farida", "c-manish", "c-divya", "c-sameer"];
const PRIYA_HISTORY_JOBS: { svc: string; note: string; daysBack: number; hour: number; rating?: number; comment?: string; tags?: string[] }[] = [
  { svc: "svc-e1", note: "Three fans serviced before summer.", daysBack: 52, hour: 10, rating: 5, comment: "Quick service, all three fans silent now.", tags: ["Punctual", "Skilled"] },
  { svc: "svc-e6", note: "Kitchen MCB tripping repeatedly.", daysBack: 50, hour: 17, rating: 5 },
  { svc: "svc-e3", note: "Two tube lights and a holder replaced.", daysBack: 47, hour: 11 },
  { svc: "svc-e2", note: "Modular switchboard for study.", daysBack: 44, hour: 18, rating: 5, comment: "Neat wiring, labelled everything. Highly recommended.", tags: ["Professional", "Tidy"] },
  { svc: "svc-e5", note: "Inverter battery check and reconnection.", daysBack: 42, hour: 9, rating: 4, comment: "Thorough job, took a little longer than the estimate.", tags: ["Skilled"] },
  { svc: "svc-e1", note: "New fan installation, kids' room.", daysBack: 39, hour: 16 },
  { svc: "svc-e6", note: "Loose socket in living room.", daysBack: 36, hour: 10, rating: 5 },
  { svc: "svc-e4", note: "Wiring inspection for a resale flat.", daysBack: 33, hour: 11, rating: 5, comment: "Detailed written report — the buyer's electrician confirmed her findings.", tags: ["Detailed report", "Professional"] },
  { svc: "svc-e3", note: "Flickering corridor light fixed.", daysBack: 31, hour: 18 },
  { svc: "svc-e2", note: "Two sparking sockets replaced.", daysBack: 28, hour: 17, rating: 4, comment: "Good work, had to visit the shop for a part.", tags: ["Skilled"] },
  { svc: "svc-e1", note: "Fan wobble repair, master bedroom.", daysBack: 25, hour: 10 },
  { svc: "svc-e6", note: "Geyser connection check.", daysBack: 22, hour: 9, rating: 5, comment: "Honest assessment — advised a replacement only where needed.", tags: ["Honest", "Fair pricing"] },
  { svc: "svc-e5", note: "Inverter load rewiring after purchase.", daysBack: 19, hour: 16 },
  { svc: "svc-e3", note: "Bedroom light fixtures replaced.", daysBack: 16, hour: 11, rating: 5 },
  { svc: "svc-e2", note: "Old switchboard replacement, kitchen.", daysBack: 13, hour: 17, rating: 5, comment: "Clean work and cleared the old board herself.", tags: ["Tidy", "Professional"] },
  { svc: "svc-e1", note: "Two fans serviced, balcony.", daysBack: 10, hour: 10 },
  { svc: "svc-e6", note: "Doorbell and extension board fault.", daysBack: 8, hour: 18, rating: 4, comment: "Fixed both issues in one visit.", tags: ["Skilled"] },
  { svc: "svc-e4", note: "Pre-monsoon earthing check.", daysBack: 6, hour: 9, rating: 5 },
];

PRIYA_HISTORY_JOBS.forEach((job, idx) => {
  const service = serviceById("electrical", job.svc)!;
  seeds.push({
    id: `bk-7${String(idx + 1).padStart(2, "0")}`,
    customerId: PRIYA_HISTORY_CUSTOMERS[idx % PRIYA_HISTORY_CUSTOMERS.length],
    workerId: "w-priya",
    categoryId: "electrical",
    serviceId: job.svc,
    title: service.name,
    description: job.note,
    when: daysAgo(job.daysBack, job.hour, [0, 30][idx % 2]),
    status: "completed",
    rating: job.rating,
    reviewComment: job.comment,
    reviewTags: job.tags,
    matchScore: 88 + (idx % 9),
  });
});

/* ------------------------------------------------------------------ */
/* Standing orders (recurring bookings) — the cooperative's core        */
/* promise of stable, predictable member income. Three series:         */
/* weekly deep cleaning (Meena), monthly plumbing maintenance          */
/* (Rakesh), monthly garden upkeep (Arjun). All charges pinned to the   */
/* catalogue base price — same member, same rate.                      */
/* ------------------------------------------------------------------ */
seeds.push(
  /* so-001 — Ananya ↔ Meena, weekly full-home deep clean (₹1,999) */
  { id: "bk-801", customerId: "c-ananya", workerId: "w-meena", categoryId: "cleaning", serviceId: "svc-c2", title: "Full home deep clean (2 BHK)", description: "Standing order — weekly deep clean of our 2 BHK: every room, kitchen, bathrooms and balconies.", when: daysAgo(37, 10, 0), status: "completed", rating: 5, reviewComment: "First visit of our weekly plan — spotless as always. Meena's team knows the house now.", reviewTags: ["Thorough", "Repeat visit"], matchScore: 96, recurrence: "weekly", seriesId: "so-001", occurrenceIndex: 1, charge: 1999 },
  { id: "bk-802", customerId: "c-ananya", workerId: "w-meena", categoryId: "cleaning", serviceId: "svc-c2", title: "Full home deep clean (2 BHK)", description: "Standing order — weekly deep clean of our 2 BHK: every room, kitchen, bathrooms and balconies.", when: daysAgo(30, 10, 0), status: "completed", rating: 5, reviewComment: "Second weekly clean — same quality, same rate. Exactly why we set up the standing order.", reviewTags: ["Reliable"], matchScore: 96, recurrence: "weekly", seriesId: "so-001", occurrenceIndex: 2, charge: 1999 },
  { id: "bk-803", customerId: "c-ananya", workerId: "w-meena", categoryId: "cleaning", serviceId: "svc-c2", title: "Full home deep clean (2 BHK)", description: "Standing order — weekly deep clean of our 2 BHK: every room, kitchen, bathrooms and balconies.", when: daysAgo(23, 10, 0), status: "completed", rating: 5, reviewComment: "Weekly clean done while I was at work. They lock up carefully and leave a note.", reviewTags: ["Reliable", "Tidy"], matchScore: 96, recurrence: "weekly", seriesId: "so-001", occurrenceIndex: 3, charge: 1999 },
  { id: "bk-804", customerId: "c-ananya", workerId: "w-meena", categoryId: "cleaning", serviceId: "svc-c2", title: "Full home deep clean (2 BHK)", description: "Standing order — weekly deep clean of our 2 BHK: every room, kitchen, bathrooms and balconies.", when: daysAgo(16, 10, 0), status: "completed", rating: 4, reviewComment: "Good clean. A couple of high shelves were missed this week — mentioned to Meena and they were covered next visit.", reviewTags: ["Tidy"], matchScore: 96, recurrence: "weekly", seriesId: "so-001", occurrenceIndex: 4, charge: 1999 },
  { id: "bk-805", customerId: "c-ananya", workerId: "w-meena", categoryId: "cleaning", serviceId: "svc-c2", title: "Full home deep clean (2 BHK)", description: "Standing order — weekly deep clean of our 2 BHK: every room, kitchen, bathrooms and balconies.", when: daysAgo(9, 10, 0), status: "completed", rating: 5, reviewComment: "Fifth weekly clean and the flat has never stayed this good. Standing orders are a lifesaver.", reviewTags: ["Repeat visit", "Thorough"], matchScore: 96, recurrence: "weekly", seriesId: "so-001", occurrenceIndex: 5, charge: 1999 },
  { id: "bk-806", customerId: "c-ananya", workerId: "w-meena", categoryId: "cleaning", serviceId: "svc-c2", title: "Full home deep clean (2 BHK)", description: "Standing order — weekly deep clean of our 2 BHK: every room, kitchen, bathrooms and balconies.", when: daysAhead(2, 10, 0), status: "confirmed", matchScore: 96, customerNotes: "Spare key with the society office if nobody is home — they know Meena's team.", recurrence: "weekly", seriesId: "so-001", occurrenceIndex: 6, charge: 1999, createdHoursBefore: 11 * 24 },

  /* so-002 — Manish ↔ Rakesh, monthly bathroom plumbing inspection (₹599) */
  { id: "bk-811", customerId: "c-manish", workerId: "w-rakesh", categoryId: "plumbing", serviceId: "svc-p5", title: "Bathroom plumbing inspection", description: "Standing order — monthly bathroom plumbing inspection: fittings, pressure, drainage and flush check.", when: daysAgo(86, 11, 0), status: "completed", rating: 5, reviewComment: "Monthly inspection keeps everything in order — caught a slow leak under the sink before it damaged the cabinet.", reviewTags: ["Skilled", "Honest"], matchScore: 91, recurrence: "monthly", seriesId: "so-002", occurrenceIndex: 1, charge: 599 },
  { id: "bk-812", customerId: "c-manish", workerId: "w-rakesh", categoryId: "plumbing", serviceId: "svc-p5", title: "Bathroom plumbing inspection", description: "Standing order — monthly bathroom plumbing inspection: fittings, pressure, drainage and flush check.", when: daysAgo(56, 11, 0), status: "completed", rating: 5, reviewComment: "Second monthly visit. Rakesh leaves a short checklist note each time — very reassuring.", reviewTags: ["Reliable"], matchScore: 91, recurrence: "monthly", seriesId: "so-002", occurrenceIndex: 2, charge: 599 },
  { id: "bk-813", customerId: "c-manish", workerId: "w-rakesh", categoryId: "plumbing", serviceId: "svc-p5", title: "Bathroom plumbing inspection", description: "Standing order — monthly bathroom plumbing inspection: fittings, pressure, drainage and flush check.", when: daysAgo(26, 11, 0), status: "completed", rating: 5, reviewComment: "Third monthly inspection done quickly. No repairs needed this time — honest as always.", reviewTags: ["Honest"], matchScore: 91, recurrence: "monthly", seriesId: "so-002", occurrenceIndex: 3, charge: 599 },
  { id: "bk-814", customerId: "c-manish", workerId: "w-rakesh", categoryId: "plumbing", serviceId: "svc-p5", title: "Bathroom plumbing inspection", description: "Standing order — monthly bathroom plumbing inspection: fittings, pressure, drainage and flush check.", when: daysAhead(4, 11, 0), status: "pending_acceptance", matchScore: 91, recurrence: "monthly", seriesId: "so-002", occurrenceIndex: 4, charge: 599, createdHoursBefore: 30 * 24 },

  /* so-003 — Divya ↔ Arjun, monthly garden upkeep (₹499) */
  { id: "bk-821", customerId: "c-divya", workerId: "w-arjun", categoryId: "gardening", serviceId: "svc-g1", title: "Garden maintenance visit", description: "Standing order — monthly garden upkeep: weeding, pruning, watering check and green-waste clearance.", when: daysAgo(56, 8, 30), status: "completed", rating: 5, reviewComment: "Monthly upkeep keeps the front garden tidy through the dry weeks. Arjun suggests low-water planting too.", reviewTags: ["Thorough"], matchScore: 89, recurrence: "monthly", seriesId: "so-003", occurrenceIndex: 1, charge: 499 },
  { id: "bk-822", customerId: "c-divya", workerId: "w-arjun", categoryId: "gardening", serviceId: "svc-g1", title: "Garden maintenance visit", description: "Standing order — monthly garden upkeep: weeding, pruning, watering check and green-waste clearance.", when: daysAgo(26, 8, 30), status: "completed", rating: 4, reviewComment: "Good upkeep visit. Some hedge edges were uneven — Arjun corrected them on the spot when pointed out.", reviewTags: ["Tidy"], matchScore: 89, recurrence: "monthly", seriesId: "so-003", occurrenceIndex: 2, charge: 499 },
  { id: "bk-823", customerId: "c-divya", workerId: "w-arjun", categoryId: "gardening", serviceId: "svc-g1", title: "Garden maintenance visit", description: "Standing order — monthly garden upkeep: weeding, pruning, watering check and green-waste clearance.", when: daysAhead(4, 8, 30), status: "confirmed", matchScore: 89, customerNotes: "Side gate is open for the gardener — tools are in the shed.", recurrence: "monthly", seriesId: "so-003", occurrenceIndex: 3, charge: 499, createdHoursBefore: 30 * 24 },
);

function buildBooking(s: BookingSeed): { booking: Booking; review?: Review; transaction?: Transaction } {
  const service = CATALOG_LOOKUP(s.categoryId, s.serviceId);
  const charge = s.charge ?? service.basePrice + intBetween(-2, 2) * 25;
  const price = computePrice(charge);
  const customer = CUSTOMERS.find((c) => c.id === s.customerId)!;
  const worker = WORKERS.find((w) => w.id === s.workerId)!;
  const createdAt =
    s.createdHoursBefore !== undefined
      ? new Date(s.when.getTime() - s.createdHoursBefore * HOUR)
      : new Date(s.when.getTime() - intBetween(20, 72) * HOUR);
  const reference = `SG-${s.id.slice(-3).toUpperCase()}${(parseInt(s.id.slice(-1), 10) + 4).toString()}`;

  const baseBooking: Booking = {
    id: s.id,
    reference,
    customerId: s.customerId,
    workerId: s.workerId,
    categoryId: s.categoryId,
    serviceId: s.serviceId,
    title: s.title,
    description: s.description,
    addressId: customer.addresses[0].id,
    scheduledAt: iso(s.when),
    durationMin: service.durationMin,
    status: s.status,
    paymentStatus: "authorized",
    price,
    matchScore: s.matchScore,
    createdAt: iso(createdAt),
    checklist: CHECKLISTS[s.categoryId].map((label, i) => ({
      id: `chk-${s.id}-${i}`,
      label,
      done: ["completed", "awaiting_confirmation"].includes(s.status),
    })),
    evidence: [],
    timeline: [{ id: `ev-${s.id}-0`, at: iso(createdAt), label: "Request created", detail: `${customer.name} · ${s.title}`, by: customer.name }],
    customerNotes: s.customerNotes,
    recurrence: s.recurrence,
    seriesId: s.seriesId,
    occurrenceIndex: s.occurrenceIndex,
    messages: s.messages && (() => {
      /* keep the thread in the past no matter when the demo runs: if the newest
         seeded message would land in the future, shift the whole thread back
         uniformly — spacing and ordering are preserved. */
      const times = s.messages!.map((m) => s.when.getTime() + m.hoursOffset * HOUR);
      const newest = Math.max(...times);
      const ceiling = Date.now() - 30 * 60000;
      const shift = newest > ceiling ? newest - ceiling : 0;
      return s.messages!.map((m, i) => ({
        id: `msg-${s.id}-${i}`,
        authorRole: m.role,
        authorName: m.role === "customer" ? customer.name : worker.name,
        text: m.text,
        at: iso(new Date(times[i] - shift)),
      }));
    })(),
  };

  /* Standing-order timeline: first occurrence is created by the customer;
     later occurrences are auto-scheduled by the platform at confirmation. */
  if (s.recurrence) {
    if ((s.occurrenceIndex ?? 1) === 1) {
      baseBooking.timeline.splice(1, 0, {
        id: `ev-${s.id}-so`,
        at: iso(new Date(createdAt.getTime() + 5 * 60000)),
        label: "Standing order created",
        detail: `${s.recurrence === "weekly" ? "Weekly" : "Monthly"} — the next visit is scheduled automatically after each completed service`,
        by: customer.name,
      });
    } else if (["confirmed", "pending_acceptance"].includes(s.status)) {
      baseBooking.timeline[0] = {
        id: `ev-${s.id}-so`,
        at: iso(createdAt),
        label: "Standing order — next occurrence scheduled automatically",
        detail: `Occurrence ${s.occurrenceIndex} of ${s.seriesId} · payment authorised for the next visit`,
        by: "Platform",
      };
    }
  }

  const review: Review | undefined = s.rating
    ? {
        id: `rev-${s.id}`,
        bookingId: s.id,
        customerId: s.customerId,
        customerName: customer.name,
        workerId: s.workerId,
        rating: s.rating,
        comment: s.reviewComment ?? "",
        tags: s.reviewTags ?? [],
        createdAt: iso(new Date(s.when.getTime() + 3 * HOUR)),
      }
    : undefined;

  const transaction: Transaction | undefined =
    s.status === "completed"
      ? {
          id: `txn-${s.id}`,
          bookingId: s.id,
          bookingRef: reference,
          workerId: s.workerId,
          date: iso(new Date(s.when.getTime() + 4 * HOUR)),
          serviceTitle: s.title,
          gross: price.workerGross,
          platformFee: price.platformFee,
          welfareContribution: price.welfareContribution,
          tds: price.workerTds,
          net: price.workerNetPayout,
          status: rand() > 0.25 ? "credited" : "paid_out",
        }
      : undefined;

  /* Timeline per status */
  if (["completed", "awaiting_confirmation"].includes(s.status)) {
    baseBooking.paymentStatus = s.status === "completed" ? "settled" : "authorized";
    baseBooking.timeline.push(
      { id: `ev-${s.id}-1`, at: iso(new Date(createdAt.getTime() + 20 * 60000)), label: "Worker accepted", detail: `${worker.name} accepted the job`, by: worker.name },
      { id: `ev-${s.id}-2`, at: iso(new Date(createdAt.getTime() + 25 * 60000)), label: "Payment authorised", detail: "Held securely until service completion", by: "Platform" },
      { id: `ev-${s.id}-3`, at: iso(new Date(s.when.getTime() - 45 * 60000)), label: "On the way", by: worker.name },
      { id: `ev-${s.id}-4`, at: iso(s.when), label: "Arrived & started", by: worker.name },
      { id: `ev-${s.id}-5`, at: iso(new Date(s.when.getTime() + service.durationMin * 60000)), label: "Service completed", detail: "Checklist and evidence recorded", by: worker.name },
    );
    if (s.status === "completed") {
      baseBooking.timeline.push({ id: `ev-${s.id}-6`, at: iso(new Date(s.when.getTime() + (service.durationMin + 30) * 60000)), label: "Payment settled to worker", detail: "Breakdown available in worker earnings", by: "Platform" });
      if (review) baseBooking.timeline.push({ id: `ev-${s.id}-7`, at: review.createdAt, label: "Rated by customer", detail: `${review.rating} / 5`, by: customer.name });
    }
    baseBooking.evidence = [
      { phase: "before", capturedAt: iso(s.when), label: "Fault photographed before repair" },
      { phase: "after", capturedAt: iso(new Date(s.when.getTime() + service.durationMin * 60000)), label: "Completed work after repair" },
    ];
  } else if (s.status === "cancelled") {
    baseBooking.paymentStatus = "refunded";
    baseBooking.cancellationReason = "Customer travelling — cancelled 2 days before the slot (free cancellation window)";
    baseBooking.timeline.push(
      { id: `ev-${s.id}-1`, at: iso(new Date(createdAt.getTime() + 2 * HOUR)), label: "Cancelled by customer", detail: "Full refund issued to source account", by: customer.name },
    );
  } else if (s.status === "confirmed") {
    baseBooking.timeline.push(
      { id: `ev-${s.id}-1`, at: iso(new Date(createdAt.getTime() + 18 * 60000)), label: "Worker accepted", by: worker.name },
      { id: `ev-${s.id}-2`, at: iso(new Date(createdAt.getTime() + 22 * 60000)), label: "Payment authorised", detail: "Held securely until service completion", by: "Platform" },
    );
  } else if (s.status === "pending_acceptance") {
    /* offer only */
  } else if (s.status === "in_progress") {
    baseBooking.timeline.push(
      { id: `ev-${s.id}-1`, at: iso(new Date(createdAt.getTime() + 15 * 60000)), label: "Worker accepted", by: worker.name },
      { id: `ev-${s.id}-2`, at: iso(new Date(createdAt.getTime() + 19 * 60000)), label: "Payment authorised", by: "Platform" },
      { id: `ev-${s.id}-3`, at: iso(new Date(s.when.getTime() - 40 * 60000)), label: "On the way", by: worker.name },
      { id: `ev-${s.id}-4`, at: iso(s.when), label: "Arrived & started", by: worker.name },
    );
    baseBooking.checklist = baseBooking.checklist.map((c, i) => ({ ...c, done: i < 2 }));
    baseBooking.evidence = [{ phase: "before", capturedAt: iso(s.when), label: "Kitchen — before cleaning" }];
  }

  /* A completed standing-order occurrence schedules the next one automatically. */
  if (s.recurrence && s.status === "completed") {
    const nextAt = new Date(s.when.getTime() + (s.recurrence === "weekly" ? 7 : 30) * DAY);
    baseBooking.timeline.push({
      id: `ev-${s.id}-so-next`,
      at: iso(new Date(s.when.getTime() + (service.durationMin + 45) * 60000)),
      label: "Standing order — next occurrence scheduled automatically",
      detail: `Occurrence ${(s.occurrenceIndex ?? 1) + 1} of ${s.seriesId} · ${nextAt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}, same time`,
      by: "Platform",
    });
  }

  return { booking: baseBooking, review, transaction };
}

function CATALOG_LOOKUP(categoryId: Booking["categoryId"], serviceId: string) {
  const svc = serviceById(categoryId, serviceId);
  if (!svc) throw new Error(`Unknown service ${serviceId} in ${categoryId}`);
  return svc;
}

const built = seeds.map(buildBooking);
export const SEED_BOOKINGS: Booking[] = built.map((b) => b.booking);
export const SEED_REVIEWS: Review[] = built.map((b) => b.review).filter((r): r is Review => Boolean(r));
export const SEED_TRANSACTIONS: Transaction[] = built.map((b) => b.transaction).filter((t): t is Transaction => Boolean(t));

/* ------------------------------------------------------------------ */
/* Payouts (weekly batches, worker side)                               */
/* ------------------------------------------------------------------ */
export const SEED_PAYOUTS: Payout[] = [
  { id: "pay-1", workerId: "w-priya", period: "Week of 8–14 Sep", date: iso(daysAgo(13, 20, 0)), transactions: 5, amount: 5402, method: "Bank ••4417 (HDFC)", status: "processed", reference: "POT-2609-081" },
  { id: "pay-2", workerId: "w-priya", period: "Week of 15–21 Sep", date: iso(daysAgo(6, 20, 0)), transactions: 6, amount: 6314, method: "Bank ••4417 (HDFC)", status: "processed", reference: "POT-2609-142" },
  { id: "pay-3", workerId: "w-priya", period: "Week of 22–28 Sep", date: iso(daysAhead(1, 20, 0)), transactions: 5, amount: 5987, method: "Bank ••4417 (HDFC)", status: "processing", reference: "POT-2609-203" },
];

/* ------------------------------------------------------------------ */
/* Skills                                                              */
/* ------------------------------------------------------------------ */
export const SEED_COURSES: SkillCourse[] = [
  { id: "crs-1", title: "Advanced Residential Wiring Safety", provider: "Sahyog Skill Academy", category: "electrical", status: "completed", progress: 100, completedAt: iso(daysAgo(420)), hours: 12, certified: true, creditValue: 12 },
  { id: "crs-2", title: "Customer Communication for Field Services", provider: "Sahyog Skill Academy", category: "electrical", status: "completed", progress: 100, completedAt: iso(daysAgo(180)), hours: 8, certified: true, creditValue: 8 },
  { id: "crs-3", title: "Solar Rooftop Installation Basics", provider: "Sahyog Skill Academy", category: "electrical", status: "in_progress", progress: 40, hours: 16, certified: false, creditValue: 16 },
  { id: "crs-4", title: "Appliance Repair Fundamentals", provider: "Sahyog Skill Academy", category: "repairs", status: "available", progress: 0, hours: 20, certified: false, creditValue: 20 },
  { id: "crs-5", title: "EV Home Charger Installation Readiness", provider: "Sahyog Skill Academy", category: "electrical", status: "available", progress: 0, hours: 24, certified: false, creditValue: 24 },
];

/* ------------------------------------------------------------------ */
/* Training & upskilling hub — cooperative-funded courses + enrolments */
/* ------------------------------------------------------------------ */

export const TRAINING_COURSES: TrainingCourse[] = [
  {
    id: "tc-1",
    title: "Advanced Appliance Diagnosis & Repair",
    category: "electrical",
    description:
      "Systematic fault-finding for washing machines, refrigerators and microwaves — motor and compressor testing, control-board diagnosis, and honest repair-versus-replace quoting for the customer.",
    durationHrs: 12,
    level: "advanced",
    format: "in-person",
    instructor: "Vikram Salunkhe — ITI Pune, 18 yrs appliance service",
    skills: ["Motor & compressor testing", "Control-board diagnosis", "Repair-vs-replace quoting"],
    moduleCount: 6,
    nextCohortAt: iso(daysAhead(18, 10, 0)),
    seatsLeft: 4,
  },
  {
    id: "tc-2",
    title: "Solar Rooftop Installation Basics",
    category: "electrical",
    description:
      "Rooftop mount assembly, string wiring and inverter commissioning for residential 1–3 kW systems, taught over three weekend blocks with a live install at the Sahyog Centre.",
    durationHrs: 16,
    level: "foundation",
    format: "hybrid",
    instructor: "Aarti Nene — MNRE-certified solar trainer, 11 yrs",
    skills: ["Mounting & load calculation", "Inverter & battery wiring", "Net-metering documentation"],
    moduleCount: 3,
    nextCohortAt: iso(daysAhead(9, 9, 30)),
    seatsLeft: 6,
  },
  {
    id: "tc-3",
    title: "Modern Plumbing Fixtures & Water Harvesting",
    category: "plumbing",
    description:
      "Concealed fitting of modern fixtures without tile damage, low-flow retrofits, and layout of rooftop rainwater harvesting for apartment societies — Pune's water reality, practically taught.",
    durationHrs: 10,
    level: "foundation",
    format: "in-person",
    instructor: "Dattatray Bhosale — licensed plumbing contractor, 22 yrs",
    skills: ["Concealed fixture fitting", "Low-flow retrofits", "Rainwater harvesting layout"],
    moduleCount: 4,
    nextCohortAt: iso(daysAhead(13, 10, 0)),
    seatsLeft: 3,
  },
  {
    id: "tc-4",
    title: "Eco-friendly Deep Cleaning Practices",
    category: "cleaning",
    description:
      "pH-neutral and enzyme-based product handling, surface-specific methods for Indian homes, and water-saving routines that cut tank use per deep clean without cutting results.",
    durationHrs: 8,
    level: "foundation",
    format: "in-person",
    instructor: "Shalini Mahajan — facility hygiene trainer, 12 yrs",
    skills: ["pH-neutral product use", "Surface-specific methods", "Water-saving routines"],
    moduleCount: 4,
    nextCohortAt: iso(daysAhead(5, 9, 0)),
    seatsLeft: 2,
  },
  {
    id: "tc-5",
    title: "Kitchen Garden & Seasonal Planting",
    category: "gardening",
    description:
      "Seasonal planting calendars for Pune's climate, soil and compost basics, and setting up low-cost drip irrigation so kitchen gardens survive the summer.",
    durationHrs: 6,
    level: "foundation",
    format: "hybrid",
    instructor: "Maruti Gole — horticulturist, Pune Municipal Gardens (ret'd)",
    skills: ["Seasonal planting calendars", "Composting & soil health", "Drip irrigation setup"],
    moduleCount: 3,
    nextCohortAt: iso(daysAhead(21, 10, 0)),
    seatsLeft: 8,
  },
  {
    id: "tc-6",
    title: "Customer Communication & Digital Payments",
    category: "professional",
    description:
      "Explaining the transparent bill on the doorstep, safe UPI practice for members, and de-escalating disputes before they reach the support desk. Open to every trade.",
    durationHrs: 4,
    level: "foundation",
    format: "online",
    instructor: "Medha Kulkarni — customer-experience faculty, 9 yrs",
    skills: ["UPI payment safety", "Dispute de-escalation", "Explaining pricing clearly"],
    moduleCount: 2,
    nextCohortAt: iso(daysAhead(2, 17, 0)),
    seatsLeft: 15,
  },
  {
    id: "tc-7",
    title: "Home Electrical Safety Audit",
    category: "electrical",
    description:
      "A repeatable audit method for homes — earthing and leakage testing, load and MCB sizing, and writing the safety summary customers receive at the end of every audit.",
    durationHrs: 6,
    level: "foundation",
    format: "online",
    instructor: "Rajendra Kulkarni — Electrical Inspector (ret'd), Maharashtra",
    skills: ["Earthing & leakage testing", "Load & MCB sizing", "Written audit reporting"],
    moduleCount: 3,
    nextCohortAt: iso(daysAhead(11, 18, 30)),
    seatsLeft: 9,
  },
];

/**
 * Seeded enrolments — 14 across the member base, 7 completed with
 * certificates (SCT-2025-041…047; live issuances continue from 050).
 * In-progress percentages are exact module boundaries (100/moduleCount).
 */
export const TRAINING_ENROLLMENTS: TrainingEnrollment[] = [
  /* Priya — the demo member: one completed (cert) + one in progress */
  { id: "tre-1", courseId: "tc-1", workerId: "w-priya", status: "completed", progressPct: 100, enrolledAt: iso(daysAgo(102, 9, 0)), completedAt: iso(daysAgo(61, 16, 0)), certificateId: "SCT-2025-041", score: 92 },
  { id: "tre-2", courseId: "tc-2", workerId: "w-priya", status: "in_progress", progressPct: 67, enrolledAt: iso(daysAgo(24, 9, 0)) },
  /* Cleaning members */
  { id: "tre-3", courseId: "tc-4", workerId: "w-meena", status: "completed", progressPct: 100, enrolledAt: iso(daysAgo(75, 9, 0)), completedAt: iso(daysAgo(40, 15, 0)), certificateId: "SCT-2025-042", score: 88 },
  { id: "tre-5", courseId: "tc-4", workerId: "w-kavita", status: "completed", progressPct: 100, enrolledAt: iso(daysAgo(52, 9, 0)), completedAt: iso(daysAgo(18, 12, 0)), certificateId: "SCT-2025-044", score: 85 },
  { id: "tre-13", courseId: "tc-4", workerId: "w-shalini", status: "in_progress", progressPct: 25, enrolledAt: iso(daysAgo(7, 9, 0)) },
  /* Gardening members */
  { id: "tre-4", courseId: "tc-5", workerId: "w-arjun", status: "completed", progressPct: 100, enrolledAt: iso(daysAgo(58, 9, 0)), completedAt: iso(daysAgo(25, 13, 0)), certificateId: "SCT-2025-043", score: 90 },
  { id: "tre-14", courseId: "tc-5", workerId: "w-prasad", status: "in_progress", progressPct: 33, enrolledAt: iso(daysAgo(11, 9, 0)) },
  /* Professional skills */
  { id: "tre-6", courseId: "tc-6", workerId: "w-sunita", status: "completed", progressPct: 100, enrolledAt: iso(daysAgo(45, 9, 0)), completedAt: iso(daysAgo(12, 17, 0)), certificateId: "SCT-2025-045", score: 94 },
  /* Appliance repair (electrical + repairs members) */
  { id: "tre-7", courseId: "tc-1", workerId: "w-farhan", status: "completed", progressPct: 100, enrolledAt: iso(daysAgo(88, 9, 0)), completedAt: iso(daysAgo(55, 11, 0)), certificateId: "SCT-2025-046", score: 89 },
  { id: "tre-11", courseId: "tc-1", workerId: "w-mangesh", status: "in_progress", progressPct: 67, enrolledAt: iso(daysAgo(29, 9, 0)) },
  { id: "tre-12", courseId: "tc-1", workerId: "w-deepak", status: "in_progress", progressPct: 33, enrolledAt: iso(daysAgo(13, 9, 0)) },
  /* Plumbing members */
  { id: "tre-8", courseId: "tc-3", workerId: "w-sandeep", status: "completed", progressPct: 100, enrolledAt: iso(daysAgo(36, 9, 0)), completedAt: iso(daysAgo(8, 14, 0)), certificateId: "SCT-2025-047", score: 82 },
  { id: "tre-9", courseId: "tc-3", workerId: "w-rakesh", status: "in_progress", progressPct: 50, enrolledAt: iso(daysAgo(21, 9, 0)) },
  /* Safety audit */
  { id: "tre-10", courseId: "tc-7", workerId: "w-vikas", status: "in_progress", progressPct: 67, enrolledAt: iso(daysAgo(17, 9, 0)) },
];

/* ------------------------------------------------------------------ */
/* Support tickets                                                     */
/* ------------------------------------------------------------------ */
export const SEED_TICKETS: SupportTicket[] = [
  {
    id: "tk-001",
    reference: "SUP-5841",
    raisedByRole: "customer",
    raisedByName: "Sneha Kulkarni",
    type: "dispute",
    category: "Service quality",
    subject: "Deep clean incomplete — balconies skipped",
    description: "Booked a 2 BHK deep clean (SG-105) on Tuesday. The team finished early and did not clean the balcony areas or the windows as promised in the service description.",
    relatedBookingRef: "SG-1054",
    status: "open",
    priority: "high",
    createdAt: iso(daysAgo(1, 14, 20)),
    updatedAt: iso(daysAgo(0, 9, 15)),
    assignedTo: "Meera Kulkarni (Member Support)",
    messages: [
      { id: "msg-1", at: iso(daysAgo(1, 14, 20)), author: "Sneha Kulkarni", body: "Reporting the issue with photos of the skipped areas. The rest of the clean was good, but the description clearly includes balconies." },
      { id: "msg-2", at: iso(daysAgo(1, 16, 5)), author: "Meera Kulkarni (Member Support)", body: "Thank you, Sneha. We've informed the member and scheduled a callback. We will arrange a complimentary balcony + window cleanup or a partial refund — your choice." },
    ],
  },
  {
    id: "tk-002",
    reference: "SUP-5837",
    raisedByRole: "customer",
    raisedByName: "Aditya Joshi",
    type: "complaint",
    category: "Punctuality",
    subject: "Technician arrived 40 minutes late",
    description: "Slot was 6:00 PM, technician arrived at 6:40 PM. He called in advance, but I had to reschedule my evening.",
    relatedBookingRef: "SG-0147",
    status: "in_review",
    priority: "medium",
    createdAt: iso(daysAgo(3, 19, 45)),
    updatedAt: iso(daysAgo(2, 11, 10)),
    assignedTo: "Meera Kulkarni (Member Support)",
    messages: [
      { id: "msg-1", at: iso(daysAgo(3, 19, 45)), author: "Aditya Joshi", body: "Not a complaint about the work itself — just the delay. Should the on-time guarantee apply here?" },
      { id: "msg-2", at: iso(daysAgo(2, 11, 10)), author: "Meera Kulkarni (Member Support)", body: "It does, Aditya. The on-time record for this visit will be marked in the member's quality log, and we're reviewing the traffic buffer for evening slots on that route. A 10% goodwill credit has been applied to your next booking." },
    ],
  },
  {
    id: "tk-003",
    reference: "SUP-5829",
    raisedByRole: "worker",
    raisedByName: "Rakesh Patil",
    type: "payout_issue",
    category: "Payments",
    subject: "Weekly payout short by ₹312",
    description: "The payout for week of 8–14 Sep (ref POT-2609-081) lists 5 jobs but only 4 amounts appear in the statement total. Difference is ₹312.",
    status: "awaiting_response",
    priority: "high",
    createdAt: iso(daysAgo(4, 21, 5)),
    updatedAt: iso(daysAgo(3, 10, 30)),
    assignedTo: "Finance Desk",
    messages: [
      { id: "msg-1", at: iso(daysAgo(4, 21, 5)), author: "Rakesh Patil", body: "Adding the statement screenshot. The 9 Sep job (tap repair, SG-0447) seems missing from the batch." },
      { id: "msg-2", at: iso(daysAgo(3, 10, 30)), author: "Finance Desk", body: "Thanks Rakesh — we can see the transaction was included in the count but excluded from the batch due to a settlement hold. We've released the hold and the difference will reach your account with the next payout cycle. Apologies for the missing line item." },
    ],
  },
  {
    id: "tk-004",
    reference: "SUP-5815",
    raisedByRole: "worker",
    raisedByName: "Vikas Shinde",
    type: "grievance",
    category: "Scheduling",
    subject: "Customer rescheduled twice on the day of visit",
    description: "Same booking moved twice on the day (2 PM → 5 PM → next day). I had blocked the whole evening. Requesting the reschedule policy to be applied.",
    status: "resolved",
    priority: "medium",
    createdAt: iso(daysAgo(9, 18, 0)),
    updatedAt: iso(daysAgo(7, 12, 45)),
    assignedTo: "Meera Kulkarni (Member Support)",
    messages: [
      { id: "msg-1", at: iso(daysAgo(9, 18, 0)), author: "Vikas Shinde", body: "Two same-day reschedules for one visit is genuinely difficult — I lose the evening's other opportunities too." },
      { id: "msg-2", at: iso(daysAgo(7, 12, 45)), author: "Meera Kulkarni (Member Support)", body: "Agreed, and we're sorry. The late-reschedule compensation (25% of service charge) has been credited to you. We've also shared a gentle policy reminder with the customer. Members' time is protected on this platform." },
    ],
    resolution: "Late-reschedule compensation credited to the member; customer counselled on the reschedule policy.",
  },
  {
    id: "tk-005",
    reference: "SUP-5802",
    raisedByRole: "customer",
    raisedByName: "Farida Sheikh",
    type: "question",
    category: "Billing",
    subject: "How is the welfare contribution on my bill used?",
    description: "I see a welfare contribution line on every invoice. Where exactly does this money go?",
    status: "resolved",
    priority: "low",
    createdAt: iso(daysAgo(12, 13, 20)),
    updatedAt: iso(daysAgo(12, 15, 5)),
    assignedTo: "Meera Kulkarni (Member Support)",
    messages: [
      { id: "msg-1", at: iso(daysAgo(12, 13, 20)), author: "Farida Sheikh", body: "It's a small amount per booking, but I'd like to know how it is used." },
      { id: "msg-2", at: iso(daysAgo(12, 15, 5)), author: "Meera Kulkarni (Member Support)", body: "Great question. 100% of it is credited to the welfare fund of the worker who served you — it contributes to their health cover, accident cover and pension pot. Every worker can see their fund statement in their own app, and the cooperative publishes a quarterly welfare fund summary." },
    ],
    resolution: "Explained the welfare fund flow; customer satisfaction confirmed.",
  },
  {
    id: "tk-006",
    reference: "SUP-5844",
    raisedByRole: "worker",
    raisedByName: "Shalini Kadam",
    type: "verification_issue",
    category: "Onboarding",
    subject: "ID proof upload rejected — file unclear",
    description: "My address proof was rejected in onboarding. I re-uploaded a clearer scan today.",
    status: "open",
    priority: "medium",
    createdAt: iso(daysAgo(0, 8, 40)),
    updatedAt: iso(daysAgo(0, 8, 40)),
    messages: [{ id: "msg-1", at: iso(daysAgo(0, 8, 40)), author: "Shalini Kadam", body: "Uploaded the rental agreement again with better lighting. Please re-check." }],
  },
  {
    id: "tk-007",
    reference: "SUP-5846",
    raisedByRole: "customer",
    raisedByName: "Manish Agarwal",
    type: "dispute",
    category: "Billing",
    subject: "Charged for 2 BHK deep clean, 1 BHK delivered",
    description: "My flat is a 1 BHK. I was billed for the 2 BHK service (SG-1296). Requesting correction and refund of the difference.",
    relatedBookingRef: "SG-1296",
    status: "escalated",
    priority: "urgent",
    createdAt: iso(daysAgo(0, 10, 10)),
    updatedAt: iso(daysAgo(0, 11, 25)),
    assignedTo: "Kiran Rao (Operations)",
    messages: [
      { id: "msg-1", at: iso(daysAgo(0, 10, 10)), author: "Manish Agarwal", body: "Attaching my agreement page showing 1 BHK. The service itself was fine — the billing category is wrong." },
      { id: "msg-2", at: iso(daysAgo(0, 11, 25)), author: "Kiran Rao (Operations)", body: "Escalated to me personally. We are checking whether the category was selected at booking or changed later. Correction or refund will be processed within 24 hours either way." },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */
export const SEED_NOTIFICATIONS: AppNotification[] = [
  /* Priya (worker) */
  { id: "nt-1", userId: "w-priya", kind: "job", title: "New job recommendation", body: "Switchboard replacement, 2.3 km away — tomorrow 11:00 AM. Estimated earnings ₹950.", createdAt: iso(daysAgo(0, 9, 20)), read: false, route: { name: "worker-jobs" } },
  { id: "nt-2", userId: "w-priya", kind: "payment", title: "Payment settled", body: "₹792 for switchboard & socket repair (SG-2094) has been added to your available earnings.", createdAt: iso(daysAgo(0, 12, 10)), read: false, route: { name: "worker-earnings" } },
  { id: "nt-3", userId: "w-priya", kind: "governance", title: "Cooperative vote open", body: "Proposal PRO-2026-014 — training fund allocation for high-demand skills. Closes in 9 days.", createdAt: iso(daysAgo(1, 17, 0)), read: false, route: { name: "worker-governance" } },
  { id: "nt-4", userId: "w-priya", kind: "verification", title: "Certification renewed", body: "Your Residential Wiring Safety — Level 2 credential was re-validated for 12 months.", createdAt: iso(daysAgo(2, 10, 30)), read: true, route: { name: "worker-verification" } },
  { id: "nt-5", userId: "w-priya", kind: "support", title: "Welfare claim update", body: "Health check-up claim (WCL-1044) moved to under review. Expected decision in 2–3 working days.", createdAt: iso(daysAgo(2, 15, 40)), read: true, route: { name: "worker-welfare" } },
  { id: "nt-6", userId: "w-priya", kind: "payment", title: "Weekly payout processing", body: "₹5,987 for the week of 22–28 Sep will reach Bank ••4417 tomorrow evening.", createdAt: iso(daysAgo(0, 8, 0)), read: true, route: { name: "worker-earnings" } },
  /* Ananya (customer) */
  { id: "nt-10", userId: "c-ananya", kind: "booking", title: "Booking confirmed", body: "Garden maintenance with Arjun Kamble is confirmed for tomorrow, 10:00 AM.", createdAt: iso(daysAgo(0, 9, 5)), read: false, route: { name: "customer-booking", params: { bookingId: "bk-105" } } },
  { id: "nt-11", userId: "c-ananya", kind: "booking", title: "Service completed", body: "Kitchen deep clean by Meena Joshi is complete. Payment will be settled after your confirmation.", createdAt: iso(daysAgo(12, 14, 30)), read: true, route: { name: "customer-booking", params: { bookingId: "bk-103" } } },
  { id: "nt-12", userId: "c-ananya", kind: "booking", title: "Rate your service", body: "How was the fan repair with Vikas Shinde? Your rating keeps quality transparent for everyone.", createdAt: iso(daysAgo(7, 20, 15)), read: true, route: { name: "customer-booking", params: { bookingId: "bk-104" } } },
  { id: "nt-13", userId: "c-ananya", kind: "payment", title: "Invoice ready", body: "Invoice INV-0912 for kitchen deep clean (₹1,047) is available in Payments & Invoices.", createdAt: iso(daysAgo(12, 14, 35)), read: true, route: { name: "customer-payments" } },
  { id: "nt-14", userId: "c-ananya", kind: "booking", title: "Your standing order continues", body: "Your weekly deep clean with Meena Joshi continues — next visit scheduled in 2 days, awaiting Meena's confirmation.", createdAt: iso(daysAgo(9, 11, 30)), read: true, route: { name: "customer-booking", params: { bookingId: "bk-806" } } },
  /* Admin */
  { id: "nt-20", userId: "u-admin", kind: "support", title: "Dispute escalated", body: "SUP-5846 — 2 BHK vs 1 BHK billing dispute escalated by Kiran Rao. Needs assignment today.", createdAt: iso(daysAgo(0, 11, 30)), read: false, route: { name: "admin-disputes" } },
  { id: "nt-21", userId: "u-admin", kind: "verification", title: "Verification needs action", body: "Ganesh Salunke's address proof has expired. Fresh proof was requested 4 days ago.", createdAt: iso(daysAgo(1, 9, 0)), read: false, route: { name: "admin-verifications" } },
  { id: "nt-22", userId: "u-admin", kind: "system", title: "Capacity gap forecast", body: "Forecast predicts a 12-worker gap for electrical services on Saturday evening (4–8 PM).", createdAt: iso(daysAgo(0, 7, 30)), read: false, route: { name: "admin-forecast" } },
  { id: "nt-23", userId: "u-admin", kind: "payment", title: "Payout batch processed", body: "84 members · ₹4.2L processed for the week of 15–21 Sep.", createdAt: iso(daysAgo(6, 20, 5)), read: true, route: { name: "admin-finance" } },
  /* Standing orders (recurring bookings) */
  { id: "nt-30", userId: "w-rakesh", kind: "job", title: "Standing order continues", body: "Standing order: Bathroom plumbing inspection for Manish Agarwal continues — next occurrence in 4 days. You have priority; accept to confirm.", createdAt: iso(daysAgo(26, 12, 35)), read: false, route: { name: "worker-jobs" } },
  { id: "nt-31", userId: "w-meena", kind: "payment", title: "Standing-order visit settled", body: "₹1,979 for the fifth weekly deep clean (SG-8059) was added to your earnings. Your standing order with this customer continues every week.", createdAt: iso(daysAgo(9, 14, 40)), read: true, route: { name: "worker-earnings" } },
  /* Training & upskilling hub */
  { id: "nt-40", userId: "w-priya", kind: "verification", title: "Certificate issued", body: "Certificate SCT-2025-041 issued — Advanced Appliance Diagnosis & Repair (score 92/100). It is now visible on your customer-facing profile.", createdAt: iso(daysAgo(61, 16, 5)), read: true, route: { name: "worker-training" } },
  { id: "nt-41", userId: "w-arjun", kind: "verification", title: "Certificate issued", body: "Certificate SCT-2025-043 issued — Kitchen Garden & Seasonal Planting (score 90/100). It is now visible on your customer-facing profile.", createdAt: iso(daysAgo(25, 13, 10)), read: true, route: { name: "worker-training" } },
];

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */
export const SEED_AUDIT: AuditEntry[] = [
  { id: "au-1", at: iso(daysAgo(0, 11, 25)), actor: "Kiran Rao", actorRole: "admin", action: "Escalated dispute SUP-5846", entity: "Support ticket", severity: "warning" },
  { id: "au-2", at: iso(daysAgo(0, 10, 40)), actor: "Meera Kulkarni", actorRole: "admin", action: "Replied to ticket SUP-5841", entity: "Support ticket", severity: "info" },
  { id: "au-3", at: iso(daysAgo(0, 9, 15)), actor: "System (scheduler)", actorRole: "admin", action: "Generated 7-day demand forecast", entity: "Forecast", severity: "info" },
  { id: "au-4", at: iso(daysAgo(0, 8, 40)), actor: "Shalini Kadam", actorRole: "worker", action: "Re-uploaded address proof", entity: "Verification record", severity: "notice" },
  { id: "au-5", at: iso(daysAgo(1, 18, 55)), actor: "Priya Sharma", actorRole: "worker", action: "Completed service SG-2094", entity: "Booking", severity: "info" },
  { id: "au-6", at: iso(daysAgo(1, 16, 10)), actor: "Finance Desk", actorRole: "admin", action: "Released settlement hold on POT-2609-081", entity: "Payout", severity: "warning" },
  { id: "au-7", at: iso(daysAgo(2, 12, 30)), actor: "Kiran Rao", actorRole: "admin", action: "Updated category rate — Electrical: wiring inspection ₹1,099 → ₹1,199", entity: "Service category", severity: "notice" },
  { id: "au-8", at: iso(daysAgo(3, 11, 5)), actor: "Kiran Rao", actorRole: "admin", action: "Approved verification — Sandeep Gaikwad (plumbing)", entity: "Verification record", severity: "info" },
  { id: "au-9", at: iso(daysAgo(4, 15, 20)), actor: "Executive Committee", actorRole: "admin", action: "Published proposal PRO-2026-014 for member voting", entity: "Governance proposal", severity: "info" },
  { id: "au-10", at: iso(daysAgo(5, 10, 10)), actor: "Kiran Rao", actorRole: "admin", action: "Rejected verification — Rekha Bhalerao (care role eligibility)", entity: "Verification record", severity: "warning" },
  { id: "au-11", at: iso(daysAgo(6, 20, 5)), actor: "Finance Desk", actorRole: "admin", action: "Processed payout batch POT-2609-142 (84 members)", entity: "Payout", severity: "info" },
  { id: "au-12", at: iso(daysAgo(8, 9, 45)), actor: "Kiran Rao", actorRole: "admin", action: "Updated policy — dispute window 3 → 3 days (no change, reviewed)", entity: "Platform policy", severity: "info" },
  { id: "au-13", at: iso(daysAgo(10, 14, 30)), actor: "Meera Kulkarni", actorRole: "admin", action: "Resolved ticket SUP-5802 (welfare contribution query)", entity: "Support ticket", severity: "info" },
  { id: "au-14", at: iso(daysAgo(12, 11, 15)), actor: "Executive Committee", actorRole: "admin", action: "Closed proposal PRO-2026-009 — passed (131 approve / 33 reject / 8 abstain)", entity: "Governance proposal", severity: "notice" },
  { id: "au-15", at: iso(daysAgo(26, 11, 45)), actor: "System (scheduler)", actorRole: "admin", action: "Standing order so-002 — next occurrence scheduled automatically", entity: "Booking", severity: "info" },
  { id: "au-16", at: iso(daysAgo(9, 10, 45)), actor: "System (scheduler)", actorRole: "admin", action: "Standing order so-001 — next occurrence scheduled automatically", entity: "Booking", severity: "info" },
  { id: "au-17", at: iso(daysAgo(61, 16, 5)), actor: "Sahyog Skill Academy", actorRole: "admin", action: "Certificate SCT-2025-041 issued — Priya Sharma, Advanced Appliance Diagnosis & Repair (92/100)", entity: "Training certificate", severity: "notice" },
  { id: "au-18", at: iso(daysAgo(21, 9, 20)), actor: "Rakesh Patil", actorRole: "worker", action: "Training enrolment — Rakesh Patil joined Modern Plumbing Fixtures & Water Harvesting", entity: "Training enrolment", severity: "info" },
  { id: "au-19", at: iso(daysAgo(8, 14, 10)), actor: "Sahyog Skill Academy", actorRole: "admin", action: "Certificate SCT-2025-047 issued — Sandeep Gaikwad, Modern Plumbing Fixtures & Water Harvesting (82/100)", entity: "Training certificate", severity: "notice" },
];

/* ------------------------------------------------------------------ */
/* Policy                                                              */
/* ------------------------------------------------------------------ */
export const SEED_POLICY: PlatformPolicy = {
  commissionPct: 6,
  welfarePct: 3,
  gstPct: 18,
  tdsPct: 1,
  surgePolicy: "No customer surge pricing. High-demand windows are managed by routing priority and member availability incentives.",
  cancellationPolicy: "Free cancellation until 2 hours before the slot. Later cancellations charge 25% of the service charge, credited to the member for their blocked time.",
  disputeWindowDays: 3,
  minWagePerHour: 120,
  updatedBy: "Kiran Rao",
  updatedAt: iso(daysAgo(8, 12, 0)),
};
