import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LayoutGrid,
  Table2,
  Plus,
  Loader2,
  CalendarDays,
  GanttChartSquare,
  PanelRightClose,
} from "lucide-react";
import { useProjectContext } from "@/pages/app/ProjectShell";
import { useTaskLists, useCreateTaskList } from "@/lib/hooks/useTaskLists";
import {
  useTasksByProject,
  useCreateTask,
  useDeleteTask,
} from "@/lib/hooks/useTasks";
import { useRowDisplayPrefs } from "@/lib/hooks/useRowDisplayPrefs";
import { TaskRow, type TaskTreeNode } from "@/components/tasks/TaskRow";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";
import { TasksBlock } from "@/components/projects/blocks/TasksBlock";
import { CalendarBlock } from "@/components/projects/blocks/CalendarBlock";
import type { Task, TaskList } from "@/lib/types/domain";
import { pushUndo } from "@/lib/undo/store";
import { cn } from "@/lib/utils/cn";

const VIEW_KEY = "multitask.projectTasks.view";
type ViewMode = "lists" | "table";

export function ProjectTasksTab() {
  const { projectId } = useProjectContext();
  const { data: lists = [], isLoading: listsLoading } = useTaskLists();
  const projectList = useMemo(
    () => lists.find((l) => l.project_id === projectId) ?? null,
    [lists, projectId]
  );

  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "lists";
    return localStorage.getItem(VIEW_KEY) === "table" ? "table" : "lists";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  const [sidePanel, setSidePanel] = useState<"calendar" | null>(null);

  if (listsLoading) {
    return (
      <div className="card p-10 text-center text-ink-500 text-sm">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
        טוען משימות…
      </div>
    );
  }

  if (!projectList) {
    return <CreateProjectListCta projectId={projectId} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <ViewToggle view={view} onChange={setView} />
        <div className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSidePanel((p) => (p === "calendar" ? null : "calendar"))}
            className={cn(
              "hidden lg:inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border",
              sidePanel === "calendar"
                ? "bg-ink-900 text-white border-ink-900"
                : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
            )}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            יומן
          </button>
          <Link
            to="/app/gantt"
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
            title="פתח גאנט (אפשר לסנן לפי הפרויקט)"
          >
            <GanttChartSquare className="w-3.5 h-3.5" />
            גאנט
          </Link>
        </div>
      </div>

      <div className={cn("flex gap-3", sidePanel && "items-start")}>
        <div className="flex-1 min-w-0">
          {view === "table" ? (
            <TasksBlock scopeId={projectId} />
          ) : (
            <PhaseListsView projectList={projectList} projectId={projectId} />
          )}
        </div>

        {sidePanel === "calendar" && (
          <aside className="hidden lg:block w-[380px] shrink-0 card p-3 sticky top-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-ink-800">יומן הפרויקט</span>
              <button
                type="button"
                onClick={() => setSidePanel(null)}
                className="p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-ink-100"
                aria-label="סגור פאנל"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            </div>
            <div style={{ height: "420px" }}>
              <CalendarBlock scopeId={projectId} />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

// ─── Phase-as-list view ──────────────────────────────────────────────────────

function PhaseListsView({
  projectList,
  projectId,
}: {
  projectList: TaskList;
  projectId: string;
}) {
  const { data: tasks = [] } = useTasksByProject(projectId);
  const [prefs] = useRowDisplayPrefs();
  const createTask = useCreateTask();
  const deleteTask = useDeleteTask();
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);

  const { phases, looseRoots } = useMemo(() => buildPhaseGroups(tasks), [tasks]);

  const addPhase = async () => {
    const payload = {
      title: "",
      task_list_id: projectList.id,
      parent_task_id: null,
      is_phase: true,
      status: "todo",
      urgency: 0,
    };
    const t = await createTask.mutateAsync(payload);
    pushUndo({
      description: "יצירת שלב",
      undo: () => deleteTask.mutate(t.id),
      redo: () => createTask.mutate(payload),
    });
    setFocusTaskId(t.id);
  };

  const addTask = async (parentPhaseId: string | null) => {
    const payload = {
      title: "",
      task_list_id: projectList.id,
      parent_task_id: parentPhaseId,
      status: "todo",
      urgency: 0,
    };
    const t = await createTask.mutateAsync(payload);
    pushUndo({
      description: "יצירת משימה",
      undo: () => deleteTask.mutate(t.id),
      redo: () => createTask.mutate(payload),
    });
    setFocusTaskId(t.id);
  };

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin items-start">
        {/* Loose tasks (no phase) */}
        {looseRoots.length > 0 && (
          <PhaseColumn
            title="ללא שלב"
            count={looseRoots.length}
            roots={looseRoots}
            parentTaskId={null}
            listId={projectList.id}
            display={prefs}
            focusTaskId={focusTaskId}
            onRequestFocus={setFocusTaskId}
            onOpenEdit={setEditingTaskId}
            onAddTask={() => addTask(null)}
          />
        )}

        {phases.map((p) => (
          <PhaseColumn
            key={p.phase.id}
            title={p.phase.title || "שלב ללא שם"}
            count={p.children.length}
            roots={p.children}
            parentTaskId={p.phase.id}
            listId={projectList.id}
            color={p.phase.accent_color ?? null}
            display={prefs}
            focusTaskId={focusTaskId}
            onRequestFocus={setFocusTaskId}
            onOpenEdit={setEditingTaskId}
            onHeaderClick={() => setEditingTaskId(p.phase.id)}
            onAddTask={() => addTask(p.phase.id)}
          />
        ))}

        {/* Add phase */}
        <button
          type="button"
          onClick={addPhase}
          className="shrink-0 w-64 self-start rounded-xl border-2 border-dashed border-ink-200 text-ink-400 hover:text-primary-600 hover:border-primary-300 py-6 text-sm inline-flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          שלב חדש
        </button>
      </div>

      <TaskEditModal
        taskId={editingTaskId}
        createDraft={null}
        onClose={() => setEditingTaskId(null)}
      />
    </>
  );
}

function PhaseColumn({
  title,
  count,
  roots,
  parentTaskId,
  listId,
  color,
  display,
  focusTaskId,
  onRequestFocus,
  onOpenEdit,
  onHeaderClick,
  onAddTask,
}: {
  title: string;
  count: number;
  roots: TaskTreeNode[];
  parentTaskId: string | null;
  listId: string;
  color?: string | null;
  display: ReturnType<typeof useRowDisplayPrefs>[0];
  focusTaskId: string | null;
  onRequestFocus: (id: string) => void;
  onOpenEdit: (id: string) => void;
  onHeaderClick?: () => void;
  onAddTask: () => void;
}) {
  const accent = color ?? "#a8a8bc";
  const incomplete = roots.filter((n) => !n.task.completed_at);
  const completed = roots.filter((n) => !!n.task.completed_at);
  const [showCompleted, setShowCompleted] = useState(false);

  return (
    <div
      className="shrink-0 w-72 self-start flex flex-col bg-white border border-ink-200 rounded-xl shadow-soft"
      style={{ ["--list-color" as string]: accent } as React.CSSProperties}
    >
      <div
        className="px-3 py-2 flex items-center gap-2 border-b-2"
        style={{ borderBottomColor: accent }}
      >
        <button
          type="button"
          onClick={onHeaderClick}
          disabled={!onHeaderClick}
          className={cn(
            "flex-1 min-w-0 text-start font-semibold text-ink-900 text-sm truncate rounded-md px-1 -mx-1",
            onHeaderClick && "hover:bg-ink-100"
          )}
        >
          {title}
        </button>
        <span className="text-xs text-ink-500 shrink-0 tabular-nums">{count}</span>
      </div>

      <div className="p-1 max-h-[calc(100vh-320px)] overflow-y-auto scrollbar-thin">
        {incomplete.map((node, idx) => (
          <TaskRow
            key={node.task.id}
            node={node}
            prevSiblingId={idx > 0 ? incomplete[idx - 1]!.task.id : null}
            parentTaskId={parentTaskId}
            grandparentTaskId={null}
            listId={listId}
            onRequestFocus={onRequestFocus}
            focusTaskId={focusTaskId}
            onOpenEdit={onOpenEdit}
            display={display}
            permission="owner"
          />
        ))}

        <button
          type="button"
          onClick={onAddTask}
          className="w-full flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-ink-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          משימה חדשה
        </button>

        {completed.length > 0 && (
          <div className="mt-1">
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              className="w-full flex items-center gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400 hover:text-ink-600"
            >
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className={cn(
                  "w-3 h-3 transition-transform",
                  showCompleted ? "rotate-90" : "rotate-0"
                )}
              >
                <path d="M5 7l5 6 5-6H5z" />
              </svg>
              הושלמו ({completed.length})
            </button>
            {showCompleted &&
              completed.map((node) => (
                <TaskRow
                  key={node.task.id}
                  node={node}
                  prevSiblingId={null}
                  parentTaskId={parentTaskId}
                  grandparentTaskId={null}
                  listId={listId}
                  onRequestFocus={onRequestFocus}
                  focusTaskId={focusTaskId}
                  onOpenEdit={onOpenEdit}
                  display={display}
                  permission="owner"
                />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface PhaseGroup {
  phase: Task;
  children: TaskTreeNode[];
}

/**
 * Builds the parent→child tree for a project's single list, then splits the
 * top level into phase groups. Each `is_phase` root becomes its own column
 * (carrying its subtree); non-phase roots collect into `looseRoots`.
 */
function buildPhaseGroups(tasks: Task[]): {
  phases: PhaseGroup[];
  looseRoots: TaskTreeNode[];
} {
  const byId = new Map<string, Task>();
  tasks.forEach((t) => byId.set(t.id, t));

  const childrenOf = new Map<string | null, Task[]>();
  for (const t of tasks) {
    const parentInList = t.parent_task_id && byId.has(t.parent_task_id);
    const pid = parentInList ? t.parent_task_id : null;
    if (!childrenOf.has(pid)) childrenOf.set(pid, []);
    childrenOf.get(pid)!.push(t);
  }
  for (const arr of childrenOf.values()) {
    arr.sort((a, b) => {
      const aDone = !!a.completed_at;
      const bDone = !!b.completed_at;
      if (aDone !== bDone) return aDone ? 1 : -1;
      if (aDone && bDone)
        return (b.completed_at ?? "").localeCompare(a.completed_at ?? "");
      return a.sort_order - b.sort_order;
    });
  }

  const build = (
    pid: string | null,
    depth: number,
    visited = new Set<string>()
  ): TaskTreeNode[] =>
    (childrenOf.get(pid) ?? [])
      .filter((t) => !visited.has(t.id))
      .map((t) => ({
        task: t,
        children: build(t.id, depth + 1, new Set([...visited, t.id])),
        depth,
      }));

  const topLevel = childrenOf.get(null) ?? [];
  const phases: PhaseGroup[] = [];
  const looseRoots: TaskTreeNode[] = [];

  for (const t of topLevel) {
    if (t.is_phase) {
      phases.push({ phase: t, children: build(t.id, 0, new Set([t.id])) });
    } else {
      looseRoots.push({
        task: t,
        children: build(t.id, 1, new Set([t.id])),
        depth: 0,
      });
    }
  }

  return { phases, looseRoots };
}

// ─── Empty state: project has no list yet ────────────────────────────────────

function CreateProjectListCta({ projectId }: { projectId: string }) {
  const createList = useCreateTaskList();
  return (
    <div className="card p-8 text-center">
      <LayoutGrid className="w-9 h-9 text-ink-300 mx-auto mb-2" />
      <h3 className="text-base font-semibold text-ink-900 mb-1">
        עדיין אין רשימת משימות לפרויקט
      </h3>
      <p className="text-xs text-ink-500 mb-4 max-w-sm mx-auto">
        כל פרויקט מנהל רשימת משימות אחת. בתוך הדף אפשר לחלק אותה לשלבים שיופיעו
        כרשימות נפרדות.
      </p>
      <button
        type="button"
        disabled={createList.isPending}
        onClick={() =>
          createList.mutate({
            name: "משימות הפרויקט",
            kind: "project",
            project_id: projectId,
          })
        }
        className="btn-accent text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
      >
        <Plus className="w-4 h-4" />
        צרי רשימת משימות
      </button>
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-ink-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => onChange("lists")}
        className={cn(
          "px-2.5 py-1.5 text-xs inline-flex items-center gap-1",
          view === "lists" ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-50"
        )}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        רשימות
      </button>
      <button
        type="button"
        onClick={() => onChange("table")}
        className={cn(
          "px-2.5 py-1.5 text-xs inline-flex items-center gap-1",
          view === "table" ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-50"
        )}
      >
        <Table2 className="w-3.5 h-3.5" />
        טבלה
      </button>
    </div>
  );
}
