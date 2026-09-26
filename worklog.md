# Worklog — SIH26089 Cooperative Gig Services Platform

Project: **Sahyog** — Cooperative Gig Services Platform for Household & Community Services (SIH26089)
Stack: Next.js 16 (App Router, single `/` route as SPA), TypeScript 5, Tailwind CSS 4, shadcn/ui, Zustand, TanStack Query, Recharts, Lucide icons, sonner toasts.
Dev server: `bun run dev` on port 3000 (already running, logs in `dev.log`).

## Architecture decisions (all agents must follow)

- **Single visible route**: the whole multi-role app lives in `src/app/page.tsx` as a client-side SPA with a custom hash-based router (`#/role/screen/params`). No other page routes.
- **Mock API**: `src/app/api/[...slug]/route.ts` catch-all adapter → `src/server/*` in-memory store + domain handlers. All frontend data flows through typed `fetch` calls (`src/lib/api-client.ts` + `src/hooks/use-api.ts`), so a real backend can replace the handlers later without frontend changes.
- **Roles**: customer (Ananya Deshpande), worker (Priya Sharma, electrician), admin (Kiran Rao). Role switcher in the header (demo console pattern).
- **Transparent pricing model** (single source of truth `src/lib/rates.ts`):
  - Customer bill: service charge + welfare contribution (3% of service charge, → worker's welfare fund) + platform processing (6%, → cooperative) + GST (18% of platform fee). 
  - Worker payout: gross booking value (service + welfare) − platform fee − welfare contribution − TDS (1% of service charge) = net cash. Worker also "receives" the welfare amount in their welfare fund.
  - Full reconciliation: worker net + welfare fund + cooperative + GST + TDS = customer total.
- **Matching engine** (`src/server/matching.ts`): weighted explainable score — skill 35%, location 20%, availability 20%, rating 15%, experience 10%; every factor gets a qualitative label + human-readable reason. No black box.
- **Design language**: corporate, restrained, light theme. Warm off-white background, deep green primary (oklch 0.43 0.075 160), semantic colors only (green=positive, amber=pending, red=critical, slate=informational). No gradients, no glow, no glassmorphism, no oversized icons. 8px radius. Borders over shadows. Geist font. Tabular numerals for data. Uppercase micro-labels for table headers/badges.
- **Demo users / data**: all seeded programmatically relative to "now" (dates always look fresh), internally consistent (transactions derived from bookings, welfare contributions derived from transactions, ratings derived from reviews).
- **End-to-end demo scenario**: customer books urgent electrical repair → matching recommends Priya (94%) → transparent pricing → simulated UPI payment → worker (same session, switch role) accepts → executes with checklist + before/after evidence → completion settles payment → earnings + welfare contribution appear → customer rates → admin dashboards reflect everything.

---
Task ID: 1
Agent: main (Z.ai Code)
Task: Foundation — design tokens, types, pricing engine, seed data, mock API server, client state/query layer, shared design-system components, app shell, root SPA composition.

Work Log:
- Read project scaffold (Next.js 16, Tailwind 4, shadcn/ui, recharts, zustand, TanStack Query, sonner all available). Upload folder was empty; built from the task brief.
- Design tokens in `src/app/globals.css`: warm paper neutrals, deep cooperative-green primary `oklch(0.43 0.072 160)`, semantic success/warning/destructive/info tokens + tinted `*-muted` surfaces, disciplined chart palette, sidebar tokens, utilities (`.tnum`, `.micro-label`, `.scroll-slim`), recharts overrides.
- Domain model `src/lib/types.ts` (Worker, Customer, Booking, Review, Transaction, Payout, WelfareProfile, GovernanceData, ForecastData, SupportTicket, AuditEntry, MatchFactor, WorkerRecommendation, AdminOverview, FinanceOverview, etc).
- Pricing engine `src/lib/rates.ts`: service charge + welfare 3% + platform 6% + GST 18% (on fee) = customer total; worker gross = service + welfare, net = service − TDS 1%. `customerAllocation()` reconciles every rupee.
- Formatting `src/lib/format.ts`: en-IN currency, date/time labels ("Today · 4:30 PM"), duration, initials + deterministic avatar tones, TIME_SLOTS.
- Server: `src/server/catalog.ts` (6 categories × ~5 services each, checklists), `seed.ts` (16 workers incl. 4 verification-pipeline, 8 customers, 36 bookings across all statuses with derived transactions/reviews, payouts, 7 support tickets, notifications, audit, policy — deterministic PRNG, dates relative to now), `seed-context.ts` (welfare profile derived from transactions, governance: 2 active + 2 past proposals, meetings, dividend), `forecast.ts` (126-cell 7-day forecast with realistic gaps 11–14), `matching.ts` (explainable weighted scoring: skill 35/location 20/availability 20/rating 15/experience 10, qualitative assessments + reasons), `db.ts` (in-memory store on globalThis, mutations: booking lifecycle, accept/decline, execution checklist/evidence, settlement, rating, voting, claims, verification decisions, dispute resolution, policy updates, category rates; event notifications + audit trail), `api.ts` (~45 routes registered on a pattern router, 200ms simulated latency).
- API adapter `src/app/api/[...slug]/route.ts` (catch-all GET/POST/PUT; old scaffold api route removed).
- Client: `src/store/app-store.ts` (zustand + hash router `#/route/params`, ROUTE_PARAMS registry, ROLE_HOME, DEMO_USER_ID mapping, role derived from route prefix), `src/lib/api-client.ts` (typed fetch, `x-demo-user` header), `src/hooks/use-api.ts` (all TanStack Query hooks + mutations with toast feedback and cache invalidation; notifications/support keyed by role).
- Shared design system `src/components/shared/`: PersonAvatar, RatingStars, StatusBadge (full domain status→tone map), PageHeader, SectionCard, StatTile/StatInline, EmptyState/ErrorState/LoadingPanel/LoadingGrid, DataTable+MobileRows, CustomerPriceLines/PaymentAllocation/WorkerPayoutCard/PriceTotal, MatchBadge/FactorBars/MatchReasonChips/ScoreDial, StatusTimeline, chart wrappers (TrendAreaChart, CompareBarChart, ValueBarChart, LineTrend, Spark, HBarList), EvidenceTile (simulated capture), AlertBanner.
- Platform shell `src/components/platform/`: Providers (QueryClient + Tooltip + Sonner + hashchange router), brand mark, nav config (3 role sidebars + mobile bottom nav + pageMeta), Sidebar, Header (breadcrumb context, demo badge, language readiness, notification Sheet, role switcher dropdown), MobileNav, AppShell (sticky footer, max-w-1200 content), WelcomeScreen (cooperative model diagram + 4 pillars + role cards + how-it-works).
- Root `src/app/page.tsx` renders WelcomeScreen → AppShell → role apps. Layout: Geist fonts, SIH metadata, viewport.
- Fixed: ESM require() in seed, welfare claims persistence, support ticket scoping, notification/support query keys per role, data-table cn() parens, rating math, Priya availability (all 7 days so the demo works any day), forecast scale (gaps 11–14).
- QA: lint clean; all API endpoints validated via curl (session, customer overview, workers, matching → Priya 92% with all-Excellent factors, worker overview/earnings, welfare, governance, admin overview, forecast); browser check — welcome screen renders, role entry works, hash routing + notifications badge functional.

Stage Summary:
- Foundation complete and verified. Design language established: corporate, restrained, light, green primary, borders-over-shadows, tabular numerals, micro-labels.
- Agents for Tasks 2-a/b/c must read `docs/CONTRACT.md` (component/hook APIs, screen specs, ownership rules) before touching code.
- Demo identities: customer Ananya Deshpande (c-ananya), worker Priya Sharma (w-priya), admin Kiran Rao (u-admin).
- Full end-to-end scenario is wired server-side: book → match (92%+ explainable) → pay → accept → execute (checklist+evidence) → settle → welfare credit → rate → admin dashboards reflect.

---
Task ID: 3
Agent: main (Z.ai Code) — integration, QA and polish
Task: Wire the three parallel role builds together, browser-verify every screen and the full demo scenario, fix defects, mobile-responsiveness pass, README, final handover.

Work Log:
- Launched three parallel build agents (2-a customer, 2-b worker, 2-c admin) against docs/CONTRACT.md. All three completed their role folders (30 screens); the Task tool hit its return deadline after the work was done — verified by inspecting folders, lint, and browser testing.
- Route sweep: all 30 hash routes render with zero console errors.
- End-to-end demo scenario verified in the browser (and via curl): book (svc-e6 ₹800) → match (Priya ~92%, all factors Excellent) → transparent pricing + simulated UPI → pending_acceptance → worker accepts → en_route/arrived/in_progress → checklist 5/5 + before/after evidence → complete → awaiting_confirmation → customer confirms + rates 5★ → settled. Earnings, welfare contributions and admin dashboards all reflect the new booking.
- Bug fixes by me (foundation): rating formula parenthesis bug (Math.min capping → 0.5★) in db.ts confirmBooking; defensive date formatters (safeFormat) so a bad ISO string can never crash a screen; server-side scheduledAt validation on POST /bookings.
- UX fixes: welcome console now shows only on bare-root visits (deep links enter the app directly — removed fragile storage persistence); "About this prototype" re-opens the console cleanly; devIndicators disabled for clean screenshots.
- Data realism: added 18 historic completed bookings for Priya (8-week spread, organic charges) → 25 transactions, fluctuating weekly earnings chart (₹1,360–3,808), richer welfare contribution history and job history. Fixed truncated "Available balance" sub-label.
- Mobile responsiveness (375px): found and fixed a systemic issue — grids with only lg:/xl: templates have no mobile column template (implicit auto column overflows). Added grid-cols-1 across 20+ grids in all role folders; added min-w-0 to grid children; SectionCard forTable gets overflow-hidden. Final sweep: **all 32 screens: no horizontal overflow**.
- VLM design review rounds on 1440px screenshots of all flagship screens (welcome, discovery, worker profile, booking detail+rating, worker dashboard/jobs/execution/earnings/welfare/governance, admin overview/forecast). Scores improved to 7–9/10; chart realism, truncation and layout issues addressed. (Note for future agents: the terminal display pipeline eats literal "[m" byte sequences — grep/display of `grid-cols-[minmax(...)]` shows as `grid-cols-inmax(...)`; trust `python3 -c "open(...).read()"` byte checks over visual grep output.)
- Sticky footer verified (min-h-screen flex + mt-auto); footer naturally pushed on long pages.
- Wrote README.md (run instructions, demo scenario walkthrough, architecture, evaluator notes).
- Cleanup: killed stray browser daemons that were starving the 4GB sandbox (API once degraded to 3-minute responses; hard restart restored ~230ms).

Stage Summary:
- COMPLETE: 3 role apps × 10-12 screens each, all routes functional, demo scenario works end-to-end across roles in one session, lint clean, no console errors, mobile-clean at 375px, desktop-verified at 1440px.
- Screenshot set for the SIH deck available at /tmp/shots/*.png (regenerate anytime: enter a role, then `agent-browser eval "location.hash='#/<route>'"` + screenshot).
- The in-memory store resets on dev-server restart (seed state); the demo booking can be recreated in ~60s via the customer UI or the curl sequence documented above.
- Known acceptable limitations: recharts logs benign "width(0)" warnings while charts mount inside hidden tabs; notification "polling" is a 20s refetchInterval + mutation invalidation (no websockets — deliberate, single-browser demo); language selector is display-only (roadmap states).
- Suggested next steps for the 15-min review cycle: visual polish per VLM notes (icon chips on discovery filters, stronger status-banner contrast on execution screen), real DB behind the same API contract (Prisma), websocket mini-service for cross-device demo, dark-mode pass.
