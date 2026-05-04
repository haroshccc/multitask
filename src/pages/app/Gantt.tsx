import { useMemo, useState, useEffect } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import {
  FilterBar,
  useFiltersFromUrl,
  type FilterField,
} from "@/components/filters/FilterBar";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";
import { BulkActionsToolbar } from "@/components/tasks/BulkActionsToolbar";
import { EventEditModal } from "@/components/calendar/EventEditModal";
import { GanttChrome } from "@/components/gantt/GanttChrome";
import { GanttGrid } from "@/components/gantt/GanttGrid";
import { GanttTable } from "@/components/gantt/GanttTable";
import {
  type GanttLayer,
  type GanttRow,
  type GanttZoom,
  addDays,
  buildRows,
  computeCriticalPath,
  defaultSpanDays,
  startOfDay,
} from "@/components/gantt/gantt-utils";
import {
  useAllTaskDependencies,
  useArchiveProject,
  useCreateProject,
  useCreateTask,
  useCreateTaskList,
  useEvents,
  useListVisibility,
  useMoveTaskToList,
  useProjects,
  useReorderTasks,
  useSetListVisibility,
  useSetTaskParent,
  useTaskLists,
  useTasks,
  useUpdateEvent,
  useUpdateTask,
  useUpdateTaskList,
} from "@/lib/hooks";
import { useProjectCustomFields } from "@/lib/hooks/useTaskCustomFields";
import type { GanttSource } from "@/components/gantt/GanttChrome";
import { useTaskSelectionStore } from "@/lib/selection/store";
import { pushUndo } from "@/lib/undo/store";

