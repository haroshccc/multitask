/**
 * Calendar domain helpers — unified shape for "calendar items" that can be
 * either tasks (scheduled_at + duration_minutes) or events (starts_at/ends_at).
 *
 * All views (day, week, month) operate on this normalized item.
 */
import type { EventRow, Task, TimeEntry } from "@/lib/types/domain";

export type CalendarItemKind = "task" | "event" | "deadline";
export type LayerMode = "both" | "tasks" | "events";

export interface CalendarItem {
  id: string;
  kind: CalendarItemKind;
  title: string;
  /** Plain-text description / notes — surfaced in hover tooltips. */
  description: string | null;
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
  /** Task ownership mode — used for visual distinction in rendering. */
  ownershipMode?: "mine" | "delegated" | "assigned";
  /** Whether task requires approval and is pending */
  pendingApproval?: boolean;
  /** True when the underlying task/event repeats — either via an RRULE
   *  (`recurrence_rule`) or via ad-hoc `extra_occurrences`. Drives the
   *  small "repeat" glyph the views draw on the chip/block. */
  recurring?: boolean;
  /** Set on synthetic items dragged out of the scheduling panel (a task with
   *  no scheduled_at yet). On drop the page schedules the task rather than
   *  moving an existing block, preserving its real duration (or none). */
  isUnscheduledDraft?: boolean;
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

export function taskToItem(
  t: Task,
  listColor: string | null,
  currentUserId?: string | null
): CalendarItem | null {
  if (!t.scheduled_at) return null;
  const start = new Date(t.scheduled_at);
  // Default: a scheduled task with no explicit duration takes 15 minutes
  // on the calendar. This matches the user's "if I just dropped a date,
  // don't pretend I committed to a one-hour block" expectation.
  const durationMin = t.duration_minutes ?? 15;
  const end = new Date(start.getTime() + durationMin * MIN);

  let ownershipMode: CalendarItem["ownershipMode"] = "mine";
  if (currentUserId) {
    if (t.owner_id !== currentUserId && t.assignee_user_id === currentUserId) {
      ownershipMode = "assigned";
    } else if (
      t.owner_id === currentUserId &&
      t.assignee_user_id &&
      t.assignee_user_id !== currentUserId
    ) {
      ownershipMode = "delegated";
    }
  }

  return {
    id: `task:${t.id}`,
    kind: "task",
    title: t.title,
    description: t.description ?? null,
    start,
    end,
    allDay: false,
    color: listColor,
    listId: t.task_list_id,
    completed: !!t.completed_at,
    source: t,
    isPhase: !!t.is_phase,
    ownershipMode,
    pendingApproval: t.status === "pending_approval",
    recurring: !!t.recurrence_rule || taskExtraOccurrences(t).length > 0,
  };
}

/**
 * Parse a task's `extra_occurrences` JSONB column into a sorted Date[] —
 * the ad-hoc standalone occurrences the user added on top of any RRULE.
 * Invalid / non-string entries are dropped.
 */
export function taskExtraOccurrences(t: Task): Date[] {
  const raw = (t as { extra_occurrences?: unknown }).extra_occurrences;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === "string")
    .map((s) => new Date(s))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Parse a task's `excluded_occurrences` JSONB column into a Set of ISO
 * timestamp strings — the RRULE-expanded instances the user has moved
 * away (suppressed) via a single-occurrence reschedule.
 */
export function taskExcludedOccurrences(t: Task): Set<string> {
  const raw = (t as { excluded_occurrences?: unknown }).excluded_occurrences;
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.filter((x): x is string => typeof x === "string"));
}

/**
 * The full set of occurrence start-times for a task inside [from, to):
 * RRULE-expanded occurrences (if any) merged with the task's ad-hoc
 * `extra_occurrences`, minus any `excluded_occurrences`, de-duplicated
 * and sorted. When the task has no RRULE the base `scheduled_at` is
 * seeded as the first occurrence so a plain task with only extra dates
 * still shows its original slot.
 */
