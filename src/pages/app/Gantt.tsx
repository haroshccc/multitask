import { useMemo, useState, useEffect } from "react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import {
  FilterBar,
  useFiltersFromUrl,
  type FilterField,
} from "@/components/filters/FilterBar";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";
import { GanttChrome } from "@/components/gantt/GanttChrome";
import { GanttGrid } from "@/components/gantt/GanttGrid";
import {
  type GanttZoom,
  addDays,
  buildRows,
  computeCriticalPath,
  defaultSpanDays,
  startOfDay,
} from "@/components/gantt/gantt-utils";
import {
  useAllTaskDependencies,
  useCreateTaskList,
  useListVisibility,
  useSetListVisibility,
  useTaskLists,
  useTasks,
  useUpdateTask,
} from "@/lib/hooks";

export function Gantt() {
  const [zoom, setZoom] = useState<GanttZoom>("day");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("multitask.gantt.filtersOpen") === "true";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("multitask.gantt.filtersOpen", String(filtersOpen));
  }, [filtersOpen]);

  const [filters, setFilters] = useFiltersFromUrl();
  const { data: tasks = [] } = useTasks(filters);
  const { data: deps = [] } = useAllTaskDependencies();
  const { data: lists = [] } = useTaskLists();
  const { data: visibility } = useListVisibility("gantt");
  const setListVisibility = useSetListVisibility();
  const createTaskList = useCreateTaskList();
  const hiddenLists = useMemo(
    () => new Set(visibility?.hidden_list_ids ?? []),
    [visibility]
  );

  const updateTask = useUpdateTask();

  const windowStart = useMemo(() => {
    const span = defaultSpanDays(zoom);
    return addDays(startOfDay(anchor), -Math.floor(span / 3));
  }, [anchor, zoom]);
  const windowEnd = useMemo(
    () => addDays(windowStart, defaultSpanDays(zoom)),
    [windowStart, zoom]
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.task_list_id && hiddenLists.has(t.task_list_id)) return false;
      return true;
    });
  }, [tasks, hiddenLists]);

  const rows = useMemo(() => buildRows(filteredTasks), [filteredTasks]);

  const criticalSet = useMemo(
    () => computeCriticalPath(rows, deps),
    [rows, deps]
  );

  const visibleRows = useMemo(() => {
    if (!showCriticalOnly) return rows;
    return rows.filter((r) => criticalSet.has(r.task.id));
  }, [rows, showCriticalOnly, criticalSet]);

  const fields: FilterField[] = useMemo(
    () => [
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

  const handleBarChange = (
    taskId: string,
    patch: { scheduled_at: string; duration_minutes: number }
  ) => {
    updateTask.mutate({ taskId, patch });
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

  const unifiedLists = useMemo(
    () =>
      lists.map((l) => ({
        id: l.id,
        name: l.name,
        emoji: l.emoji,
        color: l.color,
      })),
    [lists]
  );

  return (
    <ScreenScaffold title="Gantt" subtitle="">
      <div className="space-y-2">
        <GanttChrome
          zoom={zoom}
          onZoomChange={setZoom}
          anchor={anchor}
          onAnchorChange={setAnchor}
          lists={unifiedLists}
          hiddenListIds={hiddenLists}
          onToggleListVisibility={toggleListVisibility}
          onCreateList={handleCreateList}
          filtersActiveCount={filtersActiveCount}
          filtersOpen={filtersOpen}
          onToggleFilters={() => setFiltersOpen((v) => !v)}
          showCriticalOnly={showCriticalOnly}
          onToggleCriticalOnly={() => setShowCriticalOnly((v) => !v)}
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

        <GanttGrid
          rows={visibleRows}
          deps={deps}
          zoom={zoom}
          windowStart={windowStart}
          windowEnd={windowEnd}
          criticalSet={criticalSet}
          onRowClick={setEditingTaskId}
          onBarChange={handleBarChange}
        />
      </div>

      <TaskEditModal
        taskId={editingTaskId}
        onClose={() => setEditingTaskId(null)}
        defaultTab="schedule"
      />
    </ScreenScaffold>
  );
}
