import { useMemo, useState, useEffect, useRef } from "react";
import {
  Check,
  Plus,
  Trash2,
  ChevronDown,
  ChevronLeft,
  Search,
  Loader2,
  Play,
  Square,
} from "lucide-react";
import {
  useTasksByProject,
  useCreateTask,
  useUpdateTask,
  useCompleteTask,
  useDeleteTask,
  useTaskLists,
  useCreateTaskList,
  useProject,
  useActiveTimer,
  useStartTimer,
  useStopTimer,
} from "@/lib/hooks";
import type { Task, TimeEntry } from "@/lib/types/domain";

interface TaskNode {
  task: Task;
  children: TaskNode[];
}

function buildTree(tasks: Task[]): TaskNode[] {
  const byParent = new Map<string | null, Task[]>();
  for (const t of tasks) {
    const arr = byParent.get(t.parent_task_id) ?? [];
    arr.push(t);
    byParent.set(t.parent_task_id, arr);
  }
  const sortFn = (a: Task, b: Task) =>
    (a.sort_order ?? 0) - (b.sort_order ?? 0);

  const make = (parentId: string | null): TaskNode[] =>
    (byParent.get(parentId) ?? [])
      .sort(sortFn)
      .map((task) => ({ task, children: make(task.id) }));

  return make(null);
}

function filterTree(nodes: TaskNode[], query: string): TaskNode[] {
  if (!query.trim()) return nodes;
  const q = query.trim().toLowerCase();
  const visit = (n: TaskNode): TaskNode | null => {
    const titleMatches = n.task.title.toLowerCase().includes(q);
    const notesMatches = (n.task.notes ?? "").toLowerCase().includes(q);
    const matchedChildren = n.children
      .map(visit)
      .filter((x): x is TaskNode => x !== null);
    if (titleMatches || notesMatches || matchedChildren.length > 0) {
      return { task: n.task, children: matchedChildren };
    }
    return null;
  };
  return nodes
    .map(visit)
    .filter((x): x is TaskNode => x !== null);
}

