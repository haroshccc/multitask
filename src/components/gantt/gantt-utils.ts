/**
 * Gantt domain helpers — SPEC §17.
 *
 * A task is "schedulable" on the Gantt if it has a `scheduled_at` OR an
 * `estimated_hours`. Rows are ordered by the tasks' natural sort + nesting
 * under `parent_task_id`.
 */
import type { EventRow, Task, TaskDependency } from "@/lib/types/domain";

export type GanttZoom = "day" | "week" | "month" | "quarter";
export type GanttLayer = "both" | "tasks" | "events";

export type GanttRowKind = "task" | "event";

export interface GanttRow {
  id: string;
  kind: GanttRowKind;
  /** Present when kind === "task" */
  task?: Task;
  /** Present when kind === "event" */
  event?: EventRow;
  depth: number;
  /** Start date — from scheduled_at, or "today" if only estimated_hours. */
  start: Date;
  /** End date — start + duration/estimated_hours (min 30 min). */
  end: Date;
  /** Human-readable title for rendering (always present). */
  title: string;
  /** True when the underlying entity is in a "done" state (strike-through). */
  completed: boolean;
}

// Time helpers ---------------------------------------------------------------

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
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

export function diffDays(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / DAY_MS;
}

/** Day width in pixels per zoom level. Columns shift meaning: in "day" each
 *  column = 1 day; in "week" each column = 7 days but we still use "pixels
 *  per day" as the underlying unit so bar math stays consistent. */
export function pxPerDay(zoom: GanttZoom): number {
  switch (zoom) {
    case "day":
      return 72;
    case "week":
      return 22;
    case "month":
      return 8;
    case "quarter":
      return 3;
  }
}

/** How many days the visible window should span by default. */
export function defaultSpanDays(zoom: GanttZoom): number {
  switch (zoom) {
    case "day":
      return 14;
    case "week":
      return 84; // 12 weeks
    case "month":
      return 180; // ~6 months
    case "quarter":
      return 540; // ~18 months
  }
}

// Row building --------------------------------------------------------------

/**
 * Calculate a task's rendered timing on the Gantt.
 * Priority: scheduled_at + duration_minutes → scheduled_at + estimated_hours
 *           → today + estimated_hours → null (skip).
 */
export function calcTaskTiming(task: Task, fallbackStart: Date = new Date()):
  | { start: Date; end: Date }
  | null {
  const hasEither =
    task.scheduled_at != null ||
    task.estimated_hours != null ||
    task.duration_minutes != null;
  if (!hasEither) return null;
  const start = task.scheduled_at ? new Date(task.scheduled_at) : fallbackStart;
  let durationMs: number;
  if (task.duration_minutes != null) {
    durationMs = task.duration_minutes * 60_000;
  } else if (task.estimated_hours != null) {
    durationMs = task.estimated_hours * HOUR_MS;
  } else {
    durationMs = HOUR_MS; // 1 hour default when only scheduled_at is set
  }
  if (durationMs < 30 * 60_000) durationMs = 30 * 60_000;
  return { start, end: new Date(start.getTime() + durationMs) };
}

/**
 * Build the ordered + indented row list. Parents appear above children.
 * Tasks with no schedulable timing are filtered out.
 *
 * When `events` is provided and `layer` allows it, events render as flat
 * additional rows (no hierarchy — events don't have parents).
 */
