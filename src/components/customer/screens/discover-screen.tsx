"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { EmptyState, ErrorState, LoadingGrid } from "@/components/shared";
import { useCategories, useWorkers, type WorkerFilters } from "@/hooks/use-api";
import { useAppStore } from "@/store/app-store";
import type { ServiceCategoryId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CATEGORY_ICONS } from "../constants";
import { peekSearchHandoff, clearSearchHandoff } from "../prefill";
import { WorkerCard } from "../parts/worker-card";

export function DiscoverScreen({ categoryParam }: { categoryParam?: string }) {
  const navigate = useAppStore((s) => s.navigate);
  const { data: categories } = useCategories();

  /* consume a search query handed off from the home screen (render-safe) */
  const [initialQ] = useState(() => peekSearchHandoff() ?? "");
  useEffect(() => {
    clearSearchHandoff();
  }, []);

  const [q, setQ] = useState(initialQ);
  const [debouncedQ, setDebouncedQ] = useState(initialQ);
  const [category, setCategory] = useState<string>(categoryParam ?? "all");
  const [sort, setSort] = useState("recommended");
  const [minRating, setMinRating] = useState("0");
  const [maxDistance, setMaxDistance] = useState("999");
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [availableToday, setAvailableToday] = useState(false);

  /* debounce the search box */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const filters: WorkerFilters = useMemo(
    () => ({
      q: debouncedQ || undefined,
      category: category === "all" ? undefined : category,
      minRating: minRating === "0" ? undefined : Number(minRating),
      maxDistance: maxDistance === "999" ? undefined : Number(maxDistance),
      verifiedOnly: verifiedOnly || undefined,
      availableToday: availableToday || undefined,
      sort,
    }),
    [debouncedQ, category, minRating, maxDistance, verifiedOnly, availableToday, sort],
  );

  const { data, isLoading, isError, refetch } = useWorkers(filters);
  const items = data?.items ?? [];
  const hasFilters =
    Boolean(debouncedQ) || category !== "all" || minRating !== "0" || maxDistance !== "999" || availableToday || !verifiedOnly;

  const clearFilters = () => {
    setQ("");
    setDebouncedQ("");
    setCategory("all");
    setMinRating("0");
    setMaxDistance("999");
    setVerifiedOnly(true);
    setAvailableToday(false);
  };

  return (
    <div>
      <header className="mb-6">
        <p className="micro-label mb-1.5">Find services</p>
        <h1 className="text-2xl font-semibold tracking-tight">Browse cooperative members</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Every member is ID- and trade-verified before they can accept bookings. Rates are set by cooperative policy — no surge pricing.
        </p>
      </header>

      {/* Search + filters */}
      <section aria-label="Search and filters" className="rounded-lg border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.9} />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, trade or skill — “electrician”, “deep clean”, “care”…"
              className="pl-9"
              aria-label="Search members"
            />
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by category">
            <button
              type="button"
              aria-pressed={category === "all"}
              onClick={() => setCategory("all")}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                category === "all"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              All
            </button>
            {(categories ?? []).map((c) => {
              const Icon = CATEGORY_ICONS[c.id as ServiceCategoryId];
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(active ? "all" : c.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:border-primary/40 hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
                  {c.name}
                </button>
              );
            })}
          </div>

          {/* Filters row */}
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3 border-t pt-3">
            <div className="w-[150px]">
              <Label htmlFor="df-sort" className="text-xs text-muted-foreground">Sort by</Label>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger id="df-sort" className="mt-1 h-9 text-[13px]" aria-label="Sort members">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recommended">Recommended</SelectItem>
                  <SelectItem value="rating">Highest rated</SelectItem>
                  <SelectItem value="distance">Closest</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[130px]">
              <Label htmlFor="df-rating" className="text-xs text-muted-foreground">Rating</Label>
              <Select value={minRating} onValueChange={setMinRating}>
                <SelectTrigger id="df-rating" className="mt-1 h-9 text-[13px]" aria-label="Minimum rating">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Any</SelectItem>
                  <SelectItem value="4">4.0+</SelectItem>
                  <SelectItem value="4.5">4.5+</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[130px]">
              <Label htmlFor="df-distance" className="text-xs text-muted-foreground">Distance</Label>
              <Select value={maxDistance} onValueChange={setMaxDistance}>
                <SelectTrigger id="df-distance" className="mt-1 h-9 text-[13px]" aria-label="Maximum distance">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="999">Any</SelectItem>
                  <SelectItem value="3">Within 3 km</SelectItem>
                  <SelectItem value="5">Within 5 km</SelectItem>
                  <SelectItem value="10">Within 10 km</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Switch id="df-verified" checked={verifiedOnly} onCheckedChange={setVerifiedOnly} />
              <Label htmlFor="df-verified" className="cursor-pointer text-[13px]">Verified only</Label>
            </div>
            <div className="flex items-center gap-2 pb-1">
              <Switch id="df-today" checked={availableToday} onCheckedChange={setAvailableToday} />
              <Label htmlFor="df-today" className="cursor-pointer text-[13px]">Available today</Label>
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="mb-0.5 gap-1 text-xs text-muted-foreground">
                <X className="h-3.5 w-3.5" strokeWidth={1.9} /> Clear
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Results */}
      <div className="mt-5">
        <div className="mb-3 flex items-baseline justify-between">
          <p className="micro-label" aria-live="polite">
            <SlidersHorizontal className="mr-1.5 inline h-3 w-3 align-[-1px]" strokeWidth={1.9} />
            {isLoading ? "Searching…" : `${data?.total ?? 0} member${(data?.total ?? 0) === 1 ? "" : "s"} found`}
          </p>
        </div>

        {isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : isLoading ? (
          <LoadingGrid count={4} />
        ) : items.length === 0 ? (
          <EmptyState
            title="No members match these filters"
            description="Try widening the distance, lowering the minimum rating, or clearing the search."
            action={
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear all filters
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {items.map((w) => (
              <WorkerCard
                key={w.id}
                worker={w}
                onView={() => navigate("customer-worker", { workerId: w.id })}
                onBook={() => navigate("customer-book", { categoryId: w.category })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
