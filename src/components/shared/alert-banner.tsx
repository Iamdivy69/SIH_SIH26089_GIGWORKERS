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
  /* Semantic tokens — surface, border and 3px severity accent all adapt to dark. */
  const styles = {
    critical: {
      wrap: "border-destructive/40 border-l-[3px] border-l-destructive bg-destructive-muted",
      icon: "text-destructive",
    },
    warning: {
      wrap: "border-warning/40 border-l-[3px] border-l-warning bg-warning-muted",
      icon: "text-warning",
    },
    info: {
      wrap: "border-info/40 border-l-[3px] border-l-info bg-info-muted",
      icon: "text-info",
    },
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
