"use client";

import { create } from "zustand";

/**
 * Live-connection state, fed by <LiveNotifications /> (the socket.io client
 * mounted in Providers) and read by the header's LIVE indicator.
 *
 * `lastEventAt` is set whenever a pushed notification arrives — the header
 * uses it for a brief "pulse" affordance so pushes are visible even when
 * the bell is out of view.
 */

interface LiveState {
  connected: boolean;
  /** epoch ms of the most recent pushed notification, null before the first */
  lastEventAt: number | null;
  setConnected: (connected: boolean) => void;
  setLastEventAt: (at: number) => void;
}

export const useLiveStore = create<LiveState>((set) => ({
  connected: false,
  lastEventAt: null,
  setConnected: (connected) => set({ connected }),
  setLastEventAt: (lastEventAt) => set({ lastEventAt }),
}));
