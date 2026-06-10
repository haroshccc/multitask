import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid, Table2, Plus, Loader2, Filter, Pencil } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  pointerWithin,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import { useProjectContext } from "@/pages/app/ProjectShell";
import { useTaskLists, useCreateTaskList } from "@/lib/hooks/useTaskLists";
import {
  useTasksByProject,
  useCreateTask,
  useDeleteTask,
  useUpdateTask,
  useSetTaskParent,
} from "@/lib/hooks/useTasks";
import { useRowDisplayPrefs } from "@/lib/hooks/useRowDisplayPrefs";
import { TaskRow, type TaskTreeNode } from "@/components/tasks/TaskRow";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";
import { BulkActionsToolbar } from "@/components/tasks/BulkActionsToolbar";
import { TasksBlock } from "@/components/projects/blocks/TasksBlock";
import { useTaskSelectionStore } from "@/lib/selection/store";
import type { Task, TaskList } from "@/lib/types/domain";
import { pushUndo } from "@/lib/undo/store";
import { cn } from "@/lib/utils/cn";

const VIEW_KEY = "multitask.projectTasks.view";
const LOOSE_KEY = "__loose__";
/** Droppable id prefix for a phase column (drag a task onto it to reparent). */
const PHASE_DROP_PREFIX = "phase-col:";
type ViewMode = "lists" | "table";

/**
 * Collision detection restricted to the phase columns. The shared TaskRow
 * registers its own before/nest/after droppables; without this filter dnd-kit
 * would resolve `over` to one of those tiny zones when the pointer is over a
 * row, and a drop landing on a row in another column would silently no-op.
 * Filtering to phase columns guarantees `over` is always the column under the
 * pointer, so dropping anywhere inside a column reparents to that phase.
 */
