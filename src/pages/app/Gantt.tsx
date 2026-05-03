import { useMemo, useState, useEffect } from "react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import {
  FilterBar,
  useFiltersFromUrl,
  type FilterField,
} from "@/components/filters/FilterBar";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";
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
  useCreateTaskList,
  useEvents,
  useListVisibility,
  useProjects,
  useSetListVisibility,
  useTaskLists,
  useTasks,
  useUpdateEvent,
  useUpdateTask,
} from "@/lib/hooks";
import type { GanttSource } from "@/components/gantt/GanttChrome";

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
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed((v) => !v)}
          />
        ) : tableLayout === "side" ? (
          <div className="flex gap-2 items-stretch">
            <div className="basis-1/3 min-w-0 shrink-0">
              <GanttTable
                rows={visibleRows}
                deps={deps}
                criticalSet={criticalSet}
                onRowClick={handleRowClick}
                layout="side"
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
                hideInternalSidebar
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <GanttTable
              rows={visibleRows}
              deps={deps}
              criticalSet={criticalSet}
              onRowClick={handleRowClick}
              layout="stacked"
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
              hideInternalSidebar
            />
          </div>
        )}
      </div>

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
