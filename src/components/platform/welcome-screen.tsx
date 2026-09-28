"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  HeartPulse,
  HelpCircle,
  Landmark,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
  Vote,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "./brand";
import { Navbar } from "./Navbar";
import { ROLE_HOME, useAppStore } from "@/store/app-store";
import { useSession } from "@/hooks/use-api";
import { PersonAvatar } from "@/components/shared";
import "./HomePage.css";

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
  {
    icon: TrendingUp,
    title: "Intelligent allocation",
    text: "Explainable matching on skills, location, availability, rating and fair rotation — no black-box gig penalties.",
    metric: "96% Match Quality",
  },
  {
    icon: Wallet,
    title: "Transparent finance",
    text: "Every rupee traced: worker payout (85%), welfare fund (8%), cooperative operations (7%), and taxes.",
    metric: "85% Worker Payout",
  },
  {
    icon: HeartPulse,
    title: "Worker welfare",
    text: "Health cover, accident cover, pension reserve, and emergency micro-assistance built into every completed booking.",
    metric: "₹4.2L Reserve Fund",
  },
  {
    icon: Vote,
    title: "Member governance",
    text: "One member, one vote — democratic decisions on commission fees, benefits, dispute policies and annual surplus distribution.",
    metric: "1 Member, 1 Vote",
  },
];

const FAQS = [
  {
    q: "How does a worker cooperative differ from private gig apps?",
    a: "Private gig companies extract 20–35% platform commissions for outside shareholders. Sahyog is 100% owned by the service workers themselves — 85% goes directly to the worker, surplus is reinvested into member healthcare and pensions, and platform rules are voted on democratically.",
  },
  {
    q: "How does the explainable matching algorithm work?",
    a: "Instead of punishing workers with secret algorithms, Sahyog calculates an open match score based on trade certification, geographic proximity, calendar availability, and verified skill badges. Both workers and customers can see the breakdown.",
  },
  {
    q: "Where does the customer's payment go rupee-by-rupee?",
    a: "On every invoice, customers see an itemised receipt: Worker Base Compensation, Worker Welfare & Insurance Fund, Cooperative Tool & Training pool, and statutory GST. There are zero hidden convenience charges.",
  },
  {
    q: "Is this prototype fully interactive?",
    a: "Yes! The entire application runs client-side with a simulated backend. You can book an electrician as customer Ananya, accept the job as worker Priya, and view the operations, dispute queues and forecasts as admin Kiran — all in the same browser.",
  },
];

