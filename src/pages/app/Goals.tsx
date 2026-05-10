import { useEffect, useMemo, useState } from "react";

import {
  Award,
  Clock,
  Columns3,
  CheckCircle2,
  Circle,
  Flag,
  Flame,
  LayoutGrid,
  Pencil,
  Plus,
  Repeat,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Eye,
  Lock,
} from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { cn } from "@/lib/utils/cn";
import { useTasks } from "@/lib/hooks/useTasks";
import { useTaskLists, useSharesForTaskLists } from "@/lib/hooks/useTaskLists";
import { useTaskSharesForTasks } from "@/lib/hooks/useTaskShares";
import { useTimeEntriesByRange } from "@/lib/hooks/useTimer";
import { useOrgScope } from "@/lib/hooks/useOrgScope";
import { useOrgMembers } from "@/lib/hooks/useOrgMembers";
import {
  computeGoalStats,
  periodLabelHe,
  periodUnitHe,
  type GoalPeriod,
} from "@/lib/goals/computation";
import type { Task, TimeEntry } from "@/lib/types/domain";
import { TaskEditModal, type TaskCreateDraft } from "@/components/tasks/TaskEditModal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GoalTypeFilter = "all" | "achievement" | "habit";
type GoalLayout = "grid" | "columns";
type ScopeFilter = "all" | "mine" | "shared" | "others";

/** How the current user relates to this goal's sharing state */
type ShareKind =
  | "private"      // my goal, not shared with anyone
  | "mine-read"    // my goal, shared for view-only
  | "mine-write"   // my goal, shared for editing (collaborative)
  | "other-read"   // someone else's goal, I can only view
  | "other-write"; // someone else's goal, I can also mark completion

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

const LAYOUT_KEY = "multitask:goals:layout";
const TYPE_FILTER_KEY = "multitask:goals:typeFilter";
const SCOPE_FILTER_KEY = "multitask:goals:scopeFilter";

function readLS<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Goal type helpers
// ---------------------------------------------------------------------------

function isAchievement(task: Task): boolean {
  return (task as any).goal_type === "achievement";
}
function isHabit(task: Task): boolean {
  return !!task.goal_period;
}
function isGoal(task: Task): boolean {
  return isHabit(task) || isAchievement(task);
}

// ---------------------------------------------------------------------------
// Visual helpers: border and icon classes per share kind
// ---------------------------------------------------------------------------

function getBorderClass(kind: ShareKind): string {
  if (kind === "mine-read" || kind === "mine-write") return "border-2 border-pink-400";
  if (kind === "other-read" || kind === "other-write") return "border-2 border-blue-400";
  return "border-2 border-amber-400";
}

function getIconColorClass(kind: ShareKind): string {
  if (kind === "mine-read" || kind === "mine-write") return "text-pink-500";
  if (kind === "other-read" || kind === "other-write") return "text-blue-500";
  return "text-amber-500";
}

