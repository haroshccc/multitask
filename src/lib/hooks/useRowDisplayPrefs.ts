import { useEffect, useState } from "react";

/**
 * Per-user preference for which badges show next to a task row.
 * Persisted in localStorage. Each key maps to whether the badge is rendered.
 */
export interface RowDisplayPrefs {
  urgency: boolean;          // single-star chip
  subtasks: boolean;         // N/Total counter
  timer: boolean;            // elapsed time + play button
  link: boolean;             // external_url icon
  attachments: boolean;      // attachment count
  assignee: boolean;         // assignee avatar
  alarm: boolean;            // notification/reminder bell
  dueDate: boolean;          // due_at chip
  estimated: boolean;        // estimated hours chip
  estimatedVsActual: boolean; // progress vs estimate
}

export const DEFAULT_ROW_DISPLAY: RowDisplayPrefs = {
  urgency: true,
  subtasks: true,
  timer: true,
  link: false,
  attachments: false,
  assignee: false,
  alarm: false,
  dueDate: false,
  estimated: false,
  estimatedVsActual: false,
};

/** Spec rendered as an array so the settings UI can map labels & describe them. */
export const ROW_DISPLAY_FIELDS: {
  key: keyof RowDisplayPrefs;
  label: string;
  description: string;
}[] = [
  {
    key: "urgency",
    label: "כוכב דחיפות",
    description: "כוכב יחיד עם המספר; לחיצה פותחת בחירת 1-5",
  },
  {
    key: "subtasks",
    label: "מונה תת-משימות",
    description: "כמה הושלמו מתוך הסה\"כ",
  },
  {
    key: "timer",
    label: "סטופר וזמן בפועל",
    description: "כפתור הפעלה/עצירה + סך הזמן שעבר",
  },
  {
    key: "link",
    label: "קישור חיצוני",
    description: "אייקון קישור אם למשימה יש URL חיצוני",
  },
  {
    key: "attachments",
    label: "צירופים",
    description: "מונה צירופים (קבצים / הקלטות / מחשבות)",
  },
  {
    key: "assignee",
    label: "אחראי / משותפים",
    description: "אווטאר של מי שאחראי למשימה",
  },
  {
    key: "alarm",
    label: "התראה",
    description: "פעמון אם יש תזכורת מתוזמנת",
  },
  {
    key: "dueDate",
    label: "תאריך יעד",
    description: "תאריך הגשה (due_at)",
  },
  {
    key: "estimated",
    label: "זמן שהוקצה",
    description: "הערכת שעות (estimated_hours)",
  },
  {
    key: "estimatedVsActual",
    label: "בפועל מתוך הקצאה",
    description: "אחוז זמן בפועל לעומת ההקצאה (חריגה / עודף)",
  },
];

const STORAGE_KEY = "multitask.rowDisplayPrefs";

export function useRowDisplayPrefs(): [
  RowDisplayPrefs,
  (next: Partial<RowDisplayPrefs>) => void,
  () => void,
] {
  const [prefs, setPrefs] = useState<RowDisplayPrefs>(() => {
    if (typeof window === "undefined") return DEFAULT_ROW_DISPLAY;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_ROW_DISPLAY;
      const parsed = JSON.parse(raw) as Partial<RowDisplayPrefs>;
      return { ...DEFAULT_ROW_DISPLAY, ...parsed };
    } catch {
      return DEFAULT_ROW_DISPLAY;
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  // Cross-tab sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue) as Partial<RowDisplayPrefs>;
        setPrefs({ ...DEFAULT_ROW_DISPLAY, ...parsed });
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = (next: Partial<RowDisplayPrefs>) => {
    setPrefs((current) => ({ ...current, ...next }));
  };

  const reset = () => setPrefs(DEFAULT_ROW_DISPLAY);

  return [prefs, update, reset];
}
