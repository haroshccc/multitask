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
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
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
  useReorderTasks,
  useProjectCustomFields,
  useCreateCustomField,
  useDeleteCustomField,
} from "@/lib/hooks";
import type {
  Task,
  TimeEntry,
  TaskCustomField,
  CustomFieldType,
} from "@/lib/types/domain";

interface TaskNode {
  task: Task;
  children: TaskNode[];
}

// Column template — RTL-readable in source order: drag · expand · checkbox ·
// title · hours · spare · urgency · timer · actual · notes · [N×dyn-cols] ·
// actions. Dynamic columns are inserted between notes and actions.
const FIXED_GRID_COLS =
  "20px 20px 20px minmax(140px, 1fr) 60px 60px 56px 32px 60px 140px";
const ACTIONS_COL = "72px";
const DYN_COL_WIDTH = 110;
const FIXED_GRID_MIN_WIDTH = 660;

function buildGridCols(dynColCount: number): string {
  const dyn = Array.from({ length: dynColCount }, () => `${DYN_COL_WIDTH}px`).join(
    " "
  );
  return [FIXED_GRID_COLS, dyn, ACTIONS_COL].filter(Boolean).join(" ");
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
  const reorder = useReorderTasks();
  const { data: activeTimer } = useActiveTimer();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const { data: customFields = [] } = useProjectCustomFields(projectId);
  const createField = useCreateCustomField();
  const deleteField = useDeleteCustomField();

  const [search, setSearch] = useState("");
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);

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
    const newTask = await create.mutateAsync({
      task_list_id: listId,
      title: "",
      parent_task_id: null,
      status: "todo",
    });
    setFocusTaskId(newTask.id);
  };

  const handleAddSub = async (parent: Task) => {
    const listId = parent.task_list_id ?? (await ensureList());
    const newTask = await create.mutateAsync({
      task_list_id: listId,
      title: "",
      parent_task_id: parent.id,
      status: "todo",
    });
    setFocusTaskId(newTask.id);
  };

  // Enter on a row → create a sibling right after it (same parent, between
  // the current row and its next sibling) and focus the new title.
  const handleAddAfter = async (current: Task) => {
    const listId = current.task_list_id ?? (await ensureList());
    const siblings = tasks
      .filter((t) => t.parent_task_id === current.parent_task_id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const idx = siblings.findIndex((t) => t.id === current.id);
    let nextSortOrder: number;
    if (idx === -1 || idx === siblings.length - 1) {
      nextSortOrder = (current.sort_order ?? 0) + 1000;
    } else {
      const a = current.sort_order ?? 0;
      const b = siblings[idx + 1].sort_order ?? 0;
      nextSortOrder = (a + b) / 2;
    }
    const newTask = await create.mutateAsync({
      task_list_id: listId,
      title: "",
      parent_task_id: current.parent_task_id,
      status: "todo",
      sort_order: nextSortOrder,
    });
    setFocusTaskId(newTask.id);
  };

  // Tab → become a sub-task of the previous sibling.
  const handleIndent = (current: Task) => {
    const siblings = tasks
      .filter((t) => t.parent_task_id === current.parent_task_id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const idx = siblings.findIndex((t) => t.id === current.id);
    if (idx <= 0) return; // need a previous sibling
    const newParent = siblings[idx - 1];
    update.mutate({
      taskId: current.id,
      patch: { parent_task_id: newParent.id },
    });
    setFocusTaskId(current.id);
  };

  // Shift+Tab → move out one level (parent's parent becomes parent).
  const handleOutdent = (current: Task) => {
    if (!current.parent_task_id) return;
    const parent = tasks.find((t) => t.id === current.parent_task_id);
    if (!parent) return;
    update.mutate({
      taskId: current.id,
      patch: { parent_task_id: parent.parent_task_id ?? null },
    });
    setFocusTaskId(current.id);
  };

  // Drop → renumber sort_order on the affected top-level tasks. We bulk-update
  // every node with a fresh evenly-spaced index so future inserts have room.
  const handleReorderTopLevel = (newOrder: TaskNode[]) => {
    const updates = newOrder.map((n, i) => ({
      id: n.task.id,
      sort_order: (i + 1) * 1000,
    }));
    reorder.mutate(updates);
  };

  const handleAddField = (type: CustomFieldType, label: string) => {
    if (!projectId) return;
    const fieldKey = `f_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 6)}`;
    createField.mutate({
      project_id: projectId,
      field_key: fieldKey,
      field_label: label,
      field_type: type,
      is_visible: true,
    });
  };

  const handleDeleteField = (fieldId: string) => {
    deleteField.mutate(fieldId);
  };

  const gridCols = useMemo(
    () => buildGridCols(customFields.length),
    [customFields.length]
  );
  const gridMinWidth = FIXED_GRID_MIN_WIDTH + customFields.length * DYN_COL_WIDTH;

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

      <div className="flex-1 min-h-0 overflow-auto -mx-1 px-1">
        {isLoading ? (
          <div className="text-xs text-ink-500 text-center py-6">
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState onAdd={handleAddTopLevel} pending={isPending} />
        ) : (
          <div style={{ minWidth: gridMinWidth }}>
            <TableHeader
              gridCols={gridCols}
              customFields={customFields}
              onAddField={handleAddField}
              onDeleteField={handleDeleteField}
            />
            <SortableTaskList
              nodes={filteredOpen}
              activeTimer={activeTimer ?? null}
              focusTaskId={focusTaskId}
              onFocusHandled={() => setFocusTaskId(null)}
              customFields={customFields}
              gridCols={gridCols}
              onReorder={handleReorderTopLevel}
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
              onAddAfter={handleAddAfter}
              onIndent={handleIndent}
              onOutdent={handleOutdent}
            />
            {filteredDone.length > 0 && (
              <DoneSection
                nodes={filteredDone}
                activeTimer={activeTimer ?? null}
                focusTaskId={focusTaskId}
                onFocusHandled={() => setFocusTaskId(null)}
                customFields={customFields}
                gridCols={gridCols}
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
                onAddAfter={handleAddAfter}
                onIndent={handleIndent}
                onOutdent={handleOutdent}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Table header ───────────────────────────────────────────────────────────

function TableHeader({
  gridCols,
  customFields,
  onAddField,
  onDeleteField,
}: {
  gridCols: string;
  customFields: TaskCustomField[];
  onAddField: (type: CustomFieldType, label: string) => void;
  onDeleteField: (fieldId: string) => void;
}) {
  return (
    <div
      className="grid items-center gap-1 px-1.5 py-1.5 sticky top-0 bg-ink-50/80 backdrop-blur z-10 text-[10px] font-semibold uppercase tracking-wider text-ink-500 border-b border-ink-200"
      style={{ gridTemplateColumns: gridCols }}
    >
      <span></span>
      <span></span>
      <span></span>
      <span>משימה</span>
      <span className="text-end">שעות</span>
      <span className="text-end">ספייר</span>
      <span className="text-center">דחיפות</span>
      <span className="text-center">סטופר</span>
      <span className="text-end">בפועל</span>
      <span>הערות</span>
      {customFields.map((f) => (
        <DynColumnHeader
          key={f.id}
          field={f}
          onDelete={() => onDeleteField(f.id)}
        />
      ))}
      <AddColumnButton onAdd={onAddField} />
    </div>
  );
}

function DynColumnHeader({
  field,
  onDelete,
}: {
  field: TaskCustomField;
  onDelete: () => void;
}) {
  return (
    <span className="group/dyn flex items-center justify-between gap-1 px-1 truncate">
      <span className="truncate" title={field.field_label}>
        {field.field_label}
      </span>
      <button
        type="button"
        onClick={() => {
          if (confirm(`למחוק את עמודת "${field.field_label}"?`)) onDelete();
        }}
        className="opacity-0 group-hover/dyn:opacity-100 text-ink-400 hover:text-danger transition-opacity"
        aria-label="מחקי עמודה"
        title="מחקי עמודה"
      >
        <Trash2 className="w-2.5 h-2.5" />
      </button>
    </span>
  );
}

function AddColumnButton({
  onAdd,
}: {
  onAdd: (type: CustomFieldType, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CustomFieldType>("text");
  const [label, setLabel] = useState("");

  const submit = () => {
    const v = label.trim();
    if (!v) return;
    onAdd(type, v);
    setLabel("");
    setOpen(false);
  };

  return (
    <div className="relative flex justify-end">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-ink-400 hover:text-primary-600 p-1 rounded hover:bg-primary-50"
        title="הוסיפי עמודה"
        aria-label="הוסיפי עמודה"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setOpen(false)}
          />
          <div className="absolute end-0 top-full mt-1 z-30 bg-white border border-ink-200 rounded-xl shadow-lift p-3 w-56 space-y-2 normal-case font-normal tracking-normal text-ink-900">
            <div>
              <label className="eyebrow mb-1 block text-[10px]">סוג עמודה</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as CustomFieldType)}
                className="field py-1 text-xs"
              >
                <option value="text">טקסט</option>
                <option value="number">מספר</option>
                <option value="date">תאריך</option>
                <option value="url">קישור</option>
                <option value="checkbox">תיבת סימון</option>
                <option value="select">בחירה</option>
                <option value="stars">דירוג</option>
              </select>
            </div>
            <div>
              <label className="eyebrow mb-1 block text-[10px]">שם</label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                  if (e.key === "Escape") setOpen(false);
                }}
                placeholder="למשל: ספרינט"
                className="field py-1 text-xs"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={!label.trim()}
              className="btn-accent text-xs w-full disabled:opacity-50"
            >
              הוסיפי
            </button>
          </div>
        </>
      )}
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
  onAddAfter: (current: Task) => void;
  onIndent: (current: Task) => void;
  onOutdent: (current: Task) => void;
}

interface TaskListProps {
  nodes: TaskNode[];
  level: number;
  activeTimer: TimeEntry | null;
  focusTaskId: string | null;
  onFocusHandled: () => void;
  customFields: TaskCustomField[];
  gridCols: string;
}

function TaskList({
  nodes,
  level,
  activeTimer,
  focusTaskId,
  onFocusHandled,
  customFields,
  gridCols,
  ...handlers
}: TaskListProps & RowHandlers) {
  if (nodes.length === 0) return null;
  return (
    <ul>
      {nodes.map((node) => (
        <TaskItem
          key={node.task.id}
          node={node}
          level={level}
          activeTimer={activeTimer}
          focusTaskId={focusTaskId}
          onFocusHandled={onFocusHandled}
          customFields={customFields}
          gridCols={gridCols}
          {...handlers}
        />
      ))}
    </ul>
  );
}

/**
 * Top-level list with row drag-to-reorder. Sub-tasks render in their normal
 * order (no drag) — reordering siblings within a parent is enough for now.
 */
function SortableTaskList({
  nodes,
  activeTimer,
  focusTaskId,
  onFocusHandled,
  customFields,
  gridCols,
  onReorder,
  ...handlers
}: {
  nodes: TaskNode[];
  activeTimer: TimeEntry | null;
  focusTaskId: string | null;
  onFocusHandled: () => void;
  customFields: TaskCustomField[];
  gridCols: string;
  onReorder: (newOrder: TaskNode[]) => void;
} & RowHandlers) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );
  const ids = nodes.map((n) => n.task.id);
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const fromIdx = ids.indexOf(active.id as string);
    const toIdx = ids.indexOf(over.id as string);
    if (fromIdx === -1 || toIdx === -1) return;
    onReorder(arrayMove(nodes, fromIdx, toIdx));
  };

  if (nodes.length === 0) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul>
          {nodes.map((node) => (
            <SortableTaskItem
              key={node.task.id}
              node={node}
              activeTimer={activeTimer}
              focusTaskId={focusTaskId}
              onFocusHandled={onFocusHandled}
              customFields={customFields}
              gridCols={gridCols}
              {...handlers}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableTaskItem({
  node,
  activeTimer,
  focusTaskId,
  onFocusHandled,
  customFields,
  gridCols,
  ...handlers
}: {
  node: TaskNode;
  activeTimer: TimeEntry | null;
  focusTaskId: string | null;
  onFocusHandled: () => void;
  customFields: TaskCustomField[];
  gridCols: string;
} & RowHandlers) {
  const sortable = useSortable({ id: node.task.id });
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : 1,
  };

  return (
    <li ref={sortable.setNodeRef} style={style} {...sortable.attributes}>
      <TaskRow
        task={node.task}
        level={0}
        expanded={expanded}
        hasChildren={hasChildren}
        activeTimer={activeTimer}
        shouldFocus={focusTaskId === node.task.id}
        onFocusHandled={onFocusHandled}
        customFields={customFields}
        gridCols={gridCols}
        onToggleExpand={() => setExpanded((v) => !v)}
        dragHandleProps={sortable.listeners}
        {...handlers}
      />
      {hasChildren && expanded && (
        <TaskList
          nodes={node.children}
          level={1}
          activeTimer={activeTimer}
          focusTaskId={focusTaskId}
          onFocusHandled={onFocusHandled}
          customFields={customFields}
          gridCols={gridCols}
          {...handlers}
        />
      )}
    </li>
  );
}

function TaskItem({
  node,
  level,
  activeTimer,
  focusTaskId,
  onFocusHandled,
  customFields,
  gridCols,
  ...handlers
}: {
  node: TaskNode;
  level: number;
  activeTimer: TimeEntry | null;
  focusTaskId: string | null;
  onFocusHandled: () => void;
  customFields: TaskCustomField[];
  gridCols: string;
} & RowHandlers) {
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
        shouldFocus={focusTaskId === node.task.id}
        onFocusHandled={onFocusHandled}
        customFields={customFields}
        gridCols={gridCols}
        onToggleExpand={() => setExpanded((v) => !v)}
        {...handlers}
      />
      {hasChildren && expanded && (
        <TaskList
          nodes={node.children}
          level={level + 1}
          activeTimer={activeTimer}
          focusTaskId={focusTaskId}
          onFocusHandled={onFocusHandled}
          customFields={customFields}
          gridCols={gridCols}
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
  shouldFocus,
  onFocusHandled,
  onToggleExpand,
  dragHandleProps,
  customFields,
  gridCols,
  onUpdate,
  onComplete,
  onDelete,
  onAddSub,
  onToggleTimer,
  onAddAfter,
  onIndent,
  onOutdent,
}: {
  task: Task;
  level: number;
  expanded: boolean;
  hasChildren: boolean;
  activeTimer: TimeEntry | null;
  shouldFocus: boolean;
  onFocusHandled: () => void;
  onToggleExpand: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
  customFields: TaskCustomField[];
  gridCols: string;
} & RowHandlers) {
  const isDone = task.status === "done" || !!task.completed_at;
  const isTimerActive = activeTimer?.task_id === task.id;
  const liveSeconds = useLiveActualSeconds(task, activeTimer);
  const indentPx = level * 16;

  return (
    <div
      className="group/row grid items-center gap-1 py-1 hover:bg-ink-50 px-1.5 transition-colors border-b border-ink-100/80"
      style={{ gridTemplateColumns: gridCols }}
    >
      {/* Drag handle (top-level only — sub-tasks get an empty cell) */}
      <button
        type="button"
        className={
          "w-5 h-5 flex items-center justify-center text-ink-300 hover:text-ink-700 " +
          (dragHandleProps ? "cursor-grab active:cursor-grabbing" : "invisible")
        }
        aria-label="גררי לשינוי סדר"
        title="גררי לשינוי סדר"
        {...(dragHandleProps ?? {})}
      >
        <GripVertical className="w-3 h-3" />
      </button>

      {/* Expand chevron / spacer */}
      <button
        type="button"
        onClick={onToggleExpand}
        className={
          "w-5 h-5 flex items-center justify-center text-ink-400 hover:text-ink-700 " +
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
          "w-4 h-4 rounded border flex items-center justify-center transition-colors mx-auto " +
          (isDone
            ? "bg-primary-500 border-primary-500 text-white"
            : "border-ink-300 hover:border-primary-500")
        }
        aria-label={isDone ? "החזירי לפעיל" : "סמני כהושלם"}
      >
        {isDone && <Check className="w-3 h-3" strokeWidth={3} />}
      </button>

      {/* Title (editable, indented per level) */}
      <div
        className="min-w-0"
        style={{ paddingInlineStart: `${indentPx}px` }}
      >
        <EditableTitle
          value={task.title}
          done={isDone}
          shouldFocus={shouldFocus}
          onFocusHandled={onFocusHandled}
          onSave={(v) => onUpdate(task.id, { title: v })}
          onEnter={() => onAddAfter(task)}
          onTab={() => onIndent(task)}
          onShiftTab={() => onOutdent(task)}
        />
      </div>

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

      {/* Urgency bars */}
      <div className="flex items-center justify-center">
        <UrgencyBars
          value={task.urgency ?? 0}
          onChange={(v) => onUpdate(task.id, { urgency: v })}
        />
      </div>

      {/* Timer toggle */}
      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={() => onToggleTimer(task.id, isTimerActive)}
          className={
            "p-1 rounded transition-colors " +
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
      </div>

      {/* Actual seconds (live ticking when timer is active) */}
      <span
        className={
          "text-[10px] tabular-nums text-end " +
          (isTimerActive ? "text-danger font-semibold" : "text-ink-400")
        }
        title="שעות בפועל"
      >
        {fmtHours(liveSeconds)}
      </span>

      {/* Notes (editable) */}
      <NotesCell
        value={task.notes ?? ""}
        onSave={(v) => onUpdate(task.id, { notes: v || null })}
      />

      {/* Dynamic columns */}
      {customFields.map((f) => (
        <DynCell
          key={f.id}
          field={f}
          value={readCustomField(task, f.field_key)}
          onSave={(v) =>
            onUpdate(task.id, {
              // custom_fields is jsonb — TypeScript's generated Json type
              // tightly types it; we cast our looser record back here.
              custom_fields: writeCustomField(
                task,
                f.field_key,
                v
              ) as Task["custom_fields"],
            })
          }
        />
      ))}

      {/* Actions (visible on hover) */}
      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
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

// ─── Dynamic column cell ────────────────────────────────────────────────────

function readCustomField(task: Task, key: string): unknown {
  const cf = task.custom_fields as Record<string, unknown> | null;
  if (!cf || typeof cf !== "object") return null;
  return cf[key] ?? null;
}

function writeCustomField(
  task: Task,
  key: string,
  value: unknown
): Record<string, unknown> {
  const cf = (task.custom_fields as Record<string, unknown> | null) ?? {};
  return { ...cf, [key]: value };
}

function DynCell({
  field,
  value,
  onSave,
}: {
  field: TaskCustomField;
  value: unknown;
  onSave: (v: unknown) => void;
}) {
  switch (field.field_type) {
    case "text":
      return <DynTextCell value={(value as string) ?? ""} onSave={onSave} />;
    case "number":
      return <DynNumberCell value={value as number | null} onSave={onSave} />;
    case "date":
      return <DynDateCell value={(value as string) ?? ""} onSave={onSave} />;
    case "url":
      return <DynUrlCell value={(value as string) ?? ""} onSave={onSave} />;
    case "checkbox":
      return <DynCheckboxCell value={!!value} onSave={onSave} />;
    case "stars":
      return <DynStarsCell value={(value as number) ?? 0} onSave={onSave} />;
    case "select": {
      const opts =
        (field.options as { value: string; label: string }[] | null) ?? [];
      return (
        <DynSelectCell
          value={(value as string) ?? ""}
          options={opts}
          onSave={onSave}
        />
      );
    }
    default:
      return (
        <span className="text-[10px] text-ink-300 truncate">
          (לא נתמך)
        </span>
      );
  }
}

function DynTextCell({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onSave(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="w-full bg-transparent border-0 outline-none text-[11px] text-ink-700 px-1 py-0.5 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-primary-500/40"
    />
  );
}

function DynNumberCell({
  value,
  onSave,
}: {
  value: number | null;
  onSave: (v: number | null) => void;
}) {
  const [draft, setDraft] = useState(value?.toString() ?? "");
  useEffect(() => setDraft(value?.toString() ?? ""), [value]);
  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft === "") {
          if (value !== null) onSave(null);
          return;
        }
        const n = parseFloat(draft);
        if (isFinite(n) && n !== value) onSave(n);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="w-full bg-transparent border-0 outline-none text-[11px] text-ink-700 tabular-nums text-end px-1 py-0.5 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-primary-500/40"
    />
  );
}

function DynDateCell({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string | null) => void;
}) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onSave(e.target.value || null)}
      className="w-full bg-transparent border-0 outline-none text-[11px] text-ink-700 px-1 py-0.5 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-primary-500/40"
    />
  );
}

function DynUrlCell({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string | null) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const isValid = !draft || /^https?:\/\//.test(draft);
  return (
    <div className="flex items-center gap-0.5 min-w-0">
      <input
        type="url"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== value && onSave(draft || null)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder="https://"
        className="w-full min-w-0 bg-transparent border-0 outline-none text-[11px] text-ink-700 px-1 py-0.5 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-primary-500/40 truncate"
      />
      {value && isValid && (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-primary-600 hover:text-primary-700"
          title="פתח בלשונית חדשה"
        >
          ↗
        </a>
      )}
    </div>
  );
}

function DynCheckboxCell({
  value,
  onSave,
}: {
  value: boolean;
  onSave: (v: boolean) => void;
}) {
  return (
    <div className="flex justify-center">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onSave(e.target.checked)}
        className="w-3.5 h-3.5"
      />
    </div>
  );
}

