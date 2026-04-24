import { useMemo, useState } from "react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { ListsBanner } from "@/components/lists/ListsBanner";
import {
  FilterBar,
  useFiltersFromUrl,
  type FilterField,
} from "@/components/filters/FilterBar";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";
import { GanttToolbar } from "@/components/gantt/GanttToolbar";
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
  useListVisibility,
  useTaskLists,
  useTasks,
  useUpdateTask,
} from "@/lib/hooks";

export function Gantt() {
  const [zoom, setZoom] = useState<GanttZoom>("day");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);

  const [filters, setFilters] = useFiltersFromUrl();
  const { data: tasks = [] } = useTasks(filters);
  const { data: deps = [] } = useAllTaskDependencies();
  const { data: lists = [] } = useTaskLists();
  const { data: visibility } = useListVisibility("gantt");
  const hiddenLists = useMemo(
    () => new Set(visibility?.hidden_list_ids ?? []),
    [visibility]
  );

  const updateTask = useUpdateTask();

  // Visible window — one "page" ahead of/behind the anchor (so scrolling
  // horizontally keeps working without re-querying).
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

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const handleBarChange = (
    taskId: string,
    patch: { scheduled_at: string; duration_minutes: number }
  ) => {
    updateTask.mutate({ taskId, patch });
  };

  return (
    <ScreenScaffold
      title="Gantt"
      subtitle="ציר זמן עם תלויות, זום יום/שבוע/חודש/רבעון, וחישוב אוטומטי של Critical Path."
    >
      <div className="space-y-3">
        <ListsBanner screenKey="gantt" kind="task" />
        <FilterBar
          screenKey="gantt"
          filters={filters}
          onChange={setFilters}
          fields={fields}
        />
        <GanttToolbar
          zoom={zoom}
          onZoomChange={setZoom}
          anchor={anchor}
          onAnchorChange={setAnchor}
          showCriticalOnly={showCriticalOnly}
          onShowCriticalOnlyChange={setShowCriticalOnly}
        />

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

        <GanttLegend />
      </div>

      <TaskEditModal taskId={editingTaskId} onClose={() => setEditingTaskId(null)} />
    </ScreenScaffold>
  );
}

function GanttLegend() {
  return (
    <div className="text-[11px] text-ink-500 flex items-center gap-4 flex-wrap px-1">
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-6 h-2 rounded-sm bg-gradient-to-l from-primary-500 to-primary-400" />
        משימה רגילה
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-6 h-2 rounded-sm bg-gradient-to-l from-danger-500 to-primary-500" />
        Critical path
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-6 h-0.5 border-t border-ink-400 border-dashed" />
        תלות finish-to-start
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-3 h-0.5 bg-danger-500" />
        כעת
      </span>
      <span className="text-ink-400">
        גרירה אופקית = שינוי תאריך · גרירת קצה = שינוי משך · קליק = עריכה מלאה
      </span>
    </div>
  );
}
