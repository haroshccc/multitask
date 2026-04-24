import { useCallback, useSyncExternalStore } from "react";

/**
 * Calendar preferences (per user, per device).
 *
 * Stored in `localStorage` under `multitask:calendar-prefs`. This is
 * deliberately a lightweight client-side cache — no DB round-trip, no
 * Realtime invalidation. If we later want these synced across devices,
 * move the storage layer to `user_dashboard_layouts.widget_state` (which
 * is already scoped per user and per screen_key, so the schema is there).
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

function readPrefs(): CalendarPrefs {
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

function clampHour(h: number, min: number, max: number): number {
  if (!Number.isFinite(h)) return min;
  return Math.max(min, Math.min(max, Math.round(h)));
}

// Tiny event bus so multiple hook instances in the same document stay in sync.
const listeners = new Set<() => void>();
function emit() {
  for (const l of listeners) l();
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCalendarPrefs() {
  const prefs = useSyncExternalStore(
    subscribe,
    readPrefs,
    () => DEFAULT_PREFS
  );

  const setPrefs = useCallback((next: Partial<CalendarPrefs>) => {
    const merged: CalendarPrefs = {
      ...readPrefs(),
      ...next,
    };
    // Normalize: hourEnd must be > hourStart.
    merged.hourStart = clampHour(merged.hourStart, 0, 23);
    merged.hourEnd = clampHour(merged.hourEnd, merged.hourStart + 1, 24);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    emit();
  }, []);

  const toggle24h = useCallback(() => {
    setPrefs({ show24h: !readPrefs().show24h });
  }, [setPrefs]);

  /** The effective range actually shown on the grid. */
  const effectiveRange = prefs.show24h
    ? { hourStart: 0, hourEnd: 24 }
    : { hourStart: prefs.hourStart, hourEnd: prefs.hourEnd };

  return { prefs, setPrefs, toggle24h, effectiveRange };
}
