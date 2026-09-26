# Sahyog — Cooperative Gig Services Platform

**Smart India Hackathon 2025 · Problem SIH26089**
*Household & community services, run as a worker cooperative.*

An interactive, production-quality frontend prototype demonstrating a services platform that is **owned by its workers**: explainable job matching, transparent pricing, member welfare, and one-member-one-vote governance — with customer, worker and cooperative-admin experiences in a single application.

---

## Running the prototype

```bash
bun run dev        # starts on http://localhost:3000 (dev server)
bun run lint       # ESLint
```

Open `http://localhost:3000/`. The first screen is a **demo console** — pick one of the three roles. You can switch roles anytime from the header ("Viewing as ▾").

> Everything runs locally. There is **no real backend**: all data is served by an in-memory mock API inside this project. No real payments, verifications, insurance or identities are involved — the header carries a "Demo · simulated data" badge throughout.

## The demo scenario (SIH presentation flow)

The whole journey works end-to-end **in one browser session**, because all three roles share the same live in-memory store:

1. **Customer** (Ananya Deshpande, Kothrud) → *New request* → Electrical → *General electrical repair* (₹800)
2. Describe the issue → the platform shows **recommended members with an explainable score** (Priya Sharma ~92%: skill 35% · location 20% · availability 20% · rating 15% · experience 10%, every factor rated and reasoned)
3. Pick a slot → **transparent pricing**: service charge + welfare contribution (3%) + platform processing (6%) + GST, with a *where your payment goes* allocation bar
4. Pay (simulated UPI) → booking `pending_acceptance`, Priya is notified
5. Switch role to **Worker** (Priya Sharma) → *Job opportunities* → the offer appears with match reasons and full payout → **Accept** (use the booking-scoped **message thread** to coordinate timings or gate codes — the customer sees it instantly on their booking page)
6. Open the execution screen → *I'm on the way* → *Mark arrival* → *Start service* → complete the checklist → capture before/after evidence (simulated) → **Complete service**
7. Switch back to **Customer** → booking is *Awaiting confirmation* → **Confirm & submit rating** (stars + tags)
8. Payment settles → back as **Worker**: the earnings transaction (₹800 gross → ₹792 net + ₹24 welfare credit) appears in *Earnings*, the contribution in *Welfare & benefits*
9. Switch to **Admin** (Kiran Rao): operations overview, bookings monitor and finance all reflect the completed service; the demand forecast, verification queue, dispute desk and governance pages are fully populated

## What's inside

| Experience | Screens |
|---|---|
| **Customer** | Home, service discovery & filters, worker trust profiles, 6-step booking flow with explainable matching, bookings & tracking with booking-scoped chat, confirm + rate, payments & invoices (per-invoice CSV download + full statement export), support, profile |
| **Worker (member-owner)** | Dashboard, job offers with match explanations, service execution (status flow, checklist, evidence, customer chat), schedule, availability editor, earnings with full payout breakdowns, welfare & benefits portal (insurance, pension pot, claims), cooperative governance (live voting, meetings, dividend), verification, skill academy, support |
| **Cooperative admin** | Operations overview (KPIs, alerts, trends), 7-day demand forecasting with capacity gaps & recommended actions, worker management (CSV export), verification workflow, bookings monitor (CSV export), dispute resolution, finance & reconciliation, governance publishing, service catalogue rates, platform policies, audit log |

### Cooperative model, visible in the product
- **Transparent finance** — every price and payout shows the full breakdown; rates (6% platform / 3% welfare / 18% GST / 1% TDS) are set by cooperative policy and editable on the admin *Policies* screen
- **Welfare** — the customer's welfare contribution lands in the worker's own fund, traceable booking-by-booking
- **Governance** — members vote on real proposals (one member, one vote); the admin can publish new ones
- **Explainable allocation** — no black-box "AI recommended": scores, weights and reasons are shown to both customers and workers

## Architecture

```
src/
  app/
    page.tsx                  # single visible route — SPA composition
    api/[...slug]/route.ts    # catch-all mock API adapter
  server/                     # in-memory store + handlers (swap for a real backend later)
    api.ts                    # ~45 REST routes (200ms simulated latency)
    db.ts                     # store, booking lifecycle, settlement, voting, claims…
    matching.ts               # explainable weighted scoring engine
    forecast.ts               # deterministic 7-day demand forecast generator
    seed.ts                   # 16 workers, 8 customers, 54 bookings, transactions,
                              #   reviews, welfare, governance, tickets, audit — all
                              #   internally consistent, dates relative to "now"
  lib/
    types.ts                  # full domain model
    rates.ts                  # pricing engine (single source of truth)
    format.ts                 # en-IN currency, dates, defensive formatters
    csv.ts                    # client-side CSV export (statement, invoices, registers)
  hooks/use-api.ts            # typed TanStack Query hooks for every endpoint
  store/app-store.ts          # zustand + hash router (#/route/params)
  components/
    shared/                   # design system: DataTable, PriceBreakdown components,
                              #   MatchScore/FactorBars, StatusBadge, charts, states…
    platform/                 # app shell: role sidebars, header, notifications,
                              #   role switcher, welcome console
    customer|worker|admin/    # the three role applications
```

**Key decisions**
- The whole app lives behind one route (`/`) with a hash router — deep links like `#/worker-earnings` work; a bare visit shows the demo console
- All data flows through `fetch('/api/…')` — replacing the mock handlers with a real backend requires **no frontend changes**
- Mutations (book, accept, vote, verify, resolve, rate…) update the shared store, so the three roles stay consistent within a session; state resets when the dev server restarts

## Tech stack

Next.js 16 (App Router) · TypeScript 5 · Tailwind CSS 4 · shadcn/ui · TanStack Query · Zustand · Recharts · date-fns · Lucide · Sonner

## Notes for evaluators

- All names, ratings, amounts, policies and statistics are **fictional demo data** generated relative to the current date so the prototype always looks live
- Verification, insurance, payouts and photo evidence are **simulated states** — clearly labelled in the interface
- Multilingual readiness (English active; मराठी / हिंदी on the roadmap) is surfaced in the header language selector
- The 7-day forecast is a deterministic simulation of a demand model (patterns + confidence), presented as an operations planning tool
