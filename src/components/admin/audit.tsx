"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, ErrorState, PageHeader, SectionCard } from "@/components/shared";
import type { Column } from "@/components/shared";
import { FilterChips, FineNote, RoleChip, SeverityBadge } from "./ui";
import { useAuditLog } from "@/hooks/use-api";
import { num, relativeTime, dateTimeLabel } from "@/lib/format";
import type { AuditEntry } from "@/lib/types";

const SEVERITY_CHIPS = [
  { value: "all", label: "All events" },
  { value: "info", label: "Info" },
  { value: "notice", label: "Notice" },
  { value: "warning", label: "Warning" },
];

/** Audit log — append-only record of significant actions. */
export function AdminAuditScreen() {
  const audit = useAuditLog();
  const [severity, setSeverity] = useState("all");
  const [query, setQuery] = useState("");

  const items = audit.data?.items ?? [];

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const e of items) c[e.severity] = (c[e.severity] ?? 0) + 1;
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((e) => {
      if (severity !== "all" && e.severity !== severity) return false;
      if (!q) return true;
      return [e.actor, e.action, e.entity].join(" ").toLowerCase().includes(q);
    });
  }, [items, severity, query]);

  if (audit.isError) {
    return (
      <>
        <PageHeader eyebrow="Cooperative · audit" title="Audit log" />
        <ErrorState message="The audit log could not be loaded." onRetry={() => audit.refetch()} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Cooperative · audit"
        title="Audit log"
        description={
          audit.isLoading
            ? "Loading the audit trail…"
            : `${num(items.length)} significant actions recorded — verification decisions, policy changes, payouts, governance events. Append-only; entries cannot be edited or deleted.`
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterChips
          ariaLabel="Filter audit log by severity"
          value={severity}
          onChange={setSeverity}
          options={SEVERITY_CHIPS.map((c) => ({ ...c, count: counts[c.value] ?? 0 }))}
        />
        <div className="relative sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.9} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search actor, action, entity…"
            className="h-9 pl-8 text-[13px]"
            aria-label="Search audit log"
          />
        </div>
      </div>

      <SectionCard forTable>
        {audit.isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <div className="max-h-[560px] overflow-y-auto scroll-slim">
            <DataTable
              dense
              columns={auditColumns}
              rows={filtered}
              getRowKey={(e) => e.id}
              emptyTitle="No matching entries"
              emptyDescription="Adjust the severity filter or clear the search."
              mobileCard={(e) => (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2">
                      <RoleChip role={e.actorRole} />
                      <span className="text-[13px] font-medium">{e.actor}</span>
                    </span>
                    <SeverityBadge severity={e.severity} />
                  </div>
                  <p className="text-[13px] leading-snug">{e.action}</p>
                  <p className="tnum text-[11px] text-muted-foreground">
                    {e.entity} · {relativeTime(e.at)}
                  </p>
                </div>
              )}
            />
          </div>
        )}
      </SectionCard>

      <div className="mt-4 rounded-lg border bg-muted/30 p-4">
        <FineNote>
          The audit trail is retained for 24 months and exported nightly to the cooperative's shared drive. Members may request
          extracts relating to their own records — transparency obligations apply to the cooperative, not just the platform.
          (Simulated retention in the prototype.)
        </FineNote>
      </div>
    </>
  );
}

const auditColumns: Column<AuditEntry>[] = [
  {
    key: "when",
    header: "When",
    cell: (e) => (
      <div className="whitespace-nowrap">
        <p className="tnum leading-tight">{relativeTime(e.at)}</p>
        <p className="tnum text-[11px] text-muted-foreground">{dateTimeLabel(e.at)}</p>
      </div>
    ),
  },
  {
    key: "actor",
    header: "Actor",
    cell: (e) => (
      <div className="flex items-center gap-2">
        <span className="truncate font-medium">{e.actor}</span>
        <RoleChip role={e.actorRole} />
      </div>
    ),
  },
  { key: "action", header: "Action", cell: (e) => <span className="leading-snug">{e.action}</span> },
  {
    key: "entity",
    header: "Entity",
    cell: (e) => <span className="text-muted-foreground">{e.entity}</span>,
    hideOnTablet: true,
  },
  { key: "severity", header: "Severity", cell: (e) => <SeverityBadge severity={e.severity} /> },
];
