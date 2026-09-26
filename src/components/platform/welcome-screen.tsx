"use client";

import { ArrowRight, Building2, Landmark, ShieldCheck, TrendingUp, User, Vote, Wallet, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "./brand";
import { ROLE_HOME, useAppStore } from "@/store/app-store";
import { useSession } from "@/hooks/use-api";
import { PersonAvatar } from "@/components/shared";

const ROLE_CARDS = [
  {
    role: "customer" as const,
    icon: User,
    title: "Customer",
    name: "Ananya Deshpande · Kothrud",
    description: "Book verified household services with transparent pricing and see exactly where your payment goes.",
    points: ["Search & match with verified members", "Transparent price breakdowns", "Track service, confirm & rate"],
  },
  {
    role: "worker" as const,
    icon: Landmark,
    title: "Worker & member-owner",
    name: "Priya Sharma · Electrician, SGW-0117",
    description: "This is not a gig account — it is membership of a cooperative. Earnings, welfare and a real vote.",
    points: ["Explainable job recommendations", "Full earnings & welfare statements", "Vote in cooperative decisions"],
  },
  {
    role: "admin" as const,
    icon: Building2,
    title: "Cooperative admin",
    name: "Kiran Rao · Operations, Sahyog Cooperative",
    description: "Operational visibility across bookings, workforce, quality, disputes, forecasts and finance.",
    points: ["Live operations & demand forecast", "Verification & dispute workflows", "Finance & governance oversight"],
  },
];

const PILLARS = [
  { icon: TrendingUp, title: "Intelligent allocation", text: "Explainable matching on skills, location, availability, rating and experience." },
  { icon: Wallet, title: "Transparent finance", text: "Every rupee traced: worker payout, welfare fund, cooperative fee, taxes." },
  { icon: HeartPulse, title: "Worker welfare", text: "Health cover, accident cover, pension pot and emergency assistance." },
  { icon: Vote, title: "Member governance", text: "One member, one vote — on budgets, benefits and platform policy." },
];

export function WelcomeScreen() {
  const navigate = useAppStore((s) => s.navigate);
  const dismissWelcome = useAppStore((s) => s.dismissWelcome);
  const { data: session } = useSession();

  const enter = (role: "customer" | "worker" | "admin") => {
    dismissWelcome();
    navigate(ROLE_HOME[role]);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1080px] px-4 py-10 sm:px-6 sm:py-16">
        {/* Masthead */}
        <header className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <BrandMark size={40} />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Sahyog</h1>
              <p className="text-[12.5px] text-muted-foreground">Cooperative Gig Services Platform</p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="micro-label">Smart India Hackathon 2025 · SIH26089</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">Household & community services, run as a worker cooperative</p>
          </div>
        </header>

        {/* Proposition */}
        <section className="mt-12 sm:mt-16">
          <p className="micro-label">Why this is different</p>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_1fr]">
            <div className="rounded-lg border bg-card p-6">
              <p className="text-[15px] font-medium leading-relaxed text-foreground/90">
                Conventional gig platforms sit between customers and workers as an intermediary that takes a cut.
                Sahyog is built the other way round — the service platform and the worker body are the same
                organisation, owned by the workers themselves.
              </p>
              <div className="mt-5 flex flex-col items-stretch gap-2 text-[13px] sm:flex-row sm:items-center">
                <div className="rounded-md border bg-muted/50 px-3.5 py-2.5 text-center">
                  <p className="font-semibold">Customer</p>
                  <p className="text-[11px] text-muted-foreground">reliable, transparent services</p>
                </div>
                <span className="self-center text-muted-foreground">↕</span>
                <div className="rounded-md border border-primary/30 bg-[oklch(0.965_0.015_155)] px-3.5 py-2.5 text-center">
                  <p className="font-semibold text-primary">Sahyog Cooperative</p>
                  <p className="text-[11px] text-muted-foreground">platform + worker body, 216 member-owners</p>
                </div>
                <span className="self-center text-muted-foreground">↕</span>
                <div className="rounded-md border bg-muted/50 px-3.5 py-2.5 text-center">
                  <p className="font-semibold">Worker-members</p>
                  <p className="text-[11px] text-muted-foreground">fair earnings, welfare, a vote</p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {PILLARS.map((p) => (
                <div key={p.title} className="rounded-lg border bg-card p-4">
                  <p.icon className="h-4 w-4 text-primary" strokeWidth={2} />
                  <p className="mt-2 text-[13px] font-semibold">{p.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Role selection */}
        <section className="mt-12">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className="micro-label">Interactive prototype — choose an experience</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">Explore as</h2>
            </div>
            <p className="hidden text-xs text-muted-foreground sm:block">You can switch roles anytime from the header.</p>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {ROLE_CARDS.map((card) => {
              const user = session?.users[card.role];
              return (
                <button
                  key={card.role}
                  onClick={() => enter(card.role)}
                  className="group flex flex-col rounded-lg border bg-card p-5 text-left transition-colors hover:border-primary/40 hover:bg-[oklch(0.985_0.008_155)]"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-muted/50">
                      <card.icon className="h-[18px] w-[18px] text-primary" strokeWidth={1.9} />
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                  <p className="mt-4 text-[15px] font-semibold tracking-tight">{card.title}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                    {user && <PersonAvatar name={user.name} size="xs" className="h-5 w-5 text-[9px]" />}
                    {card.name}
                  </p>
                  <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{card.description}</p>
                  <ul className="mt-4 space-y-1.5 border-t pt-3">
                    {card.points.map((pt) => (
                      <li key={pt} className="flex items-start gap-2 text-[12.5px] text-foreground/85">
                        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[oklch(0.5_0.105_155)]" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
        </section>

        {/* How it works */}
        <section className="mt-12 rounded-lg border bg-card p-6">
          <p className="micro-label">How this prototype works</p>
          <div className="mt-3 grid gap-6 text-[13px] leading-relaxed text-muted-foreground sm:grid-cols-3">
            <p>
              <span className="font-medium text-foreground">Self-contained.</span> All data — members, bookings, payments,
              forecasts — is simulated by a local mock API. No real payments, verifications or identities are involved.
            </p>
            <p>
              <span className="font-medium text-foreground">One consistent session.</span> Actions carry across roles: book as
              the customer, accept and complete as the worker, and watch operations update for the admin — all in one browser session.
            </p>
            <p>
              <span className="font-medium text-foreground">Demo scenario.</span> Try the full journey: an urgent electrical
              repair in Kothrud → match → transparent payment → service execution → settlement → welfare credit → rating.
            </p>
          </div>
        </section>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-[11.5px] text-muted-foreground">
          <p>Sahyog Services Cooperative (fictional) · West Pune · Prototype for SIH26089 evaluation</p>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => enter("customer")}
          >
            Start the demo <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </footer>
      </div>
    </div>
  );
}
