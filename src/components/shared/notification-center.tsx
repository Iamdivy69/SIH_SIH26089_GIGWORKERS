"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarCheck,
  CheckCheck,
  CircleDollarSign,
  Inbox,
  LifeBuoy,
  Settings,
  ShieldAlert,
  Vote,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, PageHeader } from "@/components/shared";
import { useMarkNotificationsRead, useNotifications } from "@/hooks/use-api";
import { roleOfRoute, useAppStore, type Role } from "@/store/app-store";
import { useLiveStore } from "@/store/live-store";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppNotification, NotificationKind } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Static configuration                                                */
/* ------------------------------------------------------------------ */

interface NotificationFilter {
  id: string;
  label: string;
  /** null = every kind */
  kinds: NotificationKind[] | null;
}

const FILTERS: NotificationFilter[] = [
  { id: "all", label: "All", kinds: null },
  { id: "bookings", label: "Bookings & jobs", kinds: ["booking", "job"] },
  { id: "payments", label: "Payments", kinds: ["payment"] },
  { id: "governance", label: "Governance", kinds: ["governance", "verification"] },
  { id: "system", label: "System & support", kinds: ["system", "support"] },
];

/** Leading icon chip per notification kind — semantic, muted tones (dark-adaptive). */
const KIND_META: Record<NotificationKind, { icon: LucideIcon; chip: string; tone: string }> = {
  job: { icon: CalendarCheck, chip: "border-primary/40 bg-accent", tone: "text-primary" },
  booking: { icon: CalendarCheck, chip: "border-primary/40 bg-accent", tone: "text-primary" },
  payment: { icon: CircleDollarSign, chip: "border-success/40 bg-success-muted", tone: "text-success-deep" },
  governance: { icon: Vote, chip: "border-info/40 bg-info-muted", tone: "text-info" },
  verification: { icon: ShieldAlert, chip: "border-info/40 bg-info-muted", tone: "text-info" },
  system: { icon: Settings, chip: "border-border bg-muted/50", tone: "text-muted-foreground" },
  support: { icon: LifeBuoy, chip: "border-warning/40 bg-warning-muted", tone: "text-warning" },
};

const ROLE_META: Record<Role, { eyebrow: string; description: string; emptyAction: { label: string; route: string } }> = {
  customer: {
    eyebrow: "My activity",
    description:
      "Booking updates, payment receipts and account activity for your Sahyog household account.",
    emptyAction: { label: "Browse services", route: "customer-discover" },
  },
  worker: {
    eyebrow: "Support & account",
    description:
      "Job offers, payment settlements, governance votes and welfare updates for your member account.",
    emptyAction: { label: "View job opportunities", route: "worker-jobs" },
  },
  admin: {
    eyebrow: "Operations",
    description:
      "Operational alerts across bookings, verification, disputes and cooperative finance.",
    emptyAction: { label: "Open operations overview", route: "admin-overview" },
  },
};

const GROUP_ORDER = ["Today", "Yesterday", "This week", "Earlier"] as const;
type GroupLabel = (typeof GROUP_ORDER)[number];

