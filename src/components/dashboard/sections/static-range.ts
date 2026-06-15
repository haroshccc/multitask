import type { DashboardRange } from "@/lib/hooks/useDateRange";

// =============================================================================
// Read-only DashboardRange builders for the fixed home dashboard.
//
// The redesigned dashboard no longer carries a global URL-backed range —
// each section owns its own date logic. Reused legacy widgets (BriefBanner,
// RangeKpis) still read DashboardRangeContext, so we feed them a static,
// non-navigable range. The setters are intentionally no-ops: these widgets
// only consume view/anchor/range/label.
// =============================================================================

const DAY_MS = 24 * 60 * 60 * 1000;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Sunday-anchored week start (Israeli convention). */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

const noop = () => {};

export function staticDayRange(anchor: Date): DashboardRange {
  const from = startOfDay(anchor);
  const to = new Date(from.getTime() + DAY_MS);
  return {
    view: "day",
    anchor: toIsoDate(from),
    range: { from: from.toISOString(), to: to.toISOString() },
    label: from.toLocaleDateString("he-IL", {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
    isCurrent: toIsoDate(new Date()) === toIsoDate(from),
    setView: noop,
    step: noop,
    resetToToday: noop,
  };
}

export function staticWeekRange(anchor: Date): DashboardRange {
  const from = startOfWeek(anchor);
  const to = new Date(from.getTime() + 7 * DAY_MS);
  const end = new Date(to.getTime() - DAY_MS);
  return {
    view: "week",
    anchor: toIsoDate(from),
    range: { from: from.toISOString(), to: to.toISOString() },
    label: `${from.getDate()}.${from.getMonth() + 1} – ${end.getDate()}.${end.getMonth() + 1}`,
    isCurrent: startOfWeek(new Date()).getTime() === from.getTime(),
    setView: noop,
    step: noop,
    resetToToday: noop,
  };
}
