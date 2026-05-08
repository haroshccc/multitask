import { useEffect, useMemo, useState } from "react";

import {
  Award,
  Clock,
  Flame,
  Pencil,
  Plus,
  Target,
  TrendingUp,
} from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { cn } from "@/lib/utils/cn";
import { useTasks } from "@/lib/hooks/useTasks";
import { useTaskLists } from "@/lib/hooks/useTaskLists";
import { useTimeEntriesByRange } from "@/lib/hooks/useTimer";
import {
  computeGoalStats,
  periodLabelHe,
  periodUnitHe,
  type GoalPeriod,
} from "@/lib/goals/computation";
import type { Task, TimeEntry } from "@/lib/types/domain";
import { TaskEditModal, type TaskCreateDraft } from "@/components/tasks/TaskEditModal";

export function Goals() {
  const { data: tasks = [], isLoading } = useTasks();
  const { data: lists = [] } = useTaskLists();
  const range = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 95);
    return {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    };
  }, []);
  const { data: timeEntries = [] } = useTimeEntriesByRange(range);

  const listColorById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const l of lists) m.set(l.id, l.color);
    return m;
  }, [lists]);

  const goalTasks = useMemo(
    () => tasks.filter((t) => t.goal_period),
    [tasks]
  );
  const entriesByTask = useMemo(() => {
    const m = new Map<string, TimeEntry[]>();
    for (const e of timeEntries) {
      let arr = m.get(e.task_id);
      if (!arr) {
        arr = [];
        m.set(e.task_id, arr);
      }
      arr.push(e);
    }
    return m;
  }, [timeEntries]);

  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState<TaskCreateDraft | null>(null);

  useEffect(() => {
    const handler = () => setCreateDraft({ goalEnabled: true });
    window.addEventListener("app:new-goal", handler);
    return () => window.removeEventListener("app:new-goal", handler);
  }, []);

  return (
    <ScreenScaffold
      title="יעדים"
      subtitle="הרגלים שאת מנסה לבסס — סטריק נוכחי, התקדמות התקופה הנוכחית והשוואת זמן."
      narrow
      actions={
        <button
          onClick={() => setCreateDraft({ goalEnabled: true })}
          className="btn-primary flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          יעד חדש
        </button>
      }
    >
      {isLoading ? (
        <div className="card p-6 text-center text-ink-500 text-sm">
          טוען…
        </div>
      ) : goalTasks.length === 0 ? (
        <div className="card p-6 text-center text-ink-500 text-sm space-y-3">
          <Target className="w-7 h-7 mx-auto text-ink-300" />
          <div className="font-medium text-ink-700">עוד לא הגדרת יעדים</div>
          <button
            onClick={() => setCreateDraft({ goalEnabled: true })}
            className="btn-primary mx-auto flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            צור יעד ראשון
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {goalTasks.map((task) => (
            <GoalCard
              key={task.id}
              task={task}
              entries={entriesByTask.get(task.id) ?? []}
              listColor={task.task_list_id ? (listColorById.get(task.task_list_id) ?? null) : null}
              onEdit={() => setEditTaskId(task.id)}
            />
          ))}
        </div>
      )}

      <TaskEditModal
        taskId={editTaskId}
        createDraft={createDraft}
        onClose={() => { setEditTaskId(null); setCreateDraft(null); }}
        defaultTab="schedule"
      />
    </ScreenScaffold>
  );
}

interface GoalCardProps {
  task: Task;
  entries: TimeEntry[];
  listColor: string | null;
  onEdit: () => void;
}

