import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Circle, MinusCircle, Target } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useTasks } from "@/lib/hooks/useTasks";
import { getCompletedOccurrences } from "@/lib/tasks/recurrence";
import { type GoalPeriod } from "@/lib/goals/computation";
import { SectionCard } from "./SectionCard";

// =============================================================================
// Weekly review — per-goal "did the week hit its target" breakdown.
//
// Expected beats for the reviewed week:
//   day-period goals   → target × 7
//   week-period goals  → target
//   month-period goals → no weekly target; we just show the beat count
// =============================================================================

interface GoalsWeekReviewProps {
  weekFrom: Date;
  weekTo: Date;
}

interface ReviewRow {
  id: string;
  title: string | null;
  beats: number;
  expected: number | null;
  pct: number;
}

export function GoalsWeekReview({ weekFrom, weekTo }: GoalsWeekReviewProps) {
  const { data: tasks = [] } = useTasks();

  const rows = useMemo((): ReviewRow[] => {
    const fromMs = weekFrom.getTime();
    const toMs = weekTo.getTime();
    return tasks
      .filter((t) => t.goal_period)
      .map((task) => {
        const period = task.goal_period as GoalPeriod;
        const target = Math.max(1, task.goal_target ?? 1);
        const startedOn = task.goal_started_on
          ? new Date(`${task.goal_started_on}T00:00:00`)
          : null;
        // Recurring goals store each tick in completed_occurrences;
        // non-recurring goals fall back to a single completed_at.
        const occs = getCompletedOccurrences(task);
        const isoList =
          occs.length === 0 && task.completed_at ? [task.completed_at] : occs;
        const beats = isoList.filter((iso) => {
          const t = new Date(iso).getTime();
          if (isNaN(t) || t < fromMs || t >= toMs) return false;
          return !startedOn || t >= startedOn.getTime();
        }).length;
        const expected =
          period === "day" ? target * 7 : period === "week" ? target : null;
        const pct =
          expected === null
            ? 0
            : Math.min(100, Math.round((beats / expected) * 100));
        return { id: task.id, title: task.title, beats, expected, pct };
      })
      .sort((a, b) => b.pct - a.pct || b.beats - a.beats);
  }, [tasks, weekFrom, weekTo]);

  const withTarget = rows.filter((r) => r.expected !== null);
  const hitCount = withTarget.filter((r) => r.beats >= (r.expected ?? 0)).length;

  return (
    <SectionCard
      icon={<Target className="w-4 h-4" />}
      title="יעדים בשבוע הזה"
      badge={
        withTarget.length > 0 ? (
          <span className="text-[11px] text-ink-500 tabular-nums">
            עמדת ב-{hitCount} מתוך {withTarget.length}
          </span>
        ) : undefined
      }
      action={
        <Link
          to="/app/goals"
          className="text-xs text-primary-700 hover:text-primary-900 inline-flex items-center gap-1"
        >
          לכל היעדים <ArrowLeft className="w-3 h-3" aria-hidden="true" />
        </Link>
      }
    >
      {rows.length === 0 ? (
        <p className="text-xs text-ink-500 py-4 text-center">
          אין יעדים פעילים — אין מה לסקור עדיין.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const hit = r.expected !== null && r.beats >= r.expected;
            const partial = r.expected !== null && !hit && r.beats > 0;
            return (
              <li key={r.id} className="flex items-center gap-2">
                {r.expected === null ? (
                  <MinusCircle
                    className="w-4 h-4 text-ink-400 shrink-0"
                    aria-label="יעד חודשי"
                  />
                ) : hit ? (
                  <CheckCircle2
                    className="w-4 h-4 text-success-500 shrink-0"
                    aria-label="הושג"
                  />
                ) : partial ? (
                  <Circle
                    className="w-4 h-4 text-amber-500 shrink-0"
                    aria-label="חלקי"
                  />
                ) : (
                  <Circle
                    className="w-4 h-4 text-ink-300 shrink-0"
                    aria-label="לא בוצע"
                  />
                )}
                <span className="flex-1 min-w-0 truncate text-xs font-medium text-ink-900">
                  {r.title}
                </span>
                {r.expected !== null && (
                  <span className="w-20 h-1.5 rounded-full bg-ink-100 overflow-hidden shrink-0">
                    <span
                      className={cn(
                        "block h-full rounded-full",
                        hit ? "bg-success-500" : "bg-primary-500",
                      )}
                      style={{ width: `${r.pct}%` }}
                    />
                  </span>
                )}
                <span className="shrink-0 text-[11px] tabular-nums text-ink-600 min-w-[34px] text-end">
                  {r.expected !== null ? `${r.beats}/${r.expected}` : r.beats}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