export function expandTaskOccurrences(
  t: Task,
  base: CalendarItem,
  from: Date,
  to: Date
): Date[] {
  let occ: Date[] = [];
  if (t.recurrence_rule) {
    try {
      occ = expandRrule(t.recurrence_rule, base.start, from, to);
    } catch {
      occ = [];
    }
  } else if (base.start >= from && base.start < to) {
    occ = [base.start];
  }
  // Drop instances the user moved away (single-occurrence reschedule).
  const excluded = taskExcludedOccurrences(t);
  if (excluded.size > 0) {
    occ = occ.filter((d) => !excluded.has(d.toISOString()));
  }
  const seen = new Set(occ.map((d) => d.getTime()));
  for (const d of taskExtraOccurrences(t)) {
    if (d < from || d >= to) continue;
    if (seen.has(d.getTime())) continue;
    seen.add(d.getTime());
    occ.push(d);
  }
  occ.sort((a, b) => a.getTime() - b.getTime());
  return occ;
}

/**
 * Render a task's `deadline_at` as a separate, visually-distinct calendar
 * item. Always 15 minutes wide so it claims a quarter-hour slot regardless
 * of how the task is otherwise scheduled. The renderer uses `kind:
 * "deadline"` to draw it as a flat label + hourglass with only an underline
 * in the list color — no border, no background block.
 *
 * Returns null when the task has no deadline or is already completed
 * (a met deadline is no longer noise to look at).
 */
export function taskDeadlineToItem(
  t: Task,
  listColor: string | null
): CalendarItem | null {
  if (!t.deadline_at) return null;
  if (t.completed_at) return null;
  const start = new Date(t.deadline_at);
  const end = new Date(start.getTime() + 15 * MIN);
  return {
    id: `deadline:${t.id}`,
    kind: "deadline",
    title: t.title,
    description: t.description ?? null,
    start,
    end,
    allDay: false,
    color: listColor,
    listId: t.task_list_id,
    completed: false,
    source: t,
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
    description: e.description ?? null,
    start: new Date(e.starts_at),
    end: new Date(e.ends_at),
    allDay: e.all_day,
    color: finalColor,
    originalColor,
    calendarId: e.calendar_id ?? null,
    listId: null,
    completed: false,
    source: e,
    recurring: !!e.recurrence_rule,
  };
}

/**
 * Build the multi-line text that hover-tooltips show for a calendar item.
 * Title on the first line; description (if any) on subsequent lines.
 * Truncated to keep the native `title` tooltip readable.
 */