export function Gantt() {
  const [zoom, setZoom] = useState<GanttZoom>("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [layer, setLayer] = useState<GanttLayer>("both");
  const [filtersOpen, setFiltersOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("multitask.gantt.filtersOpen") === "true";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("multitask.gantt.filtersOpen", String(filtersOpen));
  }, [filtersOpen]);

  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("multitask.gantt.sidebarCollapsed") === "true";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      "multitask.gantt.sidebarCollapsed",
      String(sidebarCollapsed)
    );
  }, [sidebarCollapsed]);

  /** Editable-table layout: "side" = table 1/3 + Gantt 2/3 next to each
   *  other (RTL flow puts table on the right, Gantt on the left).
   *  "stacked" = table full width on top, Gantt full width below. The
   *  user picks per their workflow; persisted in localStorage. */
  const [tableLayout, setTableLayout] = useState<"side" | "stacked">(() => {
    if (typeof window === "undefined") return "side";
    const raw = localStorage.getItem("multitask.gantt.tableLayout");
    return raw === "stacked" ? "stacked" : "side";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("multitask.gantt.tableLayout", tableLayout);
  }, [tableLayout]);

  const [filters, setFilters] = useFiltersFromUrl();
  const { data: tasks = [] } = useTasks(filters);
  const { data: deps = [] } = useAllTaskDependencies();
  const { data: lists = [] } = useTaskLists();
  const { data: projects = [] } = useProjects();
  const { data: visibility } = useListVisibility("gantt");
  const setListVisibility = useSetListVisibility();
  const createTaskList = useCreateTaskList();
  const hiddenLists = useMemo(
    () => new Set(visibility?.hidden_list_ids ?? []),
    [visibility]
  );

  /** Single-selection scope for the Gantt — "all", or one specific list,
   *  or one specific project. When narrowed, the multi-list visibility
   *  toggles below are bypassed; we just show that one workstream. */
  const [source, setSource] = useState<GanttSource>(() => {
    if (typeof window === "undefined") return { kind: "all" };
    try {
      const raw = localStorage.getItem("multitask.gantt.source");
      if (!raw) return { kind: "all" };
      const parsed = JSON.parse(raw) as GanttSource;
      if (
        parsed.kind === "all" ||
        ((parsed.kind === "list" || parsed.kind === "project") &&
          typeof parsed.id === "string")
      ) {
        return parsed;
      }
      return { kind: "all" };
    } catch {
      return { kind: "all" };
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("multitask.gantt.source", JSON.stringify(source));
  }, [source]);

  const updateTask = useUpdateTask();
  const updateEvent = useUpdateEvent();
  const createProject = useCreateProject();
  const updateTaskList = useUpdateTaskList();
  const createTask = useCreateTask();
  const archiveProject = useArchiveProject();
  const moveTaskToList = useMoveTaskToList();
  const setTaskParent = useSetTaskParent();
  const reorderTasks = useReorderTasks();

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  // Fetch custom fields for the currently-scoped project (null when "all" or
  // "list" scope — custom fields are per-project).
  const scopedProjectId = source.kind === "project" ? source.id : null;
  const { data: customFields = [] } = useProjectCustomFields(scopedProjectId);

  const windowStart = useMemo(() => {
    const span = defaultSpanDays(zoom);
    return addDays(startOfDay(anchor), -Math.floor(span / 3));
  }, [anchor, zoom]);
  const windowEnd = useMemo(
    () => addDays(windowStart, defaultSpanDays(zoom)),
    [windowStart, zoom]
  );

  // Fetch events in the visible window so the "events" layer has data.
  const { data: events = [] } = useEvents({
    from: windowStart.toISOString(),
    to: windowEnd.toISOString(),
  });

  /** When a specific source is picked we bypass the visibility toggles —
   *  the user explicitly asked for one scope, so we don't need a second
   *  layer of filtering on top. The multi-toggle popover stays available
   *  and applies again when source.kind === "all". */
  const projectListIds = useMemo(() => {
    if (source.kind !== "project") return null;
    return new Set(
      lists.filter((l) => l.project_id === source.id).map((l) => l.id)
    );
  }, [lists, source]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (source.kind === "list") {
        return t.task_list_id === source.id;
      }
      if (source.kind === "project") {
        return !!t.task_list_id && !!projectListIds?.has(t.task_list_id);
      }
      // source.kind === "all" — fall back to the per-list hide toggles.
      if (t.task_list_id && hiddenLists.has(t.task_list_id)) return false;
      return true;
    });
  }, [tasks, hiddenLists, source, projectListIds]);

  /** When the user scopes the Gantt to a specific list/project, drop events
   *  too — the user is looking at one workstream's tasks; orphan events
   *  from other calendars just create noise. Events come back when the
   *  scope is "all". */
  const filteredEvents = useMemo(() => {
    if (source.kind === "all") return events;
    return [];
  }, [events, source.kind]);

  const rows = useMemo(
    () => buildRows(filteredTasks, filteredEvents, layer, lists),
    [filteredTasks, filteredEvents, layer, lists]
  );

  const criticalSet = useMemo(
    () => computeCriticalPath(rows, deps),
    [rows, deps]
  );

  const visibleRows = useMemo(() => {
    if (!showCriticalOnly) return rows;
    return rows.filter((r) =>
      r.kind === "task" && r.task ? criticalSet.has(r.task.id) : false
    );
  }, [rows, showCriticalOnly, criticalSet]);

  // Publish the visible task ids into the shared selection store so the
  // BulkActionsToolbar's Shift+click range select resolves correctly.
  const orderedTaskIds = useMemo(
    () =>
      visibleRows
        .filter((r) => r.kind === "task" && r.task)
        .map((r) => r.task!.id),
    [visibleRows]
  );
  useEffect(() => {
    useTaskSelectionStore.getState().setOrderedIds(orderedTaskIds);
  }, [orderedTaskIds]);

  // Clear the selection when leaving / scope-switching so a stale set
  // doesn't haunt the next view.
  useEffect(() => {
    return () => {
      useTaskSelectionStore.getState().clear();
    };
  }, []);

  const fields: FilterField[] = useMemo(
    () => [
      {
        key: "lists",
        type: "multi-enum",
        label: "רשימה",
        options: lists.map((l) => ({
          value: l.id,
          label: l.name,
        })),
      },
      {
        key: "statuses",
        type: "multi-enum",
        label: "סטטוס",
        options: [
          { value: "todo", label: "לעשות" },
          { value: "in_progress", label: "בעבודה" },
          { value: "pending_approval", label: "ממתין לאישור" },
          { value: "done", label: "בוצע" },
        ],
      },
      { key: "tags", type: "multi-text", label: "תגים" },
    ],
    [lists]
  );

  const filtersActiveCount = useMemo(() => {
    let n = 0;
    Object.values(filters).forEach((v) => {
      if (Array.isArray(v)) n += v.length;
      else if (v !== undefined && v !== null && v !== "" && v !== false) n += 1;
    });
    return n;
  }, [filters]);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  /** Same picker pattern as Calendar: clicking an empty timeline area
   *  opens the create modal with an event/task toggle at the top. */
  const [creating, setCreating] = useState<{
    start: Date;
    end: Date;
    kind: "event" | "task";
  } | null>(null);

  const handleGanttCreateAt = (start: Date) => {
    const end = new Date(start.getTime() + 60 * 60_000);
    setCreating({ start, end, kind: "event" });
  };

  const handleRowClick = (row: GanttRow) => {
    if (row.kind === "event" && row.event) {
      setEditingEventId(row.event.id);
    } else if (row.kind === "task" && row.task) {
      setEditingTaskId(row.task.id);
    }
  };

  const handleBarChange = (
    row: GanttRow,
    patch: { scheduled_at: string; duration_minutes: number }
  ) => {
    if (row.kind === "task" && row.task) {
      updateTask.mutate({ taskId: row.task.id, patch });
    } else if (row.kind === "event" && row.event) {
      // For events, translate duration_minutes back to an ends_at.
      const startsAt = patch.scheduled_at;
      const endsAt = new Date(
        new Date(startsAt).getTime() + patch.duration_minutes * 60_000
      ).toISOString();
      updateEvent.mutate({
        eventId: row.event.id,
        patch: { starts_at: startsAt, ends_at: endsAt },
      });
    }
  };

  const handleScheduleTask = (row: GanttRow, date: Date) => {
    if (row.kind === "task" && row.task) {
      const scheduled_at = date.toISOString();
      pushUndo({ type: "task", id: row.task.id, prev: row.task });
      updateTask.mutate({ taskId: row.task.id, patch: { scheduled_at } });
    }
  };

  const toggleListVisibility = (listId: string) => {
    const current = visibility?.hidden_list_ids ?? [];
    const next = current.includes(listId)
      ? current.filter((id) => id !== listId)
      : [...current, listId];
    setListVisibility.mutate({ screenKey: "gantt", hiddenListIds: next });
  };

  const handleCreateList = async () => {
    const name = window.prompt("שם הרשימה החדשה:");
    if (!name?.trim()) return;
    await createTaskList.mutateAsync({ name: name.trim(), kind: "custom" });
  };

  /** Create a brand-new empty list and immediately scope the Gantt to it
   *  (so the user lands in the empty table ready to add tasks). */
  const handleCreateNewList = async () => {
    const name = window.prompt("שם הרשימה החדשה:");
    if (!name?.trim()) return;
    const list = await createTaskList.mutateAsync({
      name: name.trim(),
      kind: "custom",
    });
    setSource({ kind: "list", id: list.id });
  };

  /** Create a new project plus its initial task list (since tasks live on
   *  lists, not directly on projects). The Gantt scopes to the new project
   *  so the user sees the empty container ready for tasks. */
  const handleCreateNewProject = async () => {
    const name = window.prompt("שם הפרויקט החדש:");
    if (!name?.trim()) return;
    const project = await createProject.mutateAsync({ name: name.trim() });
    // Seed with a default task list so newly-created tasks have a home.
    await createTaskList.mutateAsync({
      name: name.trim(),
      kind: "custom",
      project_id: project.id,
    });
    setSource({ kind: "project", id: project.id });
  };

  /** Move a task one slot earlier (-1) or later (+1) among its siblings.
   *  Same midpoint sort_order math as the Tasks screen — find peers in
   *  the same `parent_task_id` + `task_list_id` scope, take a midpoint
   *  between the new neighbours. Wrapped in pushUndo. */
  const handleMoveTaskInOrder = (taskId: string, direction: -1 | 1) => {
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return;
    const peers = tasks
      .filter(
        (t) =>
          (t.parent_task_id ?? null) === (target.parent_task_id ?? null) &&
          t.task_list_id === target.task_list_id
      )
      .sort((a, b) => a.sort_order - b.sort_order);
    const idx = peers.findIndex((t) => t.id === taskId);
    if (idx === -1) return;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= peers.length) return;
    const neighbour = peers[swapIdx]!;
    const farther = peers[swapIdx + direction];
    let newSortOrder = farther
      ? (neighbour.sort_order + farther.sort_order) / 2
      : direction === -1
      ? neighbour.sort_order - 1
      : neighbour.sort_order + 1;
    if (newSortOrder === target.sort_order) {
      newSortOrder = neighbour.sort_order + (direction === -1 ? -0.5 : 0.5);
    }
    const prev = target.sort_order;
    reorderTasks.mutate([{ id: taskId, sort_order: newSortOrder }]);
    pushUndo({
      description: "סידור מחדש",
      undo: () => reorderTasks.mutate([{ id: taskId, sort_order: prev }]),
      redo: () => reorderTasks.mutate([{ id: taskId, sort_order: newSortOrder }]),
    });
  };

  /** Inline-create a task within the current scope. For a list scope the
   *  task lands in that list. For a project scope it lands in the
   *  project's first list (creating one if the project somehow has none).
   *  No-op for "all" — the source picker doesn't expose this affordance
   *  in that mode anyway. */
  const handleCreateTaskInScope = async (title: string) => {
    if (source.kind === "list") {
      await createTask.mutateAsync({
        title,
        task_list_id: source.id,
        parent_task_id: null,
        status: "todo",
        urgency: 0,
      });
      return;
    }
    if (source.kind === "project") {
      // Find the first list of this project; create one if missing.
      let targetList = lists.find((l) => l.project_id === source.id);
      if (!targetList) {
        const proj = projects.find((p) => p.id === source.id);
        targetList = await createTaskList.mutateAsync({
          name: proj?.name ?? "רשימה חדשה",
          kind: "custom",
          project_id: source.id,
        });
      }
      await createTask.mutateAsync({
        title,
        task_list_id: targetList.id,
        parent_task_id: null,
        status: "todo",
        urgency: 0,
      });
    }
  };

  /** Demote the currently-selected project to a single list: archives
   *  the project, and:
   *    - 1 list → just clears its `project_id` and switches scope to it
   *    - N lists → creates a new merged list, moves every task into it,
   *      switches scope. The original lists become orphans (still
   *      accessible via the lists table) but the project goes to archive.
   *  Either way the user keeps every task. Confirms before mutating
   *  because archiving a project is hard to recover from inside the UI. */
  const handleConvertProjectToList = async () => {
    if (source.kind !== "project") return;
    const project = projects.find((p) => p.id === source.id);
    if (!project) return;
    const projectLists = lists.filter((l) => l.project_id === source.id);

    if (projectLists.length === 0) {
      if (
        !window.confirm(
          `הפרויקט "${project.name}" ריק. להעבירו לארכיון?`
        )
      ) {
        return;
      }
      await archiveProject.mutateAsync(source.id);
      setSource({ kind: "all" });
      return;
    }

    if (projectLists.length === 1) {
      const list = projectLists[0]!;
      if (
        !window.confirm(
          `להפוך את הפרויקט "${project.name}" לרשימה? הפרויקט יועבר לארכיון; הרשימה והמשימות יישארו.`
        )
      ) {
        return;
      }
      await updateTaskList.mutateAsync({
        listId: list.id,
        patch: { project_id: null },
      });
      await archiveProject.mutateAsync(source.id);
      setSource({ kind: "list", id: list.id });
      return;
    }

    // Multiple lists — needs a confirmation that's explicit about the merge.
    if (
      !window.confirm(
        `הפרויקט "${project.name}" מכיל ${projectLists.length} רשימות. ` +
          `כל המשימות יועברו לרשימה חדשה אחת בשם הפרויקט; הפרויקט יועבר לארכיון. להמשיך?`
      )
    ) {
      return;
    }
    const newList = await createTaskList.mutateAsync({
      name: project.name,
      kind: "custom",
      color: project.color,
      emoji: project.emoji,
    });
    // Move every task currently scoped to this project.
    const tasksToMove = tasks.filter(
      (t) =>
        !!t.task_list_id &&
        projectLists.some((l) => l.id === t.task_list_id)
    );
    for (const t of tasksToMove) {
      await moveTaskToList.mutateAsync({
        taskId: t.id,
        listId: newList.id,
      });
    }
    await archiveProject.mutateAsync(source.id);
    setSource({ kind: "list", id: newList.id });
  };

  /** Promote the currently-selected list into a project: create a new
   *  project, attach the list to it via project_id, then re-scope the
   *  Gantt to the project so the user sees the same tasks but now under
   *  a project header. The list is preserved (no data loss). */
  const handleConvertListToProject = async () => {
    if (source.kind !== "list") return;
    const list = lists.find((l) => l.id === source.id);
    if (!list) return;
    if (
      !window.confirm(
        `להפוך את הרשימה "${list.name}" לפרויקט?\nכל המשימות יישארו במקומן.`
      )
    ) {
      return;
    }
    const project = await createProject.mutateAsync({
      name: list.name,
      color: list.color,
      emoji: list.emoji,
    });
    await updateTaskList.mutateAsync({
      listId: list.id,
      patch: { project_id: project.id },
    });
    setSource({ kind: "project", id: project.id });
  };

  /** Prevent dropping a task onto one of its own descendants (cycle guard). */
  const isGanttDescendant = (
    taskId: string,
    potentialAncestorId: string
  ): boolean => {
    let current: string | null = taskId;
    const visited = new Set<string>();
    while (current) {
      if (visited.has(current)) break;
      visited.add(current);
      if (current === potentialAncestorId) return true;
      const t = tasks.find((x) => x.id === current);
      current = t?.parent_task_id ?? null;
    }
    return false;
  };

  /**
   * Handle drag-end from the GanttTable rows. Three cases:
   *   gantt-task-before → place dragged as sibling BEFORE target
   *   gantt-task-nest   → make dragged a child of target
   *   gantt-task-after  → place dragged as sibling AFTER target
   */
  const handleGanttDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;

    type ActiveData = {
      type: "gantt-task";
      taskId: string;
      listId: string | null;
      parentTaskId: string | null;
    };
    type OverData =
      | {
          type: "gantt-task-nest";
          taskId: string;
          listId: string | null;
        }
      | {
          type: "gantt-task-before" | "gantt-task-after";
          taskId: string;
          listId: string | null;
          parentTaskId: string | null;
        };

    const activeData = active.data.current as ActiveData | undefined;
    const overData = over.data.current as OverData | undefined;
    if (!activeData || !overData) return;
    if (activeData.type !== "gantt-task") return;
    if (!activeData.taskId || !overData.taskId) return;
    if (activeData.taskId === overData.taskId) return;

    if (overData.type === "gantt-task-nest") {
      // Drop-onto: make the active task a child of the target.
      if (isGanttDescendant(overData.taskId, activeData.taskId)) return;
      const prevParent = activeData.parentTaskId;
      const prevListId = activeData.listId;
      const nextListId = overData.listId;
      setTaskParent.mutate({ taskId: activeData.taskId, parentId: overData.taskId });
      if (prevListId !== nextListId && nextListId) {
        moveTaskToList.mutate({ taskId: activeData.taskId, listId: nextListId });
      }
      pushUndo({
        description: "קינון משימה",
        undo: () => {
          setTaskParent.mutate({ taskId: activeData.taskId, parentId: prevParent });
          if (prevListId !== nextListId && prevListId !== undefined) {
            moveTaskToList.mutate({ taskId: activeData.taskId, listId: prevListId });
          }
        },
        redo: () => {
          setTaskParent.mutate({ taskId: activeData.taskId, parentId: overData.taskId });
          if (prevListId !== nextListId && nextListId) {
            moveTaskToList.mutate({ taskId: activeData.taskId, listId: nextListId });
          }
        },
      });
      return;
    }

    // before / after: place as sibling of the target
    if (
      overData.type === "gantt-task-before" ||
      overData.type === "gantt-task-after"
    ) {
      const targetTask = tasks.find((t) => t.id === overData.taskId);
      if (!targetTask) return;

      const nextParentId = targetTask.parent_task_id ?? null;
      const nextListId = targetTask.task_list_id;
      const prevParentId = activeData.parentTaskId;
      const prevListId = activeData.listId;
      const direction = overData.type === "gantt-task-before" ? -1 : 1;

      // Find sibling peers of the target in its scope.
      const peers = tasks
        .filter(
          (t) =>
            (t.parent_task_id ?? null) === nextParentId &&
            t.task_list_id === nextListId
        )
        .sort((a, b) => a.sort_order - b.sort_order);

      const targetIdx = peers.findIndex((t) => t.id === targetTask.id);
      if (targetIdx === -1) return;

      // Neighbour is the task on the far side of the target in the drop direction.
      const farIdx = targetIdx + direction;
      const far = peers[farIdx];
      let newSortOrder: number;
      if (direction === -1) {
        // before target: land between [far-before-target] and [target]
        const farBefore = peers[targetIdx - 1];
        newSortOrder = farBefore
          ? (farBefore.sort_order + targetTask.sort_order) / 2
          : targetTask.sort_order - 1;
      } else {
        // after target: land between [target] and [far-after-target]
        newSortOrder = far
          ? (targetTask.sort_order + far.sort_order) / 2
          : targetTask.sort_order + 1;
      }

      const prevSortOrder =
        tasks.find((t) => t.id === activeData.taskId)?.sort_order ?? 0;

      setTaskParent.mutate({ taskId: activeData.taskId, parentId: nextParentId });
      if (prevListId !== nextListId) {
        moveTaskToList.mutate({ taskId: activeData.taskId, listId: nextListId });
      }
      reorderTasks.mutate([{ id: activeData.taskId, sort_order: newSortOrder }]);

      pushUndo({
        description: "סידור משימה",
        undo: () => {
          setTaskParent.mutate({ taskId: activeData.taskId, parentId: prevParentId });
          if (prevListId !== nextListId && prevListId !== undefined) {
            moveTaskToList.mutate({ taskId: activeData.taskId, listId: prevListId });
          }
          reorderTasks.mutate([{ id: activeData.taskId, sort_order: prevSortOrder }]);
        },
        redo: () => {
          setTaskParent.mutate({ taskId: activeData.taskId, parentId: nextParentId });
          if (prevListId !== nextListId) {
            moveTaskToList.mutate({ taskId: activeData.taskId, listId: nextListId });
          }
          reorderTasks.mutate([{ id: activeData.taskId, sort_order: newSortOrder }]);
        },
      });
    }
  };

  const unifiedLists = useMemo(
    () =>
      lists.map((l) => ({
        id: l.id,
        name: l.name,
        emoji: l.emoji,
        color: l.color,
        project_id: l.project_id,
      })),
    [lists]
  );

  const unifiedProjects = useMemo(
    () =>
      projects.map((p) => ({
        id: p.id,
        name: p.name,
        emoji: p.emoji ?? null,
        color: p.color ?? null,
      })),
    [projects]
  );

  return (
    <ScreenScaffold title="Gantt" subtitle="">
      <div className="space-y-2">
        <GanttChrome
          zoom={zoom}
          onZoomChange={setZoom}
          anchor={anchor}
          onAnchorChange={setAnchor}
          layer={layer}
          onLayerChange={setLayer}
          lists={unifiedLists}
          hiddenListIds={hiddenLists}
          onToggleListVisibility={toggleListVisibility}
          onCreateList={handleCreateList}
          projects={unifiedProjects}
          source={source}
          onSourceChange={setSource}
          onCreateNewList={handleCreateNewList}
          onCreateNewProject={handleCreateNewProject}
          onConvertListToProject={handleConvertListToProject}
          onConvertProjectToList={handleConvertProjectToList}
          filtersActiveCount={filtersActiveCount}
          filtersOpen={filtersOpen}
          onToggleFilters={() => setFiltersOpen((v) => !v)}
          showCriticalOnly={showCriticalOnly}
          onToggleCriticalOnly={() => setShowCriticalOnly((v) => !v)}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
          tableLayout={tableLayout}
          onTableLayoutChange={setTableLayout}
        />

        {filtersOpen && (
          <FilterBar
            screenKey="gantt"
            filters={filters}
            onChange={setFilters}
            fields={fields}
            alwaysExpanded
          />
        )}

        {/* Table + Gantt layout. The user picks side-by-side (default) or
            stacked. In side mode RTL puts the table on the right and Gantt
            on the left at a 1:2 width ratio. In stacked mode each takes
            full width with the table above. The internal sidebar of
            GanttGrid is suppressed in both cases — the external
            GanttTable replaces it. The legacy "collapse sidebar" toggle
            still hides the table entirely (useful when the user wants the
            timeline at full width). */}
        {sidebarCollapsed ? (
          <GanttGrid
            rows={visibleRows}
            deps={deps}
            zoom={zoom}
            windowStart={windowStart}
            windowEnd={windowEnd}
            criticalSet={criticalSet}
            onRowClick={handleRowClick}
            onBarChange={handleBarChange}
            onCreateAt={handleGanttCreateAt}
            onScheduleTask={handleScheduleTask}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
          />
        ) : tableLayout === "side" ? (
          <DndContext
            sensors={dndSensors}
            collisionDetection={pointerWithin}
            onDragEnd={handleGanttDragEnd}
          >
            <div className="flex gap-2 items-stretch">
              <div className="basis-1/3 min-w-0 shrink-0">
                <GanttTable
                  rows={visibleRows}
                  deps={deps}
                  criticalSet={criticalSet}
                  onRowClick={handleRowClick}
                  layout="side"
                  onCreateTask={
                    source.kind === "all" ? undefined : handleCreateTaskInScope
                  }
                  onMoveTaskInOrder={handleMoveTaskInOrder}
                  customFields={customFields}
                />
              </div>
              <div className="basis-2/3 min-w-0 grow">
                <GanttGrid
                  rows={visibleRows}
                  deps={deps}
                  zoom={zoom}
                  windowStart={windowStart}
                  windowEnd={windowEnd}
                  criticalSet={criticalSet}
                  onRowClick={handleRowClick}
                  onBarChange={handleBarChange}
                  onCreateAt={handleGanttCreateAt}
                  onScheduleTask={handleScheduleTask}
                  hideInternalSidebar
                />
              </div>
            </div>
          </DndContext>
        ) : (
          <DndContext
            sensors={dndSensors}
            collisionDetection={pointerWithin}
            onDragEnd={handleGanttDragEnd}
          >
            <div className="flex flex-col gap-2">
              <GanttTable
                rows={visibleRows}
                deps={deps}
                criticalSet={criticalSet}
                onRowClick={handleRowClick}
                layout="stacked"
                onCreateTask={
                  source.kind === "all" ? undefined : handleCreateTaskInScope
                }
                onMoveTaskInOrder={handleMoveTaskInOrder}
                customFields={customFields}
              />
              <GanttGrid
                rows={visibleRows}
                deps={deps}
                zoom={zoom}
                windowStart={windowStart}
                windowEnd={windowEnd}
                criticalSet={criticalSet}
                onRowClick={handleRowClick}
                onBarChange={handleBarChange}
                onCreateAt={handleGanttCreateAt}
                onScheduleTask={handleScheduleTask}
                hideInternalSidebar
              />
            </div>
          </DndContext>
        )}
      </div>

      <BulkActionsToolbar allTasks={tasks} />

      <TaskEditModal
        taskId={editingTaskId}
        onClose={() => setEditingTaskId(null)}
        defaultTab="schedule"
      />
      <EventEditModal
        open={!!editingEventId}
        eventId={editingEventId}
        onClose={() => setEditingEventId(null)}
      />

      {/* Create-flow picker — mirrors Calendar.tsx. The toggle inside
          the modals' top slot lets the user flip between event and task
          without losing the time/date context. */}
      {creating?.kind === "event" && (
        <EventEditModal
          open
          eventId={null}
          initialStart={creating.start}
          initialEnd={creating.end}
          onClose={() => setCreating(null)}
          topSlot={
            <GanttCreateKindToggle
              kind="event"
              onChange={(k) =>
                setCreating((c) => (c ? { ...c, kind: k } : c))
              }
            />
          }
        />
      )}
      {creating?.kind === "task" && (
        <TaskEditModal
          taskId={null}
          onClose={() => setCreating(null)}
          createDraft={{
            title: "",
            scheduled_at: creating.start.toISOString(),
            duration_minutes: Math.round(
              (creating.end.getTime() - creating.start.getTime()) / 60000
            ),
          }}
          defaultTab="schedule"
          topSlot={
            <GanttCreateKindToggle
              kind="task"
              onChange={(k) =>
                setCreating((c) => (c ? { ...c, kind: k } : c))
              }
            />
          }
        />
      )}
    </ScreenScaffold>
  );
}

function GanttCreateKindToggle({
  kind,
  onChange,
}: {
  kind: "event" | "task";
  onChange: (k: "event" | "task") => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-ink-200 overflow-hidden text-xs mt-1">
      <button
        onClick={() => onChange("event")}
        className={
          "px-3 py-1 font-medium border-e border-ink-200 transition-colors " +
          (kind === "event"
            ? "bg-ink-900 text-white"
            : "bg-white text-ink-700 hover:bg-ink-50")
        }
        type="button"
      >
        אירוע
      </button>
      <button
        onClick={() => onChange("task")}
        className={
          "px-3 py-1 font-medium transition-colors " +
          (kind === "task"
            ? "bg-ink-900 text-white"
            : "bg-white text-ink-700 hover:bg-ink-50")
        }
        type="button"
      >
        משימה
      </button>
    </div>
  );
}
