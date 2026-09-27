"use client";

import type { AppRoute } from "@/store/app-store";
import { HomeScreen } from "./screens/home-screen";
import { DiscoverScreen } from "./screens/discover-screen";
import { WorkerScreen } from "./screens/worker-screen";
import { BookingFlowScreen } from "./screens/booking-flow";
import { BookingsScreen } from "./screens/bookings-screen";
import { BookingDetailScreen } from "./screens/booking-detail";
import { InvoiceScreen } from "./screens/invoice-screen";
import { PaymentsScreen } from "./screens/payments-screen";
import { SupportScreen } from "./screens/support-screen";
import { ProfileScreen } from "./screens/profile-screen";
import { NotificationCenterScreen } from "@/components/shared/notification-center";

/**
 * Customer platform — route switch.
 * Each screen lives in ./screens and receives the params it needs.
 * `key` props force a remount where deep-link params define the context.
 */
export function CustomerApp({ route }: { route: AppRoute }) {
  switch (route.name) {
    case "customer-home":
      return <HomeScreen />;
    case "customer-discover":
      return <DiscoverScreen key={route.params.category ?? "all"} categoryParam={route.params.category} />;
    case "customer-worker":
      return <WorkerScreen key={route.params.workerId} workerId={route.params.workerId} />;
    case "customer-book":
      return <BookingFlowScreen key={route.params.categoryId ?? "new"} categoryIdParam={route.params.categoryId} />;
    case "customer-bookings":
      return <BookingsScreen />;
    case "customer-booking":
      return <BookingDetailScreen key={route.params.bookingId} bookingId={route.params.bookingId} />;
    case "customer-invoice":
      return <InvoiceScreen key={route.params.bookingId} bookingId={route.params.bookingId} />;
    case "customer-payments":
      return <PaymentsScreen />;
    case "customer-support":
      return <SupportScreen />;
    case "customer-profile":
      return <ProfileScreen />;
    case "customer-notifications":
      return <NotificationCenterScreen role="customer" />;
    default:
      return <HomeScreen />;
  }
}