export function itemTooltip(item: CalendarItem): string {
  const desc = item.description?.trim();
  if (!desc) return item.title;
  const trimmed = desc.length > 240 ? `${desc.slice(0, 240)}…` : desc;
  return `${item.title}\n\n${trimmed}`;
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
  /** BYHOUR — list of hours (0..23). Combined with byminute as a cartesian
   *  product to produce multiple occurrences per day. Used for tasks like
   *  "every day at 9 and 17". */
  byhour?: number[];
  /** BYMINUTE — list of minutes (0..59). Defaults to [0] when byhour is set
   *  but byminute is missing. */
  byminute?: number[];
  /** BYSLOT — non-standard extension that lists explicit "HH:MM" slots per
   *  day. When present, it OVERRIDES byhour/byminute and avoids the cartesian
   *  product expansion (so arbitrary tuples like 08:00, 13:30, 21:15 round-
   *  trip cleanly). The picker emits this for multi-slot recurrences. */
  byslot?: Array<{ h: number; m: number }>;
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
  const byhour = map.BYHOUR
    ? map.BYHOUR.split(",")
        .map((h) => Number(h.trim()))
        .filter((n) => Number.isInteger(n) && n >= 0 && n < 24)
    : undefined;
  const byminute = map.BYMINUTE
    ? map.BYMINUTE.split(",")
        .map((m) => Number(m.trim()))
        .filter((n) => Number.isInteger(n) && n >= 0 && n < 60)
    : undefined;
  const byslot = map.BYSLOT
    ? map.BYSLOT.split(",")
        .map((s) => {
          const [h, m] = s.trim().split(":").map(Number);
          return { h, m: m ?? 0 };
        })
        .filter(
          ({ h, m }) =>
            Number.isInteger(h) &&
            h >= 0 &&
            h < 24 &&
            Number.isInteger(m) &&
            m >= 0 &&
            m < 60
        )
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
  return { freq, interval, byday, byhour, byminute, byslot, until };
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
  const { freq, interval, byday, byhour, byminute, byslot, until } = parsed;

  const effectiveEnd = until && until < windowEnd ? until : windowEnd;
  if (anchor >= effectiveEnd) return [];

  const out: Date[] = [];
  // Always compare against the anchor's DATE only for DAILY/WEEKLY rules,
  // since time-of-day comes from BYHOUR (or defaults to midnight) — not the
  // anchor's clock. An anchor at 14:00 would otherwise drop the same day's
  // midnight or 9:00 slot as "before the anchor".
  const useDateOnlyCompare = freq === "DAILY" || freq === "WEEKLY";
  const anchorDateOnly = (() => {
    const x = new Date(anchor);
    x.setHours(0, 0, 0, 0);
    return x;
  })();
  const push = (d: Date) => {
    if (d < windowStart || d >= effectiveEnd) return;
    if (useDateOnlyCompare) {
      const dateOnly = new Date(d);
      dateOnly.setHours(0, 0, 0, 0);
      if (dateOnly < anchorDateOnly) return;
    } else if (d < anchor) return; // recurrence can't predate the master
    out.push(d);
  };

  // Time-of-day slots — BYSLOT (if present) lists explicit per-day slots and
  // bypasses cartesian expansion. Otherwise BYHOUR/BYMINUTE are combined as a
  // cartesian product. Otherwise fall back to the anchor's time. Sorted
  // ascending so occurrences emit in chronological order.
  let slotsPerDay: Array<{ h: number; m: number }>;
  if (byslot && byslot.length > 0) {
    slotsPerDay = [...byslot].sort((a, b) => (a.h - b.h) || (a.m - b.m));
  } else if (byhour && byhour.length > 0) {
    const hours = [...byhour].sort((a, b) => a - b);
    const minutes = byminute && byminute.length > 0 ? [...byminute].sort((a, b) => a - b) : [0];
    slotsPerDay = [];
    for (const h of hours) for (const m of minutes) slotsPerDay.push({ h, m });
  } else {
    // No explicit time in the rule → midnight (start of day). This means
    // "no specific time" tasks always reset at 00:00, not at the anchor's hour.
    slotsPerDay = [{ h: 0, m: 0 }];
  }

  // Helper: emit every slot for a given y/m/d, in order.
  const pushDay = (y: number, mo: number, d: number) => {
    for (const { h, m } of slotsPerDay) {
      push(new Date(y, mo, d, h, m, 0, 0));
    }
  };

  // Helper: replicate the anchor's time on a given y/m/d. Used by MONTHLY
  // and YEARLY which don't support BYHOUR yet.
  const withAnchorTime = (y: number, m: number, d: number): Date => {
    const x = new Date(y, m, d, anchor.getHours(), anchor.getMinutes(), anchor.getSeconds(), anchor.getMilliseconds());
    return x;
  };

  if (freq === "DAILY") {
    // Walk day by day, stepping `interval` at a time, starting at anchor.
    // Cap at maxOccurrences to avoid runaway loops on malformed rules.
    const cursor = new Date(anchor);
    cursor.setHours(0, 0, 0, 0);
    for (let i = 0; i < maxOccurrences && cursor < effectiveEnd; i++) {
      pushDay(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
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
        pushDay(day.getFullYear(), day.getMonth(), day.getDate());
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
