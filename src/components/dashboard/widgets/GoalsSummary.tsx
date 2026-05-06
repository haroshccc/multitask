import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Flame, Target } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useTasks } from "@/lib/hooks/useTasks";
import { useTimeEntriesByRange } from "@/lib/hooks/useTimer";
import {
  computeGoalStats,
  periodLabelHe,
  type GoalPeriod,
} from "@/lib/goals/computation";
import type { TimeEntry } from "@/lib/types/domain";

// =============================================================================
// "ההרגלים שלי" — compact dashboard widget. Lists every goal-tagged task
// with current-period progress and the streak. Clicking the title (or any
// row) navigates to the full /goals screen.
// =============================================================================

export function GoalsSummary() {
  const { data: tasks = [] } = useTasks();
  const range = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 95);
    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    };
  }, []);
  const { data: entries = [] } = useTimeEntriesByRange(range);

  const goalTasks = useMemo(
    () => tasks.filter((t) => t.goal_period),
    [tasks]
  );
  const entriesByTask = useMemo(() => {
    const m = new Map<string, TimeEntry[]>();
    for (const e of entries) {
      let arr = m.get(e.task_id);
      if (!arr) {
        arr = [];
        m.set(e.task_id, arr);
      }
      arr.push(e);
    }
    return m;
  }, [entries]);

  return (
    <div className="card p-3 h-full flex flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-semibold text-ink-900 inline-flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5 text-primary-600" />
          ההרגלים שלי
        </h3>
        <Link
          to="/app/goals"
          className="text-xs text-primary-700 hover:text-primary-900 inline-flex items-center gap-1"
        >
          לכל היעדים <ArrowLeft className="w-3 h-3" />
        </Link>
      </header>

      {goalTasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center text-xs text-ink-500 px-3">
          עוד לא הגדרת יעדים. פתחי משימה חוזרת ב"תזמון" וסמני "הגדר כיעד".
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto -mx-1 px-1 space-y-1.5">
          {goalTasks.map((task) => {
            const stats = computeGoalStats(task, entriesByTask.get(task.id) ?? []);
            if (!stats) return null;
            const period = task.goal_period as GoalPeriod;
            const target = task.goal_target ?? 1;
            const pct = Math.min(
              100,
              Math.round((stats.currentPeriodCount / target) * 100)
            );
            return (
              <li key={task.id}>
                <Link
                  to="/app/goals"
                  className="block rounded-md p-2 hover:bg-ink-50 -mx-1"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm text-ink-900 truncate">
                      {task.title}
                    </span>
                    <span className="text-[11px] text-ink-500 shrink-0">
                      {target} {periodLabelHe(period)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-ink-100 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          stats.currentPeriodHit
                            ? "bg-success-500"
                            : "bg-primary-500"
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] tabular-nums text-ink-700 shrink-0 min-w-[42px] text-end">
                      {stats.currentPeriodCount}/{target}
                    </span>
                    {stats.currentStreak > 0 && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[11px] text-amber-700 shrink-0"
                        title="סטריק נוכחי"
                      >
                        <Flame className="w-3 h-3" />
                        {stats.currentStreak}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