export function WelcomeScreen() {
  const navigate = useAppStore((s) => s.navigate);
  const dismissWelcome = useAppStore((s) => s.dismissWelcome);
  const { data: session } = useSession();
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const enter = (role: "customer" | "worker" | "admin") => {
    dismissWelcome();
    navigate(ROLE_HOME[role]);
  };

  /* 3D tilt perspective scroll animation */
  useEffect(() => {
    const handleScroll = () => {
      if (!imageContainerRef.current) return;
      const scrollY = window.scrollY;
      const maxScroll = 500;
      const progress = Math.min(scrollY / maxScroll, 1);
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
      const easedProgress = easeOutCubic(progress);

      const rotateX = 8 * (1 - easedProgress);
      const scale = 0.96 + 0.04 * easedProgress;
      const translateZ = -20 * (1 - easedProgress);
      const translateY = -20 * (1 - easedProgress);

      imageContainerRef.current.style.transform = `perspective(1200px) rotateX(${rotateX}deg) translateY(${translateY}px) scale(${scale}) translateZ(${translateZ}px)`;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="landing-container">
      {/* Floating Pill Navbar with preserved features */}
      <Navbar onEnter={enter} />

      {/* Hero Section */}
      <section className="hero-section" id="top">
        <div className="hero-content">
          {/* Trusted Badge */}
          <div className="slide-up" style={{ animationDelay: "0ms" }}>
            <div className="trusted-badge">
              <div className="avatar-group">
                <span className="avatar avatar-1">P</span>
                <span className="avatar avatar-2">A</span>
                <span className="avatar avatar-3">K</span>
              </div>
              <span className="trusted-text">Smart India Hackathon 2025 · SIH26089</span>
            </div>
          </div>

          {/* Heading — word-by-word reveal */}
          <h1 className="hero-title">
            {["Empowering", "Gig", "Workers"].map((word, i) => (
              <span
                key={word}
                className="word-blur-reveal"
                style={{ animationDelay: `${80 + i * 80}ms` }}
              >
                {word}&nbsp;
              </span>
            ))}
            <br />
            {["with", "our"].map((word, i) => (
              <span
                key={word}
                className="word-blur-reveal"
                style={{ animationDelay: `${320 + i * 80}ms` }}
              >
                {word}&nbsp;
              </span>
            ))}
            <span
              className="highlight-text word-blur-reveal"
              style={{ animationDelay: "480ms" }}
            >
              Cooperative&nbsp;
            </span>
            <span
              className="highlight-text word-blur-reveal"
              style={{ animationDelay: "560ms" }}
            >
              Platform
            </span>
          </h1>

          {/* Subtitle */}
          <p className="hero-subtitle blur-reveal" style={{ animationDelay: "680ms" }}>
            The household services platform owned by the workers themselves — fair earnings,
            comprehensive healthcare welfare, and democratic member governance.
          </p>

          {/* CTA Group */}
          <div className="hero-cta-group">
            <div className="slide-up" style={{ animationDelay: "820ms" }}>
              <button
                type="button"
                className="hero-cta-btn"
                onClick={() => {
                  const rolesEl = document.getElementById("roles");
                  if (rolesEl) {
                    rolesEl.scrollIntoView({ behavior: "smooth" });
                  } else {
                    enter("customer");
                  }
                }}
              >
                Explore Platform Demo
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            <div className="slide-up" style={{ animationDelay: "940ms" }}>
              <span className="hero-subtext">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                216 Member-Owners · 8 West Pune Neighbourhoods · All data simulated
              </span>
            </div>
          </div>
        </div>

        {/* Dashboard Showcase Card with 3D Perspective Scroll Tilt */}
        <div className="hero-image-wrapper">
          <div ref={imageContainerRef} className="hero-image-container">
            <div className="hero-dashboard-img">
              {/* Window chrome bar */}
              <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                  <span className="ml-2 font-mono text-[11px] font-medium text-foreground/80">
                    sahyog.coop/operations-console
                  </span>
                </div>
                <div className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                  Live Cooperative Ledger
                </div>
              </div>

              {/* Showcase content */}
              <div className="grid gap-4 p-5 sm:grid-cols-4 sm:p-6">
                <div className="rounded-xl border bg-card p-4 text-left shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Worker Share
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold text-foreground">85.0%</p>
                  <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                    +27% vs conventional platforms
                  </p>
                </div>
                <div className="rounded-xl border bg-card p-4 text-left shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Welfare Reserve
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold text-foreground">₹4,28,500</p>
                  <p className="mt-1 text-xs text-muted-foreground">Accident, health & pension pool</p>
                </div>
                <div className="rounded-xl border bg-card p-4 text-left shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Match Explainability
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold text-foreground">96.4%</p>
                  <p className="mt-1 text-xs text-muted-foreground">Multi-factor score with open audit</p>
                </div>
                <div className="rounded-xl border bg-card p-4 text-left shadow-sm">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Member Governance
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold text-foreground">1M · 1V</p>
                  <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                    92% turnout on Q1 policy vote
                  </p>
                </div>
              </div>

              {/* Mini workflow bar */}
              <div className="border-t bg-muted/20 px-6 py-4 text-left">
                <div className="flex flex-col items-start justify-between gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2">
                    <BrandMark size={20} />
                    <span className="font-semibold text-foreground">Sahyog Ecosystem Flow:</span>
                    <span>Verified Customer Booking</span>
                    <span>→</span>
                    <span className="font-medium text-primary">Explainable Matching</span>
                    <span>→</span>
                    <span>Instant Escrow Payout</span>
                    <span>→</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">Welfare Credit</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => enter("customer")}
                  >
                    Launch Demo Journey <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Prototype: Choose an Experience / Roles Section */}
      <section className="roles-section" id="roles">
        <div className="mb-6 flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <span className="features-badge">Choose an Experience</span>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Explore the Prototype
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Select any role to test end-to-end cooperative operations with pre-populated demo data.
            </p>
          </div>
          <span className="text-xs text-muted-foreground">Switch roles anytime from the top header.</span>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {ROLE_CARDS.map((card) => {
            const user = session?.users[card.role];
            return (
              <button
                type="button"
                key={card.role}
                onClick={() => enter(card.role)}
                className="group flex flex-col rounded-2xl border bg-card p-6 text-left transition-all hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-muted/60">
                    <card.icon className="h-5 w-5 text-primary" strokeWidth={2} />
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                </div>
                <p className="mt-4 text-base font-bold tracking-tight text-foreground">{card.title}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {user && <PersonAvatar name={user.name} size="xs" className="h-5 w-5 text-[9px]" />}
                  {card.name}
                </p>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{card.description}</p>
                <ul className="mt-4 space-y-1.5 border-t pt-3">
                  {card.points.map((pt) => (
                    <li key={pt} className="flex items-start gap-2 text-xs text-foreground/90">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      </section>

      {/* Unique Features / 4 Pillars Section */}
      <section className="features-section" id="features">
        <div className="features-header">
          <span className="features-badge">Cooperative Advantage</span>
          <h2 className="features-title">
            Built from the ground up for gig worker dignity
          </h2>
          <p className="features-subtitle">
            Conventional gig platforms act as rent-seeking middlemen. Sahyog aligns incentives so workers,
            customers, and the cooperative thrive together.
          </p>
        </div>

        <div className="features-grid">
          {PILLARS.map((p) => (
            <div key={p.title} className="feature-card">
              <div className="feature-img-box">
                <span className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-card text-primary shadow-sm">
                  <p.icon className="h-6 w-6" strokeWidth={2} />
                </span>
                <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs font-semibold text-primary">
                  {p.metric}
                </span>
              </div>
              <div className="feature-info">
                <h3 className="feature-card-title">{p.title}</h3>
                <p className="feature-card-desc">{p.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section" id="how-it-works">
        <div className="rounded-2xl border bg-card p-8 shadow-sm">
          <div className="mb-6">
            <span className="features-badge">Prototype Guide</span>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              How this prototype works
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A self-contained demonstration for the Smart India Hackathon 2025 jury.
            </p>
          </div>

          <div className="grid gap-6 text-xs leading-relaxed text-muted-foreground sm:grid-cols-3">
            <div className="rounded-xl border bg-muted/20 p-5">
              <p className="text-sm font-semibold text-foreground">1. Self-contained data</p>
              <p className="mt-2">
                All 216 members, bookings, payments, and demand forecasts are realistically simulated. No
                real credit cards or private credentials are required.
              </p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-5">
              <p className="text-sm font-semibold text-foreground">2. Cross-role continuity</p>
              <p className="mt-2">
                Actions persist across views: book a repair as customer Ananya, accept it as worker Priya,
                and observe operational metrics update immediately for admin Kiran.
              </p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-5">
              <p className="text-sm font-semibold text-foreground">3. End-to-end journey</p>
              <p className="mt-2">
                Walk through the full cycle: request service → explainable matching → transparent escrow →
                execution → welfare fund credit → rating and dividend allocation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section" id="faq">
        <div className="mb-8 text-center">
          <span className="features-badge">Common Questions</span>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Key questions regarding cooperative gig platforms and the prototype architecture.
          </p>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div key={faq.q} className="faq-card">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="flex w-full items-center justify-between text-left font-medium text-foreground"
                >
                  <span className="flex items-center gap-2.5 text-sm font-semibold">
                    <HelpCircle className="h-4 w-4 text-primary" />
                    {faq.q}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {isOpen && (
                  <p className="mt-3 pl-6.5 text-xs leading-relaxed text-muted-foreground">
                    {faq.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer Section */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="flex items-center gap-3">
            <BrandMark size={24} />
            <span>Sahyog Cooperative Services · Smart India Hackathon 2025 (SIH26089)</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline">West Pune · 8 Neighbourhoods</span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs font-semibold"
              onClick={() => enter("customer")}
            >
              Start the demo <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}
