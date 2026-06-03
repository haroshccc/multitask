/**
 * Framework projection engine.
 *
 * Turns a framework's weekly-base templates (+ per-date overrides + effective
 * ranges) into concrete, dated occurrences over a window — so the calendar can
 * render framework blocks (faded) and per-day labels alongside tasks/events.
 *
 * Pure functions, no IO. Mirrors the spirit of calendar-utils' expandRrule but
 * scoped to the framework data model (weekly day-of-week + date overrides).
 */

import type {
  Framework,
  FrameworkBlock,
  FrameworkBlockOccurrence,
  FrameworkBlockOccurrenceView,
  FrameworkDayLabel,
  FrameworkDayLabelView,
} from "@/lib/types/frameworks";

// ── date helpers ────────────────────────────────────────────────────────────

/** Local yyyy-mm-dd for a Date. */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Parse a yyyy-mm-dd string into a local Date at midnight. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** 540 -> "09:00" */
export function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "09:30" -> 570 */
export function hhmmToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function atMinutes(day: Date, minutes: number): Date {
  const r = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  r.setMinutes(minutes);
  return r;
}

function daysInMonth(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/**
 * Periodic rule: matches when `cursor` is an exact multiple of the interval
 * from the anchor, in the chosen unit. Only dates on/after the anchor match.
 *   - month: every N months on the anchor's day-of-month (clamped for short
 *            months). e.g. anchor 2026-06-15, N=4 → Jun 15, Oct 15, Feb 15…
 *   - week:  every N*7 days from the anchor (e.g. every 3 weeks).
 *   - day:   every N days from the anchor (e.g. every 10 days).
 */
function matchesPeriodic(
  anchorKey: string | null,
  interval: number | null,
  unit: "day" | "week" | "month",
  cursor: Date
): boolean {
  if (!anchorKey) return false;
  const a = fromDateKey(anchorKey);
  const anc = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const cur = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
  if (cur < anc) return false;
  const n = Math.max(1, interval ?? 1);
  if (unit === "month") {
    const monthsDiff =
      (cur.getFullYear() - anc.getFullYear()) * 12 + (cur.getMonth() - anc.getMonth());
    if (monthsDiff % n !== 0) return false;
    const targetDay = Math.min(anc.getDate(), daysInMonth(cur));
    return cur.getDate() === targetDay;
  }
  const MS_PER_DAY = 86400000;
  const daysDiff = Math.round((cur.getTime() - anc.getTime()) / MS_PER_DAY);
  const step = unit === "week" ? 7 * n : n;
  return daysDiff % step === 0;
}

/** Inclusive-from / inclusive-to test against optional yyyy-mm-dd bounds. */
function withinRange(dateKey: string, from: string | null, to: string | null): boolean {
  if (from && dateKey < from) return false;
  if (to && dateKey > to) return false;
  return true;
}

/** Is this date within the framework's own run horizon (if any)? */
function withinRun(framework: Framework, dateKey: string): boolean {
  return withinRange(dateKey, framework.run_start, framework.run_end);
}

// ── blocks ──────────────────────────────────────────────────────────────────

/**
 * Project framework time blocks into dated occurrences for [from, to].
 *
 * - Weekly blocks repeat on their day_of_week, bounded by effective_from/to and
 *   the framework run horizon.
 * - Date blocks override the weekly block they point at (source_block_id) on
 *   their specific_date: `remove` suppresses it, `modify` replaces its
 *   time/title, `add` injects a one-off block.
 */
export function projectFrameworkBlocks(
  framework: Framework,
  blocks: FrameworkBlock[],
  occurrences: FrameworkBlockOccurrence[],
  from: Date,
  to: Date
): FrameworkBlockOccurrenceView[] {
  const weekly = blocks.filter((b) => b.scope === "weekly");
  const dated = blocks.filter((b) => b.scope === "date");
  const monthly = blocks.filter((b) => b.scope === "monthly");

  // index overrides by `${sourceBlockId}|${date}` and standalone adds by date
  const overrideByKey = new Map<string, FrameworkBlock>();
  const addsByDate = new Map<string, FrameworkBlock[]>();
  for (const d of dated) {
    if (!d.specific_date) continue;
    if (d.override_kind === "add" || !d.source_block_id) {
      const list = addsByDate.get(d.specific_date) ?? [];
      list.push(d);
      addsByDate.set(d.specific_date, list);
    } else {
      overrideByKey.set(`${d.source_block_id}|${d.specific_date}`, d);
    }
  }

  // index occurrence state by `${blockId}|${date}`
  const statusByKey = new Map<string, FrameworkBlockOccurrence>();
  for (const o of occurrences) statusByKey.set(`${o.block_id}|${o.occ_date}`, o);

  const out: FrameworkBlockOccurrenceView[] = [];

  const fromKey = toDateKey(from);
  const toKey = toDateKey(to);

  for (let cursor = new Date(from); toDateKey(cursor) <= toKey; cursor = addDays(cursor, 1)) {
    const dateKey = toDateKey(cursor);
    if (dateKey < fromKey) continue;
    if (!withinRun(framework, dateKey)) continue;
    const dow = cursor.getDay();

    // weekly blocks for this weekday (+ any date override)
    for (const w of weekly) {
      if (w.day_of_week !== dow) continue;
      if (!withinRange(dateKey, w.effective_from, w.effective_to)) continue;

      const override = overrideByKey.get(`${w.id}|${dateKey}`);
      let eff: FrameworkBlock = w;
      if (override) {
        if (override.override_kind === "remove") continue;
        eff = { ...w, ...override, id: w.id }; // keep stable block id for state
      }
      out.push(viewFromBlock(framework, eff, w.id, cursor, dateKey, statusByKey));
    }

    // standalone one-off adds
    for (const a of addsByDate.get(dateKey) ?? []) {
      out.push(viewFromBlock(framework, a, a.id, cursor, dateKey, statusByKey));
    }

    // periodic blocks (every N days/weeks/months from the anchor)
    for (const m of monthly) {
      if (!withinRange(dateKey, m.effective_from, m.effective_to)) continue;
      if (!matchesPeriodic(m.month_anchor, m.month_interval, m.period_unit, cursor)) continue;
      out.push(viewFromBlock(framework, m, m.id, cursor, dateKey, statusByKey));
    }
  }

  return out;
}

function viewFromBlock(
  framework: Framework,
  block: FrameworkBlock,
  stateBlockId: string,
  day: Date,
  dateKey: string,
  statusByKey: Map<string, FrameworkBlockOccurrence>
): FrameworkBlockOccurrenceView {
  const occ = statusByKey.get(`${stateBlockId}|${dateKey}`);
  return {
    id: `fwblock:${stateBlockId}:${dateKey}`,
    frameworkId: framework.id,
    blockId: stateBlockId,
    title: block.title,
    color: block.color ?? framework.color ?? null,
    start: atMinutes(day, block.start_minute),
    end: atMinutes(day, block.end_minute),
    date: dateKey,
    status: occ?.status ?? null,
  };
}

// ── day labels ────────────────────────────────────────────────────────────────

/**
 * Resolve one label per date for [from, to]. A date-scoped label overrides the
 * weekly one for that day. Returns a map keyed by yyyy-mm-dd.
 */
export function projectFrameworkDayLabels(
  framework: Framework,
  labels: FrameworkDayLabel[],
  from: Date,
  to: Date
): Map<string, FrameworkDayLabelView> {
  const weekly = labels.filter((l) => l.scope === "weekly");
  const monthly = labels.filter((l) => l.scope === "monthly");
  const byDate = new Map<string, FrameworkDayLabel>();
  for (const l of labels) {
    if (l.scope === "date" && l.specific_date) byDate.set(l.specific_date, l);
  }

  const result = new Map<string, FrameworkDayLabelView>();
  const toKey = toDateKey(to);

  for (let cursor = new Date(from); toDateKey(cursor) <= toKey; cursor = addDays(cursor, 1)) {
    const dateKey = toDateKey(cursor);
    if (!withinRun(framework, dateKey)) continue;
    const dow = cursor.getDay();

    const dateOverride = byDate.get(dateKey);
    let chosen: FrameworkDayLabel | undefined = dateOverride;
    if (!chosen) {
      chosen = weekly.find(
        (l) =>
          l.day_of_week === dow &&
          withinRange(dateKey, l.effective_from, l.effective_to)
      );
    }
    if (!chosen) {
      chosen = monthly.find(
        (l) =>
          withinRange(dateKey, l.effective_from, l.effective_to) &&
          matchesPeriodic(l.month_anchor, l.month_interval, l.period_unit, cursor)
      );
    }
    if (chosen && chosen.label.trim()) {
      result.set(dateKey, {
        frameworkId: framework.id,
        date: dateKey,
        label: chosen.label,
        color: chosen.color ?? framework.color ?? null,
      });
    }
  }

  return result;
}
