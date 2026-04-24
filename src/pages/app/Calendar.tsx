import { useMemo, useState } from "react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import {
  FilterBar,
  useFiltersFromUrl,
  type FilterField,
} from "@/components/filters/FilterBar";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";
import { type CalendarView } from "@/components/calendar/CalendarToolbar";
import { CalendarChrome } from "@/components/calendar/CalendarChrome";
import { CalendarDayView } from "@/components/calendar/CalendarDayView";
import { CalendarWeekView } from "@/components/calendar/CalendarWeekView";
import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import { CalendarAgendaView } from "@/components/calendar/CalendarAgendaView";
import { CalendarStatsStrip } from "@/components/calendar/CalendarStatsStrip";
import { EventEditModal } from "@/components/calendar/EventEditModal";
import {
  type CalendarItem,
  type LayerMode,
  addDays,
  eventToItem,
  startOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  taskToItem,
  timeEntryToStripe,
} from "@/components/calendar/calendar-utils";
import {
  useEvents,
  useListVisibility,
  useSetListVisibility,
  useTaskLists,
  useCreateTaskList,
  useTasks,
  useTimeEntriesByRange,
  useCreateTask,
} from "@/lib/hooks";
import { useCalendarPrefs } from "@/lib/hooks/useCalendarPrefs";
import type { FilterConfig } from "@/lib/types/domain";

const HOUR_HEIGHT_DAY = 48;
const HOUR_HEIGHT_WEEK = 40;

