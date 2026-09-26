"use client";

import { ArrowRight, Award, BookOpen, GraduationCap, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertBanner, PageHeader, SectionCard, StatTile, StatusBadge } from "@/components/shared";
import { useAppStore } from "@/store/app-store";
import { useGovernance, useSkills } from "@/hooks/use-api";
import { dateShort } from "@/lib/format";
import type { SkillCourse } from "@/lib/types";
import { QueryGate, simulatedToast } from "../parts";

function CourseCard({ course }: { course: SkillCourse }) {
  const completed = course.status === "completed";
  const inProgress = course.status === "in_progress";
  return (
    <article className="flex flex-wrap items-start justify-between gap-4 rounded-lg border bg-card p-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-semibold leading-tight tracking-tight">{course.title}</h3>
          {completed && course.certified && (
            <span className="inline-flex items-center gap-1 rounded-sm border border-success/40 bg-primary-muted px-1.5 py-0.5 text-[11px] font-medium text-success-deep">
              <Award className="h-3 w-3" strokeWidth={1.9} aria-hidden />
              Certified
            </span>
          )}
          {inProgress && <StatusBadge status="in_progress" label="In progress" />}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {course.provider} · <span className="tnum">{course.hours} hours</span> ·{" "}
          <span className="tnum">{course.creditValue} credits</span>
          {completed && course.completedAt && <span className="tnum"> · completed {dateShort(course.completedAt)}</span>}
        </p>
        {inProgress && (
          <div className="mt-3 max-w-sm">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-muted-foreground">Course progress</span>
              <span className="tnum font-medium">{course.progress}%</span>
            </div>
            <Progress value={course.progress} className="mt-1.5 h-1.5" />
          </div>
        )}
      </div>
      <div className="shrink-0">
        {completed && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => simulatedToast("Opening certificate", "Certificate PDF opens in the academy portal (simulated).")}
          >
            <Award className="h-3.5 w-3.5" strokeWidth={1.9} />
            Certificate
          </Button>
        )}
        {inProgress && (
          <Button size="sm" onClick={() => simulatedToast("Resuming course", "Solar Rooftop Installation Basics — module 3 of 8 opens.")}>
            <PlayCircle className="h-3.5 w-3.5" strokeWidth={1.9} />
            Resume
          </Button>
        )}
      </div>
    </article>
  );
}

export function WorkerSkills() {
  const navigate = useAppStore((s) => s.navigate);
  const q = useSkills();
  const governance = useGovernance();
  const trainingProposal = (governance.data?.activeProposals ?? []).find((p) => p.code === "PRO-2026-014");

  return (
    <div>
      <PageHeader
        eyebrow="Cooperative"
        title="Skill development"
        description="Fully-funded courses at the cooperative's skill academy — with wages paid for training hours on approved courses."
      />
      <QueryGate query={q}>
        {(data) => {
          const completed = data.courses.filter((c) => c.status === "completed");
          const inProgress = data.courses.filter((c) => c.status === "in_progress");
          const available = data.courses.filter((c) => c.status === "available");
          const hoursDone = completed.reduce((a, c) => a + c.hours, 0);

          return (
            <div className="space-y-6">
              {trainingProposal && (
                <AlertBanner
                  severity="info"
                  title="Training fund expansion is open for voting"
                  detail={`${trainingProposal.code}: ${trainingProposal.summary} Your vote decides 40 funded seats for electrical and appliance repair.`}
                  action="View & vote"
                  onAction={() => navigate("worker-governance")}
                />
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatTile label="Credits earned" value={data.credits} sub="Recognised across the cooperative" emphasis />
                <StatTile label="Courses completed" value={completed.length} sub={`${hoursDone} hours of certified training`} />
                <StatTile label="In progress" value={inProgress.length} sub="Solar rooftop installation basics" />
              </div>

              <SectionCard title="Completed" description="Certifications on your public profile.">
                <div className="space-y-3">
                  {completed.map((c) => (
                    <CourseCard key={c.id} course={c} />
                  ))}
                </div>
              </SectionCard>

              {inProgress.length > 0 && (
                <SectionCard title="In progress" description="Finish before the cohort window closes to earn the certificate.">
                  <div className="space-y-3">
                    {inProgress.map((c) => (
                      <CourseCard key={c.id} course={c} />
                    ))}
                  </div>
                </SectionCard>
              )}

              <SectionCard title="Available at the academy" description="Enroll through the app — seats confirmed within 2 working days.">
                <div className="space-y-3">
                  {available.map((c) => (
                    <article key={c.id} className="flex flex-wrap items-start justify-between gap-4 rounded-lg border bg-card p-5">
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-semibold leading-tight tracking-tight">{c.title}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {c.provider} · <span className="tnum">{c.hours} hours</span> ·{" "}
                          <span className="tnum">{c.creditValue} credits</span>
                        </p>
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <BookOpen className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />
                          Demand for this trade is forecast to exceed member capacity — priority matching for certified members.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => simulatedToast("Enrollment requested", `${c.title} — the academy team will confirm your batch within 2 working days.`)}
                      >
                        Enroll
                        <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.9} />
                      </Button>
                    </article>
                  ))}
                </div>
              </SectionCard>

              <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} />
                Course fees are covered by the cooperative's training fund — members contribute only their time. Fund allocation is decided
                by member vote in Governance.
              </p>
            </div>
          );
        }}
      </QueryGate>
    </div>
  );
}
