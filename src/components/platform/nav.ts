import {
  BookOpenCheck,
  BriefcaseBusiness,
  CalendarDays,
  CalendarPlus,
  ClipboardList,
  Clock,
  GraduationCap,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  Receipt,
  Scale,
  ScrollText,
  Search,
  ShieldCheck,
  Shapes,
  SlidersHorizontal,
  TrendingUp,
  Users,
  Vote,
  Wallet,
  HeartPulse,
  Home,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  route: string;
  icon: LucideIcon;
  /** key into live badge counts provided by the shell */
  badgeKey?: "offers" | "notifications" | "verifications" | "disputes" | "unvoted";
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const CUSTOMER_NAV: NavGroup[] = [
  {
    label: "Services",
    items: [
      { label: "Home", route: "customer-home", icon: Home },
      { label: "Find services", route: "customer-discover", icon: Search },
      { label: "New request", route: "customer-book", icon: CalendarPlus },
    ],
  },
  {
    label: "My activity",
    items: [
      { label: "Bookings", route: "customer-bookings", icon: ClipboardList },
      { label: "Payments & invoices", route: "customer-payments", icon: Receipt },
      { label: "Support", route: "customer-support", icon: LifeBuoy },
    ],
  },
  {
    label: "Account",
    items: [{ label: "Profile", route: "customer-profile", icon: UserRound }],
  },
];

export const WORKER_NAV: NavGroup[] = [
  {
    label: "Work",
    items: [
      { label: "Dashboard", route: "worker-dashboard", icon: LayoutDashboard },
      { label: "Job opportunities", route: "worker-jobs", icon: BriefcaseBusiness, badgeKey: "offers" },
      { label: "My schedule", route: "worker-schedule", icon: CalendarDays },
      { label: "Availability", route: "worker-availability", icon: Clock },
    ],
  },
  {
    label: "Earnings & benefits",
    items: [
      { label: "Earnings", route: "worker-earnings", icon: Wallet },
      { label: "Welfare & benefits", route: "worker-welfare", icon: HeartPulse },
    ],
  },
  {
    label: "Cooperative",
    items: [
      { label: "Governance", route: "worker-governance", icon: Vote, badgeKey: "unvoted" },
      { label: "Verification", route: "worker-verification", icon: ShieldCheck },
      { label: "Skill development", route: "worker-skills", icon: GraduationCap },
    ],
  },
  {
    label: "Support & account",
    items: [
      { label: "Support", route: "worker-support", icon: LifeBuoy },
      { label: "Profile", route: "worker-profile", icon: UserRound },
    ],
  },
];

export const ADMIN_NAV: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { label: "Overview", route: "admin-overview", icon: LayoutDashboard },
      { label: "Demand forecast", route: "admin-forecast", icon: TrendingUp },
      { label: "Bookings", route: "admin-bookings", icon: ClipboardList },
    ],
  },
  {
    label: "Workforce",
    items: [
      { label: "Workers", route: "admin-workers", icon: Users },
      { label: "Verification queue", route: "admin-verifications", icon: ShieldCheck, badgeKey: "verifications" },
    ],
  },
  {
    label: "Resolution",
    items: [{ label: "Disputes & support", route: "admin-disputes", icon: Scale, badgeKey: "disputes" }],
  },
  {
    label: "Cooperative",
    items: [
      { label: "Finance", route: "admin-finance", icon: Landmark },
      { label: "Governance", route: "admin-governance", icon: Vote },
      { label: "Service catalogue", route: "admin-categories", icon: Shapes },
      { label: "Policies", route: "admin-policies", icon: SlidersHorizontal },
      { label: "Audit log", route: "admin-audit", icon: ScrollText },
    ],
  },
];

export const NAV_BY_ROLE = {
  customer: CUSTOMER_NAV,
  worker: WORKER_NAV,
  admin: ADMIN_NAV,
};

/** Mobile bottom navigation — primary destinations per role. */
export const MOBILE_NAV = {
  customer: [
    { label: "Home", route: "customer-home", icon: Home },
    { label: "Find", route: "customer-discover", icon: Search },
    { label: "Book", route: "customer-book", icon: CalendarPlus },
    { label: "Bookings", route: "customer-bookings", icon: ClipboardList },
  ],
  worker: [
    { label: "Dashboard", route: "worker-dashboard", icon: LayoutDashboard },
    { label: "Jobs", route: "worker-jobs", icon: BriefcaseBusiness },
    { label: "Schedule", route: "worker-schedule", icon: CalendarDays },
    { label: "Earnings", route: "worker-earnings", icon: Wallet },
  ],
  admin: [
    { label: "Overview", route: "admin-overview", icon: LayoutDashboard },
    { label: "Forecast", route: "admin-forecast", icon: TrendingUp },
    { label: "Workers", route: "admin-workers", icon: Users },
    { label: "Cases", route: "admin-disputes", icon: Scale },
  ],
};

export function pageMeta(routeName: string): { section: string; title: string } {
  for (const group of [...CUSTOMER_NAV, ...WORKER_NAV, ...ADMIN_NAV]) {
    const item = group.items.find((i) => i.route === routeName);
    if (item) return { section: group.label, title: item.label };
  }
  return { section: "", title: "" };
}

export { BookOpenCheck };
