"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Bell, Check, ChevronDown, ChevronRight, Menu, MessageSquareWarning, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAppStore, useRole, DEMO_USER_ID, ROLE_HOME } from "@/store/app-store";
import { useMarkNotificationsRead, useNotifications, useSession } from "@/hooks/use-api";
import { pageMeta, MOBILE_NAV } from "./nav";
import { PersonAvatar } from "@/components/shared";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Sidebar } from "./sidebar";

const KIND_ICON: Record<string, { icon: typeof Bell; className: string }> = {
  job: { icon: Bell, className: "text-primary" },
  payment: { icon: Check, className: "text-success" },
  verification: { icon: Check, className: "text-info" },
  governance: { icon: MessageSquareWarning, className: "text-warning" },
  booking: { icon: Bell, className: "text-primary" },
  system: { icon: Bell, className: "text-muted-foreground" },
  support: { icon: MessageSquareWarning, className: "text-destructive" },
};

/** Hydration-safe "is client" flag — false during SSR/hydration, true after mount. */
const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/**
 * Theme toggle — light is the default corporate identity; dark is an explicit
 * user choice that persists across reloads (next-themes localStorage).
 * The mounted guard keeps SSR and the first client render identical (light),
 * so the icon swap after hydration never triggers a mismatch warning.
 */
