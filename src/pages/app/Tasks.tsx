import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { ListsBanner } from "@/components/lists/ListsBanner";
import {
  FilterBar,
  useFiltersFromUrl,
  type FilterField,
} from "@/components/filters/FilterBar";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";
import { TaskColumn } from "@/components/tasks/TaskColumn";
import type { TaskTreeNode } from "@/components/tasks/TaskRow";
import {
  useTasks,
  useTaskLists,
  useMoveTaskToList,
  useSetTaskParent,
  useListVisibility,
} from "@/lib/hooks";
import type { Task, TaskList, TaskStatus } from "@/lib/types/domain";

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "לעשות" },
  { value: "in_progress", label: "בעבודה" },
  { value: "pending_approval", label: "ממתין לאישור" },
  { value: "done", label: "בוצע" },
  { value: "cancelled", label: "בוטל" },
];

export function Tasks() {
  const [filters, setFilters] = useFiltersFromUrl();
  const { data: tasks = [] } = useTasks(filters);
  const { data: lists = [] } = useTaskLists();
  const { data: visibility } = useListVisibility("tasks");
  const moveToList = useMoveTaskToList();
  const setParent = useSetTaskParent();

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const hiddenSet = useMemo(
    () => new Set(visibility?.hidden_list_ids ?? []),
    [visibility]
  );

  // Build per-list trees + a count map for header badges.
  const { listTrees, counts } = useMemo(
    () => buildTrees(tasks),
    [tasks]
  );

  // Columns to render: "unassigned" always visible and pinned, then visible lists.
  const visibleLists = useMemo(
    () => lists.filter((l) => !hiddenSet.has(l.id)),
    [lists, hiddenSet]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

  const allTagSuggestions = useMemo(() => {
    const s = new Set<string>();
    tasks.forEach((t) => (t.tags ?? []).forEach((tag) => s.add(tag)));
    return Array.from(s);
  }, [tasks]);

  const fields: FilterField[] = [
    {
      key: "statuses",
      type: "multi-enum",
      label: "סטטוס",
      options: STATUS_OPTIONS,
    },
    {
      key: "lists",
      type: "multi-enum",
      label: "רשימה",
      options: lists.map((l) => ({
        value: l.id,
        label: `${l.emoji ?? ""} ${l.name}`.trim(),
      })),
    },
    {
      key: "urgencyMin",
      type: "number-range",
      label: "דחיפות",
      min: 1,
      max: 5,
      minKey: "urgencyMin",
      maxKey: "urgencyMax",
    },
    {
      key: "tags",
      type: "multi-text",
      label: "תגים",
      resolveLabel: (v) => (allTagSuggestions.includes(v) ? v : v),
    },
    {
      key: "dueAfter",
      type: "date-range",
      label: "תאריך יעד",
      fromKey: "dueAfter",
      toKey: "dueBefore",
    },
    { key: "onlyWithTimer", type: "boolean", label: "סטופר פעיל בלבד" },
  ];

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeData = active.data.current as
      | { type: "task"; taskId: string; listId: string | null; parentTaskId: string | null }
      | undefined;
    const overData = over.data.current as
      | { type: "list"; listId: string | null }
      | { type: "task-drop"; taskId: string; listId: string | null }
      | undefined;
    if (!activeData || !overData) return;

    if (activeData.type !== "task") return;

    if (overData.type === "list") {
      // Move task to the root of this list.
      if (activeData.listId === overData.listId && activeData.parentTaskId === null) {
        return;
      }
      // Clear parent + move list
      setParent.mutate({ taskId: activeData.taskId, parentId: null });
      if (activeData.listId !== overData.listId) {
        moveToList.mutate({
          taskId: activeData.taskId,
          listId: overData.listId,
        });
      }
      return;
    }

    if (overData.type === "task-drop") {
      // Don't allow dropping a task on itself.
      if (overData.taskId === activeData.taskId) return;
      // Don't allow dropping a task on one of its own descendants.
      if (isDescendant(tasks, overData.taskId, activeData.taskId)) return;
      // Make active a child of over, and ensure it lives in over's list.
      setParent.mutate({
        taskId: activeData.taskId,
        parentId: overData.taskId,
      });
      if (activeData.listId !== overData.listId) {
        moveToList.mutate({
          taskId: activeData.taskId,
          listId: overData.listId,
        });
      }
      return;
    }
  };

  return (
    <ScreenScaffold
      title="משימות"
      subtitle="רשימות עמודה-עמודה, עץ היררכי מלא, סטופר, גרירה בין רשימות."
    >
      <div className="space-y-3">
        <ListsBanner screenKey="tasks" kind="task" />
        <FilterBar
          screenKey="tasks"
          filters={filters}
          onChange={setFilters}
          fields={fields}
        />

        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragEnd={handleDragEnd}
        >
          <div className="overflow-x-auto scrollbar-thin">
            <div className="flex items-stretch gap-3 min-h-[calc(100vh-280px)] pb-2">
              {/* Unassigned: pinned to the leading (right in RTL) edge. Since flex
                  in RTL lays out items right-to-left, first DOM item = rightmost. */}
              <TaskColumn
                list={null}
                roots={listTrees.get("__unassigned__") ?? []}
                totalCount={counts.get("__unassigned__") ?? 0}
                pinned
                onOpenEdit={setEditingTaskId}
              />

              {/* Visible custom/project lists */}
              {visibleLists.map((list) => (
                <TaskColumn
                  key={list.id}
                  list={list}
                  roots={listTrees.get(list.id) ?? []}
                  totalCount={counts.get(list.id) ?? 0}
                  onOpenEdit={setEditingTaskId}
                />
              ))}

              {/* "+ רשימה חדשה" affordance lives in ListsBanner */}
              {visibleLists.length === 0 && (
                <EmptyListsHint lists={lists} />
              )}
            </div>
          </div>
        </DndContext>
      </div>

      <TaskEditModal
        taskId={editingTaskId}
        onClose={() => setEditingTaskId(null)}
      />
    </ScreenScaffold>
  );
}

