import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
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
import { GanttExportModal } from "@/components/gantt/GanttExportModal";
import {
  type GanttLayer,
  type GanttRow,
  type GanttZoom,
  addDays,
  buildRows,
  computeCriticalPath,
  startOfDay,
  weeksToDays,
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
import {
  useGanttBaselines,
  useGanttBaselineTasks,
  useCreateBaseline,
  useDeleteBaseline,
  buildBaselineMap,
} from "@/lib/hooks/useGanttBaselines";
import { useOrgMembers } from "@/lib/hooks/useOrgMembers";
import { ResourceHistogram } from "@/components/gantt/ResourceHistogram";

export function Gantt() {
  const { user } = useAuth();
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
    localStorage.setItem("multitask.gantt.sidebarCollapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const [tableLayout, setTableLayout] = useState<"side" | "stacked">(() => {
    if (typeof window === "undefined") return "side";
    const raw = localStorage.getItem("multitask.gantt.tableLayout");
    return raw === "stacked" ? "stacked" : "side";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("multitask.gantt.tableLayout", tableLayout);
  }, [tableLayout]);

  const [selectedBaselineId, setSelectedBaselineId] = useState<string | null>(null);
  const [showHistogram, setShowHistogram] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  /** Configurable visible range — in weeks. Default 26 (~6 months). */
  const [spanWeeks, setSpanWeeks] = useState<number>(() => {
    if (typeof window === "undefined") return 26;
    const raw = localStorage.getItem("multitask.gantt.spanWeeks");
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n >= 2 && n <= 260 ? n : 26;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("multitask.gantt.spanWeeks", String(spanWeeks));
  }, [spanWeeks]);

  /** Continuous zoom multiplier (0.5 .. 2.5). */
  const [zoomScale, setZoomScale] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    const raw = localStorage.getItem("multitask.gantt.zoomScale");
    const n = raw ? Number(raw) : NaN;
    return Number.isFinite(n) && n >= 0.4 && n <= 3 ? n : 1;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("multitask.gantt.zoomScale", String(zoomScale));
  }, [zoomScale]);

  const [filters, setFilters] = useFiltersFromUrl();
  const { data: tasks = [] } = useTasks(filters);
  const { data: deps = [] } = useAllTaskDependencies();
  const { data: lists = [] } = useTaskLists();
  const { data: projects = [] } = useProjects();
  const { data: visibility } = useListVisibility("gantt");
  const setListVisibility = useSetListVisibility();
  const createTaskList = useCreateTaskList();
  const hiddenLists = useMemo(() => new Set(visibility?.hidden_list_ids ?? []), [visibility]);

  const [source, setSource] = useState<GanttSource>(() => {
    if (typeof window === "undefined") return { kind: "all" };
    try {
      const raw = localStorage.getItem("multitask.gantt.source");
      if (!raw) return { kind: "all" };
      const parsed = JSON.parse(raw) as GanttSource;
      if (parsed.kind === "all" || ((parsed.kind === "list" || parsed.kind === "project") && typeof parsed.id === "string")) return parsed;
      return { kind: "all" };
    } catch { return { kind: "all" }; }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("multitask.gantt.source", JSON.stringify(source));
  }, [source]);

  const { data: baselines = [] } = useGanttBaselines();
  const { data: baselineTasksRaw = [] } = useGanttBaselineTasks(selectedBaselineId);
  const createBaseline = useCreateBaseline();
  const deleteBaseline = useDeleteBaseline();
  const { data: orgMembers = [] } = useOrgMembers();

  const baselineMap = useMemo(
    () => (selectedBaselineId ? buildBaselineMap(baselineTasksRaw) : null),
    [selectedBaselineId, baselineTasksRaw]
  );

  const memberNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const om of orgMembers) {
      if (om.profile) {
        const name = om.profile.full_name?.trim() || om.membership.user_id.slice(0, 8);
        m.set(om.membership.user_id, name);
      }
    }
    return m;
  }, [orgMembers]);

  const handleSaveBaseline = async () => {
    const name = window.prompt("שם לבסיס (Baseline):", `בסיס ${new Date().toLocaleDateString("he-IL")}`) ?? "";
    if (!name.trim()) return;
    const taskSnapshots = filteredTasks.filter((t) => t.scheduled_at).map((t) => ({ task_id: t.id, scheduled_at: t.scheduled_at, duration_minutes: t.duration_minutes }));
    const bl = await createBaseline.mutateAsync({ name: name.trim(), tasks: taskSnapshots });
    setSelectedBaselineId(bl.id);
  };

  const handleDeleteBaseline = async (id: string) => {
    if (!window.confirm("למחוק את הבסיס הזה?")) return;
    await deleteBaseline.mutateAsync(id);
    if (selectedBaselineId === id) setSelectedBaselineId(null);
  };

  const updateTask = useUpdateTask();
  const updateEvent = useUpdateEvent();
  const createProject = useCreateProject();
  const updateTaskList = useUpdateTaskList();
  const createTask = useCreateTask();
  const archiveProject = useArchiveProject();
  const moveTaskToList = useMoveTaskToList();
  const setTaskParent = useSetTaskParent();
  const reorderTasks = useReorderTasks();

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const scopedProjectId = source.kind === "project" ? source.id : null;
  const { data: customFields = [] } = useProjectCustomFields(scopedProjectId);

  // Window: 1/4 of the span sits before the anchor (so the user sees a bit
  // of history) and 3/4 after (which is what they actually plan into).
  const windowStart = useMemo(() => {
    const span = weeksToDays(spanWeeks);
    return addDays(startOfDay(anchor), -Math.floor(span / 4));
  }, [anchor, spanWeeks]);
  const windowEnd = useMemo(
    () => addDays(windowStart, weeksToDays(spanWeeks)),
    [windowStart, spanWeeks]
  );

  const { data: events = [] } = useEvents({ from: windowStart.toISOString(), to: windowEnd.toISOString() });

  const projectListIds = useMemo(() => {
    if (source.kind !== "project") return null;
    return new Set(lists.filter((l) => l.project_id === source.id).map((l) => l.id));
  }, [lists, source]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (source.kind === "list") return t.task_list_id === source.id;
      if (source.kind === "project") return !!t.task_list_id && !!projectListIds?.has(t.task_list_id);
      if (t.task_list_id && hiddenLists.has(t.task_list_id)) return false;
      return true;
    });
  }, [tasks, hiddenLists, source, projectListIds]);

  const filteredEvents = useMemo(() => {
    if (source.kind === "all") return events;
    return [];
  }, [events, source.kind]);

  const rows = useMemo(
    () => buildRows(filteredTasks, filteredEvents, layer, lists, user?.id),
    [filteredTasks, filteredEvents, layer, lists]
  );

  const criticalSet = useMemo(() => {
    const autoSet = computeCriticalPath(rows, deps);
    const merged = new Set(autoSet);
    for (const t of filteredTasks) { if ((t as any).is_critical) merged.add(t.id); }
    return merged;
  }, [rows, deps, filteredTasks]);

  const visibleRows = useMemo(() => {
    if (!showCriticalOnly) return rows;
    return rows.filter((r) => r.kind === "task" && r.task ? criticalSet.has(r.task.id) : false);
  }, [rows, showCriticalOnly, criticalSet]);

  const orderedTaskIds = useMemo(
    () => visibleRows.filter((r) => r.kind === "task" && r.task).map((r) => r.task!.id),
    [visibleRows]
  );
  useEffect(() => { useTaskSelectionStore.getState().setOrderedIds(orderedTaskIds); }, [orderedTaskIds]);
  useEffect(() => () => { useTaskSelectionStore.getState().clear(); }, []);

  const fields: FilterField[] = useMemo(() => [
    { key: "lists", type: "multi-enum", label: "רשימה", options: lists.map((l) => ({ value: l.id, label: l.name })) },
    { key: "statuses", type: "multi-enum", label: "סטטוס", options: [{ value: "todo", label: "לעשות" }, { value: "in_progress", label: "בעבודה" }, { value: "pending_approval", label: "ממתין לאישור" }, { value: "done", label: "בוצע" }] },
    { key: "tags", type: "multi-text", label: "תגים" },
  ], [lists]);

  const filtersActiveCount = useMemo(() => {
    let n = 0;
    Object.values(filters).forEach((v) => { if (Array.isArray(v)) n += v.length; else if (v !== undefined && v !== null && v !== "" && v !== false) n += 1; });
    return n;
  }, [filters]);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [creating, setCreating] = useState<{ start: Date; end: Date; kind: "event" | "task"; taskListId?: string | null } | null>(null);

  const handleToggleCritical = (taskId: string, critical: boolean) => {
    updateTask.mutate({ taskId, patch: { is_critical: critical } as any });
    pushUndo({
      description: critical ? "סימון כקריטי" : "הסרת קריטיות",
      undo: () => updateTask.mutate({ taskId, patch: { is_critical: !critical } as any }),
      redo: () => updateTask.mutate({ taskId, patch: { is_critical: critical } as any }),
    });
  };

  const handleGanttCreateAt = (start: Date) => {
    const end = new Date(start.getTime() + 60 * 60_000);
    let taskListId: string | null = null;
    if (source.kind === "list") taskListId = source.id;
    else if (source.kind === "project") taskListId = lists.find((l) => l.project_id === source.id)?.id ?? null;
    setCreating({ start, end, kind: "event", taskListId });
  };

  const handleRowClick = (row: GanttRow) => {
    if (row.kind === "event" && row.event) setEditingEventId(row.event.id);
    else if (row.kind === "task" && row.task) setEditingTaskId(row.task.id);
  };

  const handleBarChange = (row: GanttRow, patch: { scheduled_at: string; duration_minutes: number }) => {
    if (row.kind === "task" && row.task) {
      updateTask.mutate({ taskId: row.task.id, patch });
    } else if (row.kind === "event" && row.event) {
      const endsAt = new Date(new Date(patch.scheduled_at).getTime() + patch.duration_minutes * 60_000).toISOString();
      updateEvent.mutate({ eventId: row.event.id, patch: { starts_at: patch.scheduled_at, ends_at: endsAt } });
    }
  };

  const handleScheduleTask = (row: GanttRow, date: Date) => {
    if (row.kind === "task" && row.task) {
      const taskId = row.task.id;
      const prevScheduledAt = row.task.scheduled_at;
      const nextScheduledAt = date.toISOString();
      updateTask.mutate({ taskId, patch: { scheduled_at: nextScheduledAt } });
      pushUndo({ description: "תזמון משימה מהציר", undo: () => updateTask.mutate({ taskId, patch: { scheduled_at: prevScheduledAt } }), redo: () => updateTask.mutate({ taskId, patch: { scheduled_at: nextScheduledAt } }) });
    }
  };

  const handlePhaseColorChange = (taskId: string, color: string) => {
    updateTask.mutate({ taskId, patch: { accent_color: color } });
  };

  const toggleListVisibility = (listId: string) => {
    const current = visibility?.hidden_list_ids ?? [];
    const next = current.includes(listId) ? current.filter((id) => id !== listId) : [...current, listId];
    setListVisibility.mutate({ screenKey: "gantt", hiddenListIds: next });
  };

  const handleCreateList = async () => {
    const name = window.prompt("שם הרשימה החדשה:");
    if (!name?.trim()) return;
    await createTaskList.mutateAsync({ name: name.trim(), kind: "custom" });
  };

  const handleCreateNewList = async () => {
    const name = window.prompt("שם הרשימה החדשה:");
    if (!name?.trim()) return;
    const list = await createTaskList.mutateAsync({ name: name.trim(), kind: "custom" });
    setSource({ kind: "list", id: list.id });
  };

  const handleCreateNewProject = async () => {
    const name = window.prompt("שם הפרוייקט החדש:");
    if (!name?.trim()) return;
    const project = await createProject.mutateAsync({ name: name.trim() });
    await createTaskList.mutateAsync({ name: name.trim(), kind: "custom", project_id: project.id });
    setSource({ kind: "project", id: project.id });
  };

  const handleCreateTaskInScope = async (title: string) => {
    if (source.kind === "list") {
      await createTask.mutateAsync({ title, task_list_id: source.id, parent_task_id: null, status: "todo", urgency: 0 });
      return;
    }
    if (source.kind === "project") {
      let targetList = lists.find((l) => l.project_id === source.id);
      if (!targetList) {
        const proj = projects.find((p) => p.id === source.id);
        targetList = await createTaskList.mutateAsync({ name: proj?.name ?? "רשימה חדשה", kind: "custom", project_id: source.id });
      }
      await createTask.mutateAsync({ title, task_list_id: targetList.id, parent_task_id: null, status: "todo", urgency: 0 });
    }
  };

  const handleConvertProjectToList = async () => {
    if (source.kind !== "project") return;
    const project = projects.find((p) => p.id === source.id);
    if (!project) return;
    const projectLists = lists.filter((l) => l.project_id === source.id);
    if (projectLists.length === 0) {
      if (!window.confirm(`הפרוייקט "${project.name}" ריק. להעבירו לארכיון?`)) return;
      await archiveProject.mutateAsync(source.id);
      setSource({ kind: "all" });
      return;
    }
    if (projectLists.length === 1) {
      const list = projectLists[0]!;
      if (!window.confirm(`להפוך את הפרוייקט "${project.name}" לרשימה? הפרוייקט יועבר לארכיון; הרשימה והמשימות יישארו.`)) return;
      await updateTaskList.mutateAsync({ listId: list.id, patch: { project_id: null } });
      await archiveProject.mutateAsync(source.id);
      setSource({ kind: "list", id: list.id });
      return;
    }
    if (!window.confirm(`הפרוייקט "${project.name}" מכיל ${projectLists.length} רשימות. כל המשימות יועברו לרשימה חדשה אחת בשם הפרוייקט; הפרוייקט יועבר לארכיון. להמשיך?`)) return;
    const newList = await createTaskList.mutateAsync({ name: project.name, kind: "custom", color: project.color, emoji: project.emoji });
    const tasksToMove = tasks.filter((t) => !!t.task_list_id && projectLists.some((l) => l.id === t.task_list_id));
    for (const t of tasksToMove) await moveTaskToList.mutateAsync({ taskId: t.id, listId: newList.id });
    await archiveProject.mutateAsync(source.id);
    setSource({ kind: "list", id: newList.id });
  };

  const handleConvertListToProject = async () => {
    if (source.kind !== "list") return;
    const list = lists.find((l) => l.id === source.id);
    if (!list) return;
    if (!window.confirm(`להפוך את הרשימה "${list.name}" לפרוייקט?\nכל המשימות יישארו במקומן.`)) return;
    const project = await createProject.mutateAsync({ name: list.name, color: list.color, emoji: list.emoji });
    await updateTaskList.mutateAsync({ listId: list.id, patch: { project_id: project.id } });
    setSource({ kind: "project", id: project.id });
  };

  const isGanttDescendant = (taskId: string, potentialAncestorId: string): boolean => {
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

  const handleGanttDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    type ActiveData = { type: "gantt-task"; taskId: string; listId: string | null; parentTaskId: string | null };
    type OverData = { type: "gantt-task-nest"; taskId: string; listId: string | null } | { type: "gantt-task-before" | "gantt-task-after"; taskId: string; listId: string | null; parentTaskId: string | null };
    const activeData = active.data.current as ActiveData | undefined;
    const overData = over.data.current as OverData | undefined;
    if (!activeData || !overData) return;
    if (activeData.type !== "gantt-task") return;
    if (!activeData.taskId || !overData.taskId) return;
    if (activeData.taskId === overData.taskId) return;

    if (overData.type === "gantt-task-nest") {
      if (isGanttDescendant(overData.taskId, activeData.taskId)) return;
      const prevParent = activeData.parentTaskId;
      const prevListId = activeData.listId;
      const nextListId = overData.listId;
      setTaskParent.mutate({ taskId: activeData.taskId, parentId: overData.taskId });
      if (prevListId !== nextListId && nextListId) moveTaskToList.mutate({ taskId: activeData.taskId, listId: nextListId });
      pushUndo({
        description: "קינון משימה",
        undo: () => { setTaskParent.mutate({ taskId: activeData.taskId, parentId: prevParent }); if (prevListId !== nextListId && prevListId !== undefined) moveTaskToList.mutate({ taskId: activeData.taskId, listId: prevListId }); },
        redo: () => { setTaskParent.mutate({ taskId: activeData.taskId, parentId: overData.taskId }); if (prevListId !== nextListId && nextListId) moveTaskToList.mutate({ taskId: activeData.taskId, listId: nextListId }); },
      });
      return;
    }

    if (overData.type === "gantt-task-before" || overData.type === "gantt-task-after") {
      const targetTask = tasks.find((t) => t.id === overData.taskId);
      if (!targetTask) return;
      const nextParentId = targetTask.parent_task_id ?? null;
      const nextListId = targetTask.task_list_id;
      const prevParentId = activeData.parentTaskId;
      const prevListId = activeData.listId;
      const direction = overData.type === "gantt-task-before" ? -1 : 1;
      const peers = tasks.filter((t) => (t.parent_task_id ?? null) === nextParentId && t.task_list_id === nextListId).sort((a, b) => a.sort_order - b.sort_order);
      const targetIdx = peers.findIndex((t) => t.id === targetTask.id);
      if (targetIdx === -1) return;
      const far = peers[targetIdx + direction];
      let newSortOrder: number;
      if (direction === -1) {
        const farBefore = peers[targetIdx - 1];
        newSortOrder = farBefore ? (farBefore.sort_order + targetTask.sort_order) / 2 : targetTask.sort_order - 1;
      } else {
        newSortOrder = far ? (targetTask.sort_order + far.sort_order) / 2 : targetTask.sort_order + 1;
      }
      const prevSortOrder = tasks.find((t) => t.id === activeData.taskId)?.sort_order ?? 0;
      setTaskParent.mutate({ taskId: activeData.taskId, parentId: nextParentId });
      if (prevListId !== nextListId) moveTaskToList.mutate({ taskId: activeData.taskId, listId: nextListId });
      reorderTasks.mutate([{ id: activeData.taskId, sort_order: newSortOrder }]);
      pushUndo({
        description: "סידור משימה",
        undo: () => { setTaskParent.mutate({ taskId: activeData.taskId, parentId: prevParentId }); if (prevListId !== nextListId && prevListId !== undefined) moveTaskToList.mutate({ taskId: activeData.taskId, listId: prevListId }); reorderTasks.mutate([{ id: activeData.taskId, sort_order: prevSortOrder }]); },
        redo: () => { setTaskParent.mutate({ taskId: activeData.taskId, parentId: nextParentId }); if (prevListId !== nextListId) moveTaskToList.mutate({ taskId: activeData.taskId, listId: nextListId }); reorderTasks.mutate([{ id: activeData.taskId, sort_order: newSortOrder }]); },
      });
    }
  };

  const unifiedLists = useMemo(() => lists.map((l) => ({ id: l.id, name: l.name, emoji: l.emoji, color: l.color, project_id: l.project_id })), [lists]);
  const unifiedProjects = useMemo(() => projects.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji ?? null, color: p.color ?? null })), [projects]);

  const listNamesMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of lists) m.set(l.id, l.name);
    return m;
  }, [lists]);

  const exportTitle = useMemo(() => {
    if (source.kind === "list") return lists.find((l) => l.id === source.id)?.name ?? "Gantt";
    if (source.kind === "project") return projects.find((p) => p.id === source.id)?.name ?? "Gantt";
    return "Gantt";
  }, [source, lists, projects]);

  return (
    <ScreenScaffold title="Gantt" subtitle="">
      <div className="space-y-2">
        <GanttChrome
          zoom={zoom} onZoomChange={setZoom} anchor={anchor} onAnchorChange={setAnchor}
          spanWeeks={spanWeeks} onSpanWeeksChange={setSpanWeeks}
          zoomScale={zoomScale} onZoomScaleChange={setZoomScale}
          onExport={() => setExportOpen(true)}
          layer={layer} onLayerChange={setLayer} lists={unifiedLists} hiddenListIds={hiddenLists}
          onToggleListVisibility={toggleListVisibility} onCreateList={handleCreateList}
          projects={unifiedProjects} source={source} onSourceChange={setSource}
          onCreateNewList={handleCreateNewList} onCreateNewProject={handleCreateNewProject}
          onConvertListToProject={handleConvertListToProject} onConvertProjectToList={handleConvertProjectToList}
          filtersActiveCount={filtersActiveCount} filtersOpen={filtersOpen} onToggleFilters={() => setFiltersOpen((v) => !v)}
          showCriticalOnly={showCriticalOnly} onToggleCriticalOnly={() => setShowCriticalOnly((v) => !v)}
          sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
          tableLayout={tableLayout} onTableLayoutChange={setTableLayout}
        />

        {filtersOpen && <FilterBar screenKey="gantt" filters={filters} onChange={setFilters} fields={fields} alwaysExpanded />}

        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={handleSaveBaseline} className="btn-ghost text-xs" title="שמור את התזמון הנוכחי כבסיס להשוואה">
            📌 שמור בסיס
          </button>
          {baselines.length > 0 && (
            <>
              <select value={selectedBaselineId ?? ""} onChange={(e) => setSelectedBaselineId(e.target.value || null)} className="field text-xs py-0.5 px-2 h-7">
                <option value="">— ללא בסיס —</option>
                {baselines.map((bl) => <option key={bl.id} value={bl.id}>{bl.name} ({new Date(bl.created_at).toLocaleDateString("he-IL")})</option>)}
              </select>
              {selectedBaselineId && <button type="button" onClick={() => handleDeleteBaseline(selectedBaselineId)} className="btn-ghost text-xs text-danger-500" title="מחק בסיס זה">✕</button>}
            </>
          )}
          <div className="h-4 border-e border-ink-200 mx-1" />
          <button type="button" onClick={() => setShowHistogram((v) => !v)} className={showHistogram ? "btn-accent text-xs" : "btn-ghost text-xs"} title="הצג/הסתר היסטוגרמת משאבים">
            📊 עומס משאבים
          </button>
        </div>

        {sidebarCollapsed ? (
          <GanttGrid rows={visibleRows} deps={deps} zoom={zoom} zoomScale={zoomScale} windowStart={windowStart} windowEnd={windowEnd} criticalSet={criticalSet} onRowClick={handleRowClick} onBarChange={handleBarChange} onCreateAt={handleGanttCreateAt} onScheduleTask={handleScheduleTask} sidebarCollapsed={sidebarCollapsed} onToggleSidebar={() => setSidebarCollapsed((v) => !v)} baselineMap={baselineMap ?? undefined} onPhaseColorChange={handlePhaseColorChange} />
        ) : tableLayout === "side" ? (
          <DndContext sensors={dndSensors} collisionDetection={pointerWithin} onDragEnd={handleGanttDragEnd}>
            <div className="flex gap-2 items-stretch">
              <div className="basis-1/3 min-w-0 shrink-0">
                <GanttTable rows={visibleRows} deps={deps} criticalSet={criticalSet} onRowClick={handleRowClick} layout="side" onCreateTask={source.kind === "all" ? undefined : handleCreateTaskInScope} customFields={customFields} lists={unifiedLists} onToggleCritical={handleToggleCritical} />
              </div>
              <div className="basis-2/3 min-w-0 grow">
                <GanttGrid rows={visibleRows} deps={deps} zoom={zoom} zoomScale={zoomScale} windowStart={windowStart} windowEnd={windowEnd} criticalSet={criticalSet} onRowClick={handleRowClick} onBarChange={handleBarChange} onCreateAt={handleGanttCreateAt} onScheduleTask={handleScheduleTask} hideInternalSidebar baselineMap={baselineMap ?? undefined} onPhaseColorChange={handlePhaseColorChange} />
              </div>
            </div>
          </DndContext>
        ) : (
          <DndContext sensors={dndSensors} collisionDetection={pointerWithin} onDragEnd={handleGanttDragEnd}>
            <div className="flex flex-col gap-2">
              <GanttTable rows={visibleRows} deps={deps} criticalSet={criticalSet} onRowClick={handleRowClick} layout="stacked" onCreateTask={source.kind === "all" ? undefined : handleCreateTaskInScope} customFields={customFields} lists={unifiedLists} onToggleCritical={handleToggleCritical} />
              <GanttGrid rows={visibleRows} deps={deps} zoom={zoom} zoomScale={zoomScale} windowStart={windowStart} windowEnd={windowEnd} criticalSet={criticalSet} onRowClick={handleRowClick} onBarChange={handleBarChange} onCreateAt={handleGanttCreateAt} onScheduleTask={handleScheduleTask} hideInternalSidebar baselineMap={baselineMap ?? undefined} onPhaseColorChange={handlePhaseColorChange} />
            </div>
          </DndContext>
        )}

        {showHistogram && <ResourceHistogram rows={visibleRows} zoom={zoom} windowStart={windowStart} windowEnd={windowEnd} memberNames={memberNames} />}
      </div>

      <BulkActionsToolbar allTasks={tasks} />

      <TaskEditModal taskId={editingTaskId} onClose={() => setEditingTaskId(null)} defaultTab="schedule" />
      <EventEditModal open={!!editingEventId} eventId={editingEventId} onClose={() => setEditingEventId(null)} />

      {creating?.kind === "event" && (
        <EventEditModal open eventId={null} initialStart={creating.start} initialEnd={creating.end} onClose={() => setCreating(null)}
          topSlot={<GanttCreateKindToggle kind="event" onChange={(k) => setCreating((c) => (c ? { ...c, kind: k } : c))} />}
        />
      )}
      {creating?.kind === "task" && (
        <TaskEditModal taskId={null} onClose={() => setCreating(null)}
          createDraft={{ title: "", scheduled_at: creating.start.toISOString(), duration_minutes: Math.round((creating.end.getTime() - creating.start.getTime()) / 60000), task_list_id: creating.taskListId ?? null }}
          defaultTab="schedule"
          topSlot={<GanttCreateKindToggle kind="task" onChange={(k) => setCreating((c) => (c ? { ...c, kind: k } : c))} />}
        />
      )}

      <GanttExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        rows={visibleRows}
        defaultFrom={windowStart}
        defaultTo={windowEnd}
        listNames={listNamesMap}
        memberNames={memberNames}
        title={exportTitle}
      />
    </ScreenScaffold>
  );
}

function GanttCreateKindToggle({ kind, onChange }: { kind: "event" | "task"; onChange: (k: "event" | "task") => void }) {
  return (
    <div className="inline-flex rounded-md border border-ink-200 overflow-hidden text-xs mt-1">
      <button onClick={() => onChange("event")} className={"px-3 py-1 font-medium border-e border-ink-200 transition-colors " + (kind === "event" ? "bg-ink-900 text-white" : "bg-white text-ink-700 hover:bg-ink-50")} type="button">אירוע</button>
      <button onClick={() => onChange("task")} className={"px-3 py-1 font-medium transition-colors " + (kind === "task" ? "bg-ink-900 text-white" : "bg-white text-ink-700 hover:bg-ink-50")} type="button">משימה</button>
    </div>
  );
}
