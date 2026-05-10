import { useEffect, useState } from "react";

export interface GanttColumnPref {
  id: string;
  visible: boolean;
  label?: string;
}

const STORAGE_KEY = "multitask.gantt.columnPrefs.v1";

export const GANTT_STANDARD_COLUMNS: Array<{
  id: string;
  defaultLabel: string;
  alwaysVisible?: boolean;
  defaultHidden?: boolean;
}> = [
  { id: "title", defaultLabel: "משימה", alwaysVisible: true },
  { id: "task_list", defaultLabel: "רשימה" },
  { id: "description", defaultLabel: "תיאור" },
  { id: "scheduled_at", defaultLabel: "התחלה" },
  { id: "end_date", defaultLabel: "סיום" },
  { id: "deadline_at", defaultLabel: "דד-ליין", defaultHidden: true },
  { id: "urgency", defaultLabel: "דחיפות" },
  { id: "status", defaultLabel: "סטאטוס", defaultHidden: true },
  { id: "duration_minutes", defaultLabel: "משך" },
  { id: "dependencies", defaultLabel: "תלויות" },
  { id: "percent_complete", defaultLabel: "% סיום" },
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
    if (!pref) {
      if (std?.defaultHidden) return false;
      return !!std;
    }
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

  const enableCustomField = (fieldId: string) => {
    setPrefs((curr) => {
      const idx = curr.findIndex((p) => p.id === fieldId);
      if (idx !== -1) {
        const next = [...curr];
        next[idx] = { ...next[idx]!, visible: true };
        return next;
      }
      return [...curr, { id: fieldId, visible: true }];
    });
  };

  return { isVisible, getLabel, toggleVisible, renameColumn, enableCustomField };
}
