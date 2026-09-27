"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, CalendarCheck, CircleDollarSign, LifeBuoy, MessageSquareWarning, Settings, ShieldAlert, Vote } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DEMO_USER_ID, useRole } from "@/store/app-store";
import { useLiveStore } from "@/store/live-store";
import type { AppNotification } from "@/lib/types";

/**
 * Real-time notification layer (socket.io → mini-services/notify, port 3030
 * through the Caddy gateway as io("/?XTransformPort=3030")).
 *
 * Design:
 *   - exactly one socket per browser tab, created once on mount and torn
 *     down on unmount — it outlives role switches (rooms re-subscribed);
 *   - the current demo role's user id decides which room the tab listens to;
 *     switching roles re-subscribes and re-registers the push handler so a
 *     notification is only toasted/invalidated for the role it belongs to;
 *   - pushes trigger a TanStack invalidation of ["notifications"] so the
 *     bell badge, sheet and screens refresh instantly; the 20s polling
 *     remains as a silent fallback for when the service is unreachable;
 *   - toasts are only shown for notifications not already present in the
 *     cache (a fresh publish can race a same-screen optimistic refetch —
 *     don't double-toast what the user just did themselves);
 *   - every socket failure path is silent by design (demo resilience):
 *     reconnection keeps retrying forever, the header indicator is the
 *     only visible signal of connection state.
 */

/** Wire shape pushed by mini-services/notify (subset of AppNotification). */
interface PushedNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  createdAt: string;
}

/**
 * Screens that should refresh when a pushed notification of a given kind
 * arrives — invalidating an unused query is a no-op, so these are safe to
 * fire regardless of which screen the tab is currently showing. This is
 * what makes the two-tab demo feel alive: the worker's *Job opportunities*
 * list itself grows the instant the customer books, without navigation.
 */
const KIND_INVALIDATIONS: Record<string, string[][]> = {
  job: [["worker-jobs"], ["worker-overview"]],
  booking: [["bookings"], ["customer-overview"], ["worker-jobs"]],
  payment: [["worker-earnings"], ["worker-welfare"], ["bookings"], ["customer-overview"]],
  governance: [["governance"], ["worker-dividend"], ["admin-governance"], ["worker-jobs"]],
  verification: [["admin-verifications"], ["admin-overview"]],
};

const KIND_TOAST_META: Record<string, { icon: LucideIcon; className: string }> = {
  job: { icon: CalendarCheck, className: "text-primary" },
  booking: { icon: CalendarCheck, className: "text-primary" },
  payment: { icon: CircleDollarSign, className: "text-success" },
  governance: { icon: Vote, className: "text-info" },
  verification: { icon: ShieldAlert, className: "text-info" },
  system: { icon: Settings, className: "text-muted-foreground" },
  support: { icon: LifeBuoy, className: "text-warning" },
};

export function LiveNotifications() {
  const role = useRole();
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  /* --- one socket per tab, reconnection forever --- */
  useEffect(() => {
    const socket = io("/?XTransformPort=3030", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2_000,
      reconnectionDelayMax: 8_000,
      timeout: 10_000,
    });
    socketRef.current = socket;

    const setConnected = useLiveStore.getState().setConnected;
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    return () => {
      setConnected(false);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  /* --- room subscription + push reaction, re-registered per role --- */
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const userId = DEMO_USER_ID[role];

    const onConnect = () => socket.emit("subscribe", { userId });
    if (socket.connected) onConnect();
    socket.on("connect", onConnect);

    const onNotification = (n: PushedNotification) => {
      const setLastEventAt = useLiveStore.getState().setLastEventAt;
      setLastEventAt(Date.now());

      /* refresh badge + sheet + every notifications screen… */
      void qc.invalidateQueries({ queryKey: ["notifications"] });
      /* …and the data surfaces the notification is about */
      for (const key of KIND_INVALIDATIONS[n.kind] ?? []) {
        void qc.invalidateQueries({ queryKey: key });
      }

      /* toast only genuinely-new items for the role currently on screen */
      const cached = qc.getQueryData<{ items: AppNotification[]; unread: number }>(["notifications", role]);
      const known = cached?.items.some((x) => x.id === n.id) ?? false;
      if (!known) {
        const meta = KIND_TOAST_META[n.kind] ?? { icon: Bell, className: "text-muted-foreground" };
        toast(n.title, {
          description: n.body,
          icon: <meta.icon className={meta.className} strokeWidth={1.9} aria-hidden />,
        });
      }
    };
    socket.on("notification", onNotification);

    return () => {
      socket.off("connect", onConnect);
      socket.off("notification", onNotification);
    };
  }, [role, qc]);

  return null;
}

/* ------------------------------------------------------------------ */
/* Header indicator                                                    */
/* ------------------------------------------------------------------ */

/**
 * LIVE pill for the header — the only visible surface of the push layer.
 *
 *   connected    → success dot + "Live"
 *   disconnected → warning dot + "Delayed" (polling fallback still works)
 *
 * `lastEventAt` triggers a brief dot pulse so pushes are noticeable even
 * with the bell off-screen. The pulse animation is a Tailwind transition
 * (honours prefers-reduced-motion via globals.css).
 */
export function LiveIndicator({ className }: { className?: string }) {
  const connected = useLiveStore((s) => s.connected);
  const pulse = useLivePulse();
  /* hydration-safe "is client" flag — the header's useMounted pattern
     (useSyncExternalStore keeps the effect lint rule happy) */
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  if (!mounted) return null;

  const label = connected ? "Live" : "Delayed";
  const title = connected
    ? "Real-time connection active — notifications arrive instantly."
    : "Real-time channel unavailable — notifications refresh every ~20 seconds.";

  return (
    <span
      className={className}
      role="status"
      aria-label={`Notifications: ${connected ? "real-time" : "delayed"}`}
      title={title}
    >
      <span className="relative flex h-1.5 w-1.5 items-center justify-center">
        {pulse && (
          <span
            className="absolute inline-flex h-3 w-3 rounded-full bg-success/50 motion-safe:animate-ping"
            aria-hidden
          />
        )}
        <span className={connected ? "h-1.5 w-1.5 rounded-full bg-success" : "h-1.5 w-1.5 rounded-full bg-warning"} aria-hidden />
      </span>
      <span className={connected ? "text-[10.5px] font-semibold uppercase tracking-wide text-success" : "text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground"}>
        {label}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Shared helpers + pulse hook                                         */
/* ------------------------------------------------------------------ */

const emptySubscribe = () => () => {};

/**
 * True for ~1.6 s after every pushed notification (lastEventAt) — used to
 * draw attention to the bell/badge and the mobile notifications tab the
 * moment something arrives live. Honours prefers-reduced-motion at the
 * usage sites (motion-safe: only).
 *
 * Lint-clean derivation: the boolean is computed at render time from the
 * external store value; the effect only schedules ONE deferred re-render
 * (setState inside the timer callback, never synchronously in the body)
 * to flip the window off after it expires.
 */
export function useLivePulse(): boolean {
  const lastEventAt = useLiveStore((s) => s.lastEventAt);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!lastEventAt) return;
    const t = setTimeout(() => setTick((x) => x + 1), 1_600);
    return () => clearTimeout(t);
  }, [lastEventAt]);

  return lastEventAt !== null && Date.now() - lastEventAt < 1_600;
}
