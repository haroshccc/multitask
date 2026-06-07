import { useCallback, useSyncExternalStore } from "react";

/**
 * Task-form preferences (per user, per device) — localStorage, same lightweight
 * pattern as useCalendarPrefs. Currently just whether the status field shows in
 * the task create/edit modal. Default off: status is hidden everywhere a task is
 * created until the user turns it on in settings, after which it shows on every
 * task-creation surface (they all share TaskEditModal).
 */
export interface TaskFormPrefs {
  /** Show the סטטוס field in the task editor. Default false. */
  showStatus: boolean;
}

const STORAGE_KEY = "multitask:task-form-prefs";

const DEFAULT_PREFS: TaskFormPrefs = {
  showStatus: false,
};

let cachedSnapshot: TaskFormPrefs = DEFAULT_PREFS;

function readFromStorage(): TaskFormPrefs {
  if (typeof window === "undefined") return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<TaskFormPrefs>;
    return { showStatus: !!parsed.showStatus };
  } catch {
    return DEFAULT_PREFS;
  }
}

// Seed the cached snapshot once.
cachedSnapshot = readFromStorage();

const listeners = new Set<() => void>();

function emit(): void {
  cachedSnapshot = readFromStorage();
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): TaskFormPrefs {
  return cachedSnapshot;
}

export function useTaskFormPrefs() {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_PREFS);

  const setShowStatus = useCallback((value: boolean) => {
    const next: TaskFormPrefs = { ...readFromStorage(), showStatus: value };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    emit();
  }, []);

  return { prefs, setShowStatus };
}
