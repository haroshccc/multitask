/**
 * Pure computations for goal/habit stats.
 *
 * Given a goal-tagged task plus its time-entries, produce everything the
 * Goals screen and dashboard nudges render: current streak, best streak,
 * current-period progress, lookback "X out of Y", lifetime hit rate, and
 * the list of completion "beats" that lack any actual-time entry (used by
 * the home-page reminder).
 *
 * No Supabase / React imports — just pure functions over Task + TimeEntry
 * shapes. Everything is local-time / Sunday-anchored to match the rest of
 * the app's Israeli-week convention (`useDateRange.ts:42`).
 */
import type { Task, TimeEntry } from "@/lib/types/domain";
import { getCompletedOccurrences } from "@/lib/tasks/recurrence";

export type GoalPeriod = "day" | "week" | "month";

const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

export function startOfDayLocal(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Sunday-anchored (Israeli convention). */
export function startOfWeekLocal(d: Date): Date {
  const x = startOfDayLocal(d);
  x.setDate(x.getDate() - x.getDay()); // 0 = Sunday
  return x;
}

export function startOfMonthLocal(d: Date): Date {
  const x = startOfDayLocal(d);
  x.setDate(1);
  return x;
}

export function startOfPeriodLocal(d: Date, period: GoalPeriod): Date {
  switch (period) {
    case "day":
      return startOfDayLocal(d);
    case "week":
      return startOfWeekLocal(d);
    case "month":
      return startOfMonthLocal(d);
  }
}

export function addPeriods(d: Date, period: GoalPeriod, n: number): Date {
  const x = new Date(d);
  if (period === "day") x.setDate(x.getDate() + n);
  else if (period === "week") x.setDate(x.getDate() + n * 7);
  else x.setMonth(x.getMonth() + n);
  return x;
}

/** Number of full periods between two dates' period-starts. Sign reflects
 *  direction (positive when `to` is later). */
export function periodDiffCount(
  from: Date,
  to: Date,
  period: GoalPeriod
): number {
  const a = startOfPeriodLocal(from, period);
  const b = startOfPeriodLocal(to, period);
  if (period === "day") {
    return Math.round((b.getTime() - a.getTime()) / DAY_MS);
  }
  if (period === "week") {
    return Math.round((b.getTime() - a.getTime()) / (7 * DAY_MS));
  }
  return (
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  );
}

// ---------------------------------------------------------------------------
// Stats shape
// ---------------------------------------------------------------------------

export interface GoalStats {
  /** Periods consecutively at-or-above target, ending at the most recent
   *  completed period (current period included only if it has already hit
   *  target — otherwise the streak reflects through last period). */
  currentStreak: number;
  /** Longest run since `goal_started_on` (or all-time if not set). */
  bestStreak: number;
  /** Completions in the current period. */
  currentPeriodCount: number;
  /** Target the user set ("3 פעמים בשבוע"). */
  currentPeriodTarget: number;
  /** True iff currentPeriodCount >= currentPeriodTarget. */
  currentPeriodHit: boolean;
  /** "X out of Y" — how many of the last `lookbackTotal` periods hit target.
   *  When goal_min_streak_periods is set, Y = that; else a sensible default
   *  (7 days / 4 weeks / 3 months). */
  lookbackHits: number;
  lookbackTotal: number;
  /** Whether the first-milestone bar was crossed (only meaningful when
   *  `goal_min_streak_periods` is set; null = ongoing/forever). */
  reachedMilestone: boolean | null;
  /** Days since `goal_started_on` (null when start date unset). */
  daysSinceStart: number | null;
  /** Total completion-occurrences in scope. */
  totalCompletions: number;
  /** Periods at-or-above target since start. */
  totalPeriodsHit: number;
  /** Periods elapsed since start (so totalPeriodsHit / totalPeriodsCounted
   *  is a hit-rate). */
  totalPeriodsCounted: number;
  /** Sum of time-entry minutes within the current period. */
  thisPeriodMinutesActual: number;
  /** "Expected" minutes this period: target × duration_minutes. 0 when
   *  duration_minutes is unset on the task. */
  thisPeriodMinutesPlanned: number;
  /** Completion timestamps that have no time-entry on the same local day.
   *  Empty when goal_track_time is false or duration_minutes is unset. */
  beatsWithoutTime: Date[];
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

type GoalTaskFields = Pick<
  Task,
  | "goal_period"
  | "goal_target"
  | "goal_min_streak_periods"
  | "goal_started_on"
  | "goal_track_time"
  | "duration_minutes"
  | "completed_occurrences"
  | "completed_at"
>;

type TimeEntryFields = Pick<
  TimeEntry,
  "started_at" | "ended_at" | "duration_seconds"
>;

export function computeGoalStats(
  task: GoalTaskFields,
  timeEntries: TimeEntryFields[],
  now: Date = new Date()
): GoalStats | null {
  if (!task.goal_period) return null;
  const period = task.goal_period as GoalPeriod;
  const target = Math.max(1, task.goal_target ?? 1);
  const minStreak = task.goal_min_streak_periods ?? null;

  // 1) Build the list of completion Date objects. Recurring tasks store
  //    each tick in completed_occurrences; non-recurring goals fall back
  //    to a single completed_at if present.
  const occs = getCompletedOccurrences(task);
  const dates: Date[] = [];
  for (const iso of occs) {
    const d = new Date(iso);
    if (!isNaN(d.getTime())) dates.push(d);
  }
  if (dates.length === 0 && task.completed_at) {
    const d = new Date(task.completed_at);
    if (!isNaN(d.getTime())) dates.push(d);
  }

  // Apply goal_started_on cutoff (we don't count completions from before
  // the user even decided to track this as a goal).
  const startedOn = task.goal_started_on
    ? parseLocalDate(task.goal_started_on)
    : null;
  const dateList = startedOn ? dates.filter((d) => d >= startedOn) : dates;

  // 2) Group by period start.
  const counts = new Map<number, number>();
  for (const d of dateList) {
    const k = startOfPeriodLocal(d, period).getTime();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const currentPeriodStart = startOfPeriodLocal(now, period);
  const currentPeriodCount = counts.get(currentPeriodStart.getTime()) ?? 0;
  const currentPeriodHit = currentPeriodCount >= target;

  // 3) Current streak. If the current period has already hit target,
  //    include it; otherwise start from the previous period.
  const minPeriodMs = startedOn
    ? startOfPeriodLocal(startedOn, period).getTime()
    : -Infinity;
  let cursor = currentPeriodHit
    ? currentPeriodStart
    : addPeriods(currentPeriodStart, period, -1);
  let currentStreak = 0;
  while (cursor.getTime() >= minPeriodMs) {
    const c = counts.get(cursor.getTime()) ?? 0;
    if (c < target) break;
    currentStreak += 1;
    cursor = addPeriods(cursor, period, -1);
  }

  // 4) Best streak. Walk all known period-keys ascending; restart the run
  //    on a miss or a gap.
  const periodKeys = Array.from(counts.keys()).sort((a, b) => a - b);
  let bestStreak = 0;
  let run = 0;
  let prevKey: number | null = null;
  for (const k of periodKeys) {
    const c = counts.get(k) ?? 0;
    if (c < target) {
      run = 0;
      prevKey = k;
      continue;
    }
    if (prevKey != null) {
      const expected = addPeriods(new Date(prevKey), period, 1).getTime();
      if (k !== expected) run = 0;
    }
    run += 1;
    if (run > bestStreak) bestStreak = run;
    prevKey = k;
  }
  if (currentStreak > bestStreak) bestStreak = currentStreak;

  // 5) Lookback "X out of Y".
  const defaultLookback = period === "day" ? 7 : period === "week" ? 4 : 3;
  const lookbackTotal = minStreak ?? defaultLookback;
  let lookbackHits = 0;
  for (let i = 0; i < lookbackTotal; i++) {
    const ps = addPeriods(currentPeriodStart, period, -i);
    if (ps.getTime() < minPeriodMs) break;
    const c = counts.get(ps.getTime()) ?? 0;
    if (c >= target) lookbackHits += 1;
  }

  // 6) Total stats since start. Count periods elapsed (inclusive of current).
  const earliest =
    startedOn ??
    (dateList.length > 0
      ? new Date(Math.min(...dateList.map((x) => x.getTime())))
      : currentPeriodStart);
  const totalPeriodsCounted = Math.max(
    1,
    periodDiffCount(earliest, now, period) + 1
  );
  let totalPeriodsHit = 0;
  for (let i = 0; i < totalPeriodsCounted; i++) {
    const ps = addPeriods(currentPeriodStart, period, -i);
    const c = counts.get(ps.getTime()) ?? 0;
    if (c >= target) totalPeriodsHit += 1;
  }

  // 7) Days since start.
  const daysSinceStart = startedOn
    ? Math.floor((now.getTime() - startedOn.getTime()) / DAY_MS)
    : null;

  // 8) Time totals for current period.
  const periodEnd = addPeriods(currentPeriodStart, period, 1);
  let secActual = 0;
  for (const e of timeEntries) {
    if (!e.started_at) continue;
    const sd = new Date(e.started_at);
    if (isNaN(sd.getTime())) continue;
    if (sd < currentPeriodStart || sd >= periodEnd) continue;
    if (typeof e.duration_seconds === "number" && e.duration_seconds > 0) {
      secActual += e.duration_seconds;
    } else if (e.ended_at) {
      const ed = new Date(e.ended_at);
      if (!isNaN(ed.getTime())) {
        secActual += Math.max(0, (ed.getTime() - sd.getTime()) / 1000);
      }
    }
  }
  const thisPeriodMinutesActual = Math.round(secActual / 60);
  const thisPeriodMinutesPlanned = (task.duration_minutes ?? 0) * target;

  // 9) Beats with no time-entry on the same local day. Only meaningful
  //    when the user wants to track time on this goal AND there's a
  //    planned duration to compare against (otherwise there's nothing
  //    to nudge them to fill in).
  const beatsWithoutTime: Date[] = [];
  if (task.goal_track_time && (task.duration_minutes ?? 0) > 0) {
    const timeDays = new Set<number>();
    for (const e of timeEntries) {
      if (!e.started_at) continue;
      const sd = new Date(e.started_at);
      if (isNaN(sd.getTime())) continue;
      timeDays.add(startOfDayLocal(sd).getTime());
    }
    for (const d of dateList) {
      const dayKey = startOfDayLocal(d).getTime();
      if (!timeDays.has(dayKey)) beatsWithoutTime.push(d);
    }
    beatsWithoutTime.sort((a, b) => b.getTime() - a.getTime());
  }

  const reachedMilestone =
    minStreak == null ? null : bestStreak >= minStreak;

  return {
    currentStreak,
    bestStreak,
    currentPeriodCount,
    currentPeriodTarget: target,
    currentPeriodHit,
    lookbackHits,
    lookbackTotal,
    reachedMilestone,
    daysSinceStart,
    totalCompletions: dateList.length,
    totalPeriodsHit,
    totalPeriodsCounted,
    thisPeriodMinutesActual,
    thisPeriodMinutesPlanned,
    beatsWithoutTime,
  };
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

function parseLocalDate(yyyymmdd: string): Date | null {
  // Treat "YYYY-MM-DD" as a local-time start-of-day so day boundaries are
  // anchored to the user's wall clock, not UTC.
  const m = yyyymmdd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

/** Hebrew label for a goal period's "פעמים ב…" phrase. */
export function periodLabelHe(period: GoalPeriod): string {
  return period === "day" ? "ביום" : period === "week" ? "בשבוע" : "בחודש";
}

/** Hebrew unit for a streak count ("ימים" / "שבועות" / "חודשים"). */
export function periodUnitHe(period: GoalPeriod, n: number): string {
  if (period === "day") return n === 1 ? "יום" : "ימים";
  if (period === "week") return n === 1 ? "שבוע" : "שבועות";
  return n === 1 ? "חודש" : "חודשים";
}
