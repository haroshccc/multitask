import { useEffect, useMemo, useState } from "react";

import {
  Award,
  Clock,
  Flame,
  LayoutGrid,
  Pencil,
  Plus,
  Repeat,
  Target,
  TrendingUp,
  Trophy,
  Columns3,
  Flag,
  CheckCircle2,
  Circle,
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

type GoalTypeFilter = "all" | "achievement" | "habit";
type GoalLayout = "grid" | "columns";

const LAYOUT_KEY = "multitask:goals:layout";
const TYPE_FILTER_KEY = "multitask:goals:typeFilter";

function readLS<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function isAchievement(task: Task): boolean {
  return (task as any).goal_type === "achievement";
}
function isHabit(task: Task): boolean {
  return !!task.goal_period;
}
function isGoal(task: Task): boolean {
  return isHabit(task) || isAchievement(task);
}

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

  const listById = useMemo(() => {
    const m = new Map<string, { name: string; color: string | null }>();
    for (const l of lists) m.set(l.id, { name: l.name, color: l.color });
    return m;
  }, [lists]);

  const goalTasks = useMemo(() => tasks.filter(isGoal), [tasks]);

  const entriesByTask = useMemo(() => {
    const m = new Map<string, TimeEntry[]>();
    for (const e of timeEntries) {
      const arr = m.get(e.task_id) ?? [];
      arr.push(e);
      m.set(e.task_id, arr);
    }
    return m;
  }, [timeEntries]);

  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState<TaskCreateDraft | null>(null);
  const [typeFilter, setTypeFilter] = useState<GoalTypeFilter>(() =>
    readLS<GoalTypeFilter>(TYPE_FILTER_KEY, "all")
  );
  const [layout, setLayout] = useState<GoalLayout>(() =>
    readLS<GoalLayout>(LAYOUT_KEY, "grid")
  );

  useEffect(() => {
    const handler = () => setCreateDraft({ goalEnabled: true });
    window.addEventListener("app:new-goal", handler);
    return () => window.removeEventListener("app:new-goal", handler);
  }, []);

  const filteredGoals = useMemo(() => {
    if (typeFilter === "achievement") return goalTasks.filter(isAchievement);
    if (typeFilter === "habit") return goalTasks.filter(isHabit);
    return goalTasks;
  }, [goalTasks, typeFilter]);

  // For columns layout: group by task_list_id
  const columns = useMemo(() => {
    const map = new Map<string | null, Task[]>();
    for (const t of filteredGoals) {
      const key = t.task_list_id ?? null;
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    // Sort: lists with names first, then null (no list)
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return (listById.get(a)?.name ?? "").localeCompare(listById.get(b)?.name ?? "");
    });
  }, [filteredGoals, listById]);

  const setTypeFilterPersist = (v: GoalTypeFilter) => {
    setTypeFilter(v);
    localStorage.setItem(TYPE_FILTER_KEY, JSON.stringify(v));
  };
  const setLayoutPersist = (v: GoalLayout) => {
    setLayout(v);
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(v));
  };

  const habitCount = goalTasks.filter(isHabit).length;
  const achievementCount = goalTasks.filter(isAchievement).length;

  return (
    <ScreenScaffold
      title="יעדים"
      subtitle="הישגים חד-פעמיים והרגלים מחזוריים — מעקב סטריק, התקדמות ושיאים."
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
      {/* Toolbar: type filter + layout toggle */}
      {!isLoading && goalTasks.length > 0 && (
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          {/* Type filter tabs */}
          <div className="inline-flex rounded-lg border border-ink-200 overflow-hidden text-sm">
            {(
              [
                { id: "all", label: "הכל", count: goalTasks.length },
                { id: "achievement", label: "הישגים", count: achievementCount, icon: <Trophy className="w-3.5 h-3.5" /> },
                { id: "habit", label: "הרגלים", count: habitCount, icon: <Repeat className="w-3.5 h-3.5" /> },
              ] as { id: GoalTypeFilter; label: string; count: number; icon?: React.ReactNode }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTypeFilterPersist(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 transition-colors border-r border-ink-200 last:border-r-0",
                  typeFilter === tab.id
                    ? "bg-primary-600 text-white"
                    : "bg-white text-ink-600 hover:bg-ink-50"
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span className={cn(
                  "text-[10px] rounded-full px-1.5 py-0.5 leading-none",
                  typeFilter === tab.id ? "bg-white/20 text-white" : "bg-ink-100 text-ink-500"
                )}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Layout toggle */}
          <div className="inline-flex rounded-lg border border-ink-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setLayoutPersist("grid")}
              className={cn(
                "p-2 transition-colors border-r border-ink-200",
                layout === "grid" ? "bg-primary-600 text-white" : "bg-white text-ink-500 hover:bg-ink-50"
              )}
              title="גריד"
              aria-label="תצוגת גריד"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setLayoutPersist("columns")}
              className={cn(
                "p-2 transition-colors",
                layout === "columns" ? "bg-primary-600 text-white" : "bg-white text-ink-500 hover:bg-ink-50"
              )}
              title="עמודות לפי רשימה"
              aria-label="תצוגת עמודות לפי רשימה"
            >
              <Columns3 className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="card p-6 text-center text-ink-500 text-sm">טוען…</div>
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
      ) : filteredGoals.length === 0 ? (
        <div className="card p-6 text-center text-ink-500 text-sm">
          אין יעדים בקטגוריה זו.
        </div>
      ) : layout === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredGoals.map((task) => (
            <GoalCard
              key={task.id}
              task={task}
              entries={entriesByTask.get(task.id) ?? []}
              listColor={task.task_list_id ? (listById.get(task.task_list_id)?.color ?? null) : null}
              onEdit={() => setEditTaskId(task.id)}
            />
          ))}
        </div>
      ) : (
        /* Columns by list */
        <div className="flex gap-4 overflow-x-auto pb-2 items-start">
          {columns.map(([listId, colTasks]) => {
            const list = listId ? listById.get(listId) : null;
            return (
              <div key={listId ?? "__none__"} className="flex-none w-72">
                <div
                  className="flex items-center gap-2 mb-2 px-1 pb-2 border-b-2"
                  style={{ borderColor: list?.color ?? "#e5e7eb" }}
                >
                  <span className="font-semibold text-sm text-ink-800 truncate">
                    {list?.name ?? "ללא רשימה"}
                  </span>
                  <span className="text-[11px] bg-ink-100 text-ink-500 rounded-full px-1.5 py-0.5">
                    {colTasks.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {colTasks.map((task) => (
                    <GoalCard
                      key={task.id}
                      task={task}
                      entries={entriesByTask.get(task.id) ?? []}
                      listColor={list?.color ?? null}
                      onEdit={() => setEditTaskId(task.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
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

// ---------------------------------------------------------------------------
// Unified GoalCard — dispatches to habit or achievement rendering
// ---------------------------------------------------------------------------

interface GoalCardProps {
  task: Task;
  entries: TimeEntry[];
  listColor: string | null;
  onEdit: () => void;
}

function GoalCard({ task, entries, listColor, onEdit }: GoalCardProps) {
  if (isAchievement(task)) {
    return <AchievementCard task={task} listColor={listColor} onEdit={onEdit} />;
  }
  return <HabitCard task={task} entries={entries} listColor={listColor} onEdit={onEdit} />;
}

// ---------------------------------------------------------------------------
// Achievement card
// ---------------------------------------------------------------------------

function AchievementCard({ task, listColor, onEdit }: Omit<GoalCardProps, "entries">) {
  const deadline: string | null = (task as any).goal_deadline ?? null;
  const done = task.status === "done";

  const deadlineLabel = useMemo(() => {
    if (!deadline) return null;
    const [y, m, d] = deadline.split("-").map(Number);
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((dt.getTime() - today.getTime()) / 86400000);
    const dateStr = `${d}/${m}/${y}`;
    if (diff < 0) return { text: `עבר (${dateStr})`, overdue: true };
    if (diff === 0) return { text: "היום!", overdue: false };
    if (diff === 1) return { text: `מחר (${dateStr})`, overdue: false };
    return { text: `${diff} ימים (${dateStr})`, overdue: false };
  }, [deadline]);

  return (
    <article
      className="card p-4 border-2"
      style={{ borderColor: listColor ?? "#e5e7eb" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <Trophy
            className={cn(
              "w-4 h-4 shrink-0 mt-0.5",
              done ? "text-amber-500" : "text-ink-400"
            )}
          />
          <div className="min-w-0">
            <h3 className={cn(
              "text-sm font-semibold truncate",
              done ? "line-through text-ink-400" : "text-ink-900"
            )}>
              {task.title}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {done ? (
                <span className="inline-flex items-center gap-1 text-xs text-success-700 bg-success-50 border border-success-200 rounded-full px-2 py-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  הושג
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-ink-500 bg-ink-50 border border-ink-200 rounded-full px-2 py-0.5">
                  <Circle className="w-3 h-3" />
                  בתהליך
                </span>
              )}
              {deadlineLabel ? (
                <span className={cn(
                  "inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5",
                  deadlineLabel.overdue
                    ? "text-rose-700 bg-rose-50 border border-rose-200"
                    : "text-ink-600 bg-ink-50 border border-ink-200"
                )}>
                  <Flag className="w-3 h-3" />
                  {deadlineLabel.text}
                </span>
              ) : (
                <span className="text-xs text-ink-400">ללא מגבלת זמן</span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="p-1.5 rounded-md hover:bg-ink-100 text-ink-400 hover:text-ink-700 shrink-0"
          title="ערכי יעד"
          aria-label="ערכי יעד"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Habit card
// ---------------------------------------------------------------------------

function HabitCard({ task, entries, listColor, onEdit }: GoalCardProps) {
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
            <Repeat className="w-4 h-4 text-primary-600 shrink-0" />
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
          aria-label="ערכי יעד"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-xs text-ink-600">
            {period === "day" ? "היום" : period === "week" ? "השבוע" : "החודש"}
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

      <div
        className="mt-3 flex rounded-lg overflow-hidden divide-x divide-x-reverse divide-white/50 border border-primary-100"
        style={{ background: "linear-gradient(135deg, rgba(250,204,21,0.07) 0%, rgba(236,72,153,0.07) 100%)" }}
      >
        <StatCell
          icon={<Flame className="w-3 h-3" />}
          label="סטריק"
          value={stats.currentStreak}
          color={stats.currentStreak > 0 ? "#d97706" : "#6b6b80"}
        />
        <StatCell
          icon={<Award className="w-3 h-3" />}
          label="שיא"
          value={stats.bestStreak}
          color={stats.bestStreak > 0 ? "#ec4899" : "#6b6b80"}
        />
        <StatCell
          icon={<TrendingUp className="w-3 h-3" />}
          label="אחרונים"
          value={`${stats.lookbackHits}/${stats.lookbackTotal}`}
          color={
            stats.lookbackTotal === 0
              ? "#6b6b80"
              : stats.lookbackHits === stats.lookbackTotal
                ? "#059669"
                : stats.lookbackHits >= stats.lookbackTotal / 2
                  ? "#d97706"
                  : "#ec4899"
          }
        />
        {showTime && (
          <StatCell
            icon={<Clock className="w-3 h-3" />}
            label="זמן"
            value={`${timeActual}/${timePlanned}`}
            color={
              timeActual >= timePlanned
                ? "#059669"
                : timeActual >= timePlanned * 0.6
                  ? "#d97706"
                  : "#ec4899"
            }
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
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center py-2.5 gap-0.5">
      <div className="text-base font-bold tabular-nums leading-none" style={{ color }}>
        {value}
      </div>
      <div className="flex items-center gap-0.5 text-[10px] text-ink-400 mt-0.5" style={{ color }}>
        {icon}
        <span>{label}</span>
      </div>
    </div>
  );
}
