"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EmptyState } from "./states";

export interface Column<T> {
  key: string;
  header: string;
  /** Right-align (amounts, scores) */
  align?: "left" | "right" | "center";
  cell: (row: T) => ReactNode;
  className?: string;
  /** Hide below md to keep mobile readable */
  hideOnTablet?: boolean;
  /** Hide below lg */
  hideOnDesktop?: boolean;
}

/**
 * House data table: 13px rows, micro-label headers, hairline dividers,
 * quiet hover. On mobile the table scrolls inside its card; pass
 * `mobileCard` to render proper stacked cards instead.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  mobileCard,
  className,
  dense,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  mobileCard?: (row: T) => ReactNode;
  className?: string;
  dense?: boolean;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} className={cn("border-0 bg-transparent", className)} />;
  }
  return (
    <div className={cn(mobileCard && "hidden md:block", !mobileCard && "block", className)}>
      <div className="overflow-x-auto scroll-slim">
        <table className="w-full min-w-[560px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "micro-label px-4 py-2.5 text-left font-medium",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    col.hideOnTablet && "hidden lg:table-cell",
                    col.hideOnDesktop && "hidden xl:table-cell",
                    col.className,
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={getRowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-border/70 last:border-0",
                  onRowClick && "cursor-pointer transition-colors hover:bg-muted/60",
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-4 align-middle",
                      dense ? "py-2" : "py-3",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      col.hideOnTablet && "hidden lg:table-cell",
                      col.hideOnDesktop && "hidden xl:table-cell",
                      col.className,
                    )}
                  >
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Mobile companion list for DataTable (rendered below md). */
export function MobileRows<T>({ rows, getRowKey, render }: { rows: T[]; getRowKey: (row: T) => string; render: (row: T) => ReactNode }) {
  if (rows.length === 0) return null;
  return (
    <div className="divide-y md:hidden">
      {rows.map((row) => (
        <div key={getRowKey(row)} className="px-4 py-3">
          {render(row)}
        </div>
      ))}
    </div>
  );
}
