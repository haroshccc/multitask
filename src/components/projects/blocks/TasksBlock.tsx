import { useMemo, useState, useEffect, useRef, Fragment } from "react";
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
  CalendarPlus,
} from "lucide-react";
import {
  DndContext,
  MouseSensor,
  TouchSensor,
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
import { TimerLogPopup } from "@/components/projects/blocks/TimerLogPopup";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";
import { HelpCircle } from "lucide-react";
import { pushUndo } from "@/lib/undo/store";
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
  useUpdateCustomField,
  useDeleteCustomField,
  useProjectQuestions,
} from "@/lib/hooks";
import { useUpdateProject } from "@/lib/hooks/useProjects";
import type {
  Project,
  Task,
  TimeEntry,
  TaskCustomField,
  CustomFieldType,
} from "@/lib/types/domain";
import {
  buildGridCols,
  buildGridMinWidth,
  normalizeFixedOrder,
  type FixedColumnDescriptor,
} from "@/components/configurable-table/gridLayout";
import { TableHeader } from "@/components/configurable-table/ConfigurableTableHeader";
import {
  ColumnsMenu,
  type ColumnsMenuItem,
} from "@/components/configurable-table/ColumnsMenu";
import { ExportExcelButton } from "@/components/configurable-table/ExportExcelButton";
import { buildTasksSheet } from "@/lib/export/projectSheets";
import {
  DynCell,
  OptionsEditorModal,
  readCustomField,
  writeCustomField,
  type SelectOption,
} from "@/components/configurable-table/fieldCells";
import { useEntityColumnVisibility } from "@/lib/hooks/useEntityColumnVisibility";

interface TaskNode {
  task: Task;
  children: TaskNode[];
}

// Column template — RTL-readable in source order: drag · expand · checkbox ·
// Fixed columns are configurable per-project: the user can rename them
// (project.column_labels) AND reorder them (project.column_order). The 3
// control columns at the start (drag · expand · checkbox) and the actions
// column at the end stay in place — they're chrome, not data.
type FixedColumnKey =
  | "title"
  | "estimated_hours"
  | "spare_hours"
  | "urgency"
  | "timer"
  | "actual_seconds"
  | "notes"
  | "questions";

// Single source of truth for the task table's fixed columns, in default order.
// Identical values to the previous per-key maps — just consolidated into one
// descriptor list that the extracted generic header/grid helpers consume.
const TASK_FIXED_DESCRIPTORS: FixedColumnDescriptor<FixedColumnKey>[] = [
  {
    key: "title",
    width: "minmax(140px, 1fr)",
    defaultLabel: "משימה",
    align: "start",
    sortable: true,
    sortKey: "title",
  },
  {
    key: "estimated_hours",
    width: "60px",
    defaultLabel: "שעות",
    align: "end",
    sortable: true,
    sortKey: "estimated_hours",
  },
  {
    key: "spare_hours",
    width: "60px",
    defaultLabel: "ספייר",
    align: "end",
    sortable: true,
    sortKey: "spare_hours",
  },
  {
    key: "urgency",
    width: "56px",
    defaultLabel: "דחיפות",
    align: "center",
    sortable: true,
    sortKey: "urgency",
  },
  {
    key: "timer",
    width: "32px",
    defaultLabel: "סטופר",
    align: "center",
    sortable: false,
    sortKey: null,
  },
  {
    key: "actual_seconds",
    width: "60px",
    defaultLabel: "בפועל",
    align: "end",
    sortable: true,
    sortKey: "actual_seconds",
  },
  {
    // notes used to be a fixed 140px, but on narrow viewports the truncation
    // hid most of the text; minmax lets the cell breathe when there's room
    // (up to 1fr) yet still respect a sensible floor.
    key: "notes",
    width: "minmax(120px, 0.6fr)",
    defaultLabel: "הערות",
    align: "start",
    sortable: false,
    sortKey: null,
  },
  {
    key: "questions",
    width: "44px",
    defaultLabel: "שאלות",
    align: "center",
    sortable: false,
    sortKey: null,
  },
];

const DEFAULT_FIXED_ORDER: FixedColumnKey[] = TASK_FIXED_DESCRIPTORS.map(
  (d) => d.key
);

