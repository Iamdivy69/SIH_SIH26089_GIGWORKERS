# Sahyog — Cooperative Gig Services Platform

**Smart India Hackathon 2025 · Problem SIH26089**
*Household & community services, run as a worker cooperative.*

An interactive, production-quality frontend prototype demonstrating a services platform that is **owned by its workers**: explainable job matching, transparent pricing, member welfare, and one-member-one-vote governance — with customer, worker and cooperative-admin experiences in a single application.

---

## Running the prototype

```bash
bun run dev        # starts on http://localhost:3000 (dev server)

cd mini-services/notify && bun run dev   # OPTIONAL: real-time notification push
                                          # (socket.io, port 3030 + loopback 3031)
bun run lint       # ESLint
```

Open `http://localhost:3000/`. The first screen is a **demo console** — pick one of the three roles. You can switch roles anytime from the header ("Viewing as ▾").

> Everything runs locally. There is **no real backend**: all data is served by an in-memory mock API inside this project. No real payments, verifications, insurance or identities are involved — the header carries a "Demo · simulated data" badge throughout.
>
> The notify mini-service is **optional**: with it running, the header shows a **LIVE** pill and every notification (job offers, settlements, vote calls, dividends) is **pushed to open tabs in real time** — try booking as the customer in one tab while watching the worker tab. Without it (or if it stops), the app silently falls back to 20-second polling and the pill shows **Delayed**.

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
10. Also try: **Ctrl+K** anywhere (command palette), the customer booking's **View invoice** (printable GST invoice), and the full surplus loop: Admin → *Cooperative → Surplus & dividends* → adjust the allocation → **Send to member vote** → switch to Worker → *Earnings* shows the **live patronage-dividend projection** moving with your edits → *Governance* → vote → back as Admin → *Governance* → **Close vote & record outcome** → the proposal passes, **the dividend executes instantly** — Worker → *Earnings* now shows **₹ credited + a dividends-received history**, and Admin → *Surplus & dividends* shows the executed **distribution ledger** (per-member, patronage-proportional, audit-certified)
11. **Real-time moment (with the notify service running)**: open the app in **two browser tabs** — one as the customer, one as the worker (both show the LIVE pill). Book any service as the customer: the worker tab's bell badge, toast and job-offer list update **the instant the booking lands** — no refresh, no polling wait. Reply from the worker tab and watch the customer's tab react the same way. Also settle any completed booking as the customer and open its detail — the **"What [member] earned"** card shows the other side of the same bill: net cash in hand, welfare-fund credit and TDS

## What's inside

| Experience | Screens |
|---|---|
| **Customer** | Home (**with a personal cooperative-impact panel — where the money you paid actually went**), service discovery & filters, worker trust profiles (**with cooperative training certifications**), 6-step booking flow with explainable matching **and standing-order (weekly/monthly) scheduling**, bookings & tracking with booking-scoped chat, confirm + rate, **"Book again" one-tap rebook from history**, payments & invoices (**GST tax-invoice screen — printable one-sheet + per-invoice CSV**), **notification center with day grouping & filters**, support, profile |
| **Worker (member-owner)** | Dashboard (**with live patronage-dividend projection**), job offers with match explanations **and standing-order priority offers**, service execution (status flow, checklist, evidence, customer chat), schedule, availability editor, earnings with full payout breakdowns, **recurring-income stat (₹8,569/mo for Meena)** **and patronage-dividend card (projection, patronage share, draft split, vote CTA)**, welfare & benefits portal (insurance, pension pot, claims, **dividend projection strip**), **training & certifications hub (enrol, progress, cooperative-issued certificates)**, cooperative governance (live voting, meetings, dividend), verification, skill academy, **notification center**, support |
| **Cooperative admin** | Operations overview (KPIs, alerts, trends, **standing-order count**), 7-day demand forecasting with capacity gaps & recommended actions, worker management (CSV export), verification workflow, bookings monitor (CSV export), dispute resolution, finance & reconciliation (**finance statement CSV export**), **surplus & dividend allocation (interactive builder → member vote → close-the-vote → executed distribution ledger, patronage-based)**, **training coverage (by course, by member)**, governance publishing (**close votes, tally + quorum + certified outcomes**), service catalogue rates, platform policies, audit log, **notification center** |

