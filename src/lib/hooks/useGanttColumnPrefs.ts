import { useEffect, useState } from "react";

/**
 * Per-user, per-screen column visibility + label overrides for the Gantt
 * editable table. Persisted to localStorage so the user's pruning sticks
 * across sessions. Standard columns are identified by a stable string id
 * (`title`, `urgency`, `status`, ...); custom fields would extend this
 * via their UUID.
 */
export interface GanttColumnPref {
  id: string;
  /** When false, the column is hidden from the table. `title` can never be
   *  hidden — that's the row's identity. */
  visible: boolean;
  /** Label override. Empty/missing → use the default label. */
  label?: string;
}

const STORAGE_KEY = "multitask.gantt.columnPrefs.v1";

/** Standard columns — order = render order. `title` is always visible. */
export const GANTT_STANDARD_COLUMNS: Array<{
  id: string;
  defaultLabel: string;
  alwaysVisible?: boolean;
}> = [
  { id: "title", defaultLabel: "משימה", alwaysVisible: true },
  { id: "urgency", defaultLabel: "דחיפות" },
  { id: "status", defaultLabel: "סטטוס" },
  { id: "scheduled_at", defaultLabel: "תזמון" },
  { id: "deadline_at", defaultLabel: "דד-ליין" },
  { id: "duration_minutes", defaultLabel: "משך (ד׳)" },
  { id: "dependencies", defaultLabel: "תלויות" },
];

function loadPrefs(): GanttColumnPref[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GanttColumnPref[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p) => typeof p?.id === "string" && typeof p?.visible === "boolean"
    );
  } catch {
    return [];
  }
}

function savePrefs(prefs: GanttColumnPref[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

/**
 * Returns the current prefs map keyed by column id, plus setters that
 * mutate localStorage and re-render. Components consume the resolved
 * `getLabel(id)` and `isVisible(id)` accessors so the storage shape
 * stays an internal detail.
 */
export function useGanttColumnPrefs() {
  const [prefs, setPrefs] = useState<GanttColumnPref[]>(loadPrefs);

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  const byId = new Map(prefs.map((p) => [p.id, p]));

  const isVisible = (id: string): boolean => {
    const std = GANTT_STANDARD_COLUMNS.find((c) => c.id === id);
    if (std?.alwaysVisible) return true;
    const pref = byId.get(id);
    if (!pref) return true; // default = visible
    return pref.visible;
  };

  const getLabel = (id: string, defaultLabel: string): string => {
    const pref = byId.get(id);
    return pref?.label?.trim() || defaultLabel;
  };

  const toggleVisible = (id: string) => {
    setPrefs((curr) => {
      const std = GANTT_STANDARD_COLUMNS.find((c) => c.id === id);
      if (std?.alwaysVisible) return curr;
      const idx = curr.findIndex((p) => p.id === id);
      if (idx === -1) {
        // Not yet in storage — add a hidden override (defaults to visible).
        return [...curr, { id, visible: false }];
      }
      const next = [...curr];
      next[idx] = { ...next[idx]!, visible: !next[idx]!.visible };
      return next;
    });
  };

  const renameColumn = (id: string, label: string) => {
    setPrefs((curr) => {
      const trimmed = label.trim();
      const idx = curr.findIndex((p) => p.id === id);
      if (idx === -1) {
        if (!trimmed) return curr;
        return [...curr, { id, visible: true, label: trimmed }];
      }
      const next = [...curr];
      next[idx] = { ...next[idx]!, label: trimmed || undefined };
      return next;
    });
  };

  return { isVisible, getLabel, toggleVisible, renameColumn };
}