const TASK_FIXED_WIDTHS = Object.fromEntries(
  TASK_FIXED_DESCRIPTORS.map((d) => [d.key, d.width])
) as Record<FixedColumnKey, string>;

const TASK_FIXED_DESCRIPTOR_BY_KEY = Object.fromEntries(
  TASK_FIXED_DESCRIPTORS.map((d) => [d.key, d])
) as Record<FixedColumnKey, FixedColumnDescriptor<FixedColumnKey>>;

const CONTROL_COLS = "20px 20px 20px"; // drag · expand · checkbox
// 3 small action buttons (calendar / + sub / trash) need a touch more room
// than 2 buttons did — 96px keeps them from spilling onto the next row.
const ACTIONS_COL = "96px";
const DYN_COL_WIDTH = 110;
const CONTROL_AND_ACTIONS_WIDTH = 60 + 96;

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

/**
 * Sort siblings at every level by the given key. Sub-task ordering inside a
 * parent is sorted independently of the level above it.
 *
 * Supported keys: 'title' | 'estimated_hours' | 'spare_hours' | 'urgency' |
 * 'actual_seconds' | 'cf:<field_key>' (dynamic columns).
 */
function sortTree(
  nodes: TaskNode[],
  key: string | null,
  dir: "asc" | "desc"
): TaskNode[] {
  if (!key) return nodes;
  const mul = dir === "asc" ? 1 : -1;
  const cmp = (a: TaskNode, b: TaskNode) => {
    const va = readSortValue(a.task, key);
    const vb = readSortValue(b.task, key);
    if (va === vb) return 0;
    // null/undefined sort to the bottom regardless of direction so users see
    // their populated rows first.
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * mul;
    return String(va).localeCompare(String(vb), "he") * mul;
  };
  return nodes
    .slice()
    .sort(cmp)
    .map((n) => ({ task: n.task, children: sortTree(n.children, key, dir) }));
}

function readSortValue(task: Task, key: string): unknown {
  if (key.startsWith("cf:")) {
    const fk = key.slice(3);
    const cf = task.custom_fields as Record<string, unknown> | null;
    return cf?.[fk] ?? null;
  }
  // Map key → typed Task field
  switch (key) {
    case "title":
      return task.title.toLowerCase();
    case "estimated_hours":
      return task.estimated_hours;
    case "spare_hours":
      return task.spare_hours;
    case "urgency":
      return task.urgency;
    case "actual_seconds":
      return task.actual_seconds;
    default:
      return null;
  }
}