function EmptyListsHint({ lists }: { lists: TaskList[] }) {
  if (lists.length === 0) {
    return (
      <div className="card p-6 flex-1 min-w-[280px] text-center">
        <p className="text-sm text-ink-600">
          עוד אין רשימות. צרי רשימה ראשונה בבאנר שלמעלה, או גררי משימות לתוך "לא משויכות".
        </p>
      </div>
    );
  }
  return (
    <div className="card p-4 flex-1 min-w-[280px] text-center">
      <p className="text-sm text-ink-600">
        כל הרשימות מוסתרות. הפעילי אותן מהבאנר שלמעלה.
      </p>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Tree builder — groups tasks by task_list_id and builds a parent_task_id tree.

interface BuildResult {
  listTrees: Map<string, TaskTreeNode[]>;
  counts: Map<string, number>;
}

const UNASSIGNED_KEY = "__unassigned__";

function buildTrees(tasks: Task[]): BuildResult {
  // Group by list
  const byList = new Map<string, Task[]>();
  for (const t of tasks) {
    const key = t.task_list_id ?? UNASSIGNED_KEY;
    if (!byList.has(key)) byList.set(key, []);
    byList.get(key)!.push(t);
  }

  const listTrees = new Map<string, TaskTreeNode[]>();
  const counts = new Map<string, number>();

  for (const [listKey, listTasks] of byList.entries()) {
    counts.set(listKey, listTasks.length);

    // Index by id for O(1) lookup
    const byId = new Map<string, Task>();
    listTasks.forEach((t) => byId.set(t.id, t));

    // Children map
    const childrenOf = new Map<string | null, Task[]>();
    for (const t of listTasks) {
      // If the parent lives in another list or doesn't exist in this slice,
      // treat this task as a root within its list (graceful orphan handling).
      const parentInList = t.parent_task_id && byId.has(t.parent_task_id);
      const pid = parentInList ? t.parent_task_id : null;
      if (!childrenOf.has(pid)) childrenOf.set(pid, []);
      childrenOf.get(pid)!.push(t);
    }

    // Sort each sibling bucket: incomplete first (by sort_order), then completed
    // (by completed_at desc). V-check sinks a task to bottom of its sibling scope.
    for (const arr of childrenOf.values()) {
      arr.sort((a, b) => {
        const aDone = !!a.completed_at;
        const bDone = !!b.completed_at;
        if (aDone !== bDone) return aDone ? 1 : -1;
        if (aDone && bDone) {
          return (b.completed_at ?? "").localeCompare(a.completed_at ?? "");
        }
        return a.sort_order - b.sort_order;
      });
    }

    const build = (pid: string | null, depth: number): TaskTreeNode[] =>
      (childrenOf.get(pid) ?? []).map((t) => ({
        task: t,
        children: build(t.id, depth + 1),
        depth,
      }));

    listTrees.set(listKey, build(null, 0));
  }

  return { listTrees, counts };
}

/** True if `maybeDescendantId` lives somewhere in the subtree of `ancestorId`. */
function isDescendant(
  tasks: Task[],
  maybeDescendantId: string,
  ancestorId: string
): boolean {
  const byId = new Map<string, Task>();
  tasks.forEach((t) => byId.set(t.id, t));
  let cursor: string | null | undefined = maybeDescendantId;
  const visited = new Set<string>();
  while (cursor) {
    if (visited.has(cursor)) return false;
    visited.add(cursor);
    const node = byId.get(cursor);
    if (!node) return false;
    if (node.parent_task_id === ancestorId) return true;
    cursor = node.parent_task_id ?? null;
  }
  return false;
}
