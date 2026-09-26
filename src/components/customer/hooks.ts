"use client";

import { useMemo } from "react";
import { useWorkers } from "@/hooks/use-api";
import type { Worker } from "@/lib/types";

/**
 * One query, cached across every customer screen: the full verified member
 * directory, indexed by id. Used to render worker names/avatars/trades on
 * booking cards without per-booking lookups.
 */
export function useWorkerMap(): { map: Map<string, Worker>; ready: boolean } {
  const { data, isLoading } = useWorkers({});
  const map = useMemo(() => new Map((data?.items ?? []).map((w) => [w.id, w])), [data]);
  return { map, ready: !isLoading };
}
