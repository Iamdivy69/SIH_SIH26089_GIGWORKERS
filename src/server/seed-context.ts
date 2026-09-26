import type { GovernanceData, WelfareClaim, WelfareContribution, WelfareProfile } from "@/lib/types";

const DAY = 86400000;
const HOUR = 3600000;
const NOW = Date.now();
const iso = (t: number) => new Date(t).toISOString();

export function buildWelfareProfile(
  contributionSources: { bookingRef: string; amount: number; date: number }[],
  extraClaims: WelfareClaim[] = [],
): WelfareProfile {
  /* Contributions are derived from the worker's settled transactions */
  const sorted = [...contributionSources].sort((a, b) => b.date - a.date).slice(0, 14);
  const chronological = [...sorted].reverse();
  const openingBalance = 15000;
  let running = openingBalance;
  const contributions: WelfareContribution[] = [];
  for (const c of chronological) {
    running += c.amount;
    contributions.push({
      id: `wc-${c.bookingRef}`,
      date: iso(c.date),
      bookingRef: c.bookingRef,
      amount: c.amount,
      balanceAfter: running,
    });
  }
  const fundBalance = contributions[contributions.length - 1]?.balanceAfter ?? openingBalance;
  const ytdContribution = contributionSources.filter((c) => c.date > NOW - 180 * DAY).reduce((a, c) => a + c.amount, 0);

  const claims: WelfareClaim[] = [
    {
      id: "clm-1044",
      type: "Health check-up reimbursement",
      submittedAt: iso(NOW - 3 * DAY),
      amount: 1850,
      status: "under_review",
      description: "Annual health check-up at a network diagnostic centre (bill attached).",
      reference: "WCL-1044",
    },
    {
      id: "clm-0921",
      type: "Physiotherapy — lower back strain",
      submittedAt: iso(NOW - 34 * DAY),
      amount: 3200,
      status: "settled",
      description: "Physiotherapy sessions for back strain caused during a ladder job.",
      decisionNote: "Approved under occupational health cover. Settled to Bank ••4417.",
      reference: "WCL-0921",
    },
  ];

  return {
    benefits: [
      {
        id: "ben-health",
        name: "Health Insurance",
        description: "Group health cover negotiated by the cooperative. Covers hospitalisation for the member and dependants.",
        status: "active",
        meta: "Family floater ₹5,00,000 · self + 2 dependants · cashless at network hospitals (simulated)",
        value: "₹5,00,000 cover",
        since: iso(NOW - 900 * DAY),
        policyRef: "SGC-HL-2025-0812",
      },
      {
        id: "ben-accident",
        name: "Accident Cover",
        description: "Occupational accident cover for work-related injuries, including ladder and tool injuries.",
        status: "active",
        meta: "₹10,00,000 disability · ₹5,00,000 accidental death (simulated)",
        value: "₹10,00,000 cover",
        since: iso(NOW - 900 * DAY),
        policyRef: "SGC-ACC-2025-0144",
      },
      {
        id: "ben-pension",
        name: "Pension Pot",
        description: "Your welfare contributions plus cooperative top-ups accumulate in your pension pot.",
        status: "active",
        meta: "Cooperative matches your contribution 1:1 on the first ₹500 per quarter",
        value: `₹${fundBalance.toLocaleString("en-IN")} saved`,
      },
      {
        id: "ben-skill",
        name: "Skill Development",
        description: "Fully-funded courses at the cooperative's skill academy, with certification on completion.",
        status: "active",
        meta: "2 courses completed · 1 in progress · 20 credit hours this year",
      },
      {
        id: "ben-emergency",
        name: "Emergency Assistance",
        description: "Interest-free salary advance for medical or family emergencies.",
        status: "eligible",
        meta: "Up to ₹15,000 · one active advance per year · repayable over 6 months",
      },
    ],
    contributions: contributions.reverse(),
    claims: [...extraClaims, ...claims],
    fundBalance,
    ytdContribution: Math.round(ytdContribution),
    coopMatchYtd: 1850,
    pensionPot: fundBalance,
    emergencyAssistanceLimit: 15000,
  };
}

