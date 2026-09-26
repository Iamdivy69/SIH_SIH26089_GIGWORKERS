"use client";

import { create } from "zustand";

export type Role = "customer" | "worker" | "admin";

export interface AppRoute {
  name: string;
  params: Record<string, string>;
}

/**
 * Route registry: name → ordered param keys (for hash deep links).
 * Screen components are resolved by each role app.
 */
export const ROUTE_PARAMS: Record<string, string[]> = {
  "customer-home": [],
  "customer-discover": ["category"],
  "customer-worker": ["workerId"],
  "customer-book": ["categoryId"],
  "customer-bookings": [],
  "customer-booking": ["bookingId"],
  "customer-payments": [],
  "customer-support": [],
  "customer-profile": [],
  "customer-notifications": [],
  "worker-dashboard": [],
  "worker-jobs": [],
  "worker-job": ["bookingId"],
  "worker-schedule": [],
  "worker-availability": [],
  "worker-earnings": [],
  "worker-welfare": [],
  "worker-governance": [],
  "worker-verification": [],
  "worker-skills": [],
  "worker-support": [],
  "worker-profile": [],
  "worker-notifications": [],
  "admin-overview": [],
  "admin-forecast": [],
  "admin-workers": [],
  "admin-verifications": [],
  "admin-bookings": [],
  "admin-disputes": [],
  "admin-finance": [],
  "admin-governance": [],
  "admin-categories": [],
  "admin-audit": [],
  "admin-policies": [],
  "admin-notifications": [],
};

export const ROLE_HOME: Record<Role, string> = {
  customer: "customer-home",
  worker: "worker-dashboard",
  admin: "admin-overview",
};

export function roleOfRoute(name: string): Role | null {
  if (name.startsWith("customer-")) return "customer";
  if (name.startsWith("worker-")) return "worker";
  if (name.startsWith("admin-")) return "admin";
  return null;
}

/** The demo identities active in this prototype session. */
export const DEMO_USER_ID: Record<Role, string> = {
  customer: "c-ananya",
  worker: "w-priya",
  admin: "u-admin",
};

export function parseHash(hash: string): AppRoute | null {
  const clean = hash.replace(/^#\/?/, "").replace(/\/$/, "");
  if (!clean) return null;
  const segments = clean.split("/").map(decodeURIComponent);
  const name = segments[0];
  const keys = ROUTE_PARAMS[name];
  if (!keys) return null;
  const params: Record<string, string> = {};
  keys.forEach((k, i) => {
    if (segments[i + 1] !== undefined) params[k] = segments[i + 1];
  });
  return { name, params };
}

export function buildHash(name: string, params?: Record<string, string>): string {
  const keys = ROUTE_PARAMS[name] ?? [];
  const values = keys.map((k) => encodeURIComponent(params?.[k] ?? "")).filter((v) => v !== "");
  return `#/${[name, ...values].join("/")}`;
}

interface AppState {
  route: AppRoute;
  history: string[];
  welcomeSeen: boolean;
  notificationsOpen: boolean;
  mobileNavOpen: boolean;
  /** Set on hashchange / navigate */
  setRoute: (route: AppRoute) => void;
  navigate: (name: string, params?: Record<string, string>) => void;
  back: () => void;
  dismissWelcome: () => void;
  showWelcome: () => void;
  setNotificationsOpen: (open: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
}

const initialRoute: AppRoute = { name: "customer-home", params: {} };

export const useAppStore = create<AppState>((set, get) => ({
  route: initialRoute,
  history: [],
  welcomeSeen: false,
  notificationsOpen: false,
  mobileNavOpen: false,
  setRoute: (route) =>
    set((s) => ({
      route,
      history: [...s.history.slice(-20), route.name],
      mobileNavOpen: false,
      notificationsOpen: false,
    })),
  navigate: (name, params) => {
    const hash = buildHash(name, params);
    if (window.location.hash === hash) {
      /* same hash — set state directly so actions can re-trigger */
      const keys = ROUTE_PARAMS[name] ?? [];
      const parsed: AppRoute = { name, params: params ?? {} };
      void keys;
      get().setRoute(parsed);
    } else {
      window.location.hash = hash;
    }
  },
  back: () => window.history.back(),
  dismissWelcome: () => set({ welcomeSeen: true }),
  showWelcome: () => set({ welcomeSeen: false }),
  setNotificationsOpen: (open) => set({ notificationsOpen: open }),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
}));

/** Current role derived from the active route. */
export function useRole(): Role {
  return roleOfRoute(useAppStore((s) => s.route.name)) ?? "customer";
}

export function useCurrentUserId(): string {
  const role = useRole();
  return DEMO_USER_ID[role];
}
