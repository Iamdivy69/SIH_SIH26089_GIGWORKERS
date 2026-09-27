"use client";

import { create } from "zustand";

/**
 * Live-connection state, fed by the shared socket (<LiveNotifications /> /
 * <BookingChat /> via lib/live-socket.ts) and read by the header's LIVE
 * indicator and the chat presence line.
 *
 * - `connected`     — is the socket.io transport up right now
 * - `lastEventAt`   — epoch ms of the most recent pushed notification; the
 *                     header uses it for a brief "pulse" affordance
 * - `presence`      — which demo users are currently connected (online map,
 *                     maintained from `presence` broadcasts + the subscribe
 *                     snapshot; demo-scoped, see mini-services/notify)
 * - `openChatBookingId` — the booking whose chat thread is currently open in
 *                     THIS tab, used to suppress the notification toast for
 *                     messages that just arrived in that open thread
 */

interface LiveState {
  connected: boolean;
  /** epoch ms of the most recent pushed notification, null before the first */
  lastEventAt: number | null;
  /** userId → online (true only while at least one tab is subscribed as them) */
  presence: Record<string, boolean>;
  /** booking id of the chat thread this tab currently has open, if any */
  openChatBookingId: string | null;
  setConnected: (connected: boolean) => void;
  setLastEventAt: (at: number) => void;
  setPresence: (userId: string, online: boolean) => void;
  applyPresenceSnapshot: (online: string[]) => void;
  setOpenChatBookingId: (bookingId: string | null) => void;
}

export const useLiveStore = create<LiveState>((set) => ({
  connected: false,
  lastEventAt: null,
  presence: {},
  openChatBookingId: null,
  setConnected: (connected) => set({ connected }),
  setLastEventAt: (lastEventAt) => set({ lastEventAt }),
  setPresence: (userId, online) =>
    set((s) => (s.presence[userId] === online ? s : { presence: { ...s.presence, [userId]: online } })),
  applyPresenceSnapshot: (online) => {
    const next: Record<string, boolean> = {};
    for (const id of online) next[id] = true;
    set({ presence: next });
  },
  setOpenChatBookingId: (openChatBookingId) => set({ openChatBookingId }),
}));
