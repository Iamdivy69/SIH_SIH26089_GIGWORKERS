"use client";

import { Award, BookOpen, CalendarDays, GraduationCap, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, SectionCard, StatTile } from "@/components/shared";
import { useAppStore } from "@/store/app-store";
import { useCompleteCourse, useCourseProgress, useEnrollCourse, useWorkerTraining } from "@/hooks/use-api";
import { dateShort, num } from "@/lib/format";
import type { TrainingCourse } from "@/lib/types";
import { cn } from "@/lib/utils";
import { QueryGate } from "./parts";

/* ------------------------------------------------------------------ */
/* Local presentation pieces (semantic tokens only — dark-mode ready)  */
/* ------------------------------------------------------------------ */

const FORMAT_LABEL: Record<TrainingCourse["format"], string> = {
  "in-person": "In-person",
  online: "Online",
  hybrid: "Hybrid",
};

function LevelBadge({ level }: { level: TrainingCourse["level"] }) {
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

function SkillChips({ skills }: { skills: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((s) => (
        <span key={s} className="rounded-sm border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {s}
        </span>
      ))}
    </div>
  );
}

/** Green progress on a muted track — the one progress treatment on the page. */
function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-success transition-[width] duration-300" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

function scrollToMyLearning() {
  document.getElementById("my-learning")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ------------------------------------------------------------------ */
/* My learning — in-progress enrolments                                */
/* ------------------------------------------------------------------ */

function EnrollmentCard({
  course,
  progressPct,
  onContinue,
  onComplete,
  pending,
}: {
  course: TrainingCourse;
  progressPct: number;
  onContinue: () => void;
  onComplete: () => void;
  pending: boolean;
}) {
  const modulesDone = Math.min(course.moduleCount, Math.round((progressPct / 100) * course.moduleCount));
  const ready = progressPct >= 100;
  return (
    <article className="flex flex-col gap-4 rounded-lg border bg-card p-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-semibold leading-tight tracking-tight">{course.title}</h3>
          <LevelBadge level={course.level} />
        </div>
        <p className="tnum mt-1 text-xs text-muted-foreground">
          {FORMAT_LABEL[course.format]} · {course.durationHrs} learning hours · {course.moduleCount} modules
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{course.instructor}</p>
      </div>

      <div>
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted-foreground">
            Module <span className="tnum font-medium text-foreground">{modulesDone}</span> of{" "}
            <span className="tnum">{course.moduleCount}</span>
          </span>
          <span className={cn("tnum font-medium", ready && "text-success")}>{progressPct}%</span>
        </div>
        <div className="mt-1.5">
          <ProgressBar pct={progressPct} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {ready ? (
          <Button size="sm" onClick={onComplete} disabled={pending}>
            <Award className="h-3.5 w-3.5" strokeWidth={1.9} />
            Complete &amp; earn certificate
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onContinue} disabled={pending}>
            <PlayCircle className="h-3.5 w-3.5" strokeWidth={1.9} />
            Continue · module {modulesDone + 1}
          </Button>
        )}
        <p className="text-xs text-muted-foreground">
          {ready ? "Final module done — the certificate is issued on completion." : "Each module takes about an hour at your pace."}
        </p>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Certificates — earned credentials                                   */
/* ------------------------------------------------------------------ */

function CertificateCard({
  courseTitle,
  certificateId,
  completedAt,
  score,
  skills,
}: {
  courseTitle: string;
  certificateId: string;
  completedAt: string;
  score?: number;
  skills: string[];
}) {
  return (
    <article className="rounded-lg border border-success/40 bg-success-muted/40 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-success/40 bg-card text-success" aria-hidden>
          <Award className="h-4 w-4" strokeWidth={1.9} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold leading-snug tracking-tight">{courseTitle}</h3>
          <p className="tnum mt-1 text-xs text-muted-foreground">
            {certificateId} · issued {dateShort(completedAt)}
            {score !== undefined ? ` · score ${num(score)}/100` : ""}
          </p>
          <div className="mt-2.5">
            <SkillChips skills={skills} />
          </div>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Course catalogue                                                    */
/* ------------------------------------------------------------------ */

function CourseCard({
  course,
  state,
  onEnroll,
  pending,
}: {
  course: TrainingCourse;
  state: "not-enrolled" | "in-progress" | "completed";
  onEnroll: () => void;
  pending: boolean;
}) {
  const fewSeats = course.seatsLeft !== undefined && course.seatsLeft <= 3;
  return (
    <article className="flex flex-col gap-3 rounded-lg border bg-card p-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-semibold leading-tight tracking-tight">{course.title}</h3>
          <LevelBadge level={course.level} />
        </div>
        <p className="tnum mt-1 text-xs text-muted-foreground">
          {FORMAT_LABEL[course.format]} · {course.durationHrs} learning hours · {course.moduleCount} modules · open to{" "}
          {course.category === "professional" ? "all trades" : `${course.category.replace("-", " ")} members`}
        </p>
      </div>

      <p className="text-[13px] leading-relaxed text-muted-foreground">{course.description}</p>
      <p className="text-xs text-muted-foreground">{course.instructor}</p>
      <SkillChips skills={course.skills} />

      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-3">
        {course.nextCohortAt ? (
          <p className={cn("tnum flex items-center gap-1.5 text-xs", fewSeats ? "text-warning" : "text-muted-foreground")}>
            <CalendarDays className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
            Next cohort {dateShort(course.nextCohortAt)}
            {course.seatsLeft !== undefined ? ` · ${num(course.seatsLeft)} seats left` : ""}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Rolling online access — start anytime</p>
        )}
        {state === "completed" ? (
          <span className="inline-flex items-center gap-1 rounded-sm border border-success/40 bg-success-muted px-2 py-1 text-[11px] font-medium text-success">
            <Award className="h-3 w-3" strokeWidth={1.9} aria-hidden />
            Certified
          </span>
        ) : state === "in-progress" ? (
          <Button variant="outline" size="sm" onClick={scrollToMyLearning}>
            Enrolled — continue
          </Button>
        ) : (
          <Button size="sm" onClick={onEnroll} disabled={pending}>
            Enrol
          </Button>
        )}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export function WorkerTrainingScreen() {
  const navigate = useAppStore((s) => s.navigate);
  const q = useWorkerTraining();
  const enroll = useEnrollCourse();
  const progress = useCourseProgress();
  const complete = useCompleteCourse();

  return (
    <div>
      <PageHeader
        eyebrow="Growth · member benefit"
        title="Training & certifications"
        description="The cooperative invests in member growth, not just gigs. Course fees come from the operations budget — upskilling is a member right, not a paywalled extra, and every completed course issues a credential customers can see."
      />
      <QueryGate query={q}>
        {(data) => {
          const inProgress = data.myEnrollments.filter((e) => e.status === "in_progress");
          const courseById = new Map(data.courses.map((c) => [c.id, c]));
          const stateOf = (courseId: string): "not-enrolled" | "in-progress" | "completed" => {
            const e = data.myEnrollments.find((en) => en.courseId === courseId);
            if (!e) return "not-enrolled";
            return e.status === "completed" ? "completed" : "in-progress";
          };
          return (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile
                  label="Certificates earned"
                  value={num(data.stats.certificatesEarned)}
                  sub="Sahyog co-operative certified"
                  emphasis
                />
                <StatTile label="Courses in progress" value={num(data.stats.inProgress)} sub="Continue where you left off" />
                <StatTile label="Learning hours" value={`${num(data.stats.hoursCompleted)} h`} sub="Including partial course credit" />
                <StatTile
                  label="Next cohort"
                  value={data.stats.nextCohortAt ? dateShort(data.stats.nextCohortAt) : "—"}
                  sub={data.stats.nextCohortAt ? "Enrolment open across the catalogue" : "No scheduled cohorts right now"}
                />
              </div>

              {/* My learning */}
              <div id="my-learning" className="scroll-mt-24">
                <SectionCard
                  title="My learning"
                  description="Your active enrolments — advance one module at a time; the certificate is issued at 100%."
                >
                  {inProgress.length === 0 ? (
                    <EmptyState
                      title="No courses in progress"
                      description="Pick a course from the catalogue below — enrolment is free for members and takes one click."
                      action={
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => document.getElementById("course-catalogue")?.scrollIntoView({ behavior: "smooth" })}
                        >
                          Browse the catalogue
                        </Button>
                      }
                    />
                  ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {inProgress.map((e) => {
                        const course = courseById.get(e.courseId);
                        if (!course) return null;
                        return (
                          <EnrollmentCard
                            key={e.id}
                            course={course}
                            progressPct={e.progressPct}
                            pending={progress.isPending || complete.isPending}
                            onContinue={() => progress.mutate(course.id)}
                            onComplete={() => complete.mutate(course.id)}
                          />
                        );
                      })}
                    </div>
                  )}
                </SectionCard>
              </div>

              {/* Certificates */}
              <SectionCard
                title="Certificates"
                description="Credentials issued by the Sahyog Skill Academy — visible on your customer-facing profile."
              >
                {data.certificates.length === 0 ? (
                  <p className="flex items-start gap-2.5 rounded-md bg-muted/50 px-3 py-3 text-[13px] leading-relaxed text-muted-foreground">
                    <GraduationCap className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.9} aria-hidden />
                    No certificates yet — complete a course at 100% and your SCT credential is issued automatically, with a
                    notification and an audit-trail entry.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {data.certificates.map((c) => (
                      <CertificateCard
                        key={c.certificateId}
                        courseTitle={c.courseTitle}
                        certificateId={c.certificateId}
                        completedAt={c.completedAt}
                        score={c.score}
                        skills={c.skills}
                      />
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* Course catalogue */}
              <div id="course-catalogue" className="scroll-mt-24">
                <SectionCard
                  title="Course catalogue"
                  description="Seven certified programmes across the co-op's trades, taught by working professionals. Members enrol free."
                >
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {data.courses.map((c) => (
                      <CourseCard
                        key={c.id}
                        course={c}
                        state={stateOf(c.id)}
                        pending={enroll.isPending}
                        onEnroll={() => enroll.mutate(c.id)}
                      />
                    ))}
                  </div>
                </SectionCard>
              </div>

              <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
                Training is funded by the cooperative — proposal PRO-2026-014 (voting now in{" "}
                <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => navigate("worker-governance")}>
                  Governance
                </Button>
                ) proposes expanding the fund so training hours are also paid. Certificates and assessments are simulated in this
                prototype.
              </p>
            </div>
          );
        }}
      </QueryGate>
    </div>
  );
}
