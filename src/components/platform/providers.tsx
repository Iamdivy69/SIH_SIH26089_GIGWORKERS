"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { parseHash, useAppStore } from "@/store/app-store";
import { pageMeta } from "./nav";

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

  /* Live document title — every screen keeps the tab and history entries
     readable (e.g. "Tax invoice · Sahyog"); falls back to the brand title. */
  const routeName = useAppStore((s) => s.route.name);
  useEffect(() => {
    const meta = pageMeta(routeName);
    document.title = meta.title ? `${meta.title} · Sahyog` : "Sahyog — Cooperative Services Platform (SIH26089)";
  }, [routeName]);

  return (
    /* Theme is an explicit user choice — light-first corporate identity.
       attribute="class" flips the `.dark` token block in globals.css;
       enableColorScheme (default) also syncs `color-scheme` on <html>;
       persistence is automatic via localStorage ("theme"). */
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <QueryClientProvider client={client}>
        <TooltipProvider delayDuration={200}>
          {children}
          <Toaster position="bottom-right" closeButton />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
