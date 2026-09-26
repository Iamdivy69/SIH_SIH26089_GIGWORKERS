"use client";

import { NAV_BY_ROLE } from "./nav";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { BrandWordmark } from "./brand";

export function Sidebar({
  role,
  badges,
  onNavigate,
  className,
}: {
  role: "customer" | "worker" | "admin";
  badges: Record<string, number>;
  onNavigate?: () => void;
  className?: string;
}) {
  const route = useAppStore((s) => s.route);
  const navigate = useAppStore((s) => s.navigate);
  const groups = NAV_BY_ROLE[role];

  return (
    <div className={cn("flex h-full flex-col bg-sidebar", className)}>
      <div className="flex h-14 items-center border-b border-sidebar-border px-5">
        <button onClick={() => navigate(role === "customer" ? "customer-home" : role === "worker" ? "worker-dashboard" : "admin-overview")} className="text-left">
          <BrandWordmark />
        </button>
      </div>
      <nav className="scroll-slim flex-1 overflow-y-auto px-3 py-4" aria-label={`${role} navigation`}>
        {groups.map((group) => (
          <div key={group.label} className="mb-5 last:mb-1">
            <p className="micro-label px-2 pb-2">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = route.name === item.route;
                const badge = item.badgeKey ? badges[item.badgeKey] ?? 0 : 0;
                return (
                  <li key={item.route}>
                    <button
                      onClick={() => {
                        navigate(item.route);
                        onNavigate?.();
                      }}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex w-full items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13.5px] font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/75 hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <item.icon className={cn("h-[17px] w-[17px] shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} strokeWidth={1.9} />
                      <span className="flex-1 truncate text-left">{item.label}</span>
                      {badge > 0 && (
                        <span className="tnum inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10.5px] font-semibold text-primary-foreground">
                          {badge > 9 ? "9+" : badge}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-sidebar-border px-5 py-3.5">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Operated by <span className="font-medium text-foreground/80">Sahyog Services Cooperative</span>
          <br />
          West Pune · 216 member-owners
        </p>
      </div>
    </div>
  );
}