export function Calendar() {
  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [layer, setLayer] = useState<LayerMode>("both");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  const { effectiveRange } = useCalendarPrefs();

  const [filters, setFilters] = useFiltersFromUrl();
  const { data: lists = [] } = useTaskLists();
  const { data: visibility } = useListVisibility("calendar");
  const setListVisibility = useSetListVisibility();
  const createTaskList = useCreateTaskList();

  const hiddenLists = useMemo(
    () => new Set(visibility?.hidden_list_ids ?? []),
    [visibility]
  );

  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);

  const { data: tasks = [] } = useTasks({
    ...filters,
    scheduledAfter: range.fromIso,
    scheduledBefore: range.toIso,
  } as FilterConfig);
  const { data: events = [] } = useEvents({
    from: range.fromIso,
    to: range.toIso,
  });
  const { data: timeEntries = [] } = useTimeEntriesByRange({
    from: range.fromIso,
    to: range.toIso,
  });

  const listColorById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const l of lists) m.set(l.id, l.color);
    return m;
  }, [lists]);

  const items: CalendarItem[] = useMemo(() => {
    const out: CalendarItem[] = [];
    if (layer !== "events") {
      for (const t of tasks) {
        if (!t.scheduled_at) continue;
        if (t.task_list_id && hiddenLists.has(t.task_list_id)) continue;
        const item = taskToItem(
          t,
          listColorById.get(t.task_list_id ?? "") ?? null
        );
        if (item) out.push(item);
      }
    }
    if (layer !== "tasks") {
      for (const e of events) out.push(eventToItem(e));
    }
    return out;
  }, [tasks, events, layer, hiddenLists, listColorById]);

  const actualStripes = useMemo(() => {
    const now = new Date();
    const stripes = [];
    for (const te of timeEntries) {
      const s = timeEntryToStripe(te, now);
      if (s) stripes.push(s);
    }
    return stripes;
  }, [timeEntries]);

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
      { key: "tags", type: "multi-text", label: "תגים" },
      { key: "onlyMine", type: "boolean", label: "רק שלי" },
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
  const [creatingEvent, setCreatingEvent] = useState<{
    start: Date;
    end: Date;
  } | null>(null);

  const createTask = useCreateTask();
  const handleCreateTask = async () => {
    const now = new Date();
    const start = new Date(now);
    start.setMinutes(0, 0, 0);
    const task = await createTask.mutateAsync({
      title: "",
      task_list_id: null,
      parent_task_id: null,
      scheduled_at: start.toISOString(),
      duration_minutes: 60,
      urgency: 3,
      status: "todo",
    });
    setEditingTaskId(task.id);
  };

  const handleCreateEvent = () => {
    const now = new Date();
    const start = new Date(now);
    start.setMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60_000);
    setCreatingEvent({ start, end });
  };

  const handleItemClick = (item: CalendarItem) => {
    if (item.kind === "task") setEditingTaskId((item.source as { id: string }).id);
    else setEditingEventId((item.source as { id: string }).id);
  };

  const handleCreateAt = (start: Date) => {
    const end = new Date(start.getTime() + 60 * 60_000);
    setCreatingEvent({ start, end });
  };

  const handleMonthDayClick = (day: Date) => {
    setAnchor(day);
    setView("day");
  };

  const toggleListVisibility = (listId: string) => {
    const current = visibility?.hidden_list_ids ?? [];
    const next = current.includes(listId)
      ? current.filter((id) => id !== listId)
      : [...current, listId];
    setListVisibility.mutate({ screenKey: "calendar", hiddenListIds: next });
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

  // Agenda + week + month + day are all peers — agenda is NOT a replacement
  // for week. Same set on every breakpoint.
  const availableViews: CalendarView[] = ["day", "week", "month", "agenda"];

  return (
    <ScreenScaffold title="יומן" subtitle="">
      <div className="space-y-2">
        <CalendarChrome
          view={view}
          onViewChange={setView}
          anchor={anchor}
          onAnchorChange={setAnchor}
          availableViews={availableViews}
          layer={layer}
          onLayerChange={setLayer}
          lists={unifiedLists}
          hiddenListIds={hiddenLists}
          onToggleListVisibility={toggleListVisibility}
          onCreateList={handleCreateList}
          filtersActiveCount={filtersActiveCount}
          filtersOpen={filtersOpen}
          onToggleFilters={() => setFiltersOpen((v) => !v)}
          statsOpen={statsOpen}
          onToggleStats={() => setStatsOpen((v) => !v)}
          onCreateEvent={handleCreateEvent}
          onCreateTask={handleCreateTask}
        />

        {/* Optional filter panel */}
        {filtersOpen && (
          <FilterBar
            screenKey="calendar"
            filters={filters}
            onChange={setFilters}
            fields={fields}
            alwaysExpanded
          />
        )}

        {/* Optional stats panel */}
        {statsOpen && (
          <CalendarStatsStrip
            tasks={tasks}
            events={events}
            timeEntries={timeEntries}
            anchor={anchor}
          />
        )}

        {view === "day" && (
          <CalendarDayView
            date={anchor}
            items={items}
            actualStripes={actualStripes}
            hourStart={effectiveRange.hourStart}
            hourEnd={effectiveRange.hourEnd}
            hourHeight={HOUR_HEIGHT_DAY}
            onItemClick={handleItemClick}
            onCreateAt={handleCreateAt}
          />
        )}
        {view === "week" && (
          <CalendarWeekView
            anchor={anchor}
            items={items}
            actualStripes={actualStripes}
            hourStart={effectiveRange.hourStart}
            hourEnd={effectiveRange.hourEnd}
            hourHeight={HOUR_HEIGHT_WEEK}
            onItemClick={handleItemClick}
            onCreateAt={handleCreateAt}
          />
        )}
        {view === "month" && (
          <CalendarMonthView
            anchor={anchor}
            items={items}
            onItemClick={handleItemClick}
            onDayClick={handleMonthDayClick}
          />
        )}
        {view === "agenda" && (
          <CalendarAgendaView
            anchor={anchor}
            items={items}
            onItemClick={handleItemClick}
            onCreateAt={handleCreateAt}
          />
        )}
      </div>

      <TaskEditModal
        taskId={editingTaskId}
        onClose={() => setEditingTaskId(null)}
        defaultTab="schedule"
      />
      <EventEditModal
        open={!!editingEventId || !!creatingEvent}
        eventId={editingEventId}
        initialStart={creatingEvent?.start}
        initialEnd={creatingEvent?.end}
        onClose={() => {
          setEditingEventId(null);
          setCreatingEvent(null);
        }}
      />
    </ScreenScaffold>
  );
}

function rangeFor(
  view: CalendarView,
  anchor: Date
): { from: Date; to: Date; fromIso: string; toIso: string } {
  let from: Date;
  let to: Date;
  if (view === "day") {
    from = startOfDay(anchor);
    to = addDays(from, 1);
  } else if (view === "week" || view === "agenda") {
    from = startOfWeek(anchor);
    to = addDays(from, view === "agenda" ? 14 : 7);
  } else {
    from = startOfWeek(startOfMonth(anchor));
    const end = endOfMonth(anchor);
    to = addDays(startOfWeek(end), 7);
  }
  return { from, to, fromIso: from.toISOString(), toIso: to.toISOString() };
}