function GoalCard({ task, entries, listColor, onEdit }: GoalCardProps) {
  const stats = useMemo(
    () => computeGoalStats(task, entries),
    [task, entries]
  );
  if (!stats) return null;
  if (!task.goal_period) return null;

  const period = task.goal_period as GoalPeriod;
  const target = task.goal_target ?? 1;
  const minStreak = task.goal_min_streak_periods;

  const progressPct = Math.min(
    100,
    Math.round((stats.currentPeriodCount / target) * 100)
  );

  const summary = `${target} פעמים ${periodLabelHe(period)}`;
  const startedSummary =
    stats.daysSinceStart != null
      ? stats.daysSinceStart === 0
        ? "התחלת היום"
        : stats.daysSinceStart === 1
          ? "התחלת אתמול"
          : `התחלת לפני ${stats.daysSinceStart} ימים`
      : null;

  const timePlanned = stats.thisPeriodMinutesPlanned;
  const timeActual = stats.thisPeriodMinutesActual;
  const showTime = task.goal_track_time && timePlanned > 0;

  return (
    <article
      className="card p-4 border-2"
      style={{ borderColor: listColor ?? "#e5e7eb" }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary-600 shrink-0" />
            <h3 className="text-sm font-semibold text-ink-900 truncate">
              {task.title}
            </h3>
          </div>
          <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span>{summary}</span>
            {minStreak != null && (
              <>
                <span>·</span>
                <span>
                  אבן דרך: {minStreak} {periodUnitHe(period, minStreak)} ברצף
                </span>
              </>
            )}
            {minStreak == null && (
              <>
                <span>·</span>
                <span>ללא סיום</span>
              </>
            )}
            {startedSummary && (
              <>
                <span>·</span>
                <span>{startedSummary}</span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="p-1.5 rounded-md hover:bg-ink-100 text-ink-400 hover:text-ink-700 shrink-0"
          title="ערכי יעד"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-xs text-ink-600">
            {period === "day"
              ? "היום"
              : period === "week"
                ? "השבוע"
                : "החודש"}
          </span>
          <span className="text-xs font-medium text-ink-900 tabular-nums">
            {stats.currentPeriodCount} / {target}
            {stats.currentPeriodHit && (
              <span className="ms-1 text-success-600">✓</span>
            )}
          </span>
        </div>
        <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              stats.currentPeriodHit ? "bg-success-500" : "bg-primary-500"
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-center">
        <Stat
          icon={<Flame className="w-3.5 h-3.5" />}
          label={`סטריק (${periodUnitHe(period, stats.currentStreak)})`}
          value={stats.currentStreak}
          tone={stats.currentStreak > 0 ? "warm" : "neutral"}
        />
        <Stat
          icon={<Award className="w-3.5 h-3.5" />}
          label="שיא"
          value={stats.bestStreak}
          tone="gold"
        />
        <Stat
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          label={`${periodUnitHe(period, stats.lookbackTotal)} אחרונים`}
          value={`${stats.lookbackHits}/${stats.lookbackTotal}`}
          tone={
            stats.lookbackHits === stats.lookbackTotal
              ? "good"
              : stats.lookbackHits >= stats.lookbackTotal / 2
                ? "neutral"
                : "warn"
          }
        />
        {showTime && (
          <Stat
            icon={<Clock className="w-3.5 h-3.5" />}
            label="זמן (דק׳)"
            value={`${timeActual}/${timePlanned}`}
            tone={
              timeActual >= timePlanned
                ? "good"
                : timeActual >= timePlanned * 0.6
                  ? "neutral"
                  : "warn"
            }
          />
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px]">
        {stats.totalPeriodsCounted > 0 && (
          <span className="inline-flex items-center gap-1 text-ink-500">
            לאורך זמן:{" "}
            <strong className="text-ink-800 tabular-nums">
              {stats.totalPeriodsHit}/{stats.totalPeriodsCounted}
            </strong>{" "}
            {periodUnitHe(period, stats.totalPeriodsCounted)} עמדו ביעד
          </span>
        )}
        {stats.reachedMilestone === true && minStreak != null && (
          <span className="inline-flex items-center gap-1 text-success-700 bg-success-50 border border-success-200 px-2 py-0.5 rounded-full">
            <span aria-hidden="true">🎉</span>
            <span>אבן דרך הושגה</span>
          </span>
        )}
        {stats.beatsWithoutTime.length > 0 && (
          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3" />
            {stats.beatsWithoutTime.length} פעימות בלי זמן
          </span>
        )}
      </div>
    </article>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone: "neutral" | "warm" | "gold" | "good" | "warn";
}) {
  const toneClass = {
    neutral: "bg-ink-50 text-ink-600",
    warm: "bg-primary-50 text-primary-700",
    gold: "bg-ink-50 text-ink-700",
    good: "bg-success-50 text-success-700",
    warn: "bg-rose-50/60 text-rose-600",
  }[tone];
  return (
    <div className={cn("rounded-md p-2 text-center", toneClass)}>
      <div className="inline-flex items-center justify-center gap-1 text-[10px] text-ink-500">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-lg font-bold tabular-nums leading-tight">
        {value}
      </div>
    </div>
  );
}
