"use client";

import { DEMO_USER_ID, useAppStore, roleOfRoute } from "@/store/app-store";

/**
 * Typed API client. Every call goes through /api/* so the mock handlers
 * in src/server can later be swapped for a production backend without
 * touching any UI code. The demo identity is derived from the active role.
 */
async function api<T>(
  path: string,
  options?: { method?: string; body?: unknown; user?: string },
): Promise<T> {
  const role = roleOfRoute(useAppStore.getState().route.name) ?? "customer";
  const res = await fetch(`/api/${path}`, {
    method: options?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      "x-demo-user": options?.user ?? DEMO_USER_ID[role],
    },
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  get: <T,>(path: string, opts?: { user?: string }) => api<T>(path, { user: opts?.user }),
  post: <T,>(path: string, body?: unknown, opts?: { user?: string }) => api<T>(path, { method: "POST", body, user: opts?.user }),
  put: <T,>(path: string, body?: unknown, opts?: { user?: string }) => api<T>(path, { method: "PUT", body, user: opts?.user }),
};