export function TasksBlock({ scopeId }: { scopeId?: string | null }) {
  const projectId = scopeId ?? null;
  const { data: project } = useProject(projectId);
  const { data: tasks = [], isLoading } = useTasksByProject(projectId);
  const { data: lists = [] } = useTaskLists();

  const create = useCreateTask();
  const createList = useCreateTaskList();
  const update = useUpdateTask();
  const complete = useCompleteTask();
  const del = useDeleteTask();
  const { data: activeTimer } = useActiveTimer();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();

  const [search, setSearch] = useState("");

  const projectLists = useMemo(
    () => lists.filter((l) => l.project_id === projectId),
    [lists, projectId]
  );

  const { open, done } = useMemo(() => {
    const splitOpen: Task[] = [];
    const splitDone: Task[] = [];
    for (const t of tasks) {
      if (t.status === "done" || t.completed_at) splitDone.push(t);
      else splitOpen.push(t);
    }
    return { open: splitOpen, done: splitDone };
  }, [tasks]);

  const openTree = useMemo(() => buildTree(open), [open]);
  const doneTree = useMemo(() => buildTree(done), [done]);
  const filteredOpen = useMemo(
    () => filterTree(openTree, search),
    [openTree, search]
  );
  const filteredDone = useMemo(
    () => filterTree(doneTree, search),
    [doneTree, search]
  );

  const ensureList = async (): Promise<string> => {
    if (projectLists.length > 0) return projectLists[0].id;
    if (!projectId) throw new Error("missing project id");
    const list = await createList.mutateAsync({
      project_id: projectId,
      name: project?.name ?? "משימות",
      kind: "project",
    });
    return list.id;
  };

  const handleAddTopLevel = async () => {
    if (!projectId) return;
    const listId = await ensureList();
    await create.mutateAsync({
      task_list_id: listId,
      title: "משימה חדשה",
      parent_task_id: null,
      status: "todo",
    });
  };

  const handleAddSub = async (parent: Task) => {
    const listId = parent.task_list_id ?? (await ensureList());
    await create.mutateAsync({
      task_list_id: listId,
      title: "תת-משימה",
      parent_task_id: parent.id,
      status: "todo",
    });
  };

  const isPending = create.isPending || createList.isPending;

  if (!projectId) {
    return (
      <div className="text-xs text-ink-500 text-center py-6">
        בחרי פרויקט.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 h-full">
      <div className="flex items-center gap-2 shrink-0">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם / הערה…"
            className="field py-1.5 ps-7 text-xs"
          />
        </div>
        <button
          type="button"
          onClick={handleAddTopLevel}
          disabled={isPending}
          className="btn-accent text-xs flex items-center gap-1 shrink-0"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          הוסיפי משימה
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
        {isLoading ? (
          <div className="text-xs text-ink-500 text-center py-6">
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState onAdd={handleAddTopLevel} pending={isPending} />
        ) : (
          <>
            <TaskList
              nodes={filteredOpen}
              level={0}
              activeTimer={activeTimer ?? null}
              onUpdate={(id, patch) =>
                update.mutate({ taskId: id, patch })
              }
              onComplete={(id, done) =>
                complete.mutate({ taskId: id, completed: done })
              }
              onDelete={(id) => del.mutate(id)}
              onAddSub={handleAddSub}
              onToggleTimer={(taskId, isCurrentlyActive) => {
                if (isCurrentlyActive) stopTimer.mutate();
                else startTimer.mutate({ taskId });
              }}
            />
            {filteredDone.length > 0 && (
              <DoneSection
                nodes={filteredDone}
                activeTimer={activeTimer ?? null}
                onUpdate={(id, patch) =>
                  update.mutate({ taskId: id, patch })
                }
                onComplete={(id, doneVal) =>
                  complete.mutate({ taskId: id, completed: doneVal })
                }
                onDelete={(id) => del.mutate(id)}
                onAddSub={handleAddSub}
                onToggleTimer={(taskId, isCurrentlyActive) => {
                  if (isCurrentlyActive) stopTimer.mutate();
                  else startTimer.mutate({ taskId });
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── List + rows ────────────────────────────────────────────────────────────

interface RowHandlers {
  onUpdate: (id: string, patch: Partial<Task>) => void;
  onComplete: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
  onAddSub: (parent: Task) => void;
  onToggleTimer: (taskId: string, isCurrentlyActive: boolean) => void;
}

interface TaskListProps {
  nodes: TaskNode[];
  level: number;
  activeTimer: TimeEntry | null;
}

function TaskList({
  nodes,
  level,
  activeTimer,
  ...handlers
}: TaskListProps & RowHandlers) {
  if (nodes.length === 0) return null;
  return (
    <ul className="divide-y divide-ink-200/60">
      {nodes.map((node) => (
        <TaskItem
          key={node.task.id}
          node={node}
          level={level}
          activeTimer={activeTimer}
          {...handlers}
        />
      ))}
    </ul>
  );
}

function TaskItem({
  node,
  level,
  activeTimer,
  ...handlers
}: { node: TaskNode; level: number; activeTimer: TimeEntry | null } & RowHandlers) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <TaskRow
        task={node.task}
        level={level}
        expanded={expanded}
        hasChildren={hasChildren}
        activeTimer={activeTimer}
        onToggleExpand={() => setExpanded((v) => !v)}
        {...handlers}
      />
      {hasChildren && expanded && (
        <TaskList
          nodes={node.children}
          level={level + 1}
          activeTimer={activeTimer}
          {...handlers}
        />
      )}
    </li>
  );
}

function TaskRow({
  task,
  level,
  expanded,
  hasChildren,
  activeTimer,
  onToggleExpand,
  onUpdate,
  onComplete,
  onDelete,
  onAddSub,
  onToggleTimer,
}: {
  task: Task;
  level: number;
  expanded: boolean;
  hasChildren: boolean;
  activeTimer: TimeEntry | null;
  onToggleExpand: () => void;
} & RowHandlers) {
  const isDone = task.status === "done" || !!task.completed_at;
  const isTimerActive = activeTimer?.task_id === task.id;
  const liveSeconds = useLiveActualSeconds(task, activeTimer);
  const indentPx = level * 20;

  return (
    <div
      className="group/row flex items-center gap-1.5 py-1.5 hover:bg-ink-50 rounded-md px-1.5 transition-colors"
      style={{ paddingInlineStart: `${indentPx + 6}px` }}
    >
      {/* Expand chevron / spacer */}
      <button
        type="button"
        onClick={onToggleExpand}
        className={
          "w-4 h-4 flex items-center justify-center text-ink-400 hover:text-ink-700 shrink-0 " +
          (hasChildren ? "" : "invisible")
        }
        aria-label={expanded ? "כווץ" : "פתח"}
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Checkbox */}
      <button
        type="button"
        onClick={() => onComplete(task.id, !isDone)}
        className={
          "w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 " +
          (isDone
            ? "bg-primary-500 border-primary-500 text-white"
            : "border-ink-300 hover:border-primary-500")
        }
        aria-label={isDone ? "החזירי לפעיל" : "סמני כהושלם"}
      >
        {isDone && <Check className="w-3 h-3" strokeWidth={3} />}
      </button>

      {/* Title (editable) */}
      <EditableTitle
        value={task.title}
        done={isDone}
        onSave={(v) => onUpdate(task.id, { title: v })}
      />

      {/* Estimated hours */}
      <NumberCell
        title="שעות"
        value={task.estimated_hours}
        suffix="ש"
        onSave={(v) => onUpdate(task.id, { estimated_hours: v })}
      />

      {/* Spare hours */}
      <NumberCell
        title="ספייר"
        value={task.spare_hours}
        suffix="ס"
        onSave={(v) => onUpdate(task.id, { spare_hours: v })}
      />

      {/* Urgency bars (3-level, click to cycle 0→1→2→3→0) */}
      <UrgencyBars
        value={task.urgency ?? 0}
        onChange={(v) => onUpdate(task.id, { urgency: v })}
      />

      {/* Timer toggle */}
      <button
        type="button"
        onClick={() => onToggleTimer(task.id, isTimerActive)}
        className={
          "p-1 rounded shrink-0 transition-colors " +
          (isTimerActive
            ? "bg-danger/10 text-danger animate-pulse"
            : "text-ink-400 hover:text-primary-600 hover:bg-primary-50")
        }
        title={isTimerActive ? "עצור סטופר" : "התחל סטופר"}
        aria-label={isTimerActive ? "עצור סטופר" : "התחל סטופר"}
      >
        {isTimerActive ? (
          <Square className="w-3 h-3" strokeWidth={3} />
        ) : (
          <Play className="w-3 h-3" />
        )}
      </button>

      {/* Actual seconds (live ticking when timer is active) */}
      <span
        className={
          "text-[10px] tabular-nums w-12 text-end shrink-0 " +
          (isTimerActive ? "text-danger font-semibold" : "text-ink-400")
        }
        title="שעות בפועל"
      >
        {fmtHours(liveSeconds)}
      </span>

      {/* Actions (visible on hover) */}
      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => onAddSub(task)}
          className="p-1 rounded hover:bg-ink-200 text-ink-500 hover:text-ink-900"
          title="הוסיפי תת-משימה"
          aria-label="הוסיפי תת-משימה"
        >
          <Plus className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (confirm(`למחוק את "${task.title}"?`)) onDelete(task.id);
          }}
          className="p-1 rounded hover:bg-ink-200 text-ink-500 hover:text-danger"
          title="מחקי"
          aria-label="מחקי"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Editable cells ─────────────────────────────────────────────────────────

function EditableTitle({
  value,
  done,
  onSave,
}: {
  value: string;
  done: boolean;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setDraft(value);
      return;
    }
    if (trimmed !== value) onSave(trimmed);
  };

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      className={
        "flex-1 min-w-0 bg-transparent border-0 outline-none text-sm px-1.5 py-1 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-primary-500/40 transition-colors " +
        (done ? "line-through text-ink-400" : "text-ink-900")
      }
    />
  );
}

function NumberCell({
  title,
  value,
  suffix,
  onSave,
}: {
  title: string;
  value: number | null;
  suffix?: string;
  onSave: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState(value?.toString() ?? "");
  useEffect(() => {
    setDraft(value?.toString() ?? "");
  }, [value]);

  const commit = () => {
    if (draft === "") {
      if (value !== null) onSave(null);
      return;
    }
    const n = parseFloat(draft);
    if (!isFinite(n)) {
      setDraft(value?.toString() ?? "");
      return;
    }
    if (n !== value) onSave(n);
  };

  return (
    <div
      title={title}
      className="inline-flex items-baseline gap-0.5 w-12 shrink-0"
    >
      <input
        type="text"
        inputMode="decimal"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(value?.toString() ?? "");
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="0"
        className="w-9 bg-transparent border-0 outline-none text-xs tabular-nums text-end px-1 py-0.5 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-primary-500/40 transition-colors"
      />
      {suffix && (
        <span className="text-[10px] text-ink-400 select-none">{suffix}</span>
      )}
    </div>
  );
}

/**
 * 3-bar urgency control matching the pattern in `TaskRow.tsx`. Click cycles
 * 0→1→2→3→0; bars fill bottom-up.
 */
function UrgencyBars({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const filled = Math.min(3, Math.max(0, value));
  return (
    <button
      type="button"
      onClick={() => onChange((filled + 1) % 4)}
      aria-label={`דחיפות ${filled}/3`}
      title={`דחיפות ${filled}/3 — לחיצה לשינוי`}
      className="shrink-0 flex flex-col items-center justify-center gap-[2px] px-1 py-1 rounded-md hover:bg-ink-200 transition-colors"
    >
      {[3, 2, 1].map((n) => (
        <span
          key={n}
          className={
            "h-[2px] w-3 rounded-sm transition-colors " +
            (n <= filled ? "bg-ink-900" : "bg-ink-200")
          }
        />
      ))}
    </button>
  );
}

// ─── Done section ───────────────────────────────────────────────────────────

function DoneSection({
  nodes,
  activeTimer,
  ...handlers
}: { nodes: TaskNode[]; activeTimer: TimeEntry | null } & RowHandlers) {
  const [open, setOpen] = useState(false);
  const count = useMemo(() => countTree(nodes), [nodes]);
  return (
    <div className="mt-3 pt-3 border-t border-ink-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-ink-500 hover:text-ink-800 mb-1.5"
      >
        {open ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
        הושלמו ({count})
      </button>
      {open && (
        <TaskList
          nodes={nodes}
          level={0}
          activeTimer={activeTimer}
          {...handlers}
        />
      )}
    </div>
  );
}

function countTree(nodes: TaskNode[]): number {
  let n = 0;
  for (const node of nodes) {
    n += 1 + countTree(node.children);
  }
  return n;
}

// ─── Empty state ────────────────────────────────────────────────────────────

function EmptyState({
  onAdd,
  pending,
}: {
  onAdd: () => void;
  pending: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <div className="text-center py-6">
      <p className="text-xs text-ink-500 mb-2">עוד אין משימות בפרויקט.</p>
      <button
        ref={ref}
        type="button"
        onClick={onAdd}
        disabled={pending}
        className="btn-accent text-xs flex items-center gap-1 mx-auto"
      >
        {pending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Plus className="w-3.5 h-3.5" />
        )}
        הוסיפי משימה ראשונה
      </button>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtHours(seconds: number): string {
  if (!seconds) return "—";
  const h = seconds / 3600;
  if (h < 1) return `${Math.round(h * 60)}ד'`;
  return `${h.toFixed(1)}ש`;
}

/**
 * Returns task.actual_seconds + the live elapsed delta if a timer is currently
 * running for this task. Re-renders every second only while the timer is
 * active for this row (no global ticker overhead).
 */
function useLiveActualSeconds(
  task: Task,
  activeTimer: TimeEntry | null
): number {
  const isActive = activeTimer?.task_id === task.id;
  const startedAt = isActive && activeTimer?.started_at
    ? new Date(activeTimer.started_at).getTime()
    : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isActive]);

  if (!isActive || !startedAt) return task.actual_seconds ?? 0;
  const liveDelta = Math.max(0, Math.round((now - startedAt) / 1000));
  return (task.actual_seconds ?? 0) + liveDelta;
}
