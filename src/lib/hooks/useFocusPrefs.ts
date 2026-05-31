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
  /** What to do when a task is started after its scheduled time:
   *  - "ask": prompt each time (push the schedule now / check near the end)
   *  - "reschedule": silently push the rest of the day forward
   *  - "check-near-end": do nothing now, rely on the next-task reminder */
  lateStartBehavior: "ask" | "reschedule" | "check-near-end";
  /** Minutes before the next scheduled task to remind during a session.
   *  0 = no reminder. */
  nextTaskReminderMin: number;
}

const STORAGE_KEY = "multitask:focus-prefs";

const DEFAULT_PREFS: FocusPrefs = {
  enabled: true,
  systemNotifications: true,
  sound: true,
  defaultDurationMin: 15,
  lateCatchMin: 15,
  lateStartBehavior: "ask",
  nextTaskReminderMin: 15,
};

const LATE_BEHAVIORS = new Set<FocusPrefs["lateStartBehavior"]>([
  "ask",
  "reschedule",
  "check-near-end",
]);

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
      lateStartBehavior:
        p.lateStartBehavior && LATE_BEHAVIORS.has(p.lateStartBehavior)
          ? p.lateStartBehavior
          : DEFAULT_PREFS.lateStartBehavior,
      nextTaskReminderMin: clampInt(p.nextTaskReminderMin, 0, 240, DEFAULT_PREFS.nextTaskReminderMin),
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
    merged.nextTaskReminderMin = clampInt(merged.nextTaskReminderMin, 0, 240, DEFAULT_PREFS.nextTaskReminderMin);
    if (!LATE_BEHAVIORS.has(merged.lateStartBehavior))
      merged.lateStartBehavior = DEFAULT_PREFS.lateStartBehavior;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    }
    setSnapshot(merged);
  }, []);

  return { prefs, setPrefs };
}
