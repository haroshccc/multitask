import { useCallback, useSyncExternalStore } from "react";

/**
 * Calendar preferences (per user, per device).
 *
 * Stored in `localStorage` under `multitask:calendar-prefs`. This is
 * deliberately a lightweight client-side cache — no DB round-trip, no
 * Realtime invalidation. If we later want these synced across devices,
 * move the storage layer to `user_dashboard_layouts.widget_state` (which
 * is already scoped per user and per screen_key, so the schema is there).
 *
 * Implementation note: `useSyncExternalStore` REQUIRES the snapshot getter
 * to return a stable reference between updates. Returning a fresh object
 * literal every call sends React into an infinite "getSnapshot should be
 * cached" loop and crashes the page. So we keep one shared `cachedSnapshot`
 * and only swap it when something actually changes.
 */

export interface CalendarPrefs {
  /** Visible hour range start (0-23). Default 7. */
  hourStart: number;
  /** Visible hour range end (1-24). Default 22. */
  hourEnd: number;
  /** When true, override the default range and show 0..24. */
  show24h: boolean;
}

const STORAGE_KEY = "multitask:calendar-prefs";

const DEFAULT_PREFS: CalendarPrefs = {
  hourStart: 7,
  hourEnd: 22,
  show24h: false,
};

function clampHour(h: number, min: number, max: number): number {
  if (!Number.isFinite(h)) return min;
  return Math.max(min, Math.min(max, Math.round(h)));
}

function readFromStorage(): CalendarPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<CalendarPrefs>;
    return {
      hourStart: clampHour(parsed.hourStart ?? DEFAULT_PREFS.hourStart, 0, 23),
      hourEnd: clampHour(parsed.hourEnd ?? DEFAULT_PREFS.hourEnd, 1, 24),
      show24h: Boolean(parsed.show24h),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

// Single shared snapshot — stable reference until `setSnapshot` swaps it.
let cachedSnapshot: CalendarPrefs = readFromStorage();
const listeners = new Set<() => void>();

function getSnapshot(): CalendarPrefs {
  return cachedSnapshot;
}

function getServerSnapshot(): CalendarPrefs {
  return DEFAULT_PREFS;
}

function setSnapshot(next: CalendarPrefs) {
  cachedSnapshot = next;
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    // Another tab wrote to storage — re-read and refresh listeners.
    cachedSnapshot = readFromStorage();
    for (const l of listeners) l();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function useCalendarPrefs() {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setPrefs = useCallback((patch: Partial<CalendarPrefs>) => {
    const merged: CalendarPrefs = {
      ...cachedSnapshot,
      ...patch,
    };
    merged.hourStart = clampHour(merged.hourStart, 0, 23);
    merged.hourEnd = clampHour(merged.hourEnd, merged.hourStart + 1, 24);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    }
    setSnapshot(merged);
  }, []);

  const toggle24h = useCallback(() => {
    setPrefs({ show24h: !cachedSnapshot.show24h });
  }, [setPrefs]);

  // Effective range derives from the snapshot — no new object unless we have
  // to (`show24h` flip changes the values, otherwise return prefs).
  const effectiveRange: { hourStart: number; hourEnd: number } = prefs.show24h
    ? FULL_DAY_RANGE
    : prefs;

  return { prefs, setPrefs, toggle24h, effectiveRange };
}

const FULL_DAY_RANGE = { hourStart: 0, hourEnd: 24 } as const;