export function buildRows(
  tasks: Task[],
  events: EventRow[] = [],
  layer: GanttLayer = "both"
): GanttRow[] {
  const rows: GanttRow[] = [];
  const fallback = new Date();

  if (layer !== "events") {
    const byId = new Map<string, Task>();
    const childrenOf = new Map<string | null, Task[]>();
    for (const t of tasks) {
      byId.set(t.id, t);
      const pid = t.parent_task_id ?? null;
      if (!childrenOf.has(pid)) childrenOf.set(pid, []);
      childrenOf.get(pid)!.push(t);
    }
    for (const arr of childrenOf.values()) {
      arr.sort((a, b) => a.sort_order - b.sort_order);
    }

    const walk = (pid: string | null, depth: number) => {
      const kids = childrenOf.get(pid) ?? [];
      for (const t of kids) {
        const timing = calcTaskTiming(t, fallback);
        if (timing) {
          rows.push({
            id: `task:${t.id}`,
            kind: "task",
            task: t,
            depth,
            start: timing.start,
            end: timing.end,
            title: t.title,
            completed: !!t.completed_at,
          });
        }
        walk(t.id, depth + 1);
      }
    };
    const orphans = tasks.filter(
      (t) => t.parent_task_id && !byId.has(t.parent_task_id)
    );
    walk(null, 0);
    for (const o of orphans) {
      const timing = calcTaskTiming(o, fallback);
      if (timing) {
        rows.push({
          id: `task:${o.id}`,
          kind: "task",
          task: o,
          depth: 0,
          start: timing.start,
          end: timing.end,
          title: o.title,
          completed: !!o.completed_at,
        });
      }
    }
  }

  if (layer !== "tasks") {
    for (const e of events) {
      rows.push({
        id: `event:${e.id}`,
        kind: "event",
        event: e,
        depth: 0,
        start: new Date(e.starts_at),
        end: new Date(e.ends_at),
        title: e.title,
        completed: false,
      });
    }
  }

  return rows;
}

// Critical path --------------------------------------------------------------

/**
 * Compute which tasks are on the critical path.
 *
 * Definition for this MVP:
 *   - Project end = max(end) across all rows.
 *   - A task is on critical path if:
 *       (a) its end equals project end, AND it has no unfinished successor
 *           still pushing it further; OR
 *       (b) it is a predecessor of a critical task via finish_to_start, with
 *           its end equal to the dependent task's start (zero slack).
 *
 * Simplification: we only consider `finish_to_start` edges here. The other
 * three relation types are rare; this can be extended if needed.
 */
export function computeCriticalPath(
  rows: GanttRow[],
  deps: TaskDependency[]
): Set<string> {
  if (rows.length === 0) return new Set();

  // Only task rows can be on the critical path (dependencies live on tasks).
  const byId = new Map<string, GanttRow>();
  for (const r of rows) {
    if (r.kind === "task" && r.task) byId.set(r.task.id, r);
  }

  // Forward edges: predecessorId → [successorId...]
  const forward = new Map<string, string[]>();
  // Reverse edges: successorId → [predecessorId...]
  const reverse = new Map<string, string[]>();
  for (const d of deps) {
    if (d.relation !== "finish_to_start") continue;
    if (!byId.has(d.task_id) || !byId.has(d.depends_on_task_id)) continue;
    // depends_on_task_id finishes → task_id can start (FS).
    const pred = d.depends_on_task_id;
    const succ = d.task_id;
    if (!forward.has(pred)) forward.set(pred, []);
    forward.get(pred)!.push(succ);
    if (!reverse.has(succ)) reverse.set(succ, []);
    reverse.get(succ)!.push(pred);
  }

  const projectEnd = Math.max(...rows.map((r) => r.end.getTime()));
  const EPS = 60 * 60_000; // 1 hour tolerance

  const critical = new Set<string>();

  // Seed: task rows whose end == projectEnd.
  for (const r of rows) {
    if (r.kind !== "task" || !r.task) continue;
    if (Math.abs(r.end.getTime() - projectEnd) < EPS) {
      critical.add(r.task.id);
    }
  }

  // Walk backward along reverse edges, marking zero-slack predecessors.
  const stack = [...critical];
  const visited = new Set(stack);
  while (stack.length > 0) {
    const current = stack.pop()!;
    const currentRow = byId.get(current);
    if (!currentRow) continue;
    const preds = reverse.get(current) ?? [];
    for (const p of preds) {
      const predRow = byId.get(p);
      if (!predRow) continue;
      // Zero slack: predecessor ends exactly when current starts.
      const slack = currentRow.start.getTime() - predRow.end.getTime();
      if (slack <= EPS) {
        if (!visited.has(p)) {
          visited.add(p);
          critical.add(p);
          stack.push(p);
        }
      }
    }
  }

  return critical;
}