function DynStarsCell({
  value,
  onSave,
}: {
  value: number;
  onSave: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onSave(value === n ? 0 : n)}
          className="text-[12px] leading-none"
          aria-label={`${n}/5`}
        >
          <span
            className={n <= value ? "text-primary-500" : "text-ink-300"}
          >
            ★
          </span>
        </button>
      ))}
    </div>
  );
}

function DynSelectCell({
  value,
  options,
  onSave,
}: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (v: string | null) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onSave(e.target.value || null)}
      className="w-full bg-transparent border-0 outline-none text-[11px] text-ink-700 px-1 py-0.5 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-primary-500/40"
    >
      <option value=""></option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function NotesCell({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  const commit = () => {
    if (draft !== value) onSave(draft);
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
      placeholder="הערה…"
      className="w-full bg-transparent border-0 outline-none text-[11px] text-ink-700 placeholder:text-ink-300 px-1.5 py-0.5 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-primary-500/40 transition-colors"
    />
  );
}

// ─── Editable cells ─────────────────────────────────────────────────────────

function EditableTitle({
  value,
  done,
  shouldFocus,
  onFocusHandled,
  onSave,
  onEnter,
  onTab,
  onShiftTab,
}: {
  value: string;
  done: boolean;
  shouldFocus?: boolean;
  onFocusHandled?: () => void;
  onSave: (v: string) => void;
  onEnter?: () => void;
  onTab?: () => void;
  onShiftTab?: () => void;
}) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  // Auto-focus when the parent flagged this row for focus (just-created or
  // just-indented). Calls back so the parent clears the flag.
  useEffect(() => {
    if (shouldFocus) {
      inputRef.current?.focus();
      inputRef.current?.select();
      onFocusHandled?.();
    }
  }, [shouldFocus, onFocusHandled]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === value) return;
    // allow empty title — fresh-created rows often start blank.
    onSave(trimmed);
  };

  return (
    <input
      ref={inputRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          commit();
          onEnter?.();
        } else if (e.key === "Tab") {
          e.preventDefault();
          commit();
          if (e.shiftKey) onShiftTab?.();
          else onTab?.();
        } else if (e.key === "Escape") {
          setDraft(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
      placeholder="משימה חדשה…"
      className={
        "w-full min-w-0 bg-transparent border-0 outline-none text-sm px-1.5 py-1 rounded hover:bg-white focus:bg-white focus:ring-1 focus:ring-primary-500/40 transition-colors " +
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
    <div title={title} className="flex items-baseline gap-0.5 justify-end">
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
  focusTaskId,
  onFocusHandled,
  customFields,
  gridCols,
  ...handlers
}: {
  nodes: TaskNode[];
  activeTimer: TimeEntry | null;
  focusTaskId: string | null;
  onFocusHandled: () => void;
  customFields: TaskCustomField[];
  gridCols: string;
} & RowHandlers) {
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
          focusTaskId={focusTaskId}
          onFocusHandled={onFocusHandled}
          customFields={customFields}
          gridCols={gridCols}
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
