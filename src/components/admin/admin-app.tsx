"use client";

import type { AppRoute } from "@/store/app-store";
import { AdminOverviewScreen } from "./overview";
import { AdminForecastScreen } from "./forecast";
import { AdminWorkersScreen } from "./workers";
import { AdminVerificationsScreen } from "./verifications";
import { AdminBookingsScreen } from "./bookings";
import { AdminDisputesScreen } from "./disputes";
import { AdminFinanceScreen } from "./finance";
import { AdminGovernanceScreen } from "./governance";
import { AdminCategoriesScreen } from "./categories";
import { AdminPoliciesScreen } from "./policies";
import { AdminAuditScreen } from "./audit";

/** Cooperative admin platform — route switch. */
export function AdminApp({ route }: { route: AppRoute }) {
  switch (route.name) {
    case "admin-overview":
      return <AdminOverviewScreen />;
    case "admin-forecast":
      return <AdminForecastScreen />;
    case "admin-workers":
      return <AdminWorkersScreen />;
    case "admin-verifications":
      return <AdminVerificationsScreen />;
    case "admin-bookings":
      return <AdminBookingsScreen />;
    case "admin-disputes":
      return <AdminDisputesScreen />;
    case "admin-finance":
      return <AdminFinanceScreen />;
    case "admin-governance":
      return <AdminGovernanceScreen />;
    case "admin-categories":
      return <AdminCategoriesScreen />;
    case "admin-policies":
      return <AdminPoliciesScreen />;
    case "admin-audit":
      return <AdminAuditScreen />;
    default:
      return <AdminOverviewScreen />;
  }
}