const DAY_MS = 86_400_000;

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export function NotificationCenterScreen({ role }: { role: Role }) {
  const navigate = useAppStore((s) => s.navigate);
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const [filter, setFilter] = useState("all");

  const meta = ROLE_META[role];
  const unread = data?.unread ?? 0;

  const items = useMemo(
    () => [...(data?.items ?? [])].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [data],
  );
  const last24 = useMemo(() => {
    const now = Date.now();
    return items.filter((n) => now - new Date(n.createdAt).getTime() < DAY_MS).length;
  }, [items]);

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter) ?? FILTERS[0];
    const kinds = f?.kinds;
    return kinds ? items.filter((n) => kinds.includes(n.kind)) : items;
  }, [items, filter]);

  const groups = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const bucket = (iso: string): GroupLabel => {
      const t = new Date(iso).getTime();
      if (Number.isNaN(t)) return "Earlier";
      if (t >= startToday) return "Today";
      if (t >= startToday - DAY_MS) return "Yesterday";
      if (t >= startToday - 7 * DAY_MS) return "This week";
      return "Earlier";
    };
    const byGroup = new Map<GroupLabel, AppNotification[]>();
    for (const n of visible) {
      const g = bucket(n.createdAt);
      const arr = byGroup.get(g);
      if (arr) arr.push(n);
      else byGroup.set(g, [n]);
    }
    return GROUP_ORDER.map((label) => ({ label, items: byGroup.get(label) ?? [] })).filter((g) => g.items.length > 0);
  }, [visible]);

  const handleMarkAll = () => {
    if (unread === 0) return;
    /* optimistic — clear dots + header badge immediately, roll back on error */
    qc.setQueryData<{ items: AppNotification[]; unread: number }>(["notifications", role], (old) =>
      old ? { items: old.items.map((n) => ({ ...n, read: true })), unread: 0 } : old,
    );
    /* ids (not all:true) so only this role's notifications are touched —
       the server's `all` branch is not user-scoped */
    markRead.mutate(
      { ids: items.map((n) => n.id) },
      {
        onSuccess: () => toast.success("All notifications marked read"),
        onError: () => {
          void qc.invalidateQueries({ queryKey: ["notifications"] });
          toast.error("Couldn't mark notifications read", { description: "Please try again." });
        },
      },
    );
  };

  const handleRowOpen = (n: AppNotification) => {
    if (!n.read) markRead.mutate({ ids: [n.id] });
    if (n.route && roleOfRoute(n.route.name) === role) {
      navigate(n.route.name, n.route.params);
    }
  };

  const activeFilter = FILTERS.find((x) => x.id === filter) ?? FILTERS[0];

  return (
    <div>
      <PageHeader
        eyebrow={meta.eyebrow}
        title="Notifications"
        description={meta.description}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAll}
            disabled={unread === 0 || markRead.isPending}
          >
            <CheckCheck className="h-4 w-4" strokeWidth={1.9} />
            Mark all read
          </Button>
        }
      />

      {isError ? (
        <ErrorState message="Notifications could not be loaded." onRetry={() => refetch()} />
      ) : (
        <>
          {/* Filter chips + summary line */}
          {isLoading ? (
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                  <Skeleton key={f.id} className="h-8 w-24 rounded-full" />
                ))}
              </div>
              <Skeleton className="h-4 w-44" />
            </div>
          ) : (
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter notifications">
                {FILTERS.map((f) => {
                  const active = filter === f.id;
                  const kinds = f.kinds;
                  const count = kinds ? items.filter((n) => kinds.includes(n.kind)).length : items.length;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFilter(f.id)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:border-primary/40 hover:text-foreground",
                      )}
                    >
                      {f.label}
                      <span className={cn("tnum text-[11px]", active ? "text-primary-foreground/75" : "text-muted-foreground/75")}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground sm:shrink-0">
                <span className="tnum font-semibold text-foreground">{unread}</span> unread
                <span aria-hidden className="mx-2">·</span>
                <span className="tnum font-semibold text-foreground">{items.length}</span> total
                <span aria-hidden className="mx-2">·</span>
                <span className="tnum font-semibold text-foreground">{last24}</span> in the past 24 hours
                <LiveStatusLine className="mt-1.5" />
              </p>
            </div>
          )}

          {isLoading ? (
            <NotificationsSkeleton />
          ) : items.length === 0 ? (
            <EmptyState
              title="No notifications yet"
              description="We'll let you know the moment something needs your attention — bookings, payments, votes and cooperative updates."
              action={
                <Button variant="outline" size="sm" onClick={() => navigate(meta.emptyAction.route)}>
                  {meta.emptyAction.label}
                </Button>
              }
            />
          ) : visible.length === 0 ? (
            <EmptyState
              title={`Nothing under “${activeFilter.label}”`}
              description={`No ${activeFilter.label.toLowerCase()} notifications right now — new ones will appear here.`}
              action={
                <Button variant="outline" size="sm" onClick={() => setFilter("all")}>
                  Show all notifications
                </Button>
              }
            />
          ) : (
            <section className="overflow-hidden rounded-lg border bg-card" aria-label="Notifications by day">
              {groups.map((g, gi) => (
                <div key={g.label} className={gi > 0 ? "border-t" : undefined}>
                  <div className="flex items-center justify-between border-b bg-muted/30 px-5 py-2">
                    <p className="micro-label">{g.label}</p>
                    <p className="tnum text-[11px] font-medium text-muted-foreground">{g.items.length}</p>
                  </div>
                  <ul className="divide-y divide-border/60">
                    {g.items.map((n) => (
                      <NotificationRow key={n.id} n={n} onOpen={handleRowOpen} />
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Row                                                                 */
/* ------------------------------------------------------------------ */

function NotificationRow({ n, onOpen }: { n: AppNotification; onOpen: (n: AppNotification) => void }) {
  const meta = KIND_META[n.kind] ?? KIND_META.system;
  const Icon = meta.icon;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(n)}
        className={cn(
          "flex w-full items-start gap-3.5 rounded-md px-5 py-3.5 text-left transition-colors hover:bg-muted/50",
          !n.read && "bg-primary-muted shadow-[inset_3px_0_0_0_var(--primary)]",
        )}
      >
        <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border", meta.chip)}>
          <Icon className={cn("h-4 w-4", meta.tone)} strokeWidth={1.9} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className={cn("truncate text-sm font-semibold", n.read ? "text-muted-foreground" : "text-foreground")}>
              {n.title}
            </span>
            <span className="flex shrink-0 items-center gap-2.5">
              <span className="tnum text-[11px] text-muted-foreground">{relativeTime(n.createdAt)}</span>
              {!n.read && (
                <>
                  <span className="sr-only">Unread</span>
                  <span className="h-2 w-2 rounded-full bg-primary" aria-hidden />
                </>
              )}
            </span>
          </span>
          <span className="mt-0.5 block text-[13px] leading-relaxed text-muted-foreground line-clamp-2">{n.body}</span>
        </span>
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Loading skeleton — mirrors the grouped list layout                 */
/* ------------------------------------------------------------------ */

function NotificationsSkeleton() {
  const sections = [
    { header: 3, rows: 3 },
    { header: 2, rows: 2 },
  ];
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      {sections.map((s, gi) => (
        <div key={gi} className={gi > 0 ? "border-t" : undefined}>
          <div className="flex items-center justify-between border-b bg-muted/30 px-5 py-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-4" />
          </div>
          {Array.from({ length: s.rows }).map((_, i) => (
            <div key={i} className="flex items-start gap-3.5 border-b border-border/60 px-5 py-3.5 last:border-b-0">
              <Skeleton className="mt-0.5 h-8 w-8 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <Skeleton className="h-4 w-2/5" />
                  <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="h-3.5 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live connection status line (shared with the header pill state)     */
/* ------------------------------------------------------------------ */

/**
 * Small status line for the notifications screen — surfaces the real-time
 * push connection (or its polling fallback) exactly where it matters:
 * above the list the connection keeps fresh.
 */
function LiveStatusLine({ className }: { className?: string }) {
  const connected = useLiveStore((s) => s.connected);
  return (
    <span className={cn("flex items-center gap-1.5", className)} aria-label={`Real-time connection ${connected ? "active" : "unavailable"}`}>
      <span className={cn("h-1.5 w-1.5 rounded-full", connected ? "bg-success" : "bg-warning")} aria-hidden />
      <span className={connected ? "text-[11px] font-medium text-success" : "text-[11px] font-medium text-warning-deep"}>
        {connected
          ? "Live connection — notifications and chat messages arrive instantly"
          : "Real-time unavailable — refreshing every 20 seconds"}
      </span>
    </span>
  );
}
