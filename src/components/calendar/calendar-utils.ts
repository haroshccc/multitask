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
  /** list_id for tasks, null for events. Used by Lists Banner visibility. */
  listId: string | null;
  /** For tasks: true if completed_at is set. */
  completed: boolean;
  /** Raw source (for click → open modal). */
  source: Task | EventRow;
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
export function isMultiDay(item: { start: Date; end: Date; allDay: boolean }): boolean {
  if (item.allDay) return true;
  // An event that ends exactly at 00:00 the next day is still "single-day".
  const endAdjusted = new Date(item.end.getTime() - 1);
  return !isSameDay(item.start, endAdjusted);
}

// Formatting (Hebrew locale) -------------------------------------------------

const HE = "he-IL";

export function formatHour(d: Date): string {
  return d.toLocaleTimeString(HE, { hour: "2-digit", minute: "2-digit" });
}

export function formatDayShort(d: Date): string {
  return d.toLocaleDateString(HE, { weekday: "short", day: "numeric", month: "numeric" });
}

export function formatDayLong(d: Date): string {
  return d.toLocaleDateString(HE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatMonthYear(d: Date): string {
  return d.toLocaleDateString(HE, { month: "long", year: "numeric" });
}

export function formatWeekRange(d: Date): string {
  const s = startOfWeek(d);
  const e = addDays(s, 6);
  const sameMonth = isSameMonth(s, e);
  if (sameMonth) {
    return `${s.getDate()}–${e.getDate()} ${e.toLocaleDateString(HE, { month: "long", year: "numeric" })}`;
  }
  return `${s.toLocaleDateString(HE, { day: "numeric", month: "short" })} – ${e.toLocaleDateString(HE, { day: "numeric", month: "short", year: "numeric" })}`;
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
  };
}

export function eventToItem(e: EventRow): CalendarItem {
  return {
    id: `event:${e.id}`,
    kind: "event",
    title: e.title,
    start: new Date(e.starts_at),
    end: new Date(e.ends_at),
    allDay: e.all_day,
    color: null,
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
