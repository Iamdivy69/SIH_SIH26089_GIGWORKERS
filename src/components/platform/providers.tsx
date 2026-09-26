"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { parseHash, useAppStore } from "@/store/app-store";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: true },
        },
      }),
  );

  /* Hash-based SPA routing: location.hash is the single source of truth.
     A valid deep link (e.g. #/worker-earnings) enters the app directly —
     the welcome console only appears on a bare root visit. */
  useEffect(() => {
    const apply = () => {
      const route = parseHash(window.location.hash);
      const store = useAppStore.getState();
      if (route) {
        store.setRoute(route);
        if (!store.welcomeSeen) store.dismissWelcome();
      }
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  return (
    <QueryClientProvider client={client}>
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster position="bottom-right" closeButton />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
