/**
 * Server-side push bridge → mini-services/notify (port 3031, loopback only).
 *
 * Called from `notify()` / `addBookingMessage()` in src/server/db.ts so
 * EVERY notification created through the mock API (booking confirmations,
 * settlements, vote calls, dividend credits, …) and every stored chat
 * message is also pushed to connected browser tabs in real time. Strictly
 * best-effort:
 *
 *   - fire-and-forget: the caller never awaits the POST and never sees
 *     an error — if the service is down the app silently falls back to
 *     the frontend's 20s notification polling;
 *   - bounded: at most 16 concurrent in-flight publishes (guard against
 *     pathological loops), extras are dropped without throwing;
 *   - short timeout: a stuck control server must never hold a request.
 */

const NOTIFY_CONTROL_URL = "http://127.0.0.1:3031/publish";
const CHAT_CONTROL_URL = "http://127.0.0.1:3031/chat";

const MAX_INFLIGHT = 16;
const TIMEOUT_MS = 1_500;

let inflight = 0;

/** Minimal notification shape accepted by the push service. */
export interface PushedNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  createdAt: string;
  /** Deep-link target, used by the frontend to refresh the right screen. */
  route?: { name: string; params?: Record<string, string> };
}

/** Minimal booking-message shape accepted by the push service. */
export interface PushedChatMessage {
  id: string;
  authorRole: string;
  authorName: string;
  text: string;
  at: string;
}

export function publishNotification(userId: string, n: PushedNotification): void {
  if (inflight >= MAX_INFLIGHT) return;
  inflight += 1;

  fetch(NOTIFY_CONTROL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, notification: n }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  })
    .catch(() => {
      /* service down or slow — polling fallback covers delivery */
    })
    .finally(() => {
      inflight -= 1;
    });
}

/**
 * Fan a freshly-stored booking chat message out to every tab that has that
 * booking's chat open (room `chat:<bookingId>`). Same best-effort contract as
 * publishNotification: fire-and-forget, silent when the service is down —
 * the thread then simply refreshes through query invalidation/polling.
 */
export function publishChatMessage(bookingId: string, message: PushedChatMessage): void {
  if (inflight >= MAX_INFLIGHT) return;
  inflight += 1;

  fetch(CHAT_CONTROL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId, message }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  })
    .catch(() => {
      /* service down or slow — invalidation fallback covers the thread */
    })
    .finally(() => {
      inflight -= 1;
    });
}
