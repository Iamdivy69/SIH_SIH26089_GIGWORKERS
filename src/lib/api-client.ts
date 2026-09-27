import { DEMO_USER_ID, useAppStore, roleOfRoute } from "@/store/app-store";

/**
 * Typed API client. Every call goes through /api/* so the mock handlers
 * in src/server can later be swapped for a production backend without
 * touching any UI code.
 *
 * In dev, the Vite dev server plugin handles /api/* directly.
 * If running on a static host without a backend server, it automatically
 * falls back to executing the mock API in-memory.
 */
async function api<T>(
  path: string,
  options?: { method?: string; body?: unknown; user?: string },
): Promise<T> {
  const role = roleOfRoute(useAppStore.getState().route.name) ?? "customer";
  const user = options?.user ?? DEMO_USER_ID[role];
  const method = options?.method ?? "GET";

  try {
    const res = await fetch(`/api/${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-demo-user": user,
      },
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const contentType = res.headers.get("content-type") || "";
    if (res.ok && contentType.includes("application/json")) {
      return (await res.json()) as T;
    }
    if (!res.ok && contentType.includes("application/json")) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error ?? `Request failed (${res.status})`);
    }
  } catch (err: any) {
    if (err?.message && !err.message.includes("Failed to fetch") && !err.message.includes("NetworkError")) {
      throw err;
    }
  }

  // Seamless in-memory client fallback if no backend server is listening
  const { handle } = await import("@/server/api");
  const [cleanPath] = path.split("?");
  const slug = cleanPath.split("/").filter(Boolean);
  const fullUrl = `http://localhost/api/${path}`;
  const req = new Request(fullUrl, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-demo-user": user,
    },
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const res = await handle(req, slug);
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export const apiClient = {
  get: <T,>(path: string, opts?: { user?: string }) => api<T>(path, { user: opts?.user }),
  post: <T,>(path: string, body?: unknown, opts?: { user?: string }) => api<T>(path, { method: "POST", body, user: opts?.user }),
  put: <T,>(path: string, body?: unknown, opts?: { user?: string }) => api<T>(path, { method: "PUT", body, user: opts?.user }),
};
