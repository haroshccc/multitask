import { type FormEvent, useEffect, useMemo, useState } from "react";
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
  Upload,
  CheckSquare,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ImportTasksModal } from "@/components/tasks/ImportTasksModal";
import { MAX_VISIBLE_BOUNDS } from "@/lib/hooks/useMaxVisibleColumns";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { TasksChrome, type TasksLayout } from "@/components/tasks/TasksChrome";
import {
  FilterBar,
  useFiltersFromUrl,
  type FilterField,
} from "@/components/filters/FilterBar";
import { TaskEditModal, type TaskCreateDraft } from "@/components/tasks/TaskEditModal";
import { TaskColumn } from "@/components/tasks/TaskColumn";
import { BulkActionsToolbar } from "@/components/tasks/BulkActionsToolbar";
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
  useReorderTasks,
  useReorderTaskLists,
  useListVisibility,
  useSetListVisibility,
  useCreateTaskList,
  useArchiveTaskList,
  useMyTaskStatuses,
  useMaxVisibleColumns,
  useRowDisplayPrefs,
  useInactiveProjectListIds,
} from "@/lib/hooks";
import { pushUndo } from "@/lib/undo/store";
import { useTaskSelectionStore } from "@/lib/selection/store";
import { useOrgScope } from "@/lib/hooks/useOrgScope";
import type { Task, TaskList } from "@/lib/types/domain";

