"use client";

/**
 * Sahyog — Cooperative Gig Services Platform (SIH26089)
 * Single-route application shell. All experiences (customer / worker / admin)
 * are rendered client-side behind the hash router; see src/store/app-store.ts.
 */
import { Providers } from "@/components/platform/providers";
import { AppShell, useScrollTopOnRouteChange } from "@/components/platform/app-shell";
import { WelcomeScreen } from "@/components/platform/welcome-screen";
import { CustomerApp } from "@/components/customer/customer-app";
import { WorkerApp } from "@/components/worker/worker-app";
import { AdminApp } from "@/components/admin/admin-app";
import { useAppStore } from "@/store/app-store";

export default function Home() {
  return (
    <Providers>
      <Root />
    </Providers>
  );
}

function Root() {
  const welcomeSeen = useAppStore((s) => s.welcomeSeen);
  const route = useAppStore((s) => s.route);
  useScrollTopOnRouteChange();

  if (!welcomeSeen) {
    return <WelcomeScreen />;
  }

  return (
    <AppShell>
      {route.name.startsWith("customer-") && <CustomerApp route={route} />}
      {route.name.startsWith("worker-") && <WorkerApp route={route} />}
      {route.name.startsWith("admin-") && <AdminApp route={route} />}
    </AppShell>
  );
}
