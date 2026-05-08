/**
 * Helpers for recurring tasks. The DB stores per-occurrence completion as
 * a JSONB array of ISO timestamps in `tasks.completed_occurrences`. These
 * helpers normalize that array, decide which occurrence is "active" right
 * now (for the dim-row treatment in the task list), and produce the patch
 * payloads for toggling a single occurrence.
 */
import type { Task, TaskUpdate } from "@/lib/types/domain";
import { expandRrule } from "@/components/calendar/calendar-utils";

const DAY_MS = 86_400_000;

/** A CalendarItem id like `task:<uuid>:<timestamp>` is a recurring
 *  occurrence; `task:<uuid>` is the master/standalone item. Same format
 *  applies to events. */
export function isOccurrenceItemId(id: string): boolean {
  return id.split(":").length === 3;
}

/** Coerce the JSONB column into a string[] regardless of legacy shapes. */
export function getCompletedOccurrences(task: Pick<Task, "completed_occurrences">): string[] {
  const raw = task.completed_occurrences;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

/** True when the task has a recurrence rule and a scheduled anchor. */
export function isRecurring(task: Pick<Task, "recurrence_rule" | "scheduled_at">): boolean {
  return !!task.recurrence_rule && !!task.scheduled_at;
}

/** Normalize a Date to its ISO string the way occurrences are stored. */
export function occurrenceKey(d: Date): string {
  return d.toISOString();
}

/** Is a specific occurrence (by start Date) marked complete? */
export function isOccurrenceComplete(
  task: Pick<Task, "completed_occurrences">,
  occurrenceStart: Date
): boolean {
  const key = occurrenceKey(occurrenceStart);
  return getCompletedOccurrences(task).includes(key);
}

/**
 * Build the TaskUpdate patch that toggles a single occurrence's completion.
 * If `next === true` and not already in the array → append.
 * If `next === false` and present → remove.
 * Idempotent in either direction.
 */
export function toggleOccurrencePatch(
  task: Pick<Task, "completed_occurrences">,
  occurrenceStart: Date,
  next: boolean
): TaskUpdate {
  const curr = new Set(getCompletedOccurrences(task));
  const key = occurrenceKey(occurrenceStart);
  if (next) curr.add(key);
  else curr.delete(key);
  return { completed_occurrences: Array.from(curr) };
}

/**
 * The "active occurrence" — the one the row in the task list is currently
 * speaking about. Algorithm:
 *   1. Generate occurrences in a reasonable window around `now`
 *      (yesterday through 365 days ahead).
 *   2. Filter out any that are already in `completed_occurrences[]`.
 *   3. The earliest survivor is the active one.
 *
 * The dim-row state is shown when ALL occurrences in the lookahead window
 * have been completed up to and including the next future one — i.e., when
 * there is no "active" occurrence to complete next. The caller handles that
 * by checking the return value: `null` ⇒ all done in window ⇒ dim with ✓.
 *
 * For multi-per-day rules (medication every 4h), this naturally walks the
 * row through the day: first slot of the day → click → second slot becomes
 * active → click → third becomes active → ... → all of today done → next
 * day's first slot active → dim until tomorrow morning.
 */
export function getActiveOccurrence(
  task: Pick<Task, "recurrence_rule" | "scheduled_at" | "recurrence_ends_at" | "completed_occurrences">,
  now: Date = new Date()
): Date | null {
  if (!task.recurrence_rule || !task.scheduled_at) return null;
  const anchor = new Date(task.scheduled_at);
  // Window: from yesterday (so a missed slot from earlier today / last night
  // still surfaces as active+overdue) through one year forward.
  const windowStart = new Date(now.getTime() - DAY_MS);
  const windowEnd = new Date(now.getTime() + 365 * DAY_MS);
  const occurrences = expandRrule(
    task.recurrence_rule,
    anchor,
    windowStart,
    windowEnd
  );
  if (occurrences.length === 0) return null;
  const completed = new Set(getCompletedOccurrences(task));
  for (const occ of occurrences) {
    if (!completed.has(occurrenceKey(occ))) return occ;
  }
  return null;
}

/**
 * Render an occurrence as a Hebrew relative-time label suitable for an
 * inline row hint: "היום 9:00", "מחר 9:00", "אתמול 9:00", or
 * "15 במאי 9:00" for anything beyond the ±1 day window.
 */
export function formatRelativeOccurrence(occ: Date, now: Date = new Date()): string {
  // Midnight = "no specific time" rule; show day label only.
  const hasSpecificTime = occ.getHours() !== 0 || occ.getMinutes() !== 0;
  const time = hasSpecificTime
    ? " " + occ.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
    : "";
  const dayDiff = Math.round(
    (startOfDay(occ).getTime() - startOfDay(now).getTime()) / DAY_MS
  );
  if (dayDiff === 0) return `היום${time}`;
  if (dayDiff === 1) return `מחר${time}`;
  if (dayDiff === -1) return `אתמול${time}`;
  if (dayDiff > 1 && dayDiff < 7) {
    const weekday = occ.toLocaleDateString("he-IL", { weekday: "long" });
    return `${weekday}${time}`;
  }
  const date = occ.toLocaleDateString("he-IL", { day: "numeric", month: "long" });
  return `${date}${time}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Convenience: next future occurrence (>= now), regardless of completion.
 * Used to render "Next: tomorrow 9:00" hints when the active is in the past.
 */
export function getNextFutureOccurrence(
  task: Pick<Task, "recurrence_rule" | "scheduled_at" | "recurrence_ends_at">,
  now: Date = new Date()
): Date | null {
  if (!task.recurrence_rule || !task.scheduled_at) return null;
  const anchor = new Date(task.scheduled_at);
  const windowEnd = new Date(now.getTime() + 365 * DAY_MS);
  const occurrences = expandRrule(task.recurrence_rule, anchor, now, windowEnd);
  return occurrences[0] ?? null;
}