export function Tasks() {
  const [filters, setFilters] = useFiltersFromUrl();
  const { userId } = useOrgScope();
  const { data: tasks = [] } = useTasks(filters);
  const { data: lists = [] } = useTaskLists();
  const { data: visibility } = useListVisibility("tasks");
  const setListVisibility = useSetListVisibility();
  const createTaskList = useCreateTaskList();
  const archiveTaskList = useArchiveTaskList();
  const moveToList = useMoveTaskToList();
  const setParent = useSetTaskParent();
  const reorderTasks = useReorderTasks();
  const reorderLists = useReorderTaskLists();

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [createDraft, setCreateDraft] = useState<TaskCreateDraft | null>(null);
  const [newListDialogOpen, setNewListDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  // Mobile: the whole chrome (lists/filter/stats/layout) collapses under one
  // toggle in the compact header. Default minimized so the first list is high.
  const [chromeOpen, setChromeOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [rowDisplayOpen, setRowDisplayOpen] = useState(false);
  const [statusesOpen, setStatusesOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
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
    const wasHidden = current.includes(listId);
    const next = wasHidden
      ? current.filter((id) => id !== listId)
      : [...current, listId];
    setListVisibility.mutate({ screenKey: "tasks", hiddenListIds: next });
    pushUndo({
      description: wasHidden ? "הצגת רשימה" : "הסתרת רשימה",
      undo: () =>
        setListVisibility.mutate({
          screenKey: "tasks",
          hiddenListIds: current,
        }),
      redo: () =>
        setListVisibility.mutate({
          screenKey: "tasks",
          hiddenListIds: next,
        }),
    });
  };

  const handleCreateList = () => {
    setNewListName("");
    setNewListDialogOpen(true);
  };

  const handleCreateListSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = newListName.trim();
    if (!name) return;
    setNewListDialogOpen(false);
    const payload = { name, kind: "custom" as const };
    const created = await createTaskList.mutateAsync(payload);
    let currentId = created.id;
    pushUndo({
      description: "יצירת רשימת משימות",
      undo: () => archiveTaskList.mutate(currentId),
      redo: async () => {
        const again = await createTaskList.mutateAsync(payload);
        currentId = again.id;
      },
    });
  };

  /** Move a list one slot in the visible order. The on-screen order is
   *  pinned-first, then sort_order asc — so we operate inside one of
   *  those two groups (a pinned list stays among pinned, an unpinned
   *  one stays among unpinned) and rewrite its sort_order to land
   *  between the new neighbours.
   *
   *  We deliberately work off `visibleLists` (not `lists`) so hidden
   *  lists never interpose: if the user can't see a list, swapping past
   *  it would be a visual no-op and the arrow would feel broken.
   *  (Defined further down, after visibleLists is in scope.) */

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
  // Pass knownListIds so tasks delegated to me from foreign lists fall into unassigned.
  const knownListIds = useMemo(() => new Set(lists.map((l) => l.id)), [lists]);
  // Hide tasks belonging to inactive projects (their lists) from the task list.
  const inactiveListIds = useInactiveProjectListIds();
  const visibleTasks = useMemo(
    () =>
      inactiveListIds.size === 0
        ? tasks
        : tasks.filter((t) => !(t.task_list_id && inactiveListIds.has(t.task_list_id))),
    [tasks, inactiveListIds]
  );
  const { listTrees, counts } = useMemo(
    () => buildTrees(visibleTasks, knownListIds),
    [visibleTasks, knownListIds]
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

  const handleMoveListInOrder = (listId: string, direction: -1 | 1) => {
    const target = visibleLists.find((l) => l.id === listId);
    if (!target) return;
    const peers = visibleLists
      .filter((l) => !!l.is_pinned === !!target.is_pinned)
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = peers.findIndex((l) => l.id === listId);
    if (idx === -1) return;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= peers.length) return;
    const neighbour = peers[swapIdx]!;
    const farther = peers[swapIdx + direction];
    // Compute a sort_order that lands between neighbour and farther.
    // If farther is missing we're at the boundary — bump past neighbour
    // by ±1 (the sort_order column is double-precision).
    let newSortOrder = farther
      ? (neighbour.sort_order + farther.sort_order) / 2
      : direction === -1
      ? neighbour.sort_order - 1
      : neighbour.sort_order + 1;
    // Edge case: if neighbour and farther carry identical sort_order
    // values (legacy data, or two lists created at the same instant), the
    // midpoint equals neighbour.sort_order which equals target.sort_order —
    // the move is silently a no-op. Bump by a small, direction-aware delta
    // so the reorder actually takes effect.
    if (newSortOrder === target.sort_order) {
      newSortOrder = neighbour.sort_order + (direction === -1 ? -0.5 : 0.5);
    }
    const prevSortOrder = target.sort_order;
    reorderLists.mutate([{ id: listId, sort_order: newSortOrder }]);
    pushUndo({
      description: "סידור רשימות",
      undo: () =>
        reorderLists.mutate([{ id: listId, sort_order: prevSortOrder }]),
      redo: () =>
        reorderLists.mutate([{ id: listId, sort_order: newSortOrder }]),
    });
  };

  /**
   * Per-peer-group first/last flags for the reorder arrows. Computed once
   * across visibleLists so each TaskColumn can show its arrows enabled or
   * disabled based on its position WITHIN ITS PEER GROUP (pinned vs
   * unpinned), not across the whole sidebar — otherwise an unpinned list
   * at the very top of the unpinned group would still see "up" enabled
   * (because pinned lists sit above it), but the click would be a no-op.
   */
  const listEdgeFlags = useMemo(() => {
    const out = new Map<string, { isFirst: boolean; isLast: boolean }>();
    const groups: Record<"pinned" | "unpinned", typeof visibleLists> = {
      pinned: [],
      unpinned: [],
    };
    for (const l of visibleLists) {
      (l.is_pinned ? groups.pinned : groups.unpinned).push(l);
    }
    for (const group of [groups.pinned, groups.unpinned]) {
      group.forEach((l, i) => {
        out.set(l.id, { isFirst: i === 0, isLast: i === group.length - 1 });
      });
    }
    return out;
  }, [visibleLists]);

  // Flatten visible trees into an ordered list of task ids — used by the
  // multi-select store to resolve Shift+click range selection across rows.
  // Unassigned first, then visible lists in their visual order; each list is
  // depth-first (children right after their parent).
  const orderedTaskIds = useMemo(() => {
    const out: string[] = [];
    const flatten = (nodes: TaskTreeNode[]) => {
      for (const n of nodes) {
        out.push(n.task.id);
        if (n.children.length > 0) flatten(n.children);
      }
    };
    flatten(listTrees.get("__unassigned__") ?? []);
    for (const list of visibleLists) {
      flatten(listTrees.get(list.id) ?? []);
    }
    return out;
  }, [listTrees, visibleLists]);

  useEffect(() => {
    useTaskSelectionStore.getState().setOrderedIds(orderedTaskIds);
  }, [orderedTaskIds]);

  // Esc clears selection — common keyboard convention. Anywhere in the screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") useTaskSelectionStore.getState().clear();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Ctrl+N from AppShell opens create-task modal when on this screen.
  useEffect(() => {
    const handler = () => setCreateDraft({});
    window.addEventListener("app:new-task", handler);
    return () => window.removeEventListener("app:new-task", handler);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } })
  );

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
    },
    {
      key: "dueAfter",
      type: "date-range",
      label: "תאריך יעד",
      fromKey: "dueAfter",
      toKey: "dueBefore",
    },
  ];

  /** All descendants (children + grandchildren + …) of `rootId`, computed
   *  from the current `tasks` slice. Used so that when a parent task is
   *  dragged into a different list, its whole subtree follows. The parent
   *  link itself is preserved — only `task_list_id` cascades. */
  const collectDescendants = (rootId: string): string[] => {
    const out: string[] = [];
    const queue: string[] = [rootId];
    while (queue.length > 0) {
      const pid = queue.shift()!;
      for (const t of tasks) {
        if (t.parent_task_id === pid) {
          out.push(t.id);
          queue.push(t.id);
        }
      }
    }
    return out;
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const activeData = active.data.current as
      | { type: "task"; taskId: string; listId: string | null; parentTaskId: string | null }
      | undefined;
    const overData = over.data.current as
      | { type: "list"; listId: string | null }
      | { type: "task-nest"; taskId: string; listId: string | null }
      | {
          type: "task-before" | "task-after";
          taskId: string;
          listId: string | null;
          parentTaskId: string | null;
        }
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
      // When the list changes, the whole subtree must follow — otherwise
      // children stay orphaned in the old list and disappear from view.
      const descendantIds =
        prevListId !== nextListId ? collectDescendants(activeData.taskId) : [];
      // Apply
      setParent.mutate({ taskId: activeData.taskId, parentId: null });
      if (prevListId !== nextListId) {
        moveToList.mutate({ taskId: activeData.taskId, listId: nextListId });
        for (const did of descendantIds) {
          moveToList.mutate({ taskId: did, listId: nextListId });
        }
      }
      pushUndo({
        description: "העברת משימה בין רשימות",
        undo: () => {
          setParent.mutate({ taskId: activeData.taskId, parentId: prevParentId });
          if (prevListId !== nextListId) {
            moveToList.mutate({ taskId: activeData.taskId, listId: prevListId });
            for (const did of descendantIds) {
              moveToList.mutate({ taskId: did, listId: prevListId });
            }
          }
        },
        redo: () => {
          setParent.mutate({ taskId: activeData.taskId, parentId: null });
          if (prevListId !== nextListId) {
            moveToList.mutate({ taskId: activeData.taskId, listId: nextListId });
            for (const did of descendantIds) {
              moveToList.mutate({ taskId: did, listId: nextListId });
            }
          }
        },
      });
      return;
    }

    if (overData.type === "task-nest") {
      // Don't allow dropping a task on itself.
      if (overData.taskId === activeData.taskId) return;
      // Don't allow dropping a task on one of its own descendants.
      if (isDescendant(tasks, overData.taskId, activeData.taskId)) return;
      const prevListId = activeData.listId;
      const prevParentId = activeData.parentTaskId;
      const nextListId = overData.listId;
      const nextParentId = overData.taskId;
      // No-op: already a child of this parent in this list.
      if (prevParentId === nextParentId && prevListId === nextListId) return;
      const descendantIds =
        prevListId !== nextListId ? collectDescendants(activeData.taskId) : [];
      setParent.mutate({ taskId: activeData.taskId, parentId: nextParentId });
      if (prevListId !== nextListId) {
        moveToList.mutate({ taskId: activeData.taskId, listId: nextListId });
        for (const did of descendantIds) {
          moveToList.mutate({ taskId: did, listId: nextListId });
        }
      }
      pushUndo({
        description: "הפיכת משימה לתת-משימה",
        undo: () => {
          setParent.mutate({ taskId: activeData.taskId, parentId: prevParentId });
          if (prevListId !== nextListId) {
            moveToList.mutate({ taskId: activeData.taskId, listId: prevListId });
            for (const did of descendantIds) {
              moveToList.mutate({ taskId: did, listId: prevListId });
            }
          }
        },
        redo: () => {
          setParent.mutate({ taskId: activeData.taskId, parentId: nextParentId });
          if (prevListId !== nextListId) {
            moveToList.mutate({ taskId: activeData.taskId, listId: nextListId });
            for (const did of descendantIds) {
              moveToList.mutate({ taskId: did, listId: nextListId });
            }
          }
        },
      });
      return;
    }

    if (overData.type === "task-before" || overData.type === "task-after") {
      // Reorder as sibling — same list + same parent as the target row.
      if (overData.taskId === activeData.taskId) return;
      if (isDescendant(tasks, overData.taskId, activeData.taskId)) return;

      const targetTask = tasks.find((t) => t.id === overData.taskId);
      if (!targetTask) return;

      // Siblings in the destination scope, ordered by sort_order.
      const siblings = tasks
        .filter(
          (t) =>
            t.task_list_id === overData.listId &&
            (t.parent_task_id ?? null) === (overData.parentTaskId ?? null) &&
            t.id !== activeData.taskId
        )
        .sort((a, b) => a.sort_order - b.sort_order);
      const targetIdx = siblings.findIndex((s) => s.id === overData.taskId);
      if (targetIdx === -1) return;

      let newSortOrder: number;
      if (overData.type === "task-before") {
        const prevSibling = siblings[targetIdx - 1];
        newSortOrder = prevSibling
          ? (prevSibling.sort_order + targetTask.sort_order) / 2
          : targetTask.sort_order - 1;
      } else {
        const nextSibling = siblings[targetIdx + 1];
        newSortOrder = nextSibling
          ? (targetTask.sort_order + nextSibling.sort_order) / 2
          : targetTask.sort_order + 1;
      }

      const prevListId = activeData.listId;
      const prevParentId = activeData.parentTaskId;
      const nextListId = overData.listId;
      const nextParentId = overData.parentTaskId;

      // Cross-scope move + reorder. Same-scope no-op handled by the active
      // task being filtered out of `siblings` above, but we still re-rank.
      const activeTask = tasks.find((t) => t.id === activeData.taskId);
      const prevSortOrder = activeTask?.sort_order ?? 0;
      const descendantIds =
        prevListId !== nextListId ? collectDescendants(activeData.taskId) : [];

      if (prevParentId !== nextParentId) {
        setParent.mutate({ taskId: activeData.taskId, parentId: nextParentId });
      }
      if (prevListId !== nextListId) {
        moveToList.mutate({ taskId: activeData.taskId, listId: nextListId });
        for (const did of descendantIds) {
          moveToList.mutate({ taskId: did, listId: nextListId });
        }
      }
      reorderTasks.mutate([
        { id: activeData.taskId, sort_order: newSortOrder },
      ]);

      pushUndo({
        description: "סידור מחדש",
        undo: () => {
          if (prevParentId !== nextParentId) {
            setParent.mutate({ taskId: activeData.taskId, parentId: prevParentId });
          }
          if (prevListId !== nextListId) {
            moveToList.mutate({ taskId: activeData.taskId, listId: prevListId });
            for (const did of descendantIds) {
              moveToList.mutate({ taskId: did, listId: prevListId });
            }
          }
          reorderTasks.mutate([
            { id: activeData.taskId, sort_order: prevSortOrder },
          ]);
        },
        redo: () => {
          if (prevParentId !== nextParentId) {
            setParent.mutate({ taskId: activeData.taskId, parentId: nextParentId });
          }
          if (prevListId !== nextListId) {
            moveToList.mutate({ taskId: activeData.taskId, listId: nextListId });
            for (const did of descendantIds) {
              moveToList.mutate({ taskId: did, listId: nextListId });
            }
          }
          reorderTasks.mutate([
            { id: activeData.taskId, sort_order: newSortOrder },
          ]);
        },
      });
      return;
    }
  };

  return (
    <ScreenScaffold
      title="משימות"
      subtitle="רשימות עמודה-עמודה, עץ היררכי מלא, סטופר, גרירה בין רשימות."
      icon={<CheckSquare className="w-5 h-5" />}
      chromeCollapsible
      chromeOpen={chromeOpen}
      onToggleChrome={() => setChromeOpen((v) => !v)}
      chromeIndicator={filtersActiveCount > 0 || hiddenSet.size > 0}
      mobileExtra={
        <button
          type="button"
          onClick={() => setUnassignedOpen((v) => !v)}
          aria-pressed={unassignedOpen}
          title="לא משויכות"
          className={cn(
            "inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium",
            unassignedOpen
              ? "bg-primary-100 text-primary-700"
              : "bg-ink-100 text-ink-700 hover:bg-ink-200"
          )}
        >
          <Inbox className="w-4 h-4" />
          <span className="tabular-nums">{counts.get("__unassigned__") ?? 0}</span>
        </button>
      }
      actions={
        <div className="relative">
          <button
            onClick={() => setPageMenuOpen((v) => !v)}
            className="btn-outline text-sm"
            type="button"
            title="הגדרות הדף"
          >
            <SettingsIcon className="w-4 h-4" />
            <span className="hidden sm:inline">הגדרות הדף</span>
          </button>
          {pageMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setPageMenuOpen(false)}
              />
              <div className="absolute end-0 mt-1 w-64 bg-white border border-ink-200 rounded-xl shadow-lift z-50 py-1 text-sm">
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
                <div className="h-px bg-ink-100 mx-2" />
                <button
                  type="button"
                  onClick={() => {
                    setImportOpen(true);
                    setPageMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-ink-700 hover:bg-ink-100 text-start"
                >
                  <Upload className="w-4 h-4" />
                  ייבוא משימות
                </button>
              </div>
            </>
          )}
        </div>
      }
    >
      <div className="space-y-2">
        <DndContext
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragEnd={handleDragEnd}
        >
          {layout === "stack" ? (
            // Stack layout: toolbar + filters + stats + Unassigned are all
            // glued to the top of the viewport so the user can scroll just
            // the lists below them. Drag-and-drop still works because the
            // DndContext wraps both the sticky header and the scrolling body.
            <>
              <div className="md:sticky md:top-0 z-30 bg-ink-50 -mx-1 px-1 pt-1 pb-2 space-y-2">
                <div className={cn("space-y-2", chromeOpen ? "block" : "hidden md:block")}>
                <TasksChrome
                  lists={lists.map((l) => ({
                    id: l.id,
                    name: l.name,
                    emoji: l.emoji,
                    color: l.color,
                    is_pinned: !!l.is_pinned,
                    sort_order: l.sort_order,
                  }))}
                  hiddenListIds={hiddenSet}
                  onToggleListVisibility={toggleListVisibility}
                  onCreateList={handleCreateList}
                  onMoveListInOrder={handleMoveListInOrder}
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
                </div>
                <UnassignedBanner
                  open={unassignedOpen}
                  onToggle={() => setUnassignedOpen((v) => !v)}
                  roots={listTrees.get("__unassigned__") ?? []}
                  totalCount={counts.get("__unassigned__") ?? 0}
                  display={rowDisplayPrefs}
                  onOpenEdit={setEditingTaskId}
                  fullWidth
                />
              </div>
              <div className="flex flex-col gap-3">
                {visibleLists.map((list) => (
                  <TaskColumn
                    key={list.id}
                    list={list}
                    roots={listTrees.get(list.id) ?? []}
                    totalCount={counts.get(list.id) ?? 0}
                    divisor={1}
                    display={rowDisplayPrefs}
                    onOpenEdit={setEditingTaskId}
                    onHide={() => toggleListVisibility(list.id)}
                    onMoveInOrder={(dir) => handleMoveListInOrder(list.id, dir)}
                    isFirst={listEdgeFlags.get(list.id)?.isFirst ?? true}
                    isLast={listEdgeFlags.get(list.id)?.isLast ?? true}
                    layout="stack"
                  />
                ))}
                {visibleLists.length === 0 && <EmptyListsHint lists={lists} />}
              </div>
            </>
          ) : (
            // Columns (kanban) layout — the original Phase 3 layout.
            // On mobile: stack vertically. On md+: side-by-side with
            // Unassigned on the leading (right in RTL) edge.
            <>
              <div className={cn("space-y-2", chromeOpen ? "block" : "hidden md:block")}>
              <TasksChrome
                lists={lists.map((l) => ({
                  id: l.id,
                  name: l.name,
                  emoji: l.emoji,
                  color: l.color,
                  is_pinned: !!l.is_pinned,
                  sort_order: l.sort_order,
                }))}
                hiddenListIds={hiddenSet}
                onToggleListVisibility={toggleListVisibility}
                onCreateList={handleCreateList}
                onMoveListInOrder={handleMoveListInOrder}
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
              </div>
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
                        onHide={() => toggleListVisibility(list.id)}
                        onMoveInOrder={(dir) =>
                          handleMoveListInOrder(list.id, dir)
                        }
                        isFirst={listEdgeFlags.get(list.id)?.isFirst ?? true}
                        isLast={listEdgeFlags.get(list.id)?.isLast ?? true}
                        layout="columns"
                      />
                    ))}
                    {visibleLists.length === 0 && (
                      <EmptyListsHint lists={lists} />
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DndContext>
      </div>

      <TaskEditModal
        taskId={editingTaskId}
        createDraft={createDraft}
        onClose={() => { setEditingTaskId(null); setCreateDraft(null); }}
        assigneeView={(() => {
          if (!editingTaskId || !userId) return false;
          const t = tasks.find((x) => x.id === editingTaskId);
          return !!t && t.assignee_user_id === userId && t.owner_id !== userId;
        })()}
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

      {importOpen && <ImportTasksModal onClose={() => setImportOpen(false)} />}

      <BulkActionsToolbar allTasks={tasks} />

      {newListDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40" onClick={() => setNewListDialogOpen(false)}>
          <form
            className="bg-white rounded-2xl shadow-lift p-6 w-80 max-w-[calc(100vw-1.5rem)] flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateListSubmit}
          >
            <h2 className="text-sm font-semibold text-ink-900">רשימה חדשה</h2>
            <input
              autoFocus
              type="text"
              className="input text-sm"
              placeholder="שם הרשימה"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost text-sm" onClick={() => setNewListDialogOpen(false)}>ביטול</button>
              <button type="submit" className="btn-dark text-sm" disabled={!newListName.trim()}>יצירה</button>
            </div>
          </form>
        </div>
      )}
    </ScreenScaffold>
  );
}

function EmptyListsHint({ lists }: { lists: TaskList[] }) {
  if (lists.length === 0) {
    return (
      <div className="card p-6 flex-1 min-w-[280px] text-center">
        <p className="text-sm text-ink-600">
          עוד אין רשימות. צור רשימה ראשונה בבאנר שלמעלה, או גרור משימות לתוך "לא משויכות".
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

function buildTrees(tasks: Task[], knownListIds?: Set<string>): BuildResult {
  // Group by list. Tasks delegated to me from an unknown list → unassigned.
  const byList = new Map<string, Task[]>();
  for (const t of tasks) {
    const listId = t.task_list_id;
    const key =
      listId && knownListIds && !knownListIds.has(listId)
        ? UNASSIGNED_KEY
        : (listId ?? UNASSIGNED_KEY);
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

    const build = (pid: string | null, depth: number, visitedIds = new Set<string>()): TaskTreeNode[] =>
      (childrenOf.get(pid) ?? [])
        .filter((t) => !visitedIds.has(t.id))
        .map((t) => ({
          task: t,
          children: build(t.id, depth + 1, new Set([...visitedIds, t.id])),
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
