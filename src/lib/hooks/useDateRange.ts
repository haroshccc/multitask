import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export type DashboardView = "day" | "week" | "month";

export interface DashboardRange {
  /** Current view mode (day/week/month). */
  view: DashboardView;
  /** Anchor date (yyyy-mm-dd) — start of the period being viewed. */
  anchor: string;
  /** ISO datetime range covering the viewed period (inclusive start, exclusive end). */
  range: { from: string; to: string };
  /** Hebrew label of the current period — used in the picker header. */
  label: string;
  /** True when the current view contains today. */
  isCurrent: boolean;

  setView: (v: DashboardView) => void;
  /** Step the anchor by ±1 unit of the current view (day/week/month). */
  step: (direction: -1 | 1) => void;
  /** Jump back to "today" — anchor becomes today, view stays the same. */
  resetToToday: () => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
/** Sunday-anchored week start (Israeli convention). */
function startOfWeek(d: Date) {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function startOfMonth(d: Date) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}
function endOfMonth(d: Date) {
  const x = startOfMonth(d);
  x.setMonth(x.getMonth() + 1);
  return x;
}

const HE_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];
const HE_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function formatLabel(view: DashboardView, anchor: Date, isCurrent: boolean): string {
  if (view === "day") {
    if (isCurrent) return `היום · יום ${HE_DAYS[anchor.getDay()]}`;
    return `יום ${HE_DAYS[anchor.getDay()]}, ${anchor.getDate()} ${HE_MONTHS[anchor.getMonth()]}`;
  }
  if (view === "week") {
    const start = startOfWeek(anchor);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const sameMonth = start.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${start.getDate()}–${end.getDate()} ${HE_MONTHS[end.getMonth()]}`;
    }
    return `${start.getDate()} ${HE_MONTHS[start.getMonth()]} – ${end.getDate()} ${HE_MONTHS[end.getMonth()]}`;
  }
  return `${HE_MONTHS[anchor.getMonth()]} ${anchor.getFullYear()}`;
}

/**
 * Centralised date-range state for the dashboard. Persists in URL query
 * params (`?view=...&date=yyyy-mm-dd`) so refreshes and shared links keep
 * the same view.
 *
 * Range computation:
 *   day   → [anchor 00:00, anchor + 24h)
 *   week  → [Sunday 00:00, Sunday + 7d)
 *   month → [1st 00:00, 1st of next month 00:00)
 */
export function useDateRange(): DashboardRange {
  const [params, setParams] = useSearchParams();
  const view = (params.get("view") as DashboardView) || "day";
  const anchor = params.get("date") || toIsoDate(new Date());

  const anchorDate = useMemo(() => parseIsoDate(anchor), [anchor]);

  const range = useMemo(() => {
    if (view === "day") {
      const from = startOfDay(anchorDate);
      const to = new Date(from.getTime() + DAY_MS);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    if (view === "week") {
      const from = startOfWeek(anchorDate);
      const to = new Date(from.getTime() + 7 * DAY_MS);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    const from = startOfMonth(anchorDate);
    const to = endOfMonth(anchorDate);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [view, anchorDate]);

  const isCurrent = useMemo(() => {
    const now = new Date();
    if (view === "day") return toIsoDate(now) === toIsoDate(anchorDate);
    if (view === "week") return startOfWeek(now).getTime() === startOfWeek(anchorDate).getTime();
    return startOfMonth(now).getTime() === startOfMonth(anchorDate).getTime();
  }, [view, anchorDate]);

  const label = useMemo(
    () => formatLabel(view, anchorDate, isCurrent),
    [view, anchorDate, isCurrent],
  );

  const writeParams = useCallback(
    (next: { view?: DashboardView; date?: string }) => {
      const p = new URLSearchParams(params);
      if (next.view !== undefined) p.set("view", next.view);
      if (next.date !== undefined) p.set("date", next.date);
      setParams(p, { replace: true });
    },
    [params, setParams],
  );

  const setView = useCallback(
    (v: DashboardView) => {
      // When switching views, snap anchor to the start-of-period so the
      // displayed label matches the new bucket exactly.
      const snapped =
        v === "day"
          ? toIsoDate(anchorDate)
          : v === "week"
            ? toIsoDate(startOfWeek(anchorDate))
            : toIsoDate(startOfMonth(anchorDate));
      writeParams({ view: v, date: snapped });
    },
    [anchorDate, writeParams],
  );

  const step = useCallback(
    (direction: -1 | 1) => {
      const next = new Date(anchorDate);
      if (view === "day") next.setDate(next.getDate() + direction);
      else if (view === "week") next.setDate(next.getDate() + 7 * direction);
      else next.setMonth(next.getMonth() + direction);
      writeParams({ date: toIsoDate(next) });
    },
    [view, anchorDate, writeParams],
  );

  const resetToToday = useCallback(() => {
    writeParams({ date: toIsoDate(new Date()) });
  }, [writeParams]);

  return {
    view,
    anchor,
    range,
    label,
    isCurrent,
    setView,
    step,
    resetToToday,
  };
}