export function buildGovernance(): GovernanceData {
  return {
    membershipId: "SGW-0117",
    memberSince: iso(NOW - 1280 * DAY),
    shareCapital: 1000,
    votingWeight: 1,
    activeProposals: [
      {
        id: "gp-001",
        code: "PRO-2026-014",
        title: "Increase the worker training fund allocation for high-demand skills (electrical, appliance repair)",
        summary: "Allocate ₹4.2 lakh from the FY surplus to train 40 members in high-demand trades over the next two quarters.",
        description:
          "Demand forecasts show sustained gaps in electrical and appliance repair categories. This proposal expands the training fund so 40 members can complete certified courses — with wages paid for training hours. The fiscal committee notes the surplus can absorb the spend without touching the welfare reserve.",
        status: "active",
        category: "Member development",
        openedAt: iso(NOW - 5 * DAY),
        closesAt: iso(NOW + 9 * DAY),
        participationPct: 64,
        eligibleMembers: 216,
        votes: { approve: 96, reject: 38, abstain: 4 },
        quorumPct: 50,
        fiscalNote: "₹4.2 lakh from FY 2026-27 surplus · welfare reserve untouched",
        proposedBy: "Executive Committee",
      },
      {
        id: "gp-002",
        code: "PRO-2026-015",
        title: "Add dental and vision coverage to the group health plan from FY 2026-27",
        summary: "Expand the cooperative-negotiated group health plan with dental and vision benefits for all members.",
        description:
          "The current group plan excludes dental and vision. This proposal negotiates a rider estimated at ₹210 per member per year, funded from the welfare fund's interest income — not from member contributions.",
        status: "active",
        category: "Welfare",
        openedAt: iso(NOW - 3 * DAY),
        closesAt: iso(NOW + 16 * DAY),
        participationPct: 41,
        eligibleMembers: 216,
        votes: { approve: 61, reject: 24, abstain: 4 },
        quorumPct: 50,
        fiscalNote: "₹45,360/year from welfare fund interest income",
        proposedBy: "Welfare Committee",
        myVote: "approve",
      },
    ],
    pastProposals: [
      {
        id: "gp-003",
        code: "PRO-2026-009",
        title: "Weekend availability incentive: ₹150 shift bonus for members covering 3+ weekend evening shifts",
        summary: "Encourage weekend evening coverage with a shift bonus paid from platform fee revenue.",
        description:
          "Passed with 76% approval. The incentive applies to members who cover three or more weekend evening slots in a month and is funded entirely from platform fee revenue earmarked for member benefits.",
        status: "passed",
        category: "Scheduling",
        openedAt: iso(NOW - 40 * DAY),
        closesAt: iso(NOW - 12 * DAY),
        participationPct: 80,
        eligibleMembers: 216,
        votes: { approve: 131, reject: 33, abstain: 8 },
        quorumPct: 50,
        fiscalNote: "Estimated ₹1.1L/year from platform fee revenue",
        proposedBy: "Operations Committee",
        myVote: "approve",
        outcomeNote: "Passed — effective from the current month.",
      },
      {
        id: "gp-004",
        code: "PRO-2026-002",
        title: "Reduce platform processing fee from 6% to 5% for members rated 4.8 and above",
        summary: "A tiered fee reduction rewarding top-rated members.",
        description:
          "Rejected. The fiscal committee flagged a ₹3.8 lakh revenue shortfall that would have affected the training and welfare funds; members asked for a reworked proposal that protects fund incomes.",
        status: "rejected",
        category: "Finance",
        openedAt: iso(NOW - 70 * DAY),
        closesAt: iso(NOW - 45 * DAY),
        participationPct: 69,
        eligibleMembers: 216,
        votes: { approve: 64, reject: 76, abstain: 8 },
        quorumPct: 50,
        fiscalNote: "Would reduce cooperative revenue by ₹3.8L/year",
        proposedBy: "Member circle — Ward 3 (West Pune)",
        myVote: "abstain",
        outcomeNote: "Rejected — referred back for reworking.",
      },
    ],
    meetings: [
      {
        id: "mtg-1",
        title: "Quarterly General Body Meeting — Q3 FY26",
        date: iso(NOW + 14 * DAY),
        time: "10:30 AM – 1:00 PM",
        venue: "Cooperative Hall, Sahyog Centre, Kothrud, Pune",
        agenda: [
          "Quarterly surplus and welfare fund statement",
          "Ratification of PRO-2026-009 (weekend incentive)",
          "Training fund expansion — progress review",
          "Safety kit distribution for field members",
        ],
        mode: "In person + video link for members on duty",
      },
      {
        id: "mtg-2",
        title: "Ward-level members' circle — West Pune",
        date: iso(NOW + 6 * DAY),
        time: "6:00 PM – 7:30 PM",
        venue: "Community Centre, Warje",
        agenda: ["Evening slot coverage planning", "New member introductions", "Tool bank feedback"],
        mode: "In person",
      },
    ],
    dividend: {
      fiscalYear: "2025-26",
      surplus: 1840000,
      patronageBonus: 920000,
      members: 216,
      myShare: 4260,
      distributedAt: iso(NOW - 120 * DAY),
      note: "Distributed in proportion to each member's completed service value — one member, one vote applies to all decisions regardless of share.",
    },
    announcements: [
      {
        id: "ann-1",
        title: "Safety kit distribution for all field members",
        date: iso(NOW - 2 * DAY),
        body: "Insulated tool sets and first-aid pouches are ready for collection at the Sahyog Centre, 10 AM–6 PM on weekdays.",
      },
      {
        id: "ann-2",
        title: "Written safety summary now standard after wiring inspections",
        date: iso(NOW - 9 * DAY),
        body: "Members performing wiring inspections can now issue the standard safety summary directly from the app — customers receive it with the completion note.",
      },
    ],
  };
}