function getSharingBadge(kind: ShareKind): { label: string; icon: React.ReactNode; className: string } | null {
  if (kind === "mine-read" || kind === "mine-write")
    return { label: "שיתפתי", icon: <Users className="w-3 h-3" />, className: "text-pink-700 bg-pink-50 border-pink-200" };
  if (kind === "other-read" || kind === "other-write")
    return { label: "שותף איתי", icon: <Eye className="w-3 h-3" />, className: "text-blue-700 bg-blue-50 border-blue-200" };
  return null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function Goals() {
  const { data: tasks = [], isLoading } = useTasks();
  const { data: lists = [] } = useTaskLists();
  const { userId } = useOrgScope();
  const { data: orgMembers = [] } = useOrgMembers();

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

  // Batch-load shares for all task lists that contain goal tasks.
  // RLS ensures: owners see all share rows, non-owners see only their own row.
  const goalListIds = useMemo(() => {
    const s = new Set(goalTasks.map((t) => t.task_list_id).filter(Boolean) as string[]);
    return Array.from(s);
  }, [goalTasks]);

  const { data: listShares = [] } = useSharesForTaskLists(goalListIds);

  // Map: listId → { hasWrite, hasRead } across all visible list-level share rows
  const listShareMap = useMemo(() => {
    const m = new Map<string, { hasWrite: boolean; hasRead: boolean }>();
    for (const s of listShares) {
      const cur = m.get(s.entity_id) ?? { hasWrite: false, hasRead: false };
      if (s.permission === "write") cur.hasWrite = true;
      else cur.hasRead = true;
      m.set(s.entity_id, cur);
    }
    return m;
  }, [listShares]);

  // Task-level shares (more specific than list shares)
  const goalTaskIds = useMemo(() => goalTasks.map((t) => t.id), [goalTasks]);
  const { data: taskShares = [] } = useTaskSharesForTasks(goalTaskIds);

  // Map: taskId → { hasWrite, hasRead }
  const taskShareMap = useMemo(() => {
    const m = new Map<string, { hasWrite: boolean; hasRead: boolean }>();
    for (const s of taskShares) {
      const cur = m.get(s.entity_id) ?? { hasWrite: false, hasRead: false };
      if (s.permission === "write") cur.hasWrite = true;
      else cur.hasRead = true;
      m.set(s.entity_id, cur);
    }
    return m;
  }, [taskShares]);

  // Map: userId → display name
  const memberNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const { membership, profile } of orgMembers) {
      const name = profile?.full_name ?? (profile as any)?.email ?? membership.user_id.slice(0, 8);
      m.set(membership.user_id, name);
    }
    return m;
  }, [orgMembers]);

  const entriesByTask = useMemo(() => {
    const m = new Map<string, TimeEntry[]>();
    for (const e of timeEntries) {
      const arr = m.get(e.task_id) ?? [];
      arr.push(e);
      m.set(e.task_id, arr);
    }
    return m;
  }, [timeEntries]);

  // ---------------------------------------------------------------------------
  // Compute share kind per task
  // ---------------------------------------------------------------------------
  function getShareKind(task: Task): ShareKind {
    const isMine = task.owner_id === userId;
    // Task-level shares take precedence; fall back to list-level shares
    const taskInfo = taskShareMap.get(task.id);
    const listInfo = task.task_list_id ? listShareMap.get(task.task_list_id) : undefined;
    const hasWrite = taskInfo?.hasWrite || listInfo?.hasWrite;
    const hasRead = taskInfo?.hasRead || listInfo?.hasRead;
    if (isMine) {
      if (hasWrite) return "mine-write";
      if (hasRead) return "mine-read";
      return "private";
    }
    if (hasWrite) return "other-write";
    return "other-read";
  }

  // ---------------------------------------------------------------------------
  // Filter state
  // ---------------------------------------------------------------------------
  const [editTaskId, setEditTaskId] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState<TaskCreateDraft | null>(null);
  const [typeFilter, setTypeFilter] = useState<GoalTypeFilter>(() =>
    readLS<GoalTypeFilter>(TYPE_FILTER_KEY, "all")
  );
  const [layout, setLayout] = useState<GoalLayout>(() =>
    readLS<GoalLayout>(LAYOUT_KEY, "grid")
  );
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>(() =>
    readLS<ScopeFilter>(SCOPE_FILTER_KEY, "all")
  );
  const [userFilter, setUserFilter] = useState<string | null>(null);

  useEffect(() => {
    const handler = () => setCreateDraft({ goalEnabled: true });
    window.addEventListener("app:new-goal", handler);
    return () => window.removeEventListener("app:new-goal", handler);
  }, []);

  // ---------------------------------------------------------------------------
  // Filtered + scoped goals
  // ---------------------------------------------------------------------------
  const filteredGoals = useMemo(() => {
    let result = goalTasks;

    // Scope filter
    if (scopeFilter === "mine") {
      result = result.filter((t) => {
        if (t.owner_id !== userId) return false;
        const kind = getShareKind(t);
        return kind === "private";
      });
    } else if (scopeFilter === "shared") {
      result = result.filter((t) => {
        if (t.owner_id !== userId) return false;
        const kind = getShareKind(t);
        return kind === "mine-read" || kind === "mine-write";
      });
    } else if (scopeFilter === "others") {
      result = result.filter((t) => t.owner_id !== userId);
    }

    // User filter — meaning differs by scope:
    // "shared" scope → filter by which user I shared with (via listShares)
    // other scopes   → filter by goal owner
    if (userFilter) {
      if (scopeFilter === "shared") {
        result = result.filter((t) => {
          const byList = t.task_list_id
            ? listShares.some((s) => s.entity_id === t.task_list_id && s.user_id === userFilter)
            : false;
          const byTask = taskShares.some((s) => s.entity_id === t.id && s.user_id === userFilter);
          return byList || byTask;
        });
      } else {
        result = result.filter((t) => t.owner_id === userFilter);
      }
    }

    // Type filter
    if (typeFilter === "achievement") result = result.filter(isAchievement);
    if (typeFilter === "habit") result = result.filter(isHabit);

    return result;
  }, [goalTasks, scopeFilter, userFilter, typeFilter, userId, listShareMap, listShares, taskShares, taskShareMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // For columns layout: group by task_list_id
  const columns = useMemo(() => {
    const map = new Map<string | null, Task[]>();
    for (const t of filteredGoals) {
      const key = t.task_list_id ?? null;
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === null) return 1;
      if (b === null) return -1;
      return (listById.get(a)?.name ?? "").localeCompare(listById.get(b)?.name ?? "");
    });
  }, [filteredGoals, listById]);

  // Counts for filter badges
  const mineCount = goalTasks.filter((t) => {
    if (t.owner_id !== userId) return false;
    const k = getShareKind(t);
    return k === "private";
  }).length;
  const sharedCount = goalTasks.filter((t) => {
    if (t.owner_id !== userId) return false;
    const k = getShareKind(t);
    return k === "mine-read" || k === "mine-write";
  }).length;
  const othersCount = goalTasks.filter((t) => t.owner_id !== userId).length;
  const habitCount = goalTasks.filter(isHabit).length;
  const achievementCount = goalTasks.filter(isAchievement).length;

  // Other members (for user filter in "others"/"all" scopes)
  const otherMembers = useMemo(
    () => orgMembers.filter((m) => m.membership.user_id !== userId),
    [orgMembers, userId]
  );

  // Members I've explicitly shared with (list-level OR task-level, for "shared" scope user filter)
  const sharedWithMembers = useMemo(() => {
    const myListIds = new Set(lists.filter((l) => l.owner_id === userId).map((l) => l.id));
    const myTaskIds = new Set(goalTasks.filter((t) => t.owner_id === userId).map((t) => t.id));
    const sharedUserIds = new Set([
      ...listShares.filter((s) => myListIds.has(s.entity_id)).map((s) => s.user_id),
      ...taskShares.filter((s) => myTaskIds.has(s.entity_id)).map((s) => s.user_id),
    ]);
    return orgMembers.filter((m) => sharedUserIds.has(m.membership.user_id));
  }, [listShares, taskShares, lists, goalTasks, userId, orgMembers]);

  const setTypeFilterPersist = (v: GoalTypeFilter) => {
    setTypeFilter(v);
    localStorage.setItem(TYPE_FILTER_KEY, JSON.stringify(v));
  };
  const setLayoutPersist = (v: GoalLayout) => {
    setLayout(v);
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(v));
  };
  const setScopeFilterPersist = (v: ScopeFilter) => {
    setScopeFilter(v);
    localStorage.setItem(SCOPE_FILTER_KEY, JSON.stringify(v));
    setUserFilter(null); // always reset when scope changes — meaning of userFilter differs per scope
  };

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
      {!isLoading && goalTasks.length > 0 && (
        <div className="flex flex-col gap-3 mb-4">
          {/* Row 1: scope filter */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="inline-flex rounded-lg border border-ink-200 overflow-hidden text-sm">
              {(
                [
                  { id: "all", label: "הכל", count: goalTasks.length, icon: <Target className="w-3.5 h-3.5" /> },
                  { id: "mine", label: "שלי", count: mineCount, icon: <Lock className="w-3.5 h-3.5" /> },
                  { id: "shared", label: "שיתפתי", count: sharedCount, icon: <Users className="w-3.5 h-3.5" /> },
                  { id: "others", label: "של אחרים", count: othersCount, icon: <Eye className="w-3.5 h-3.5" /> },
                ] as { id: ScopeFilter; label: string; count: number; icon: React.ReactNode }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setScopeFilterPersist(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 transition-colors border-e border-ink-200 last:border-e-0",
                    scopeFilter === tab.id
                      ? "bg-primary-600 text-white"
                      : "bg-white text-ink-600 hover:bg-ink-50"
                  )}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  <span className={cn(
                    "text-[10px] rounded-full px-1.5 py-0.5 leading-none",
                    scopeFilter === tab.id ? "bg-white/20 text-white" : "bg-ink-100 text-ink-500"
                  )}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Layout toggle — labeled so "לפי רשימה" is discoverable */}
            <div className="inline-flex rounded-lg border border-ink-200 overflow-hidden text-sm ms-auto">
              <button
                type="button"
                onClick={() => setLayoutPersist("grid")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 transition-colors border-e border-ink-200",
                  layout === "grid" ? "bg-primary-600 text-white" : "bg-white text-ink-500 hover:bg-ink-50"
                )}
                aria-label="תצוגת גריד"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>גריד</span>
              </button>
              <button
                type="button"
                onClick={() => setLayoutPersist("columns")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 transition-colors",
                  layout === "columns" ? "bg-primary-600 text-white" : "bg-white text-ink-500 hover:bg-ink-50"
                )}
                aria-label="תצוגה לפי רשימה"
              >
                <Columns3 className="w-3.5 h-3.5" />
                <span>לפי רשימה</span>
              </button>
            </div>
          </div>

          {/* Row 2: type filter + optional user filter */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Type filter */}
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
                    "flex items-center gap-1.5 px-3 py-1.5 transition-colors border-e border-ink-200 last:border-e-0",
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

            {/* User filter — shown for "shared" (filter by who I shared with)
                or "all"/"others" (filter by goal owner) */}
            {(
              (scopeFilter === "shared" && sharedWithMembers.length > 0) ||
              ((scopeFilter === "all" || scopeFilter === "others") && othersCount > 0 && otherMembers.length > 0)
            ) && (
              <select
                value={userFilter ?? ""}
                onChange={(e) => setUserFilter(e.target.value || null)}
                className="ms-auto shrink-0 text-sm py-1.5 pe-7 ps-3 rounded-lg border border-ink-200 bg-white text-ink-700 max-w-[9rem]"
                aria-label="סינון לפי משתמש"
              >
                <option value="">
                  {scopeFilter === "shared" ? "כל המשותפים" : "כל המשתמשים"}
                </option>
                {(scopeFilter === "shared" ? sharedWithMembers : otherMembers).map(({ membership, profile }) => (
                  <option key={membership.user_id} value={membership.user_id}>
                    {profile?.full_name ?? (profile as any)?.email ?? membership.user_id.slice(0, 8)}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 flex-wrap text-[11px] text-ink-500">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded border-2 border-amber-400 inline-block shrink-0" />
              שלי בלבד
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded border-2 border-pink-400 inline-block shrink-0" />
              שיתפתי עם אחרים
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded border-2 border-blue-400 inline-block shrink-0" />
              שותף איתי
            </span>
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
              shareKind={getShareKind(task)}
              ownerName={task.owner_id !== userId ? (memberNameById.get(task.owner_id) ?? null) : null}
              onEdit={() => setEditTaskId(task.id)}
              canEdit={task.owner_id === userId || getShareKind(task) === "other-write"}
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
                      shareKind={getShareKind(task)}
                      ownerName={task.owner_id !== userId ? (memberNameById.get(task.owner_id) ?? null) : null}
                      onEdit={() => setEditTaskId(task.id)}
                      canEdit={task.owner_id === userId || getShareKind(task) === "other-write"}
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
// GoalCard — dispatches to habit or achievement rendering
// ---------------------------------------------------------------------------

interface GoalCardProps {
  task: Task;
  entries: TimeEntry[];
  listColor: string | null;
  shareKind: ShareKind;
  ownerName: string | null;
  canEdit: boolean;
  onEdit: () => void;
}

function GoalCard({ task, entries, listColor, shareKind, ownerName, canEdit, onEdit }: GoalCardProps) {
  if (isAchievement(task)) {
    return (
      <AchievementCard
        task={task}
        listColor={listColor}
        shareKind={shareKind}
        ownerName={ownerName}
        canEdit={canEdit}
        onEdit={onEdit}
      />
    );
  }
  return (
    <HabitCard
      task={task}
      entries={entries}
      listColor={listColor}
      shareKind={shareKind}
      ownerName={ownerName}
      canEdit={canEdit}
      onEdit={onEdit}
    />
  );
}

// ---------------------------------------------------------------------------
// Owner badge — shown on goals that belong to others
// ---------------------------------------------------------------------------

function OwnerBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-ink-600 bg-ink-50 border border-ink-200 rounded-full px-2 py-0.5">
      <Users className="w-3 h-3" />
      {name}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Achievement card
// ---------------------------------------------------------------------------

function AchievementCard({
  task,
  shareKind,
  ownerName,
  canEdit,
  onEdit,
}: Omit<GoalCardProps, "entries">) {
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

  const sharingBadge = getShareBadge(shareKind);

  return (
    <article className={cn("card p-4", getBorderClass(shareKind))}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <Trophy
            className={cn("w-4 h-4 shrink-0 mt-0.5", done ? getIconColorClass(shareKind) : "text-ink-400")}
          />
          <div className="min-w-0">
            <h3 className={cn(
              "text-sm font-semibold truncate",
              done ? "line-through text-ink-400" : "text-ink-900"
            )}>
              {task.title}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {ownerName && <OwnerBadge name={ownerName} />}
              {sharingBadge && (
                <span className={cn(
                  "inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 border",
                  sharingBadge.className
                )}>
                  {sharingBadge.icon}
                  {sharingBadge.label}
                </span>
              )}
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
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 rounded-md hover:bg-ink-100 text-ink-400 hover:text-ink-700 shrink-0"
            title="ערכי יעד"
            aria-label="ערכי יעד"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Habit card
// ---------------------------------------------------------------------------

function HabitCard({
  task,
  entries,
  shareKind,
  ownerName,
  canEdit,
  onEdit,
}: GoalCardProps) {
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

  const sharingBadge = getShareBadge(shareKind);
  const iconColor = getIconColorClass(shareKind);

  return (
    <article className={cn("card p-4", getBorderClass(shareKind))}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Repeat className={cn("w-4 h-4 shrink-0", iconColor === "text-amber-500" ? "text-primary-600" : iconColor)} />
            <h3 className="text-sm font-semibold text-ink-900 truncate">
              {task.title}
            </h3>
          </div>
          <div className="text-xs text-ink-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
            {ownerName && <OwnerBadge name={ownerName} />}
            {sharingBadge && (
              <span className={cn(
                "inline-flex items-center gap-1 text-[11px] rounded-full px-2 py-0.5 border",
                sharingBadge.className
              )}>
                {sharingBadge.icon}
                {sharingBadge.label}
              </span>
            )}
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
        {canEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 rounded-md hover:bg-ink-100 text-ink-400 hover:text-ink-700 shrink-0"
            title="ערכי יעד"
            aria-label="ערכי יעד"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
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

// ---------------------------------------------------------------------------
// StatCell
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helper — wrapper because getShareBadge and getShareBadgeLabel had to be
// called from JSX without a hook, so extracted as plain function
// ---------------------------------------------------------------------------

function getShareBadge(kind: ShareKind) {
  return getSharingBadge(kind);
}
