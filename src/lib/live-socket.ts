"use client";

import { io, type Socket } from "socket.io-client";
import { useLiveStore } from "@/store/live-store";

/**
 * The one shared socket.io connection per browser tab.
 *
 * Both real-time layers ride the same connection to mini-services/notify
 * (port 3030 through the Caddy gateway as io("/?XTransformPort=3030")):
 *
 *   - notification push  (platform/live-notifications.tsx — user room)
 *   - live booking chat  (shared/booking-chat.tsx — chat:<bookingId> rooms,
 *     typing indicator, presence)
 *
 * The singleton is created lazily on first use and lives for the whole tab:
 * screens mount/unmount freely, reconnection retries forever, and the only
 * visible connection signal is the header LIVE pill (fed through the live
 * store). Every failure path is silent by design — polling and query
 * invalidation remain the fallback.
 *
 * This module also owns the two GLOBAL listeners (presence broadcasts and
 * the presence snapshot on subscribe) so every part of the UI sees the same
 * online/offline map regardless of which screen is open.
 */

let socket: Socket | null = null;

export function getLiveSocket(): Socket {
  if (!socket) {
    socket = io("/?XTransformPort=3030", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 2_000,
      reconnectionDelayMax: 8_000,
      timeout: 10_000,
    });

    const setConnected = useLiveStore.getState().setConnected;
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    /* presence: global broadcasts ("someone came online / went offline") */
    socket.on("presence", (p: { userId: string; online: boolean }) => {
      if (typeof p?.userId === "string") {
        useLiveStore.getState().setPresence(p.userId, p.online);
      }
    });
  }
  return socket;
}
