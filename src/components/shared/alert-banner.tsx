"use client";

import { ReactNode } from "react";
import { AlertTriangle, CircleAlert, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function AlertBanner({
  severity,
  title,
  detail,
  action,
  onAction,
  className,
}: {
  severity: "critical" | "warning" | "info";
  title: string;
  detail?: ReactNode;
  action?: string;
  onAction?: () => void;
  className?: string;
}) {
  const styles = {
    critical: { wrap: "border-[oklch(0.90_0.04_27)] bg-[oklch(0.955_0.018_27)]", icon: "text-[oklch(0.525_0.185_27)]" },
    warning: { wrap: "border-[oklch(0.90_0.06_80)] bg-[oklch(0.965_0.035_85)]", icon: "text-[oklch(0.55_0.12_65)]" },
    info: { wrap: "border-[oklch(0.89_0.015_240)] bg-[oklch(0.955_0.008_240)]", icon: "text-[oklch(0.47_0.03_240)]" },
  }[severity];
  const Icon = severity === "info" ? Info : severity === "warning" ? AlertTriangle : CircleAlert;

  return (
    <div className={cn("flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3", styles.wrap, className)}>
      <Icon className={cn("h-4 w-4 shrink-0", styles.icon)} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium">{title}</p>
        {detail && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{detail}</p>}
      </div>
      {action && onAction && (
        <Button variant="outline" size="sm" className="h-7 shrink-0 text-xs" onClick={onAction}>
          {action}
        </Button>
      )}
    </div>
  );
}
