"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  forTable,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  forTable?: boolean;
}) {
  return (
    <section className={cn("rounded-lg border bg-card", forTable && "min-w-0 overflow-hidden", className)}>
      {(title || actions) && (
        <header className={cn("flex flex-wrap items-start justify-between gap-3 px-5 pt-4", description ? "pb-2" : "pb-4")}>
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold leading-tight tracking-tight">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(forTable ? "px-0 pb-0" : "px-5 pb-5 pt-1", description && !title && "pt-2", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}
