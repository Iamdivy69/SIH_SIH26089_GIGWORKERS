"use client";

import { BellRing, CalendarClock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PageHeader, SectionCard, StatusBadge } from "@/components/shared";
import { useVerification } from "@/hooks/use-api";
import { dateFull, dateShort } from "@/lib/format";
import { QueryGate, simulatedToast } from "../parts";

export function WorkerVerification() {
  const q = useVerification();

  return (
    <div>
      <PageHeader
        eyebrow="Cooperative"
        title="Verification & credentials"
        description="Your verified status is what customers see before they let you into their homes. All four checks are current."
      />
      <QueryGate query={q}>
        {(data) => {
          const earliest = data.verification
            .map((v) => v.verifiedAt)
            .filter((d): d is string => Boolean(d))
            .sort()[0];
          const renewable = [...data.certifications]
            .filter((c) => c.validTill)
            .sort((a, b) => +new Date(a.validTill!) - +new Date(b.validTill!))[0];

          return (
            <div className="space-y-6">
              {/* Overall banner */}
              <section className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-success/40 bg-primary-muted p-5">
                <div className="flex items-center gap-4">
                  <span className="flex h-11 w-11 items-center justify-center rounded-md bg-success text-white">
                    <ShieldCheck className="h-5 w-5" strokeWidth={1.9} aria-hidden />
                  </span>
                  <div>
                    <p className="text-[15px] font-semibold text-success-deep">Verified member — all checks complete</p>
                    <p className="tnum mt-0.5 text-[13px] text-success-deep/80">
                      {data.worker.cooperativeMemberId} · verified since {earliest ? dateFull(earliest) : "—"}
                    </p>
                  </div>
                </div>
                <StatusBadge status={data.worker.status} label="Verified" />
              </section>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                  <SectionCard title="Verification checks" description="Four mandatory checks for every field member.">
                    <ul className="divide-y divide-border/70">
                      {data.verification.map((v) => (
                        <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-1 last:pb-0">
                          <div className="min-w-0">
                            <p className="text-[13px] font-medium">{v.label}</p>
                            <p className="tnum mt-0.5 text-xs text-muted-foreground">
                              {v.verifiedAt ? `Verified ${dateFull(v.verifiedAt)}` : "Pending"} · {v.reference}
                            </p>
                          </div>
                          <StatusBadge status={v.status} />
                        </li>
                      ))}
                    </ul>
                  </SectionCard>

                  <SectionCard title="Certifications" description="Credentials on file with the cooperative — visible to customers.">
                    <ul className="divide-y divide-border/70">
                      {data.certifications.map((c) => (
                        <li key={c.id} className="py-3.5 first:pt-1 last:pb-0">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium">{c.name}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">{c.issuer}</p>
                            </div>
                            {c.validTill ? (
                              <p className="tnum shrink-0 text-xs text-muted-foreground">Valid till {dateShort(c.validTill)}</p>
                            ) : (
                              <p className="tnum shrink-0 text-xs text-muted-foreground">Issued {dateShort(c.issuedAt)}</p>
                            )}
                          </div>
                          <p className="mt-1 font-mono text-[11px] text-muted-foreground/80">Credential {c.credentialId}</p>
                        </li>
                      ))}
                    </ul>
                  </SectionCard>
                </div>

                <div className="space-y-6">
                  <SectionCard title="Renewals" description="Keep credentials current — expired ones pause new offers.">
                    {renewable ? (
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.9} />
                          <div>
                            <p className="text-[13px] font-medium leading-snug">{renewable.name}</p>
                            <p className="tnum mt-0.5 text-xs text-muted-foreground">
                              Expires {dateFull(renewable.validTill!)} · renewal window opens 60 days before
                            </p>
                          </div>
                        </div>
                        <Separator />
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => simulatedToast("Renewal reminder set", "You'll be notified 60 days before the credential expires.")}
                        >
                          <BellRing className="h-3.5 w-3.5" strokeWidth={1.9} />
                          Set renewal reminder
                        </Button>
                      </div>
                    ) : (
                      <p className="text-[13px] text-muted-foreground">No certifications with an expiry date on file.</p>
                    )}
                  </SectionCard>

                  <SectionCard title="Why this matters">
                    <ul className="space-y-2.5 text-[13px] leading-relaxed text-muted-foreground">
                      <li>Customers see your verified badge, trade certifications and cooperative membership before booking.</li>
                      <li>Verification is what unlocks the customer's payment guarantee — held funds release only to verified members.</li>
                      <li>Members with current credentials get priority in matching for safety-critical services like wiring inspections.</li>
                    </ul>
                  </SectionCard>
                </div>
              </div>

              <p className="text-xs leading-relaxed text-muted-foreground">
                Document verification and credential checks are simulated in this prototype — the workflow, statuses and audit trail mirror
                the planned integration with DigiLocker and the skill academy registry.
              </p>
            </div>
          );
        }}
      </QueryGate>
    </div>
  );
}
