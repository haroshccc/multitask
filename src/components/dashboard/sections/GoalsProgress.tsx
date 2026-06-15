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
import { SectionCard } from "./SectionCard";
import type { TimeEntry } from "@/lib/types/domain";

// =============================================================================
// "יעדים והרגלים" — current-period progress as rings instead of text rows.
// Unfinished goals float to the top; finished ones turn green.
// =============================================================================

const MAX_ROWS = 6;

function ProgressRing({ pct, hit }: { pct: number; hit: boolean }) {
  const r = 15.5;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90" aria-hidden="true">
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        strokeWidth="3.5"
        className="stroke-current text-ink-100"
      />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={`${(Math.min(100, pct) / 100) * c} ${c}`}
        className={cn(
          "stroke-current transition-all",
          hit ? "text-success-500" : "text-primary-500",
        )}
      />
    </svg>
  );
}

export function GoalsProgress() {
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

  const rows = useMemo(() => {
    const entriesByTask = new Map<string, TimeEntry[]>();
    for (const e of entries) {
      let arr = entriesByTask.get(e.task_id);
      if (!arr) {
        arr = [];
        entriesByTask.set(e.task_id, arr);
      }
      arr.push(e);
    }
    return tasks
      .filter((t) => t.goal_period)
      .map((task) => {
        const stats = computeGoalStats(task, entriesByTask.get(task.id) ?? []);
        if (!stats) return null;
        const target = task.goal_target ?? 1;
        const pct = Math.round((stats.currentPeriodCount / target) * 100);
        return { task, stats, target, pct };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => {
        // Unfinished first, then closest-to-done first.
        if (a.stats.currentPeriodHit !== b.stats.currentPeriodHit) {
          return a.stats.currentPeriodHit ? 1 : -1;
        }
        return b.pct - a.pct;
      });
  }, [tasks, entries]);

  return (
    <SectionCard
      icon={<Target className="w-4 h-4" />}
      title="יעדים והרגלים"
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
        <div className="flex flex-col items-center text-center py-5 gap-2">
          <span
            className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center"
            aria-hidden="true"
          >
            <Target className="w-5 h-5 text-amber-500" />
          </span>
          <p className="text-xs text-ink-600 max-w-[220px] leading-relaxed">
            עוד אין יעדים. יעד הופך משימה חוזרת להרגל עם מעקב והתקדמות.
          </p>
          <Link to="/app/goals" className="btn-outline text-xs">
            הגדירי יעד ראשון
          </Link>
        </div>
      ) : (
        <ul className="space-y-1">
          {rows.slice(0, MAX_ROWS).map(({ task, stats, target, pct }) => (
            <li key={task.id}>
              <Link
                to="/app/goals"
                className="flex items-center gap-2.5 rounded-lg p-1.5 -mx-1.5 hover:bg-ink-50 transition-colors"
              >
                <span className="relative shrink-0">
                  <ProgressRing pct={pct} hit={stats.currentPeriodHit} />
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold tabular-nums text-ink-700">
                    {stats.currentPeriodCount}/{target}
                  </span>
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-medium text-ink-900 truncate">
                    {task.title}
                  </span>
                  <span className="block text-[10px] text-ink-500">
                    {target} {periodLabelHe(task.goal_period as GoalPeriod)}
                  </span>
                </span>
                {stats.currentStreak > 0 && (
                  <span
                    className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-amber-700 shrink-0"
                    title="סטריק נוכחי"
                  >
                    <Flame className="w-3.5 h-3.5" aria-hidden="true" />
                    {stats.currentStreak}
                  </span>
                )}
              </Link>
            </li>
          ))}
          {rows.length > MAX_ROWS && (
            <li>
              <Link
                to="/app/goals"
                className="block text-center text-[11px] text-primary-600 hover:underline py-1"
              >
                ועוד {rows.length - MAX_ROWS} יעדים…
              </Link>
            </li>
          )}
        </ul>
      )}
    </SectionCard>
  );
}