function sortTreeWithDoneAtBottom(
  nodes: TaskNode[],
  key: string | null,
  dir: "asc" | "desc"
): TaskNode[] {
  const sorted = sortTree(nodes, key, dir);
  // Stable partition: open first, then done — both already sorted by `key`.
  const openOnes: TaskNode[] = [];
  const doneOnes: TaskNode[] = [];
  for (const n of sorted) {
    const isDone = n.task.status === "done" || !!n.task.completed_at;
    if (isDone) doneOnes.push(n);
    else openOnes.push(n);
  }
  return [...openOnes, ...doneOnes].map((n) => ({
    task: n.task,
    children: sortTreeWithDoneAtBottom(n.children, key, dir),
  }));
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
  const updateProject = useUpdateProject();
  const { data: activeTimer } = useActiveTimer();
  const startTimer = useStartTimer();
  const stopTimer = useStopTimer();
  const { data: customFields = [] } = useProjectCustomFields(projectId);
  const createField = useCreateCustomField();
  const updateField = useUpdateCustomField();
  const deleteField = useDeleteCustomField();
  const { hiddenIds, toggleHidden } = useEntityColumnVisibility({
    entityType: "task",
    projectId,
  });

  const [search, setSearch] = useState("");
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [logTaskId, setLogTaskId] = useState<string | null>(null);
  const logTask = useMemo(
    () => tasks.find((t) => t.id === logTaskId) ?? null,
    [tasks, logTaskId]
  );
  const [optionsFieldId, setOptionsFieldId] = useState<string | null>(null);
  const [editTaskId, setEditTaskId] = useState<string | null>(null);

  const { data: questions = [] } = useProjectQuestions(projectId);
  const questionsByTaskId = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of questions) {
      if (!q.task_id) continue;
      m.set(q.task_id, (m.get(q.task_id) ?? 0) + 1);
    }
    return m;
  }, [questions]);

  const projectLists = useMemo(
    () => lists.filter((l) => l.project_id === projectId),
    [lists, projectId]
  );

  // Per spec §15.6: ✓ checkbox → "צניחה לתחתית" — done tasks stay with their
  // siblings but sink to the bottom of their level. We keep the whole tree
  // unified (no separate "Done" section) and let the sort comparator push
  // done items below open ones at every level.
  const tree = useMemo(() => buildTree(tasks), [tasks]);
  const filteredTree = useMemo(
    () => sortTreeWithDoneAtBottom(filterTree(tree, search), sortKey, sortDir),
    [tree, search, sortKey, sortDir]
  );

  const handleHeaderSort = (key: string) => {
    setSortKey((prev) => {
      if (prev !== key) {
        setSortDir("asc");
        return key;
      }
      // same column: asc → desc → off
      if (sortDir === "asc") {
        setSortDir("desc");
        return key;
      }
      setSortDir("asc");
      return null;
    });
  };

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

  /**
   * Wraps a field-update with undo/redo. Captures the previous values for the
   * keys in `patch` and registers a reversible action with the global store —
   * Ctrl+Z reverts, Ctrl+Y reapplies. Used for inline cell edits.
   */
  const handleTaskUpdate = (taskId: string, patch: Partial<Task>) => {
    const before = tasks.find((t) => t.id === taskId);
    if (!before) {
      update.mutate({ taskId, patch });
      return;
    }
    const oldPatch: Partial<Task> = {};
    for (const key of Object.keys(patch) as (keyof Task)[]) {
      // structuredClone keeps nested objects (e.g. custom_fields) independent.
      const v = (before as Task)[key];
      (oldPatch as Record<string, unknown>)[key] =
        typeof v === "object" && v !== null
          ? structuredClone(v)
          : v;
    }
    update.mutate({ taskId, patch });
    pushUndo({
      description: "שינוי משימה",
      undo: () => update.mutate({ taskId, patch: oldPatch }),
      redo: () => update.mutate({ taskId, patch }),
    });
  };

  const handleCompleteWithUndo = (taskId: string, completed: boolean) => {
    complete.mutate({ taskId, completed });
    pushUndo({
      description: completed ? "סימון כהושלם" : "החזרה לפעיל",
      undo: () => complete.mutate({ taskId, completed: !completed }),
      redo: () => complete.mutate({ taskId, completed }),
    });
  };

  const handleIndentWithUndo = (current: Task) => {
    const beforeParent = current.parent_task_id;
    handleIndent(current);
    pushUndo({
      description: "קינון משימה",
      undo: () =>
        update.mutate({
          taskId: current.id,
          patch: { parent_task_id: beforeParent },
        }),
      redo: () => handleIndent(current),
    });
  };

  const handleOutdentWithUndo = (current: Task) => {
    const beforeParent = current.parent_task_id;
    handleOutdent(current);
    pushUndo({
      description: "יציאת משימה לרמה למעלה",
      undo: () =>
        update.mutate({
          taskId: current.id,
          patch: { parent_task_id: beforeParent },
        }),
      redo: () => handleOutdent(current),
    });
  };

  // Drop → renumber sort_order on the affected top-level tasks. We bulk-update
  // every node with a fresh evenly-spaced index so future inserts have room.
  const handleReorderTopLevel = (newOrder: TaskNode[]) => {
    const before = newOrder.map((n) => ({
      id: n.task.id,
      sort_order: n.task.sort_order ?? 0,
    }));
    const after = newOrder.map((n, i) => ({
      id: n.task.id,
      sort_order: (i + 1) * 1000,
    }));
    reorder.mutate(after);
    pushUndo({
      description: "שינוי סדר משימות",
      undo: () => reorder.mutate(before),
      redo: () => reorder.mutate(after),
    });
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

  const handleRenameField = (fieldId: string, label: string) => {
    updateField.mutate({ fieldId, patch: { field_label: label } });
  };

  const handleSaveOptions = (fieldId: string, options: SelectOption[]) => {
    updateField.mutate({
      fieldId,
      patch: { options: options as unknown as TaskCustomField["options"] },
    });
    setOptionsFieldId(null);
  };

  const optionsField = useMemo(
    () => customFields.find((f) => f.id === optionsFieldId) ?? null,
    [customFields, optionsFieldId]
  );

  const fixedLabels = useMemo(() => {
    const raw = (project?.column_labels ?? {}) as Record<string, unknown>;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === "string" && v.trim()) out[k] = v;
    }
    return out;
  }, [project?.column_labels]);

  const handleRenameFixedColumn = (key: string, label: string) => {
    if (!projectId) return;
    const next = { ...fixedLabels };
    if (label) next[key] = label;
    else delete next[key];
    updateProject.mutate({
      projectId,
      patch: { column_labels: next as Project["column_labels"] },
    });
  };

  /**
   * Drop on a column header → renumber sort_order on every column so the new
   * left-to-right order persists. We bulk-update via individual mutations
   * since there's no batch endpoint.
   */
  const handleReorderFields = (newOrder: TaskCustomField[]) => {
    newOrder.forEach((field, i) => {
      const next = (i + 1) * 1000;
      if (field.sort_order !== next) {
        updateField.mutate({
          fieldId: field.id,
          patch: { sort_order: next },
        });
      }
    });
  };

  const orderedFixedKeys = useMemo(
    () => normalizeFixedOrder(project?.column_order, DEFAULT_FIXED_ORDER),
    [project?.column_order]
  );

  // Visible (non-hidden) columns drive the table grid/header/rows; the full
  // lists drive the "עמודות" menu so hidden columns can be toggled back on.
  // Hiding is per-project and never deletes data.
  const visibleFixedKeys = useMemo(
    () => orderedFixedKeys.filter((k) => !hiddenIds.has(k)),
    [orderedFixedKeys, hiddenIds]
  );
  const visibleFields = useMemo(
    () => customFields.filter((f) => !hiddenIds.has(f.id)),
    [customFields, hiddenIds]
  );
  const columnMenuItems = useMemo<ColumnsMenuItem[]>(
    () => [
      ...orderedFixedKeys.map((k) => ({
        id: k,
        kind: "fixed" as const,
        label: fixedLabels[k] ?? TASK_FIXED_DESCRIPTOR_BY_KEY[k].defaultLabel,
      })),
      ...customFields.map((f) => ({
        id: f.id,
        kind: "custom" as const,
        label: f.field_label,
      })),
    ],
    [orderedFixedKeys, customFields, fixedLabels]
  );

  const orderedDescriptors = useMemo(
    () => visibleFixedKeys.map((k) => TASK_FIXED_DESCRIPTOR_BY_KEY[k]),
    [visibleFixedKeys]
  );

  const gridCols = useMemo(
    () =>
      buildGridCols(visibleFixedKeys, visibleFields.length, TASK_FIXED_WIDTHS, {
        controlCols: CONTROL_COLS,
        actionsCol: ACTIONS_COL,
        dynColWidth: DYN_COL_WIDTH,
      }),
    [visibleFixedKeys, visibleFields.length]
  );
  const gridMinWidth = buildGridMinWidth(
    visibleFixedKeys,
    visibleFields.length,
    TASK_FIXED_WIDTHS,
    {
      controlAndActionsWidth: CONTROL_AND_ACTIONS_WIDTH,
      dynColWidth: DYN_COL_WIDTH,
    }
  );

  const handleReorderFixed = (newOrder: FixedColumnKey[]) => {
    if (!projectId) return;
    updateProject.mutate({
      projectId,
      patch: { column_order: newOrder as unknown as Project["column_order"] },
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
      {logTask && (
        <TimerLogPopup task={logTask} onClose={() => setLogTaskId(null)} />
      )}
      {optionsField && (
        <OptionsEditorModal
          field={optionsField}
          onSave={(opts) => handleSaveOptions(optionsField.id, opts)}
          onClose={() => setOptionsFieldId(null)}
        />
      )}
      {editTaskId && (
        <TaskEditModal
          taskId={editTaskId}
          onClose={() => setEditTaskId(null)}
        />
      )}
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
        <div className="shrink-0">
          <ColumnsMenu
            items={columnMenuItems}
            hiddenIds={hiddenIds}
            onToggle={toggleHidden}
          />
        </div>
        {tasks.length > 0 && (
          <div className="shrink-0">
            <ExportExcelButton
              filename="משימות"
              build={() => buildTasksSheet(tasks, customFields)}
            />
          </div>
        )}
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
              customFields={visibleFields}
              fixedLabels={fixedLabels}
              orderedDescriptors={orderedDescriptors}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleHeaderSort}
              onRenameFixed={handleRenameFixedColumn}
              onReorderFixed={handleReorderFixed}
              onAddField={handleAddField}
              onDeleteField={handleDeleteField}
              onRenameField={handleRenameField}
              onReorderFields={handleReorderFields}
              onEditFieldOptions={(fieldId) => setOptionsFieldId(fieldId)}
            />
            <SortableTaskList
              nodes={filteredTree}
              activeTimer={activeTimer ?? null}
              focusTaskId={focusTaskId}
              onFocusHandled={() => setFocusTaskId(null)}
              customFields={visibleFields}
              gridCols={gridCols}
              orderedFixedKeys={visibleFixedKeys}
              questionsByTaskId={questionsByTaskId}
              onReorder={handleReorderTopLevel}
              onUpdate={handleTaskUpdate}
              onComplete={handleCompleteWithUndo}
              onDelete={(id) => del.mutate(id)}
              onAddSub={handleAddSub}
              onToggleTimer={(taskId, isCurrentlyActive) => {
                if (isCurrentlyActive) stopTimer.mutate();
                else startTimer.mutate({ taskId });
              }}
              onOpenLog={(taskId) => setLogTaskId(taskId)}
              onOpenEdit={(taskId) => setEditTaskId(taskId)}
              onAddAfter={handleAddAfter}
              onIndent={handleIndentWithUndo}
              onOutdent={handleOutdentWithUndo}
            />
          </div>
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
  onOpenLog: (taskId: string) => void;
  onOpenEdit: (taskId: string) => void;
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
  orderedFixedKeys: FixedColumnKey[];
  questionsByTaskId: Map<string, number>;
}

function TaskList({
  nodes,
  level,
  activeTimer,
  focusTaskId,
  onFocusHandled,
  customFields,
  gridCols,
  orderedFixedKeys,
  questionsByTaskId,
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
          orderedFixedKeys={orderedFixedKeys}
          questionsByTaskId={questionsByTaskId}
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
  orderedFixedKeys,
  questionsByTaskId,
  onReorder,
  ...handlers
}: {
  nodes: TaskNode[];
  activeTimer: TimeEntry | null;
  focusTaskId: string | null;
  onFocusHandled: () => void;
  customFields: TaskCustomField[];
  gridCols: string;
  orderedFixedKeys: FixedColumnKey[];
  questionsByTaskId: Map<string, number>;
  onReorder: (newOrder: TaskNode[]) => void;
} & RowHandlers) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      // Touch: long-press 250ms (with up-to-5px wobble) before drag begins,
      // otherwise scroll/tap conflict with drag activation on mobile.
      activationConstraint: { delay: 250, tolerance: 5 },
    })
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
              orderedFixedKeys={orderedFixedKeys}
              questionsByTaskId={questionsByTaskId}
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
  orderedFixedKeys,
  questionsByTaskId,
  ...handlers
}: {
  node: TaskNode;
  activeTimer: TimeEntry | null;
  focusTaskId: string | null;
  onFocusHandled: () => void;
  customFields: TaskCustomField[];
  gridCols: string;
  orderedFixedKeys: FixedColumnKey[];
  questionsByTaskId: Map<string, number>;
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
        orderedFixedKeys={orderedFixedKeys}
        questionsByTaskId={questionsByTaskId}
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
          orderedFixedKeys={orderedFixedKeys}
          questionsByTaskId={questionsByTaskId}
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
  orderedFixedKeys,
  questionsByTaskId,
  ...handlers
}: {
  node: TaskNode;
  level: number;
  activeTimer: TimeEntry | null;
  focusTaskId: string | null;
  onFocusHandled: () => void;
  customFields: TaskCustomField[];
  gridCols: string;
  orderedFixedKeys: FixedColumnKey[];
  questionsByTaskId: Map<string, number>;
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
        orderedFixedKeys={orderedFixedKeys}
        questionsByTaskId={questionsByTaskId}
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
          orderedFixedKeys={orderedFixedKeys}
          questionsByTaskId={questionsByTaskId}
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
  orderedFixedKeys,
  questionsByTaskId,
  onUpdate,
  onComplete,
  onDelete,
  onAddSub,
  onToggleTimer,
  onOpenLog,
  onOpenEdit,
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
  orderedFixedKeys: FixedColumnKey[];
  questionsByTaskId: Map<string, number>;
} & RowHandlers) {
  const isDone = task.status === "done" || !!task.completed_at;
  const isTimerActive = activeTimer?.task_id === task.id;
  const liveSeconds = useLiveActualSeconds(task, activeTimer);
  // Per-level indent shifts the entire row's content (drag, checkbox, title,
  // dynamic cells) inward from the start edge, so a sub-task's checkbox
  // visibly nests under its parent — the previous title-cell-only padding
  // left the checkbox at the same x as the parent's, which made hierarchy
  // hard to read. Bumped to 24px per level for clearer visual separation.
  const indentPx = level * 24;

  const renderFixedCell = (key: FixedColumnKey): React.ReactNode => {
    switch (key) {
      case "title":
        return (
          <div className="min-w-0">
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
        );
      case "estimated_hours":
        return (
          <NumberCell
            title="שעות"
            value={task.estimated_hours}
            suffix="ש"
            onSave={(v) => onUpdate(task.id, { estimated_hours: v })}
          />
        );
      case "spare_hours":
        return (
          <NumberCell
            title="ספייר"
            value={task.spare_hours}
            suffix="ס"
            onSave={(v) => onUpdate(task.id, { spare_hours: v })}
          />
        );
      case "urgency":
        return (
          <div className="flex items-center justify-center">
            <UrgencyBars
              value={task.urgency ?? 0}
              onChange={(v) => onUpdate(task.id, { urgency: v })}
            />
          </div>
        );
      case "timer":
        return (
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
        );
      case "actual_seconds":
        return (
          <button
            type="button"
            onClick={() => onOpenLog(task.id)}
            className={
              "text-[10px] tabular-nums text-end px-1 py-0.5 rounded hover:bg-ink-100 transition-colors " +
              (isTimerActive
                ? "text-danger font-semibold"
                : liveSeconds > 0
                ? "text-ink-700 hover:text-ink-900"
                : "text-ink-400 hover:text-ink-700")
            }
            title="היסטוריית סטופר"
          >
            {fmtHours(liveSeconds)}
          </button>
        );
      case "notes":
        return (
          <NotesCell
            value={task.notes ?? ""}
            onSave={(v) => onUpdate(task.id, { notes: v || null })}
          />
        );
      case "questions":
        return (
          <QuestionsCountCell
            count={questionsByTaskId.get(task.id) ?? 0}
            onOpen={() => onOpenEdit(task.id)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="group/row grid items-center gap-1 py-1 hover:bg-ink-50 px-1.5 transition-colors border-b border-ink-200"
      style={{
        gridTemplateColumns: gridCols,
        paddingInlineStart: `calc(0.375rem + ${indentPx}px)`,
      }}
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

      {/* Fixed cells in user-defined order */}
      {orderedFixedKeys.map((key) => (
        <Fragment key={key}>{renderFixedCell(key)}</Fragment>
      ))}

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
          onClick={() =>
            onUpdate(task.id, { is_event: !task.is_event })
          }
          className={
            "p-1 rounded hover:bg-ink-200 " +
            (task.is_event
              ? "text-primary-600 hover:text-primary-700"
              : "text-ink-500 hover:text-ink-900")
          }
          title={task.is_event ? "אירוע ביומן (קליק להסרה)" : "סמני כאירוע ביומן"}
          aria-label={task.is_event ? "הסירי מהיומן" : "סמני כאירוע ביומן"}
        >
          <CalendarPlus className="w-3 h-3" />
        </button>
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

function QuestionsCountCell({
  count,
  onOpen,
}: {
  count: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={
        "inline-flex items-center justify-center gap-0.5 mx-auto rounded px-1 py-0.5 text-[10px] transition-colors " +
        (count > 0
          ? "text-primary-700 hover:bg-primary-100"
          : "text-ink-300 hover:text-ink-700 hover:bg-ink-100")
      }
      title={count > 0 ? `${count} שאלות` : "אין שאלות"}
    >
      <HelpCircle className="w-3 h-3" />
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </button>
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
