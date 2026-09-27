"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { DataTable, ErrorState, PageHeader, PersonAvatar, SectionCard } from "@/components/shared";
import type { Column } from "@/components/shared";
import { CATEGORY_NAMES, KpiStrip, KpiStripSkeleton } from "./ui";
import { useAdminTraining } from "@/hooks/use-api";
import { num } from "@/lib/format";
import type { AdminTrainingData } from "@/lib/types";
import { cn } from "@/lib/utils";

/* Local level badge — semantic tokens only. */
function LevelBadge({ level }: { level: "foundation" | "advanced" }) {
  return (
    <span
      className={cn(
        "inline-flex whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-[11px] font-medium",
        level === "advanced" ? "border-primary/35 bg-accent text-primary" : "border bg-muted text-muted-foreground",
      )}
    >
      {level === "advanced" ? "Advanced" : "Foundation"}
    </span>
  );
}

function categoryLabel(category: string): string {
  return category === "professional" ? "All trades" : (CATEGORY_NAMES[category] ?? category);
}

/** Training & skills coverage — the cooperative's investment in member growth. */
export function AdminTrainingScreen() {
  const q = useAdminTraining();

  if (q.isError) {
    return (
      <>
        <PageHeader eyebrow="Operations · learning" title="Training & skills" />
        <ErrorState message="The training coverage data could not be loaded." onRetry={() => void q.refetch()} />
      </>
    );
  }

  if (q.isLoading || !q.data) {
    return (
      <>
        <PageHeader
          eyebrow="Operations · learning"
          title="Training & skills"
          description="Coverage of the member base across the cooperative's certified training programmes."
        />
        <div className="space-y-6">
          <KpiStripSkeleton count={4} />
          <SectionCard title="By course" forTable>
            <div className="space-y-3 p-5">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          </SectionCard>
        </div>
      </>
    );
  }

  const data: AdminTrainingData = q.data;
  const c = data.coverage;

  const courseColumns: Column<AdminTrainingData["byCourse"][number]>[] = [
    {
      key: "course",
      header: "Course",
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-medium leading-snug">{r.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{categoryLabel(r.category)}</p>
        </div>
      ),
    },
    { key: "level", header: "Level", cell: (r) => <LevelBadge level={r.level} /> },
    { key: "enrolled", header: "Enrolled", align: "right", cell: (r) => <span className="tnum">{num(r.enrolled)}</span> },
    { key: "completed", header: "Completed", align: "right", cell: (r) => <span className="tnum">{num(r.completed)}</span> },
    {
      key: "rate",
      header: "Completion rate",
      align: "right",
      cell: (r) =>
        r.enrolled === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className={cn("tnum font-medium", r.completionRate >= 75 && "text-success")}>{r.completionRate}%</span>
        ),
    },
  ];

  const memberColumns: Column<AdminTrainingData["byMember"][number]>[] = [
    {
      key: "member",
      header: "Member",
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <PersonAvatar name={r.name} size="sm" />
          <span className="truncate font-medium">{r.name}</span>
        </span>
      ),
    },
    { key: "trade", header: "Trade", cell: (r) => <span className="text-muted-foreground">{r.trade}</span> },
    {
      key: "certificates",
      header: "Certificates",
      align: "right",
      cell: (r) => <span className={cn("tnum", r.certificates > 0 ? "font-medium text-success" : "text-muted-foreground")}>{num(r.certificates)}</span>,
    },
    {
      key: "active",
      header: "Active",
      align: "right",
      cell: (r) => <span className={cn("tnum", r.active === 0 && "text-muted-foreground")}>{num(r.active)}</span>,
    },
    {
      key: "hours",
      header: "Learning hours",
      align: "right",
      cell: (r) => <span className={cn("tnum", r.hoursCompleted === 0 && "text-muted-foreground")}>{num(r.hoursCompleted)}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Operations · learning"
        title="Training & skills"
        description="Coverage of the member base across the cooperative's certified training programmes — enrolments, completions and issued credentials. Course fees are funded from operations, never member fees."
      />

      <div className="space-y-6">
        <KpiStrip
          cells={[
            {
              label: "Members trained",
              value: num(c.membersWithTraining),
              sub: `of ${num(c.totalMembers)} members enrolled at least once`,
              tone: "default",
            },
            { label: "Active enrolments", value: num(c.activeEnrollments), sub: "Courses in progress right now" },
            { label: "Completions MTD", value: num(c.completionsThisMonth), sub: "Courses finished in the last 30 days" },
            { label: "Certificates issued", value: num(c.certificatesIssued), sub: "SCT-2025 credentials on member profiles" },
          ]}
        />

        <SectionCard
          title="By course"
          description="Enrolment and completion per programme — completion rate is green at 75% and above."
          forTable
        >
          <DataTable
            columns={courseColumns}
            rows={data.byCourse}
            getRowKey={(r) => r.courseId}
            dense
            emptyTitle="No courses in the catalogue"
            mobileCard={(r) => (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium leading-snug">{r.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {categoryLabel(r.category)} · {r.level === "advanced" ? "Advanced" : "Foundation"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tnum text-[13px] font-semibold">
                    {num(r.enrolled)} enrolled · {num(r.completed)} done
                  </p>
                  <p className={cn("tnum mt-0.5 text-xs", r.completionRate >= 75 && r.enrolled > 0 ? "text-success" : "text-muted-foreground")}>
                    {r.enrolled === 0 ? "No enrolments" : `${r.completionRate}% completion`}
                  </p>
                </div>
              </div>
            )}
          />
        </SectionCard>

        <SectionCard title="By member" description="Every member of the register — certificates earned, active courses and learning hours." forTable>
          <DataTable
            columns={memberColumns}
            rows={data.byMember}
            getRowKey={(r) => r.workerId}
            dense
            emptyTitle="No members"
            mobileCard={(r) => (
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <PersonAvatar name={r.name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{r.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.trade}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tnum text-[13px] font-semibold">
                    {num(r.certificates)} cert{r.certificates === 1 ? "" : "s"} · {num(r.active)} active
                  </p>
                  <p className="tnum mt-0.5 text-xs text-muted-foreground">{num(r.hoursCompleted)} learning hours</p>
                </div>
              </div>
            )}
          />
        </SectionCard>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Certificates are issued automatically when a member completes all modules (SCT-2025-###, sequential and auditable). The
          training fund allocation is set by member vote — see the live proposal in Governance. Assessments are simulated in this
          prototype.
        </p>
      </div>
    </>
  );
}
