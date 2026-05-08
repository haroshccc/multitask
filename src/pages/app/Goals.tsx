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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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

      <div className="mt-3 flex rounded-lg border border-ink-100 overflow-hidden divide-x divide-x-reverse divide-ink-100">
        <StatCell
          icon={<Flame className="w-3 h-3" />}
          label="סטריק"
          value={stats.currentStreak}
          valueColor={stats.currentStreak > 0 ? "text-primary-600" : "text-ink-800"}
        />
        <StatCell
          icon={<Award className="w-3 h-3" />}
          label="שיא"
          value={stats.bestStreak}
          valueColor={stats.bestStreak > 0 ? "text-amber-500" : "text-ink-800"}
        />
        <StatCell
          icon={<TrendingUp className="w-3 h-3" />}
          label="אחרונים"
          value={`${stats.lookbackHits}/${stats.lookbackTotal}`}
          valueColor={
            stats.lookbackTotal === 0
              ? "text-ink-800"
              : stats.lookbackHits === stats.lookbackTotal
                ? "text-success-600"
                : "text-ink-800"
          }
        />
        {showTime && (
          <StatCell
            icon={<Clock className="w-3 h-3" />}
            label="זמן"
            value={`${timeActual}/${timePlanned}`}
            valueColor={timeActual >= timePlanned ? "text-success-600" : "text-ink-800"}
          />
        )}
      </div>

      {(stats.totalPeriodsCounted > 0 || stats.reachedMilestone || stats.beatsWithoutTime.length > 0) && (
        <div className="mt-2.5 flex items-center gap-2 flex-wrap text-[11px]">
          {stats.totalPeriodsCounted > 0 && (
            <span className="text-ink-400">
              {stats.totalPeriodsHit}/{stats.totalPeriodsCounted} {periodUnitHe(period, stats.totalPeriodsCounted)} עמדו ביעד
            </span>
          )}
          {stats.reachedMilestone === true && minStreak != null && (
            <span className="inline-flex items-center gap-1 text-success-700 bg-success-50 border border-success-200 px-2 py-0.5 rounded-full font-medium">
              🎉 אבן דרך הושגה
            </span>
          )}
          {stats.beatsWithoutTime.length > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              <Clock className="w-3 h-3" />
              {stats.beatsWithoutTime.length} ללא זמן
            </span>
          )}
        </div>
      )}
    </article>
  );
}

function StatCell({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  valueColor: string;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5 bg-white">
      <div className={cn("text-base font-bold tabular-nums leading-none", valueColor)}>
        {value}
      </div>
      <div className="flex items-center gap-0.5 text-[10px] text-ink-400 mt-0.5">
        {icon}
        <span>{label}</span>
      </div>
    </div>
  );
}
