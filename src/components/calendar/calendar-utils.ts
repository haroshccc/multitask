/**
 * Calendar domain helpers — unified shape for "calendar items" that can be
 * either tasks (scheduled_at + duration_minutes) or events (starts_at/ends_at).
 *
 * All views (day, week, month) operate on this normalized item.
 */
import type { EventRow, Task, TimeEntry } from "@/lib/types/domain";

export type CalendarItemKind = "task" | "event";
export type LayerMode = "both" | "tasks" | "events";

export interface CalendarItem {
  id: string;
  kind: CalendarItemKind;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  color: string | null;
  /**
   * The "underlying" color before a per-event override is applied. When
   * present and different from `color`, the rendering can show a small
   * indicator (the original calendar color) so the override stays
   * visible. Null when there's no override or no parent calendar.
   */
  originalColor?: string | null;
  /** list_id for tasks, null for events. Used by Lists Banner visibility. */
  listId: string | null;
  /** event_calendar_id for events, null for tasks. Drives the calendar
   *  visibility filter. */
  calendarId?: string | null;
  /** For tasks: true if completed_at is set. */
  completed: boolean;
  /** Raw source (for click → open modal). */
  source: Task | EventRow;
  /** For tasks: true when it's a phase (visualize as a background band). */
  isPhase?: boolean;
}

/** Milliseconds in a minute / hour / day — tiny convenience. */
export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

// Date math ------------------------------------------------------------------

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

/** Sunday-first week start (Hebrew / Israeli convention). */
export function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  const dow = x.getDay(); // 0 = Sunday
  x.setDate(x.getDate() - dow);
  return x;
}

export function endOfWeek(d: Date): Date {
  const s = startOfWeek(d);
  return endOfDay(addDays(s, 6));
}

export function startOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}

