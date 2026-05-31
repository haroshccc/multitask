import { useCallback, useSyncExternalStore } from "react";

/**
 * Focus-session notification preferences (per user, per device).
 *
 * Stored in `localStorage` under `multitask:focus-prefs`, following the same
 * lightweight, no-DB pattern as `useCalendarPrefs`. The FocusSessionProvider
 * reads these to decide whether to alert at all, which window counts as
 * "late", the default countdown length, and whether to chime / fire system
 * notifications.
 *
 * NOTE: `useSyncExternalStore` requires a stable snapshot reference between
 * updates — keep one shared `cachedSnapshot` and only swap it on real change.
 */

export interface FocusPrefs {
  /** Master switch — when false, no due-task alerts fire at all. */
  enabled: boolean;
  /** Show OS/browser notifications (in addition to the in-app surfaces). */
  systemNotifications: boolean;
  /** Play the chime on alert + time-up. */
  sound: boolean;
  /** Countdown length (minutes) for a task that has no duration set. */
  defaultDurationMin: number;
  /** Still alert if the start time passed at most this many minutes ago. */
  lateCatchMin: number;
}

const STORAGE_KEY = "multitask:focus-prefs";

const DEFAULT_PREFS: FocusPrefs = {
  enabled: true,
  systemNotifications: true,
  sound: true,
  defaultDurationMin: 15,
  lateCatchMin: 15,
};

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function readFromStorage(): FocusPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const p = JSON.parse(raw) as Partial<FocusPrefs>;
    return {
      enabled: p.enabled ?? DEFAULT_PREFS.enabled,
      systemNotifications: p.systemNotifications ?? DEFAULT_PREFS.systemNotifications,
      sound: p.sound ?? DEFAULT_PREFS.sound,
      defaultDurationMin: clampInt(p.defaultDurationMin, 1, 600, DEFAULT_PREFS.defaultDurationMin),
      lateCatchMin: clampInt(p.lateCatchMin, 0, 240, DEFAULT_PREFS.lateCatchMin),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

let cachedSnapshot: FocusPrefs = readFromStorage();
const listeners = new Set<() => void>();

function getSnapshot(): FocusPrefs {
  return cachedSnapshot;
}

function getServerSnapshot(): FocusPrefs {
  return DEFAULT_PREFS;
}

function setSnapshot(next: FocusPrefs) {
  cachedSnapshot = next;
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
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

/** Non-reactive read — for code paths outside React (none currently, but
 *  handy and keeps the source of truth in one place). */
export function getFocusPrefs(): FocusPrefs {
  return cachedSnapshot;
}

export function useFocusPrefs() {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setPrefs = useCallback((patch: Partial<FocusPrefs>) => {
    const merged: FocusPrefs = { ...cachedSnapshot, ...patch };
    merged.defaultDurationMin = clampInt(merged.defaultDurationMin, 1, 600, DEFAULT_PREFS.defaultDurationMin);
    merged.lateCatchMin = clampInt(merged.lateCatchMin, 0, 240, DEFAULT_PREFS.lateCatchMin);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    }
    setSnapshot(merged);
  }, []);

  return { prefs, setPrefs };
}
