import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Archive,
  Settings as SettingsIcon,
  LayoutList,
  Minus,
  Plus,
  Columns,
  Tag,
} from "lucide-react";
import { MAX_VISIBLE_BOUNDS } from "@/lib/hooks/useMaxVisibleColumns";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { TasksChrome, type TasksLayout } from "@/components/tasks/TasksChrome";
import {
  FilterBar,
  useFiltersFromUrl,
  type FilterField,
} from "@/components/filters/FilterBar";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";
import { TaskColumn } from "@/components/tasks/TaskColumn";
import { ArchiveModal } from "@/components/tasks/ArchiveModal";
import { RowDisplaySettingsModal } from "@/components/tasks/RowDisplaySettingsModal";
import { StatsPanel } from "@/components/tasks/StatsPanel";
import { UnassignedBanner } from "@/components/tasks/UnassignedBanner";
import { StatusesModal } from "@/components/tasks/StatusesModal";
import type { TaskTreeNode } from "@/components/tasks/TaskRow";
import {
  useTasks,
  useTaskLists,
  useMoveTaskToList,
  useSetTaskParent,
  useListVisibility,
  useSetListVisibility,
  useCreateTaskList,
  useMyTaskStatuses,
  useMaxVisibleColumns,
  useRowDisplayPrefs,
} from "@/lib/hooks";
import { pushUndo } from "@/lib/undo/store";
import type { Task, TaskList } from "@/lib/types/domain";