**Dark mode**: the whole platform (all three roles + welcome console) supports a full dark theme via the header toggle — semantic tokens throughout, charts included.

**Real-time notifications**: every notification created by the mock API is **pushed to connected browser tabs over socket.io** (a tiny dedicated mini-service) — bell badge, toasts and screens update instantly; a **LIVE / Delayed indicator** in the header states the connection, and 20-second polling remains as a silent fallback. Each tab subscribes to its current demo role's room, so role switching re-subscribes automatically and notifications never leak across roles.

**Command palette**: press **Ctrl/Cmd + K** (or click Search in the header) from any screen to jump anywhere — every screen of the active role, plus entity search: members by name/trade/locality, services, booking references (SG-…) and training courses. Fully keyboard-driven (↑↓ navigate · ↵ open · esc close).

### Cooperative model, visible in the product
- **Transparent finance** — every price and payout shows the full breakdown; rates (6% platform / 3% welfare / 18% GST / 1% TDS) are set by cooperative policy and editable on the admin *Policies* screen; completed payments issue a **proper GST tax invoice** (SAC code, GSTIN, line items, amount in words) that prints as a single sheet
- **Welfare** — the customer's welfare contribution lands in the worker's own fund, traceable booking-by-booking (and on the invoice)
- **Governance** — members vote on real proposals (one member, one vote); the admin can publish new ones, **including the annual surplus allocation** — the board drafts the split (reserves / patronage dividend / training / community / contingency with policy floors), members vote, and dividends follow **patronage** (completed service value), never share count
- **Member dividend visibility** — every member sees their **own live projection** of the patronage dividend (Earnings card, Welfare strip, Dashboard row): patronage to date, share of the co-op's patronage base, the board's current draft split, and — once published — the proposal code, closing date and a direct vote CTA. The projection is honest: it moves live with the board's draft, and nothing pays out before the member vote
- **Close-the-vote & distribution** — the admin closes votes with the tally and quorum certified in the audit log; when the surplus proposal passes, the distribution **executes on the spot**: an immutable per-member ledger (patronage-proportional, DIV- references), member notifications ("₹ credited"), and the workers' **dividends-received history** (FY 2025-26 seeded + this FY as executed). A failed or quorum-lapsed surplus vote reopens the board draft
- **Customer impact** — the customer's home shows **where their own money went** (computed from their completed bookings): how much reached service members and their welfare funds vs. cooperative operations vs. GST — the co-op's answer to "where does my payment go", per customer; the payments screen carries the same numbers as a compact strip above the invoices
- **Dual transparency per booking** — every settled booking detail shows **"What [member] earned"**: net cash in hand, the welfare-fund credit added on top and TDS — with the explicit note that the cooperative's 6% processing fee is paid by the customer on top and never cut from the service charge
- **Explainable allocation** — no black-box "AI recommended": scores, weights and reasons are shown to both customers and workers
- **Standing orders** — repeat bookings (weekly/monthly) give members stable, predictable income: every completed visit auto-schedules the next with the same member and rate, workers see a quantified recurring-income stat and priority offers, and the admin sees active-series counts
- **Training & upskilling** — the cooperative funds member training (7 programmes across trades + professional skills); members earn auditable certificates (SCT-2025-###) that surface as trust signals on their customer-facing profiles, and admins track coverage

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

Next.js 16 (App Router) · TypeScript 5 · Tailwind CSS 4 · shadcn/ui · TanStack Query · Zustand · Recharts · date-fns · Lucide · Sonner · Socket.IO (real-time push mini-service)

## Notes for evaluators

- All names, ratings, amounts, policies and statistics are **fictional demo data** generated relative to the current date so the prototype always looks live
- Verification, insurance, payouts and photo evidence are **simulated states** — clearly labelled in the interface
- Multilingual readiness (English active; मराठी / हिंदी on the roadmap) is surfaced in the header language selector
- The 7-day forecast is a deterministic simulation of a demand model (patterns + confidence), presented as an operations planning tool
