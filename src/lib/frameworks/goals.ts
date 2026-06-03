/**
 * Lightweight goal stats for framework blocks.
 *
 * A framework block can carry a goal (goal_period + goal_target). Progress is
 * driven by `framework_block_occurrences` rows with status === "done": each is
 * one completion on a given date. This mirrors the habit-goal idea on tasks but
 * sourced from the framework's own occurrence state (no timers).
 */

import type { FrameworkBlock, FrameworkGoalPeriod } from "@/lib/types/frameworks";
import { toDateKey, fromDateKey } from "./projection";

export interface FrameworkGoalStats {
  period: FrameworkGoalPeriod;
  target: number;
  currentPeriodCount: number;
  currentPeriodHit: boolean;
  currentStreak: number;
  recentHits: number;
  recentTotal: number;
}

/** Inclusive start (yyyy-mm-dd) of the period containing `d`. */
function periodStart(d: Date, period: FrameworkGoalPeriod): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (period === "day") return x;
  if (period === "week") {
    // Week starts Sunday (getDay() === 0), matching the app's RTL convention.
    x.setDate(x.getDate() - x.getDay());
    return x;
  }
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function periodEndExclusive(start: Date, period: FrameworkGoalPeriod): Date {
  if (period === "day") return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  if (period === "week") return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return new Date(start.getFullYear(), start.getMonth() + 1, 1);
}

function prevPeriodStart(start: Date, period: FrameworkGoalPeriod): Date {
  if (period === "day") return new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1);
  if (period === "week") return new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7);
  return new Date(start.getFullYear(), start.getMonth() - 1, 1);
}

/** Count done dates falling inside [start, endExcl). */
function countInPeriod(doneKeys: Set<string>, start: Date, endExcl: Date): number {
  let n = 0;
  for (const key of doneKeys) {
    const d = fromDateKey(key);
    if (d >= start && d < endExcl) n++;
  }
  return n;
}

export function computeFrameworkBlockGoal(
  block: FrameworkBlock,
  doneDates: Iterable<string>,
  now: Date = new Date()
): FrameworkGoalStats | null {
  if (!block.goal_period) return null;
  const period = block.goal_period;
  const target = Math.max(1, block.goal_target ?? 1);
  const doneKeys = new Set<string>(doneDates);

  const curStart = periodStart(now, period);
  const curEnd = periodEndExclusive(curStart, period);
  const currentPeriodCount = countInPeriod(doneKeys, curStart, curEnd);
  const currentPeriodHit = currentPeriodCount >= target;

  // Recent window: last 8 periods including current.
  let recentHits = 0;
  let recentTotal = 0;
  let cursor = new Date(curStart);
  for (let i = 0; i < 8; i++) {
    const end = periodEndExclusive(cursor, period);
    const count = countInPeriod(doneKeys, cursor, end);
    recentTotal++;
    if (count >= target) recentHits++;
    cursor = prevPeriodStart(cursor, period);
  }

  // Current streak: consecutive met periods. An in-progress current period that
  // hasn't hit yet doesn't break the streak — we start counting from previous.
  let currentStreak = 0;
  let streakCursor = currentPeriodHit ? new Date(curStart) : prevPeriodStart(curStart, period);
  for (let i = 0; i < 520; i++) {
    const end = periodEndExclusive(streakCursor, period);
    const count = countInPeriod(doneKeys, streakCursor, end);
    if (count >= target) {
      currentStreak++;
      streakCursor = prevPeriodStart(streakCursor, period);
    } else break;
  }

  return {
    period,
    target,
    currentPeriodCount,
    currentPeriodHit,
    currentStreak,
    recentHits,
    recentTotal,
  };
}

/** All done dates for a block from its occurrence rows. */
export function doneDatesForBlock(
  occurrences: { block_id: string; occ_date: string; status: string }[],
  blockId: string
): string[] {
  return occurrences
    .filter((o) => o.block_id === blockId && o.status === "done")
    .map((o) => o.occ_date);
}

export { toDateKey };