const phaseColumnCollision: CollisionDetection = (args) => {
  const phaseCols = args.droppableContainers.filter(
    (c) => c.data.current?.type === "phase-col"
  );
  const within = pointerWithin({ ...args, droppableContainers: phaseCols });
  if (within.length > 0) return within;
  return closestCenter({ ...args, droppableContainers: phaseCols });
};

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
      </div>

      <div>
        {view === "table" ? (
          <TasksBlock scopeId={projectId} />
        ) : (
          <PhaseListsView projectList={projectList} projectId={projectId} />
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
  const updateTask = useUpdateTask();
  const setParent = useSetTaskParent();
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);

  const { phases, looseRoots } = useMemo(() => buildPhaseGroups(tasks), [tasks]);

  // ─── Phase visibility filter (persisted per project) ──────────────────────
  const storageKey = `multitask.projectTasks.hiddenPhases.${projectId}`;
  const [hidden, setHidden] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? new Set<string>(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    if (typeof window !== "undefined")
      localStorage.setItem(storageKey, JSON.stringify([...hidden]));
  }, [hidden, storageKey]);
  const toggleHidden = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const filterOptions = [
    ...(looseRoots.length > 0 ? [{ key: LOOSE_KEY, label: "ללא שלב" }] : []),
    ...phases.map((p) => ({
      key: p.phase.id,
      label: p.phase.title || "שלב ללא שם",
    })),
  ];
  const showFilter = filterOptions.length > 1;
  const looseVisible = looseRoots.length > 0 && !hidden.has(LOOSE_KEY);
  const visiblePhases = phases.filter((p) => !hidden.has(p.phase.id));

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

  // ─── Drag a task between phases (kanban-style reparent) ───────────────────
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const handleDragStart = (e: DragStartEvent) => {
    const taskId = e.active.data.current?.taskId as string | undefined;
    setActiveTask(taskId ? tasks.find((t) => t.id === taskId) ?? null : null);
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveTask(null);
    const taskId = e.active.data.current?.taskId as string | undefined;
    // phaseId is `null` for the loose column, a phase id for a phase column,
    // or `undefined` when the drop landed outside any column.
    const phaseId = e.over?.data.current?.phaseId as string | null | undefined;
    if (!taskId || phaseId === undefined) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.is_phase) return; // never reparent a phase into a phase
    const target = phaseId ?? null;
    const prevParent = task.parent_task_id ?? null;
    if (prevParent === target) return;
    setParent.mutate({ taskId, parentId: target });
    pushUndo({
      description: "העברת משימה בין שלבים",
      undo: () => setParent.mutate({ taskId, parentId: prevParent }),
      redo: () => setParent.mutate({ taskId, parentId: target }),
    });
  };

  // Publish the flat visible order so Shift+click range-select resolves, and
  // clear any lingering selection when leaving this view.
  const setOrderedIds = useTaskSelectionStore((s) => s.setOrderedIds);
  const clearSelection = useTaskSelectionStore((s) => s.clear);
  useEffect(() => {
    const ids: string[] = [];
    const walk = (nodes: TaskTreeNode[]) => {
      for (const n of nodes) {
        ids.push(n.task.id);
        walk(n.children);
      }
    };
    if (looseVisible) walk(looseRoots);
    for (const p of visiblePhases) walk(p.children);
    setOrderedIds(ids);
  });
  useEffect(() => () => clearSelection(), [clearSelection]);

  return (
    <>
      {showFilter && (
        <div className="flex items-center gap-1.5 flex-wrap mb-1">
          <span className="inline-flex items-center gap-1 text-xs text-ink-400 me-1">
            <Filter className="w-3.5 h-3.5" />
            סינון שלבים
          </span>
          {filterOptions.map((opt) => {
            const isHidden = hidden.has(opt.key);
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => toggleHidden(opt.key)}
                className={cn(
                  "max-w-[12rem] truncate rounded-full border px-2.5 py-1 text-xs transition-colors",
                  isHidden
                    ? "border-ink-200 bg-white text-ink-400 hover:bg-ink-50"
                    : "border-primary-300 bg-primary-50 text-primary-700"
                )}
                title={isHidden ? `הצג: ${opt.label}` : `הסתר: ${opt.label}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={phaseColumnCollision}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveTask(null)}
      >
        <div className="flex gap-3 overflow-x-auto overscroll-x-contain pb-2 scrollbar-thin items-start">
          {/* Loose tasks (no phase) */}
          {looseVisible && (
            <PhaseColumn
              title="ללא שלב"
              editable={false}
              phaseId={null}
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

          {visiblePhases.map((p) => (
            <PhaseColumn
              key={p.phase.id}
              title={p.phase.title}
              editable
              phaseId={p.phase.id}
              autoEdit={focusTaskId === p.phase.id}
              count={p.children.length}
              roots={p.children}
              parentTaskId={p.phase.id}
              listId={projectList.id}
              color={p.phase.accent_color ?? null}
              display={prefs}
              focusTaskId={focusTaskId}
              onRequestFocus={setFocusTaskId}
              onOpenEdit={setEditingTaskId}
              onRename={(title) =>
                updateTask.mutate({ taskId: p.phase.id, patch: { title } })
              }
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

        <DragOverlay>
          {activeTask ? (
            <div className="rounded-md bg-white border border-primary-300 shadow-lift px-2 py-1 text-sm text-ink-900 max-w-xs truncate pointer-events-none">
              {activeTask.title || "משימה ללא שם"}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <TaskEditModal
        taskId={editingTaskId}
        createDraft={null}
        onClose={() => setEditingTaskId(null)}
      />

      <BulkActionsToolbar allTasks={tasks} />
    </>
  );
}

function PhaseColumn({
  title,
  editable,
  phaseId,
  autoEdit,
  count,
  roots,
  parentTaskId,
  listId,
  color,
  display,
  focusTaskId,
  onRequestFocus,
  onOpenEdit,
  onRename,
  onAddTask,
}: {
  title: string;
  editable: boolean;
  phaseId: string | null;
  autoEdit?: boolean;
  count: number;
  roots: TaskTreeNode[];
  parentTaskId: string | null;
  listId: string;
  color?: string | null;
  display: ReturnType<typeof useRowDisplayPrefs>[0];
  focusTaskId: string | null;
  onRequestFocus: (id: string) => void;
  onOpenEdit: (id: string) => void;
  onRename?: (title: string) => void;
  onAddTask: () => void;
}) {
  const accent = color ?? "#a8a8bc";
  const incomplete = roots.filter((n) => !n.task.completed_at);
  const completed = roots.filter((n) => !!n.task.completed_at);
  const [showCompleted, setShowCompleted] = useState(false);
  const [editing, setEditing] = useState(() => editable && !!autoEdit);

  const displayTitle = editable ? title || "שלב ללא שם" : title;

  const commitRename = (next: string) => {
    setEditing(false);
    if (next !== title) onRename?.(next);
  };

  // Whole-column drop target — dropping a dragged task anywhere inside
  // reparents it to this phase (or to "no phase" for the loose column).
  const { setNodeRef, isOver } = useDroppable({
    id: `${PHASE_DROP_PREFIX}${phaseId ?? "loose"}`,
    data: { type: "phase-col", phaseId },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "shrink-0 w-[36rem] max-w-[calc(100vw-2rem)] self-start flex flex-col bg-white border rounded-xl shadow-soft transition-colors",
        isOver ? "border-primary-400 ring-2 ring-primary-200" : "border-ink-200"
      )}
      style={{ ["--list-color" as string]: accent } as React.CSSProperties}
    >
      <div
        className="px-3 py-2 flex items-center gap-2 border-b-2"
        style={{ borderBottomColor: accent }}
      >
        {editable && editing ? (
          <PhaseTitleEditor
            initial={title}
            onCommit={commitRename}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <button
            type="button"
            onClick={editable ? () => setEditing(true) : undefined}
            disabled={!editable}
            className={cn(
              "flex-1 min-w-0 text-start font-semibold text-ink-900 text-sm truncate rounded-md px-1 -mx-1",
              editable && "hover:bg-ink-100 cursor-text"
            )}
            title={editable ? "לחצי לעריכת שם השלב" : undefined}
          >
            {displayTitle}
          </button>
        )}

        {editable && phaseId && !editing && (
          <button
            type="button"
            onClick={() => onOpenEdit(phaseId)}
            className="shrink-0 p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-ink-100"
            title="פתיחת עריכת השלב המלאה"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}

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

/**
 * Inline editor for a phase column title. Commits on Enter or blur, cancels on
 * Escape. Deliberately isolated from the sensitive TaskRow save path: it only
 * calls the parent's `onCommit` (which patches the phase task's title) and
 * never creates/deletes tasks, so there is no race with task creation.
 */
function PhaseTitleEditor({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (title: string) => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);
  const commit = () => {
    if (done.current) return;
    done.current = true;
    onCommit((ref.current?.value ?? "").trim());
  };
  return (
    <input
      ref={ref}
      defaultValue={initial}
      placeholder="שם השלב"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          done.current = true;
          onCancel();
        }
      }}
      onBlur={commit}
      className="flex-1 min-w-0 rounded-md border border-ink-300 bg-white px-1.5 py-1 text-sm font-semibold text-ink-900 focus:outline-none focus:ring-1 focus:ring-primary-400"
    />
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