export function endOfMonth(d: Date): Date {
  const x = startOfMonth(d);
  x.setMonth(x.getMonth() + 1);
  x.setDate(0);
  return endOfDay(x);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** True if the item visibly spans more than one local day (i.e. crosses midnight). */
export function isMultiDay(item: {
  start: Date;
  end: Date;
  allDay: boolean;
  isPhase?: boolean;
}): boolean {
  // Phases always render as a band (they visualize the phase's full lifetime,
  // even a short one-hour phase reads as "this is a group" not a timed item).
  if (item.isPhase) return true;
  if (item.allDay) return true;
  const endAdjusted = new Date(item.end.getTime() - 1);
  return !isSameDay(item.start, endAdjusted);
}

// Formatting (Hebrew locale) -------------------------------------------------
//
// All formatters accept an optional IANA `timeZone` — when passed, the Date's
// instant is rendered *in that zone* instead of the browser's local zone.
// This lets a user in Jerusalem see a calendar in "America/New_York" without
// changing the underlying timestamps in the DB.

const HE = "he-IL";

function withTz(
  options: Intl.DateTimeFormatOptions,
  timeZone?: string
): Intl.DateTimeFormatOptions {
  return timeZone ? { ...options, timeZone } : options;
}

export function formatHour(d: Date, timeZone?: string): string {
  return d.toLocaleTimeString(
    HE,
    withTz({ hour: "2-digit", minute: "2-digit" }, timeZone)
  );
}

export function formatDayShort(d: Date, timeZone?: string): string {
  return d.toLocaleDateString(
    HE,
    withTz({ weekday: "short", day: "numeric", month: "numeric" }, timeZone)
  );
}

export function formatDayLong(d: Date, timeZone?: string): string {
  return d.toLocaleDateString(
    HE,
    withTz(
      {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      },
      timeZone
    )
  );
}

export function formatMonthYear(d: Date, timeZone?: string): string {
  return d.toLocaleDateString(HE, withTz({ month: "long", year: "numeric" }, timeZone));
}

export function formatWeekRange(d: Date, timeZone?: string): string {
  const s = startOfWeek(d);
  const e = addDays(s, 6);
  const sameMonth = isSameMonth(s, e);
  if (sameMonth) {
    return `${s.getDate()}–${e.getDate()} ${e.toLocaleDateString(
      HE,
      withTz({ month: "long", year: "numeric" }, timeZone)
    )}`;
  }
  return `${s.toLocaleDateString(
    HE,
    withTz({ day: "numeric", month: "short" }, timeZone)
  )} – ${e.toLocaleDateString(
    HE,
    withTz({ day: "numeric", month: "short", year: "numeric" }, timeZone)
  )}`;
}

// Item normalization ---------------------------------------------------------

export function taskToItem(t: Task, listColor: string | null): CalendarItem | null {
  if (!t.scheduled_at) return null;
  const start = new Date(t.scheduled_at);
  const durationMin =
    t.duration_minutes ??
    (t.estimated_hours != null ? Math.round(t.estimated_hours * 60) : 60);
  const end = new Date(start.getTime() + durationMin * MIN);
  return {
    id: `task:${t.id}`,
    kind: "task",
    title: t.title,
    start,
    end,
    allDay: false,
    color: listColor,
    listId: t.task_list_id,
    completed: !!t.completed_at,
    source: t,
    isPhase: !!t.is_phase,
  };
}

export function eventToItem(
  e: EventRow,
  calendarColorById?: Map<string, string | null>
): CalendarItem {
  // Color resolution: per-event override (`e.color`) wins, then the
  // event_calendar's color, then null (the renderer falls back to the
  // default amber). `originalColor` exposes the calendar's color when
  // it's been overridden so the UI can paint a small indicator dot.
  const calColor = e.calendar_id
    ? calendarColorById?.get(e.calendar_id) ?? null
    : null;
  const eventColor = e.color ?? null;
  const finalColor = eventColor ?? calColor ?? null;
  const originalColor =
    eventColor && calColor && eventColor !== calColor ? calColor : null;
  return {
    id: `event:${e.id}`,
    kind: "event",
    title: e.title,
    start: new Date(e.starts_at),
    end: new Date(e.ends_at),
    allDay: e.all_day,
    color: finalColor,
    originalColor,
    calendarId: e.calendar_id ?? null,
    listId: null,
    completed: false,
    source: e,
  };
}

/** Clip an item so only the portion inside [from, to) remains; returns null if none. */
export function clipItem(item: CalendarItem, from: Date, to: Date): CalendarItem | null {
  const s = item.start < from ? from : item.start;
  const e = item.end > to ? to : item.end;
  if (e <= s) return null;
  return { ...item, start: s, end: e };
}

// Actual (time_entries) overlay helpers --------------------------------------

export interface ActualStripe {
  taskId: string;
  start: Date;
  end: Date;
}

export function timeEntryToStripe(te: TimeEntry, now: Date): ActualStripe | null {
  const start = new Date(te.started_at);
  const end = te.ended_at ? new Date(te.ended_at) : now;
  if (end <= start) return null;
  return { taskId: te.task_id, start, end };
}

// Overlap layout — column-packing for a single day -----------------------------

export interface LaidOutItem<T> {
  item: T;
  column: number;
  columns: number;
}

/**
 * Columnar packing for timed items in a single day — the standard algorithm
 * for calendar overlaps: sweep line, assign each item to the leftmost column
 * where no currently-open neighbor sits; track max concurrency per cluster.
 */
export function layoutDayOverlaps<T extends { start: Date; end: Date }>(
  items: T[]
): LaidOutItem<T>[] {
  if (items.length === 0) return [];
  const sorted = [...items].sort(
    (a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime()
  );
  const result: LaidOutItem<T>[] = [];
  let cluster: LaidOutItem<T>[] = [];
  let clusterEnd = -Infinity;

  const flushCluster = () => {
    if (cluster.length === 0) return;
    const columns = Math.max(...cluster.map((c) => c.column)) + 1;
    for (const c of cluster) c.columns = columns;
    result.push(...cluster);
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const item of sorted) {
    if (item.start.getTime() >= clusterEnd) {
      flushCluster();
    }
    // Find the leftmost unused column.
    const used = new Set<number>();
    for (const c of cluster) {
      if (c.item.end.getTime() > item.start.getTime()) used.add(c.column);
    }
    let col = 0;
    while (used.has(col)) col++;
    cluster.push({ item, column: col, columns: 0 });
    clusterEnd = Math.max(clusterEnd, item.end.getTime());
  }
  flushCluster();
  return result;
}

/** Percent of the day a point in time occupies (0..100). */
export function dayPercent(d: Date, dayStart: Date): number {
  const ms = d.getTime() - dayStart.getTime();
  const p = (ms / DAY) * 100;
  if (p < 0) return 0;
  if (p > 100) return 100;
  return p;
}

/** Percent of the day a duration spans (0..100). */
export function durationPercent(ms: number): number {
  return (ms / DAY) * 100;
}

// Past-time semantics — a task is "overdue" if its scheduled end slipped past
// without being completed. Events aren't "overdue" — they simply become past.
export function isOverdueTask(item: CalendarItem, now: Date): boolean {
  return item.kind === "task" && !item.completed && item.end.getTime() < now.getTime();
}

export function isPast(item: CalendarItem, now: Date): boolean {
  return item.end.getTime() < now.getTime();
}

export function isPastDay(day: Date, now: Date): boolean {
  const dayEnd = endOfDay(day);
  return dayEnd.getTime() < now.getTime();
}

/**
 * "No specific hour" — used to decide whether a completed task should
 * sink to the bottom of its day's list. Tasks whose `scheduled_at`
 * falls exactly on midnight are treated as floating todos for the day
 * (no time-of-day pin); tasks with any other hour stay at their hour
 * even when completed. Events: never hourless (they always have a
 * concrete starts_at).
 */
export function isHourless(item: CalendarItem): boolean {
  if (item.kind !== "task") return item.allDay;
  return item.start.getHours() === 0 && item.start.getMinutes() === 0;
}

// RRULE expansion ------------------------------------------------------------
//
// Minimal RFC-5545 expander: given an RRULE string, an anchor datetime (the
// master event's `starts_at`), and a window [windowStart, windowEnd),
// returns the timestamps at which the event recurs inside that window.
// Supports DAILY / WEEKLY(+BYDAY) / MONTHLY / YEARLY, INTERVAL, UNTIL.
//
// Every instance keeps the anchor's time-of-day — we only shift the date.
// The master anchor itself is included when it falls inside the window; it
// is NOT treated as "the first instance + others" — it IS one of them.

const WEEKDAY_TO_INDEX: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

interface ParsedRrule {
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  byday?: number[]; // 0..6
  until?: Date;
}

function parseRrule(raw: string): ParsedRrule | null {
  const clean = raw.replace(/^RRULE:/i, "");
  const parts = clean.split(";");
  const map: Record<string, string> = {};
  for (const p of parts) {
    const [k, v] = p.split("=");
    if (k && v) map[k.toUpperCase()] = v;
  }
  const freq = map.FREQ as ParsedRrule["freq"];
  if (!freq || !["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return null;
  const interval = map.INTERVAL ? Math.max(1, Number(map.INTERVAL)) : 1;
  const byday = map.BYDAY
    ? map.BYDAY.split(",")
        .map((d) => WEEKDAY_TO_INDEX[d.trim().toUpperCase()])
        .filter((n) => n !== undefined)
    : undefined;
  let until: Date | undefined;
  if (map.UNTIL) {
    // RRULE UNTIL is either YYYYMMDD or YYYYMMDDTHHMMSSZ.
    const m = map.UNTIL.match(
      /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/
    );
    if (m) {
      const [, y, mo, d, h, mi, s] = m;
      until = new Date(
        Date.UTC(+y, +mo - 1, +d, +(h ?? 23), +(mi ?? 59), +(s ?? 59))
      );
    }
  }
  return { freq, interval, byday, until };
}

/**
 * Expand an RRULE into actual occurrence Dates inside a [windowStart, windowEnd)
 * window, keeping the anchor's time-of-day on every instance.
 */
export function expandRrule(
  rule: string,
  anchor: Date,
  windowStart: Date,
  windowEnd: Date,
  maxOccurrences = 366
): Date[] {
  const parsed = parseRrule(rule);
  if (!parsed) return [];
  const { freq, interval, byday, until } = parsed;

  const effectiveEnd = until && until < windowEnd ? until : windowEnd;
  if (anchor >= effectiveEnd) return [];

  const out: Date[] = [];
  const push = (d: Date) => {
    if (d < windowStart || d >= effectiveEnd) return;
    if (d < anchor) return; // recurrence can't predate the master
    out.push(d);
  };

  // Helper: replicate the anchor's time on a given y/m/d.
  const withAnchorTime = (y: number, m: number, d: number): Date => {
    const x = new Date(y, m, d, anchor.getHours(), anchor.getMinutes(), anchor.getSeconds(), anchor.getMilliseconds());
    return x;
  };

  if (freq === "DAILY") {
    // Walk day by day, stepping `interval` at a time, starting at anchor.
    // Cap at maxOccurrences to avoid runaway loops on malformed rules.
    const cursor = new Date(anchor);
    for (let i = 0; i < maxOccurrences && cursor < effectiveEnd; i++) {
      push(new Date(cursor));
      cursor.setDate(cursor.getDate() + interval);
    }
    return out;
  }

  if (freq === "WEEKLY") {
    // If BYDAY is absent, fall back to anchor's weekday.
    const daySet =
      byday && byday.length > 0 ? new Set(byday) : new Set([anchor.getDay()]);
    // Walk forward one week at a time (of `interval` weeks). For each week,
    // emit every listed weekday that lands within [anchor, effectiveEnd).
    // Align the week start to the week of the anchor (Sun-based locally).
    const weekAnchor = startOfWeek(anchor);
    for (let w = 0; w < maxOccurrences; w++) {
      const weekStart = addDays(weekAnchor, w * interval * 7);
      if (weekStart >= effectiveEnd) break;
      for (let d = 0; d < 7; d++) {
        if (!daySet.has(d)) continue;
        const day = addDays(weekStart, d);
        const dt = withAnchorTime(day.getFullYear(), day.getMonth(), day.getDate());
        push(dt);
      }
    }
    return out;
  }

  if (freq === "MONTHLY") {
    const dom = anchor.getDate();
    for (let i = 0; i < maxOccurrences; i++) {
      const y = anchor.getFullYear();
      const m = anchor.getMonth() + i * interval;
      // Skip months that can't hold the day-of-month (e.g. Feb 30).
      const probe = new Date(y, m + 1, 0); // last day of target month
      if (probe.getDate() < dom) continue;
      const dt = withAnchorTime(y, m, dom);
      if (dt >= effectiveEnd) break;
      push(dt);
    }
    return out;
  }

  if (freq === "YEARLY") {
    const dom = anchor.getDate();
    const mo = anchor.getMonth();
    for (let i = 0; i < maxOccurrences; i++) {
      const y = anchor.getFullYear() + i * interval;
      const probe = new Date(y, mo + 1, 0);
      if (probe.getDate() < dom) continue;
      const dt = withAnchorTime(y, mo, dom);
      if (dt >= effectiveEnd) break;
      push(dt);
    }
    return out;
  }

  return out;
}