export function ThemeToggle({ variant = "icon", className }: { variant?: "icon" | "text"; className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const dark = mounted && resolvedTheme === "dark";
  const label = dark ? "Switch to light theme" : "Switch to dark theme";
  const toggle = () => setTheme(dark ? "light" : "dark");
  if (variant === "text") {
    return (
      <Button variant="outline" size="sm" className={cn("h-8 gap-2 px-3 text-[13px] font-medium", className)} onClick={toggle} aria-label={label}>
        {dark ? <Sun className="h-4 w-4" strokeWidth={1.9} /> : <Moon className="h-4 w-4" strokeWidth={1.9} />}
        {dark ? "Light mode" : "Dark mode"}
        <span className="sr-only">{label}</span>
      </Button>
    );
  }
  return (
    <Button variant="ghost" size="icon" className={cn("h-9 w-9 shrink-0", className)} onClick={toggle} aria-label={label} title={label}>
      {dark ? <Moon className="h-[18px] w-[18px]" strokeWidth={1.9} /> : <Sun className="h-[18px] w-[18px]" strokeWidth={1.9} />}
      <span className="sr-only">{label}</span>
    </Button>
  );
}

export function Header({ badges }: { badges: Record<string, number> }) {
  const role = useRole();
  const route = useAppStore((s) => s.route);
  const navigate = useAppStore((s) => s.navigate);
  const setMobileNavOpen = useAppStore((s) => s.setMobileNavOpen);
  const showWelcome = useAppStore((s) => s.showWelcome);
  const { data: session } = useSession();
  const { data: notifications } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const meta = pageMeta(route.name);
  const user = session?.users[role];

  const unread = notifications?.unread ?? 0;
  const items = useMemo(() => notifications?.items.slice(0, 12) ?? [], [notifications]);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:px-6">
      {/* Mobile nav */}
      <Button variant="ghost" size="icon" className="h-9 w-9 md:hidden" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </Button>

      {/* Context breadcrumb */}
      <div className="min-w-0 flex-1">
        {meta.section && (
          <p className="hidden text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground sm:block">
            {role === "customer" ? "Customer" : role === "worker" ? "Worker" : "Admin"} · {meta.section}
          </p>
        )}
        <p className="truncate text-sm font-semibold tracking-tight">{meta.title || "Welcome"}</p>
      </div>

      {/* Prototype indicator */}
      <span className="hidden items-center gap-1.5 rounded-sm border border-dashed px-2 py-1 text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground lg:inline-flex">
        <span className="h-1.5 w-1.5 rounded-full bg-warning" />
        Demo · simulated data
      </span>

      {/* Language readiness (display-only in prototype) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="hidden h-8 gap-1 px-2 text-xs text-muted-foreground sm:inline-flex">
            EN <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-xs">Interface language</DropdownMenuLabel>
          <DropdownMenuItem className="justify-between text-[13px]">English <span className="text-[10px] text-muted-foreground">active</span></DropdownMenuItem>
          <DropdownMenuItem className="justify-between text-[13px]">मराठी <span className="text-[10px] text-muted-foreground">roadmap</span></DropdownMenuItem>
          <DropdownMenuItem className="justify-between text-[13px]">हिंदी <span className="text-[10px] text-muted-foreground">roadmap</span></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Theme */}
      <ThemeToggle />

      {/* Notifications */}
      <Sheet open={useAppStore((s) => s.notificationsOpen)} onOpenChange={(open) => useAppStore.getState().setNotificationsOpen(open)}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}>
            <Bell className="h-[18px] w-[18px]" />
            {unread > 0 && (
              <span className="tnum absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[9.5px] font-bold text-primary-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full overflow-hidden p-0 sm:max-w-sm">
          <div className="flex h-full flex-col">
            <SheetHeader className="flex-row items-center justify-between space-y-0 border-b px-5 py-3.5">
              <SheetTitle className="text-[15px]">Notifications</SheetTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                /* ids (not all:true) so only this role's notifications are touched */
                onClick={() => markRead.mutate({ ids: (notifications?.items ?? []).map((n) => n.id) })}
                disabled={unread === 0}
              >
                <Check className="mr-1 h-3.5 w-3.5" /> Mark all read
              </Button>
            </SheetHeader>
            <div className="scroll-slim min-h-0 flex-1 overflow-y-auto">
              {items.length === 0 && <p className="px-5 py-10 text-center text-sm text-muted-foreground">You're all caught up.</p>}
              {items.map((n) => {
                const kind = KIND_ICON[n.kind] ?? KIND_ICON.system;
                return (
                  <button
                    key={n.id}
                    className={cn(
                      "flex w-full gap-3 border-b border-border/60 px-5 py-3.5 text-left transition-colors hover:bg-muted/50",
                      !n.read && "bg-primary-muted",
                    )}
                    onClick={() => {
                      markRead.mutate({ ids: [n.id] });
                      if (n.route) {
                        navigate(n.route.name, n.route.params);
                        useAppStore.getState().setNotificationsOpen(false);
                      }
                    }}
                  >
                    <kind.icon className={cn("mt-0.5 h-4 w-4 shrink-0", kind.className)} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={cn("truncate text-[13px]", n.read ? "font-medium" : "font-semibold")}>{n.title}</span>
                        <span className="shrink-0 text-[10.5px] text-muted-foreground">{relativeTime(n.createdAt)}</span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{n.body}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="border-t p-2.5">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center gap-1.5 text-[13px] text-primary"
                onClick={() => {
                  navigate(`${role}-notifications`);
                  useAppStore.getState().setNotificationsOpen(false);
                }}
              >
                View all notifications
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Role switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-md border bg-card px-2 py-1.5 transition-colors hover:bg-muted/60" aria-label="Switch demo role">
            <PersonAvatar name={user?.name ?? "Guest"} size="xs" />
            <span className="hidden text-left leading-tight sm:block">
              <span className="block max-w-[150px] truncate text-[12.5px] font-semibold" title={user?.name}>
                {user?.name ?? "Select a role"}
              </span>
              <span className="block text-[10.5px] capitalize text-muted-foreground">{role}</span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="text-xs">View the platform as</DropdownMenuLabel>
          {(["customer", "worker", "admin"] as const).map((r) => {
            const u = session?.users[r];
            return (
              <DropdownMenuItem
                key={r}
                className={cn("gap-2.5 py-2", role === r && "bg-accent")}
                onClick={() => navigate(ROLE_HOME[r])}
              >
                <PersonAvatar name={u?.name ?? r} size="xs" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{u?.name}</span>
                  <span className="block truncate text-[11px] capitalize text-muted-foreground">{r === "worker" ? u?.subtitle : u?.subtitle ?? r}</span>
                </span>
                {role === r && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-[13px]"
            onClick={() => {
              showWelcome();
              window.history.replaceState(null, "", window.location.pathname);
            }}
          >
            About this prototype
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

/** Mobile navigation: slide-over sidebar + bottom tab bar. */
export function MobileNav({ badges }: { badges: Record<string, number> }) {
  const role = useRole();
  const open = useAppStore((s) => s.mobileNavOpen);
  const setOpen = useAppStore((s) => s.setMobileNavOpen);
  const route = useAppStore((s) => s.route);
  const navigate = useAppStore((s) => s.navigate);
  const { data: notifications } = useNotifications();
  const tabs = MOBILE_NAV[role];
  const unread = notifications?.unread ?? 0;

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <Sidebar role={role} badges={badges} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Primary">
        {tabs.map((t) => {
          const active = route.name === t.route || route.name.startsWith(t.route);
          const badge = t.route === "worker-jobs" ? badges.offers ?? 0 : t.route.endsWith("-notifications") ? unread : 0;
          return (
            <button
              key={t.route}
              onClick={() => navigate(t.route)}
              aria-current={active ? "page" : undefined}
              className={cn("relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium", active ? "text-primary" : "text-muted-foreground")}
            >
              <t.icon className="h-5 w-5" strokeWidth={1.9} />
              {t.label}
              {badge > 0 && <span className="absolute right-[22%] top-1.5 h-2 w-2 rounded-full bg-primary" />}
            </button>
          );
        })}
      </nav>
    </>
  );
}

export function useSidebarBadges(): Record<string, number> {
  const role = useRole();
  const { data: notifications } = useNotifications();
  const badgeCount = notifications?.unread ?? 0;
  /* Role-specific badge sources are lightweight; hooks below self-disable by role */
  return { notifications: badgeCount, role };
}
