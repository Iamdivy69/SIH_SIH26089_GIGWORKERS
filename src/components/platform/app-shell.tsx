"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { DEMO_USER_ID, useAppStore, useRole, type Role } from "@/store/app-store";
import { Header, MobileNav } from "./header";
import { Sidebar } from "./sidebar";
import type { WorkerJobsData } from "@/hooks/use-api";
import type { GovernanceData, SupportTicket, Worker } from "@/lib/types";

/** Live sidebar badge counts, scoped to the active role's demo user. */
function useBadges(role: Role): Record<string, number> {
  const isWorker = role === "worker";
  const isAdmin = role === "admin";

  const jobs = useQuery({
    queryKey: ["worker-jobs", "badges"],
    queryFn: () => apiClient.get<WorkerJobsData>("worker/jobs", { user: DEMO_USER_ID.worker }),
    enabled: isWorker,
    staleTime: 10_000,
  });
  const governance = useQuery({
    queryKey: ["governance", "badges"],
    queryFn: () => apiClient.get<GovernanceData>("governance", { user: DEMO_USER_ID.worker }),
    enabled: isWorker,
    staleTime: 10_000,
  });
  const verifications = useQuery({
    queryKey: ["admin-verifications", "badges"],
    queryFn: () => apiClient.get<{ queue: { worker: Worker; daysInQueue: number }[] }>("admin/verifications", { user: DEMO_USER_ID.admin }),
    enabled: isAdmin,
    staleTime: 10_000,
  });
  const disputes = useQuery({
    queryKey: ["admin-disputes", "badges"],
    queryFn: () => apiClient.get<{ items: SupportTicket[] }>("admin/disputes", { user: DEMO_USER_ID.admin }),
    enabled: isAdmin,
    staleTime: 10_000,
  });

  return {
    offers: (jobs.data?.offers.length ?? 0) + (jobs.data?.openRequests.length ?? 0),
    unvoted: governance.data?.activeProposals.filter((p) => !p.myVote).length ?? 0,
    verifications: verifications.data?.queue.filter((q) => q.worker.status !== "rejected").length ?? 0,
    disputes: disputes.data?.items.filter((t) => t.status !== "resolved").length ?? 0,
  };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const role = useRole();
  const badges = useBadges(role);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 border-r md:block">
        <Sidebar role={role} badges={badges} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Header badges={badges} />
        <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-10">
          {children}
        </main>
        <footer className="mt-auto border-t bg-muted/30">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 text-[11.5px] text-muted-foreground sm:px-6">
            <p>
              Sahyog — Cooperative Gig Services Platform · Smart India Hackathon 2025 (SIH26089) · Interactive prototype, all data simulated
            </p>
            <p className="tnum">216 members · 8 neighbourhoods · West Pune</p>
          </div>
        </footer>
      </div>

      <MobileNav badges={badges} />
    </div>
  );
}

/** Scroll to top on route change */
export function useScrollTopOnRouteChange() {
  const route = useAppStore((s) => s.route);
  const key = JSON.stringify(route.params);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route.name, key]);
}
