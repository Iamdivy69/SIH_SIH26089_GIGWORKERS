"use client";

import { Fragment, useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { BookOpenCheck, ClipboardList, Search, Shapes, Wrench, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { PersonAvatar, statusLabel } from "@/components/shared";
import { useBookings, useCategories, useWorkers, useWorkerTraining } from "@/hooks/use-api";
import { DEMO_USER_ID, useAppStore, useRole, type Role } from "@/store/app-store";
import { NAV_BY_ROLE, type NavGroup } from "./nav";

/**
 * Global command palette (Ctrl/Cmd + K).
 *
 * A keyboard-driven quick switcher over the active role's app: every nav
 * screen (the default grouped view while the query is empty) plus entity
 * search — members and services for customers, booking references and
 * training courses for workers. Entity data is fetched only while the
 * dialog is open (the role bodies live inside the dialog content tree, so
 * the existing TanStack hooks mount/unmount with it) and stays cached
 * across opens. Everything is client-side; no `window` access during render.
 */

/** Per-group caps while searching — keeps results scannable; "+N more" notes truncation. */
const SEARCH_CAPS = { screens: 5, members: 4, services: 3, bookings: 4, courses: 3 } as const;

const PLACEHOLDER: Record<Role, string> = {
  customer: "Search screens, members, services, bookings…",
  worker: "Search screens, jobs, courses…",
  admin: "Search screens…",
};

const EMPTY_HINT: Record<Role, string> = {
  customer: "No matches — try a service, member or booking reference.",
  worker: "No matches — try a booking reference or course.",
  admin: "No matches — try another screen name.",
};

type Go = (name: string, params?: Record<string, string>) => void;

interface PaletteRow {
  key: string;
  /** Leading icon; members render a PersonAvatar instead. */
  icon?: LucideIcon;
  /** Person name → renders an avatar chip instead of an icon. */
  avatar?: string;
  label: string;
  /** Muted context line — nav section, trade/locality, booking status… */
  secondary?: string;
  /** Right-aligned muted slot (rating figures). */
  right?: ReactNode;
  /** Lowercased searchable text cmdk scores against (label + secondary + ids). */
  value: string;
  run: () => void;
}

interface GroupSpec {
  key: string;
  heading: string;
  rows: PaletteRow[];
  cap: number;
  /** Best relevance rank in the group — drives group order while searching. */
  best: number;
}

const WORD_START = /[\s/·\-&,()]/;

const emptySubscribe = () => () => {};

/** Platform probe — Mac gets the "⌘ K" hint, everything else "Ctrl K". */
function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  const platform = nav.userAgentData?.platform ?? nav.platform ?? "";
  return /mac|iphone|ipad|ipod/i.test(platform) || /macintosh|iphone|ipad/i.test(nav.userAgent);
}

/**
 * Substring pre-filter with light relevance ranking (prefix > word start >
 * contains). Every surviving row contains the query verbatim, so cmdk's own
 * fuzzy pass keeps them all — the two filters never disagree, and slicing
 * happens on the *matched* set (never the raw list). `best` is the winning
 * row's rank, used to order groups by relevance.
 */
function filterRows<T extends { value: string }>(rows: readonly T[], query: string): { list: T[]; best: number } {
  const needle = query.trim().toLowerCase();
  if (!needle) return { list: [...rows], best: rows.length > 0 ? 0 : Infinity };
  const scored = rows
    .map((row, index) => {
      const at = row.value.indexOf(needle);
      const rank = at === -1 ? -1 : at === 0 ? 0 : WORD_START.test(row.value[at - 1] ?? "") ? 1 : 2;
      return { row, index, rank };
    })
    .filter((entry) => entry.rank >= 0);
  scored.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return { list: scored.map((entry) => entry.row), best: scored.length > 0 ? scored[0].rank : Infinity };
}

/** Flat "Screens" rows from the role's sidebar config, tagged with their nav group. */
function screenRows(navGroups: NavGroup[], go: Go): PaletteRow[] {
  return navGroups.flatMap((group) =>
    group.items.map((item) => ({
      key: item.route,
      icon: item.icon,
      label: item.label,
      secondary: group.label,
      value: `${item.label} ${group.label}`.toLowerCase(),
      run: () => go(item.route),
    })),
  );
}

/**
 * Render one results group. The "+N more" note is a sibling of the group
 * (not a child of [cmdk-group-items]) on purpose: cmdk physically re-appends
 * matched items inside the group on every search change, which would push a
 * plain in-group row above the items. Siblings are never touched, and cmdk's
 * own group reordering is inert with heading-based groups (it looks them up
 * by an internal id that never matches), so the note stays anchored.
 */
function renderGroup(spec: GroupSpec): ReactNode {
  if (spec.rows.length === 0) return null;
  const visible = spec.rows.slice(0, spec.cap);
  const hidden = spec.rows.length - visible.length;
  return (
    <Fragment key={spec.key}>
      <CommandGroup
        heading={spec.heading}
        className="[&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.06em]"
      >
        {visible.map((row) => (
          <CommandItem
            key={row.key}
            value={row.value}
            onSelect={row.run}
            className="group gap-2.5 text-[13.5px] font-medium"
          >
            {row.avatar ? (
              <PersonAvatar name={row.avatar} size="xs" className="h-5 w-5 text-[9px]" />
            ) : row.icon ? (
              <row.icon className="shrink-0 text-muted-foreground" strokeWidth={1.9} />
            ) : null}
            <span className="min-w-0 flex-1 truncate">{row.label}</span>
            {row.secondary && (
              <span className="max-w-[45%] shrink-0 truncate text-xs font-normal text-muted-foreground">
                {row.secondary}
              </span>
            )}
            {row.right}
            {/* Enter hint — reserved slot, visible on the active row only */}
            <span
              aria-hidden
              className="shrink-0 text-[11px] font-medium text-muted-foreground opacity-0 transition-opacity duration-150 group-data-[selected=true]:opacity-100"
            >
              ↵
            </span>
          </CommandItem>
        ))}
      </CommandGroup>
      {hidden > 0 && (
        <div className="px-4 py-1.5 text-[11px] text-muted-foreground">+{hidden} more</div>
      )}
    </Fragment>
  );
}

/** Groups with matches, most relevant first (stable within equal ranks). */
function renderGroups(specs: GroupSpec[]): ReactNode {
  return specs
    .filter((spec) => spec.rows.length > 0)
    .sort((a, b) => a.best - b.best)
    .map(renderGroup);
}

/** Customer: screens + members + services + bookings by reference. */
function CustomerGroups({ query, go }: { query: string; go: Go }) {
  const workers = useWorkers({});
  const categories = useCategories();
  const bookings = useBookings({ customerId: DEMO_USER_ID.customer });
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const screens = useMemo(() => screenRows(NAV_BY_ROLE.customer, go), [go]);
  const screensFiltered = useMemo(() => filterRows(screens, q), [screens, q]);

  const members = useMemo(() => {
    const rows: PaletteRow[] = (workers.data?.items ?? []).map((worker) => ({
      key: worker.id,
      avatar: worker.name,
      label: worker.name,
      secondary: `${worker.tradeTitle} · ${worker.locality}`,
      right: (
        <span
          className="tnum shrink-0 text-xs font-normal text-muted-foreground"
          title={`Rated ${worker.rating.toFixed(1)} by ${worker.reviewCount} customers`}
        >
          {worker.rating.toFixed(1)}
        </span>
      ),
      value: `${worker.name} ${worker.tradeTitle} ${worker.locality} ${worker.category} ${worker.rating}`.toLowerCase(),
      run: () => go("customer-worker", { workerId: worker.id }),
    }));
    return filterRows(rows, q);
  }, [workers.data, q, go]);

  const services = useMemo(() => {
    const rows: PaletteRow[] = [];
    for (const category of categories.data ?? []) {
      rows.push({
        key: `cat-${category.id}`,
        icon: Shapes,
        label: category.name,
        secondary: category.tagline,
        value: `${category.name} ${category.tagline}`.toLowerCase(),
        run: () => go("customer-book", { categoryId: category.id }),
      });
      for (const service of category.services) {
        rows.push({
          key: service.id,
          icon: Wrench,
          label: service.name,
          secondary: category.name,
          value: `${service.name} ${category.name} ${service.description}`.toLowerCase(),
          run: () => go("customer-book", { categoryId: category.id }),
        });
      }
    }
    return filterRows(rows, q);
  }, [categories.data, q, go]);

  const bookingRows = useMemo(() => {
    const rows: PaletteRow[] = [...(bookings.data?.items ?? [])]
      .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
      .map((booking) => ({
        key: booking.id,
        icon: ClipboardList,
        label: `${booking.reference} · ${booking.title}`,
        secondary: statusLabel(booking.status),
        value: `${booking.reference} ${booking.title} ${statusLabel(booking.status)} ${booking.categoryId}`.toLowerCase(),
        run: () => go("customer-booking", { bookingId: booking.id }),
      }));
    return filterRows(rows, q);
  }, [bookings.data, q, go]);

  return renderGroups([
    { key: "screens", heading: "Screens", rows: screensFiltered.list, cap: searching ? SEARCH_CAPS.screens : Infinity, best: screensFiltered.best },
    ...(searching
      ? [
          { key: "members", heading: "Members", rows: members.list, cap: SEARCH_CAPS.members, best: members.best },
          { key: "services", heading: "Services", rows: services.list, cap: SEARCH_CAPS.services, best: services.best },
          { key: "bookings", heading: "Bookings", rows: bookingRows.list, cap: SEARCH_CAPS.bookings, best: bookingRows.best },
        ]
      : []),
  ]);
}

/** Worker: screens + bookings by reference + training courses. */
function WorkerGroups({ query, go }: { query: string; go: Go }) {
  const bookings = useBookings({ workerId: DEMO_USER_ID.worker });
  const training = useWorkerTraining();
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const screens = useMemo(() => screenRows(NAV_BY_ROLE.worker, go), [go]);
  const screensFiltered = useMemo(() => filterRows(screens, q), [screens, q]);

  const bookingRows = useMemo(() => {
    const rows: PaletteRow[] = [...(bookings.data?.items ?? [])]
      .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
      .map((booking) => ({
        key: booking.id,
        icon: ClipboardList,
        label: `${booking.reference} · ${booking.title}`,
        secondary: statusLabel(booking.status),
        value: `${booking.reference} ${booking.title} ${statusLabel(booking.status)} ${booking.categoryId}`.toLowerCase(),
        run: () => go("worker-job", { bookingId: booking.id }),
      }));
    return filterRows(rows, q);
  }, [bookings.data, q, go]);

  const courseRows = useMemo(() => {
    const rows: PaletteRow[] = (training.data?.courses ?? []).map((course) => ({
      key: course.id,
      icon: BookOpenCheck,
      label: course.title,
      secondary: `${course.instructor} · ${course.level === "foundation" ? "Foundation" : "Advanced"} · ${course.durationHrs}h`,
      value: `${course.title} ${course.instructor} ${course.category}`.toLowerCase(),
      run: () => go("worker-training"),
    }));
    return filterRows(rows, q);
  }, [training.data, q, go]);

  return renderGroups([
    { key: "screens", heading: "Screens", rows: screensFiltered.list, cap: searching ? SEARCH_CAPS.screens : Infinity, best: screensFiltered.best },
    ...(searching
      ? [
          { key: "bookings", heading: "Bookings", rows: bookingRows.list, cap: SEARCH_CAPS.bookings, best: bookingRows.best },
          { key: "courses", heading: "Courses", rows: courseRows.list, cap: SEARCH_CAPS.courses, best: courseRows.best },
        ]
      : []),
  ]);
}

/** Admin: the 14 screens as a quick-nav — no entity search. */
function AdminGroups({ query, go }: { query: string; go: Go }) {
  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const screens = useMemo(() => screenRows(NAV_BY_ROLE.admin, go), [go]);
  const screensFiltered = useMemo(() => filterRows(screens, q), [screens, q]);

  return (
    <>
      {renderGroups([
        { key: "screens", heading: "Screens", rows: screensFiltered.list, cap: searching ? SEARCH_CAPS.screens : Infinity, best: screensFiltered.best },
      ])}
      {!searching && (
        <p className="px-4 pb-2 pt-1 text-[11.5px] text-muted-foreground">
          Admin quick-nav: jump to any screen
        </p>
      )}
    </>
  );
}

export function CommandPalette() {
  const role = useRole();
  const navigate = useAppStore((s) => s.navigate);
  const [open, setOpen] = useState(false);
  /* Query is tagged with the role it belongs to — a role switch reads back as
     an empty query (fresh quick-nav) without effects or render-time resets. */
  const [queryState, setQueryState] = useState<{ role: Role; value: string }>({ role, value: "" });
  const query = queryState.role === role ? queryState.value : "";
  /* Hydration-safe platform detection (false on the server/first paint). */
  const isMac = useSyncExternalStore(emptySubscribe, isMacPlatform, () => false);

  /* Global Ctrl/Cmd+K — always available and toggles the palette; any other
     held modifier (shift/alt) is ignored. Opening from a focused field just
     opens — Radix moves focus into the dialog. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      if (event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      setQueryState((prev) => (prev.value === "" ? prev : { ...prev, value: "" }));
      setOpen((prev) => !prev);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const go = useCallback<Go>(
    (name, params) => {
      setOpen(false);
      setQueryState((prev) => (prev.value === "" ? prev : { ...prev, value: "" }));
      navigate(name, params);
    },
    [navigate],
  );

  const openDialog = () => {
    setQueryState({ role, value: "" });
    setOpen(true);
  };
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQueryState({ role, value: "" });
  };

  const shortcut = isMac ? "⌘ K" : "Ctrl K";
  const triggerLabel = `Search and jump to… (${shortcut})`;

  return (
    <>
      {/* Icon trigger — mobile */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 md:hidden"
        onClick={openDialog}
        aria-label={triggerLabel}
        title={triggerLabel}
      >
        <Search className="h-[18px] w-[18px]" strokeWidth={1.9} />
      </Button>
      {/* Labeled trigger — md and up */}
      <Button
        variant="outline"
        className="hidden h-9 w-44 gap-2 px-3 md:inline-flex lg:w-52"
        onClick={openDialog}
        title={triggerLabel}
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.9} />
        <span className="text-[13px] font-normal text-muted-foreground">Search</span>
        <kbd className="tnum ml-auto inline-flex h-5 items-center rounded border px-1.5 text-[10px] font-medium text-muted-foreground">
          {shortcut}
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        showCloseButton={false}
        title="Search and jump to…"
        description={`Quick switcher for the ${role} workspace.`}
      >
        <CommandInput value={query} onValueChange={(value) => setQueryState({ role, value })} placeholder={PLACEHOLDER[role]} />
        <CommandList className="scroll-slim max-h-[min(26rem,calc(100vh_-_12rem))]">
          <CommandEmpty>{EMPTY_HINT[role]}</CommandEmpty>
          {role === "customer" ? (
            <CustomerGroups query={query} go={go} />
          ) : role === "worker" ? (
            <WorkerGroups query={query} go={go} />
          ) : (
            <AdminGroups query={query} go={go} />
          )}
        </CommandList>
        <div className="border-t px-3 py-2">
          <p className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>
              <span className="tnum font-medium">↑↓</span> navigate
            </span>
            <span aria-hidden>·</span>
            <span>
              <span className="font-medium">↵</span> open
            </span>
            <span aria-hidden>·</span>
            <span>
              <span className="font-medium">esc</span> close
            </span>
          </p>
        </div>
      </CommandDialog>
    </>
  );
}
