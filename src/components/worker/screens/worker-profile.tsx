"use client";

import { useState } from "react";
import { Check, MapPin, Pencil, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { PageHeader, PersonAvatar, RatingStars, SectionCard, StatusBadge } from "@/components/shared";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { useWorkerProfile } from "@/hooks/use-api";
import { DAY_NAMES, dateShort, ratingLabel } from "@/lib/format";
import { QueryGate, simulatedToast } from "../parts";

const SLOT_LABELS = ["08:00–12:00", "12:00–16:00", "16:00–20:00"];

/** 7×3 dot matrix of the worker's weekly slots. */
function MiniSlotGrid({ availability }: { availability: { day: number; slots: string[] }[] }) {
  const days = [1, 2, 3, 4, 5, 6, 0];
  return (
    <div className="grid grid-cols-[repeat(3,1fr)] gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      <span className="micro-label col-span-3 mb-1">Morning · Afternoon · Evening</span>
      {days.map((day) => {
        const slots = availability.find((a) => a.day === day)?.slots ?? [];
        return (
          <div key={day} className="col-span-3 grid grid-cols-[44px_repeat(3,1fr)] items-center gap-3">
            <span className={cn("font-medium", day === new Date().getDay() && "text-primary")}>{DAY_NAMES[day]}</span>
            {SLOT_LABELS.map((slot) => (
              <span
                key={slot}
                className={cn("h-4 rounded-sm border", slots.includes(slot) ? "border-primary/30 bg-accent" : "border-border bg-muted/40")}
                title={`${DAY_NAMES[day]} ${slot}`}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function WorkerProfile() {
  const navigate = useAppStore((s) => s.navigate);
  const q = useWorkerProfile("w-priya");
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Support & account"
        title="My profile"
        description="This is exactly what customers see when your profile appears in search, matching and booking."
      />
      <QueryGate query={q}>
        {(data) => {
          const w = data.worker;
          const bio = bioDraft ?? w.bio;
          return (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-2">
                <SectionCard title="Public profile preview" description="Live to customers — verified badge, rating and record.">
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-start gap-4">
                      <PersonAvatar name={w.name} size="xl" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold tracking-tight">{w.name}</h3>
                          <StatusBadge status={w.status} label="Verified member" />
                        </div>
                        <p className="mt-0.5 text-[13px] text-muted-foreground">
                          {w.tradeTitle} · {w.locality}, {w.city}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                          <RatingStars value={w.rating} count={w.reviewCount} />
                          <span className="tnum text-[13px] text-muted-foreground">{w.completedJobs} services completed</span>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="micro-label">About</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground"
                          onClick={() => {
                            setBioDraft(bio);
                            setEditingBio((v) => !v);
                          }}
                        >
                          <Pencil className="h-3 w-3" strokeWidth={1.9} />
                          {editingBio ? "Cancel" : "Edit"}
                        </Button>
                      </div>
                      {editingBio ? (
                        <div className="mt-2 space-y-2">
                          <Textarea
                            value={bio}
                            onChange={(e) => setBioDraft(e.target.value)}
                            rows={4}
                            aria-label="Edit bio"
                          />
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingBio(false);
                                setBioDraft(null);
                              }}
                            >
                              Discard
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                setEditingBio(false);
                                simulatedToast("Profile updated", "Your bio was saved locally for this prototype session.");
                              }}
                            >
                              <Check className="h-3.5 w-3.5" strokeWidth={1.9} />
                              Save bio
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{bio}</p>
                      )}
                    </div>

                    <div>
                      <p className="micro-label">Skills</p>
                      <ul className="mt-2 flex flex-wrap gap-1.5">
                        {w.skills.map((s) => (
                          <li key={s} className="rounded-sm border bg-muted/50 px-2 py-1 text-xs font-medium">
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <p className="micro-label">Languages</p>
                        <p className="mt-1 text-[13px]">{w.languages.join(" · ")}</p>
                      </div>
                      <div>
                        <p className="micro-label">Visit rate</p>
                        <p className="mt-1 text-[13px]">{w.baseRateNote}</p>
                      </div>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard title="Recent customer feedback" description="The latest reviews on your public profile.">
                  <ul className="space-y-4">
                    {data.reviews.slice(0, 2).map((r) => (
                      <li key={r.id} className="rounded-lg border p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <RatingStars value={r.rating} showValue={false} />
                          <p className="tnum text-xs text-muted-foreground">
                            {ratingLabel(r.rating)} · {r.customerName} · {dateShort(r.createdAt)}
                          </p>
                        </div>
                        {r.comment && <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">"{r.comment}"</p>}
                        {r.tags.length > 0 && (
                          <ul className="mt-2 flex flex-wrap gap-1.5">
                            {r.tags.map((t) => (
                              <li key={t} className="rounded-sm bg-accent px-1.5 py-0.5 text-[11px] font-medium text-accent-foreground">
                                {t}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              </div>

              <div className="space-y-6">
                <SectionCard title="Service record">
                  <dl className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="micro-label">Experience</dt>
                      <dd className="tnum mt-0.5 text-lg font-semibold tracking-tight">{w.experienceYears} yrs</dd>
                    </div>
                    <div>
                      <dt className="micro-label">Response time</dt>
                      <dd className="tnum mt-0.5 text-lg font-semibold tracking-tight">~{w.responseMins} min</dd>
                    </div>
                    <div>
                      <dt className="micro-label">On-time rate</dt>
                      <dd className="tnum mt-0.5 text-lg font-semibold tracking-tight">{w.onTimeRate}%</dd>
                    </div>
                    <div>
                      <dt className="micro-label">Repeat customers</dt>
                      <dd className="tnum mt-0.5 text-lg font-semibold tracking-tight">{w.repeatCustomerRate}%</dd>
                    </div>
                  </dl>
                </SectionCard>

                <SectionCard title="Service area">
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-2 text-[13px] font-medium">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.9} />
                      {w.locality}, {w.city}
                    </p>
                    <p className="tnum text-[13px] text-muted-foreground">Preferred radius: {w.preferredRadiusKm} km</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Jobs beyond this radius are flagged before you accept, so you always choose.
                    </p>
                  </div>
                </SectionCard>

                <SectionCard title="Availability this week" actions={<Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => navigate("worker-availability")}>Edit</Button>}>
                  <MiniSlotGrid availability={w.availability} />
                </SectionCard>

                <SectionCard title="Credentials">
                  <div className="space-y-3">
                    <p className="flex items-center gap-2 text-[13px]">
                      <ShieldCheck className="h-4 w-4 text-success" strokeWidth={1.9} />
                      All 4 verification checks complete
                    </p>
                    <p className="tnum text-[13px] text-muted-foreground">
                      {w.certifications.length} certifications on file · member since {dateShort(w.memberSince)}{" "}
                      {new Date(w.memberSince).getFullYear()}
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button variant="outline" size="sm" onClick={() => navigate("worker-verification")}>
                        Verification
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigate("worker-skills")}>
                        Skill academy
                      </Button>
                    </div>
                  </div>
                </SectionCard>
              </div>
            </div>
          );
        }}
      </QueryGate>
    </div>
  );
}