// Header ticks ---------------------------------------------------------------

export interface TickGroup {
  label: string;
  start: Date;
  end: Date;
  /** For the secondary row below: sub-ticks inside this group. */
  subTicks: { label: string; date: Date }[];
}

export function buildTicks(
  from: Date,
  to: Date,
  zoom: GanttZoom
): TickGroup[] {
  const groups: TickGroup[] = [];
  const locale = "he-IL";

  if (zoom === "day") {
    // Group by week (sub-ticks = days).
    let cursor = startOfWeek(from);
    while (cursor < to) {
      const groupEnd = addDays(cursor, 7);
      const label = `שבוע ${weekNumber(cursor)} · ${cursor.toLocaleDateString(locale, { day: "numeric", month: "short" })}`;
      const subTicks: TickGroup["subTicks"] = [];
      for (let i = 0; i < 7; i++) {
        const d = addDays(cursor, i);
        if (d >= from && d < to) {
          subTicks.push({
            label: `${d.toLocaleDateString(locale, { weekday: "narrow" })} ${d.getDate()}`,
            date: d,
          });
        }
      }
      groups.push({ label, start: cursor, end: groupEnd, subTicks });
      cursor = groupEnd;
    }
  } else if (zoom === "week") {
    // Group by month (sub-ticks = week starts).
    let cursor = startOfMonth(from);
    while (cursor < to) {
      const monthEnd = addMonths(cursor, 1);
      const label = cursor.toLocaleDateString(locale, {
        month: "long",
        year: "numeric",
      });
      const subTicks: TickGroup["subTicks"] = [];
      // Weeks that start within this month window.
      let w = startOfWeek(cursor);
      if (w < cursor) w = addDays(w, 7);
      while (w < monthEnd) {
        if (w >= from && w < to) {
          subTicks.push({ label: String(w.getDate()), date: w });
        }
        w = addDays(w, 7);
      }
      groups.push({ label, start: cursor, end: monthEnd, subTicks });
      cursor = monthEnd;
    }
  } else if (zoom === "month") {
    // Group by quarter (sub-ticks = months).
    let cursor = startOfQuarter(from);
    while (cursor < to) {
      const qEnd = addMonths(cursor, 3);
      const q = Math.floor(cursor.getMonth() / 3) + 1;
      const label = `רבעון ${q} · ${cursor.getFullYear()}`;
      const subTicks: TickGroup["subTicks"] = [];
      for (let i = 0; i < 3; i++) {
        const m = addMonths(cursor, i);
        if (m >= from && m < to) {
          subTicks.push({
            label: m.toLocaleDateString(locale, { month: "short" }),
            date: m,
          });
        }
      }
      groups.push({ label, start: cursor, end: qEnd, subTicks });
      cursor = qEnd;
    }
  } else {
    // quarter: group by year, sub-ticks = quarters.
    let cursor = startOfYear(from);
    while (cursor < to) {
      const yEnd = new Date(cursor);
      yEnd.setFullYear(cursor.getFullYear() + 1);
      const label = String(cursor.getFullYear());
      const subTicks: TickGroup["subTicks"] = [];
      for (let i = 0; i < 4; i++) {
        const m = addMonths(cursor, i * 3);
        if (m >= from && m < to) {
          subTicks.push({ label: `Q${i + 1}`, date: m });
        }
      }
      groups.push({ label, start: cursor, end: yEnd, subTicks });
      cursor = yEnd;
    }
  }
  return groups;
}

function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function startOfMonth(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}
function startOfQuarter(d: Date): Date {
  const x = startOfMonth(d);
  const m = x.getMonth();
  x.setMonth(m - (m % 3));
  return x;
}
function startOfYear(d: Date): Date {
  const x = startOfMonth(d);
  x.setMonth(0);
  return x;
}

function weekNumber(d: Date): number {
  // ISO-ish week number — fine for labels.
  const year = d.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const days = Math.floor((d.getTime() - jan1.getTime()) / DAY_MS);
  return Math.ceil((days + jan1.getDay() + 1) / 7);
}