export function Tasks() {
  const [filters, setFilters] = useFiltersFromUrl();
  const { data: tasks = [] } = useTasks(filters);
  const { data: lists = [] } = useTaskLists();
  const { data: visibility } = useListVisibility("tasks");
  const setListVisibility = useSetListVisibility();
  const createTaskList = useCreateTaskList();
  const moveToList = useMoveTaskToList();
  const setParent = useSetTaskParent();

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [rowDisplayOpen, setRowDisplayOpen] = useState(false);
  const [statusesOpen, setStatusesOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("multitask.tasks.filtersOpen") === "true";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("multitask.tasks.filtersOpen", String(filtersOpen));
  }, [filtersOpen]);

  const filtersActiveCount = useMemo(() => {
    let n = 0;
    Object.values(filters).forEach((v) => {
      if (Array.isArray(v)) n += v.length;
      else if (v !== undefined && v !== null && v !== "" && v !== false) n += 1;
    });
    return n;
  }, [filters]);

  const toggleListVisibility = (listId: string) => {
    const current = visibility?.hidden_list_ids ?? [];
    const next = current.includes(listId)
      ? current.filter((id) => id !== listId)
      : [...current, listId];
    setListVisibility.mutate({ screenKey: "tasks", hiddenListIds: next });
  };

  const handleCreateList = async () => {
    const name = window.prompt("שם הרשימה החדשה:");
    if (!name?.trim()) return;
    await createTaskList.mutateAsync({ name: name.trim(), kind: "custom" });
  };

  // Allow ?edit=<taskId> in the URL to pre-open the TaskEditModal — used by
  // the QuickCapture "+ משימה חדשה" action to land the user directly on an
  // editable draft. We strip the param once consumed so the modal can be
  // closed without it snapping back open.
  const [urlParams, setUrlParams] = useSearchParams();
  useEffect(() => {
    const editId = urlParams.get("edit");
    if (editId && editId !== editingTaskId) {
      setEditingTaskId(editId);
      const next = new URLSearchParams(urlParams);
      next.delete("edit");
      setUrlParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlParams]);
  const [statsOpen, setStatsOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    // Default: closed (user can open via the chevron on the header)
    return localStorage.getItem("multitask.tasks.statsOpen") === "true";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("multitask.tasks.statsOpen", String(statsOpen));
  }, [statsOpen]);

  const { data: myStatuses = [] } = useMyTaskStatuses();
  const [maxVisibleColumns, setMaxVisibleColumns] = useMaxVisibleColumns("tasks");
  const [rowDisplayPrefs, updateRowDisplay, resetRowDisplay] = useRowDisplayPrefs();
  const [unassignedOpen, setUnassignedOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const raw = localStorage.getItem("multitask.tasks.unassignedOpen");
    return raw === null ? true : raw === "true";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("multitask.tasks.unassignedOpen", String(unassignedOpen));
  }, [unassignedOpen]);

  // Layout: kanban columns (the original) vs vertical-stack of lists.
  const [layout, setLayout] = useState<TasksLayout>(() => {
    if (typeof window === "undefined") return "columns";
    return (
      (localStorage.getItem("multitask.tasks.layout") as TasksLayout) ||
      "columns"
    );
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("multitask.tasks.layout", layout);
  }, [layout]);

  const hiddenSet = useMemo(
    () => new Set(visibility?.hidden_list_ids ?? []),
    [visibility]
  );

  // Build per-list trees + a count map for header badges.
  const { listTrees, counts } = useMemo(
    () => buildTrees(tasks),
    [tasks]
  );

  // Columns to render: "unassigned" always visible and pinned, then the rest.
  // Pinned-via-menu custom lists come first (right after "unassigned").
  const visibleLists = useMemo(() => {
    const shown = lists.filter((l) => !hiddenSet.has(l.id));
    return shown.sort((a, b) => {
      if (!!a.is_pinned !== !!b.is_pinned) return a.is_pinned ? -1 : 1;
      return a.sort_order - b.sort_order;
    });
  }, [lists, hiddenSet]);

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
      options: myStatuses.map((s) => ({ value: s.key, label: s.label })),
    },
    {
      key: "lists",
      type: "multi-enum",
      label: "רשימה",
      options: lists.map((l) => ({
        value: l.id,
        // emoji column may hold an "icon:<key>" slug — the <FilterBar> label is
        // plain text, so strip those and just show the name.
        label:
          l.emoji && !l.emoji.startsWith("icon:")
            ? `${l.emoji} ${l.name}`.trim()
            : l.name,
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
      const prevListId = activeData.listId;
      const prevParentId = activeData.parentTaskId;
      const nextListId = overData.listId;
      // Apply
      setParent.mutate({ taskId: activeData.taskId, parentId: null });
      if (prevListId !== nextListId) {
        moveToList.mutate({
          taskId: activeData.taskId,
          listId: nextListId,
        });
      }
      pushUndo({
        description: "העברת משימה בין רשימות",
        undo: () => {
          setParent.mutate({ taskId: activeData.taskId, parentId: prevParentId });
          if (prevListId !== nextListId) {
            moveToList.mutate({
              taskId: activeData.taskId,
              listId: prevListId,
            });
          }
        },
        redo: () => {
          setParent.mutate({ taskId: activeData.taskId, parentId: null });
          if (prevListId !== nextListId) {
            moveToList.mutate({
              taskId: activeData.taskId,
              listId: nextListId,
            });
          }
        },
      });
      return;
    }

    if (overData.type === "task-drop") {
      // Don't allow dropping a task on itself.
      if (overData.taskId === activeData.taskId) return;
      // Don't allow dropping a task on one of its own descendants.
      if (isDescendant(tasks, overData.taskId, activeData.taskId)) return;
      const prevListId = activeData.listId;
      const prevParentId = activeData.parentTaskId;
      const nextListId = overData.listId;
      const nextParentId = overData.taskId;
      setParent.mutate({ taskId: activeData.taskId, parentId: nextParentId });
      if (prevListId !== nextListId) {
        moveToList.mutate({
          taskId: activeData.taskId,
          listId: nextListId,
        });
      }
      pushUndo({
        description: "הפיכת משימה לתת-משימה",
        undo: () => {
          setParent.mutate({ taskId: activeData.taskId, parentId: prevParentId });
          if (prevListId !== nextListId) {
            moveToList.mutate({
              taskId: activeData.taskId,
              listId: prevListId,
            });
          }
        },
        redo: () => {
          setParent.mutate({ taskId: activeData.taskId, parentId: nextParentId });
          if (prevListId !== nextListId) {
            moveToList.mutate({
              taskId: activeData.taskId,
              listId: nextListId,
            });
          }
        },
      });
      return;
    }
  };

  return (
    <ScreenScaffold
      title="משימות"
      subtitle="רשימות עמודה-עמודה, עץ היררכי מלא, סטופר, גרירה בין רשימות."
      actions={
        <div className="relative">
          <button
            onClick={() => setPageMenuOpen((v) => !v)}
            className="btn-outline text-sm"
            type="button"
            title="הגדרות הדף"
          >
            <SettingsIcon className="w-4 h-4" />
            <span>הגדרות הדף</span>
          </button>
          {pageMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setPageMenuOpen(false)}
              />
              <div className="absolute end-0 mt-1 w-64 bg-white border border-ink-200 rounded-xl shadow-lift z-30 py-1 text-sm">
                {/* Max-visible columns stepper (lives here, unified with other page settings) */}
                <div className="flex items-center gap-2 px-3 py-2 text-ink-700">
                  <Columns className="w-4 h-4 shrink-0" />
                  <span className="flex-1">עמודות בתצוגה</span>
                  <div className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-1 py-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMaxVisibleColumns(maxVisibleColumns - 1);
                      }}
                      disabled={maxVisibleColumns <= MAX_VISIBLE_BOUNDS.MIN}
                      className="p-0.5 rounded hover:bg-ink-100 disabled:opacity-40"
                      aria-label="פחות"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono tabular-nums w-3 text-center text-xs">
                      {maxVisibleColumns}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMaxVisibleColumns(maxVisibleColumns + 1);
                      }}
                      disabled={maxVisibleColumns >= MAX_VISIBLE_BOUNDS.MAX}
                      className="p-0.5 rounded hover:bg-ink-100 disabled:opacity-40"
                      aria-label="עוד"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div className="h-px bg-ink-100 mx-2" />
                <button
                  type="button"
                  onClick={() => {
                    setRowDisplayOpen(true);
                    setPageMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-ink-700 hover:bg-ink-100 text-start"
                >
                  <LayoutList className="w-4 h-4" />
                  תצוגת שורה
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusesOpen(true);
                    setPageMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-ink-700 hover:bg-ink-100 text-start"
                >
                  <Tag className="w-4 h-4" />
                  עריכת סטטוסים
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setArchiveOpen(true);
                    setPageMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-ink-700 hover:bg-ink-100 text-start"
                >
                  <Archive className="w-4 h-4" />
                  ארכיון רשימות
                </button>
              </div>
            </>
          )}
        </div>
      }
    >
      <div className="space-y-2">
        <TasksChrome
          lists={lists.map((l) => ({
            id: l.id,
            name: l.name,
            emoji: l.emoji,
            color: l.color,
          }))}
          hiddenListIds={hiddenSet}
          onToggleListVisibility={toggleListVisibility}
          onCreateList={handleCreateList}
          filtersActiveCount={filtersActiveCount}
          filtersOpen={filtersOpen}
          onToggleFilters={() => setFiltersOpen((v) => !v)}
          statsOpen={statsOpen}
          onToggleStats={() => setStatsOpen((v) => !v)}
          layout={layout}
          onLayoutChange={setLayout}
        />

        {filtersOpen && (
          <FilterBar
            screenKey="tasks"
            filters={filters}
            onChange={setFilters}
            fields={fields}
            alwaysExpanded
          />
        )}

        {statsOpen && (
          <StatsPanel
            lists={visibleLists}
            tasks={tasks}
            open
            onToggle={() => setStatsOpen(false)}
          />
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragEnd={handleDragEnd}
        >
          {layout === "stack" ? (
            // Stack layout: each list is a full-width section, top to bottom.
            // Visible-lists filter still applies. Drag-and-drop still works
            // across sections — the dnd context wraps both layouts.
            <div className="flex flex-col gap-3">
              <UnassignedBanner
                open={unassignedOpen}
                onToggle={() => setUnassignedOpen((v) => !v)}
                roots={listTrees.get("__unassigned__") ?? []}
                totalCount={counts.get("__unassigned__") ?? 0}
                display={rowDisplayPrefs}
                onOpenEdit={setEditingTaskId}
                fullWidth
              />
              {visibleLists.map((list) => (
                <TaskColumn
                  key={list.id}
                  list={list}
                  roots={listTrees.get(list.id) ?? []}
                  totalCount={counts.get(list.id) ?? 0}
                  divisor={1}
                  display={rowDisplayPrefs}
                  onOpenEdit={setEditingTaskId}
                />
              ))}
              {visibleLists.length === 0 && <EmptyListsHint lists={lists} />}
            </div>
          ) : (
            // Columns (kanban) layout — the original Phase 3 layout.
            // On mobile: stack vertically. On md+: side-by-side with
            // Unassigned on the leading (right in RTL) edge.
            <div className="flex flex-col md:flex-row items-stretch gap-3 min-h-[calc(100vh-340px)]">
              <UnassignedBanner
                open={unassignedOpen}
                onToggle={() => setUnassignedOpen((v) => !v)}
                roots={listTrees.get("__unassigned__") ?? []}
                totalCount={counts.get("__unassigned__") ?? 0}
                display={rowDisplayPrefs}
                onOpenEdit={setEditingTaskId}
              />

              <div className="flex-1 min-w-0 overflow-x-auto scrollbar-thin">
                <div className="flex items-stretch gap-3 pb-2">
                  {visibleLists.map((list) => (
                    <TaskColumn
                      key={list.id}
                      list={list}
                      roots={listTrees.get(list.id) ?? []}
                      totalCount={counts.get(list.id) ?? 0}
                      divisor={Math.min(
                        Math.max(visibleLists.length, 1),
                        maxVisibleColumns
                      )}
                      display={rowDisplayPrefs}
                      onOpenEdit={setEditingTaskId}
                    />
                  ))}
                  {visibleLists.length === 0 && (
                    <EmptyListsHint lists={lists} />
                  )}
                </div>
              </div>
            </div>
          )}
        </DndContext>
      </div>

      <TaskEditModal
        taskId={editingTaskId}
        onClose={() => setEditingTaskId(null)}
      />

      {archiveOpen && <ArchiveModal onClose={() => setArchiveOpen(false)} />}

      {rowDisplayOpen && (
        <RowDisplaySettingsModal
          prefs={rowDisplayPrefs}
          onChange={updateRowDisplay}
          onReset={resetRowDisplay}
          onClose={() => setRowDisplayOpen(false)}
        />
      )}

      {statusesOpen && <StatusesModal onClose={() => setStatusesOpen(false)} />}
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
