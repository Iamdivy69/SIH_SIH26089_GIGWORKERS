"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { ErrorState, PageHeader, RatingStars } from "@/components/shared";
import { FineNote } from "./ui";
import { useAdminCategories, useUpdateServiceRate } from "@/hooks/use-api";
import { duration, money, num, pctLabel } from "@/lib/format";
import type { ServiceItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type AdminCategory = {
  id: string;
  name: string;
  tagline: string;
  services: ServiceItem[];
  activeWorkers: number;
  bookings30d: number;
  avgRating: number;
};

/** Service catalogue — what the cooperative sells, and at what rate. */
export function AdminCategoriesScreen() {
  const categories = useAdminCategories();

  if (categories.isError) {
    return (
      <>
        <PageHeader eyebrow="Cooperative · catalogue" title="Service catalogue" />
        <ErrorState message="The catalogue could not be loaded." onRetry={() => categories.refetch()} />
      </>
    );
  }

  const loading = categories.isLoading || !categories.data;
  const cats = categories.data?.categories ?? [];
  const totalBookings = cats.reduce((a, c) => a + c.bookings30d, 0);

  return (
    <>
      <PageHeader
        eyebrow="Cooperative · catalogue"
        title="Service catalogue"
        description={
          loading
            ? "Loading the catalogue…"
            : `${num(cats.length)} categories · ${num(cats.reduce((a, c) => a + c.services.length, 0))} services · ${num(totalBookings)} bookings in the last 30 days. Edit a base rate inline — changes apply to new bookings only.`
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[240px] rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {cats.map((c) => (
            <CategoryCard key={c.id} category={c} defaultOpen={c.bookings30d === Math.max(...cats.map((x) => x.bookings30d))} />
          ))}
        </div>
      )}

      <div className="mt-4 rounded-lg border bg-muted/30 p-4">
        <FineNote>
          Rate changes take effect for new bookings only — in-flight bookings keep their quoted price, and the change is written
          to the audit log. Base rates are floor prices: members may quote higher for complex jobs with the customer's consent.
        </FineNote>
      </div>
    </>
  );
}

function CategoryCard({ category: c, defaultOpen }: { category: AdminCategory; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-tight tracking-tight">{c.name}</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{c.tagline}</p>
        </div>
        {c.avgRating > 0 && <RatingStars value={c.avgRating} size={12} />}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 border-b px-5 pb-4">
        <div>
          <p className="micro-label">Active members</p>
          <p className="tnum mt-0.5 text-[15px] font-semibold leading-tight">{num(c.activeWorkers)}</p>
        </div>
        <div>
          <p className="micro-label">Bookings · 30d</p>
          <p className="tnum mt-0.5 text-[15px] font-semibold leading-tight">{num(c.bookings30d)}</p>
        </div>
        <div>
          <p className="micro-label">Fill rate</p>
          <p className="tnum mt-0.5 text-[15px] font-semibold leading-tight">{pctLabel(Math.min(100, Math.round((c.bookings30d / Math.max(1, c.activeWorkers * 6)) * 100)))}</p>
        </div>
      </div>

      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between px-5 py-2.5 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"
            aria-expanded={open}
          >
            {num(c.services.length)} services & base rates
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} strokeWidth={1.9} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="divide-y border-t">
            {c.services.map((s) => (
              <ServiceRateRow key={s.id} categoryId={c.id} service={s} />
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}

function ServiceRateRow({ categoryId, service }: { categoryId: string; service: ServiceItem }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(service.basePrice));
  const update = useUpdateServiceRate();

  const startEdit = () => {
    setDraft(String(service.basePrice));
    setEditing(true);
  };

  const save = () => {
    const price = Math.round(Number(draft));
    if (!Number.isFinite(price) || price <= 0) return;
    if (price === service.basePrice) {
      setEditing(false);
      return;
    }
    update.mutate(
      { categoryId, serviceId: service.id, basePrice: price },
      { onSuccess: () => setEditing(false) },
    );
  };

  const invalid = !Number.isFinite(Number(draft)) || Number(draft) <= 0;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3">
      <div className="min-w-0 flex-1 basis-52">
        <p className="text-[13px] font-medium leading-snug">{service.name}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{service.description}</p>
        <p className="tnum mt-0.5 text-[11px] text-muted-foreground">
          {duration(service.durationMin)} · per {service.unit}
        </p>
      </div>
      {editing ? (
        <div className="flex items-center gap-1.5">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            inputMode="numeric"
            autoFocus
            aria-label={`New base price for ${service.name}`}
            className={cn("tnum h-8 w-24 text-[13px]", invalid && "border-destructive focus-visible:ring-destructive/20")}
          />
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            aria-label="Save rate"
            disabled={invalid || update.isPending}
            onClick={save}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={1.9} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            aria-label="Cancel edit"
            onClick={() => setEditing(false)}
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.9} />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={startEdit}
          className="group flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1 transition-colors hover:border-border hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={`Edit base price of ${service.name} (currently ${money(service.basePrice)})`}
        >
          <span className="tnum text-[13px] font-semibold">{money(service.basePrice)}</span>
          <Pencil className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" strokeWidth={1.9} />
        </button>
      )}
    </li>
  );
}
