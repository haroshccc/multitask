import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { ListsBanner } from "@/components/lists/ListsBanner";
import {
  FilterBar,
  useFiltersFromUrl,
  type FilterField,
} from "@/components/filters/FilterBar";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";
import {
  CalendarToolbar,
  type CalendarView,
} from "@/components/calendar/CalendarToolbar";
import { TasksEventsToggle } from "@/components/calendar/TasksEventsToggle";
import { CalendarDayView } from "@/components/calendar/CalendarDayView";
import { CalendarWeekView } from "@/components/calendar/CalendarWeekView";
import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import { CalendarAgendaView } from "@/components/calendar/CalendarAgendaView";
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
  useTaskLists,
  useTasks,
  useTimeEntriesByRange,
} from "@/lib/hooks";
import { useCalendarPrefs } from "@/lib/hooks/useCalendarPrefs";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import type { FilterConfig } from "@/lib/types/domain";

const HOUR_HEIGHT_DAY = 48;
const HOUR_HEIGHT_WEEK = 40;

export function Calendar() {
  const isNarrow = useMediaQuery("(max-width: 768px)");

  // Default view — week on desktop, agenda on mobile. Users can still flip.
  const [view, setView] = useState<CalendarView>(() =>
    isNarrow ? "agenda" : "week"
  );
  // When the viewport crosses the breakpoint, gently nudge to the sensible
  // default but let the user override afterwards.
  useEffect(() => {
    if (isNarrow && (view === "week" || view === "month")) {
      setView("agenda");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNarrow]);

  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [layer, setLayer] = useState<LayerMode>("both");

  const { effectiveRange } = useCalendarPrefs();

  const [filters, setFilters] = useFiltersFromUrl();
  const { data: lists = [] } = useTaskLists();
  const { data: visibility } = useListVisibility("calendar");
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
          label: `${l.emoji ?? ""} ${l.name}`.trim(),
        })),
      },
      { key: "tags", type: "multi-text", label: "תגים" },
      { key: "onlyMine", type: "boolean", label: "רק שלי" },
    ],
    [lists]
  );

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [creatingEvent, setCreatingEvent] = useState<{
    start: Date;
    end: Date;
  } | null>(null);

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

  const availableViews: CalendarView[] = isNarrow
    ? ["day", "agenda", "month"]
    : ["day", "week", "month", "agenda"];

  return (
    <ScreenScaffold
      title="יומן"
      subtitle="יום · שבוע · חודש · אג׳נדה — משימות ואירועים באותה רצועת זמן, עם השוואת מתוכנן ובפועל."
      actions={
        <button
          onClick={() => {
            const now = new Date();
            const start = new Date(now.getTime());
            start.setMinutes(0, 0, 0);
            const end = new Date(start.getTime() + 60 * 60_000);
            setCreatingEvent({ start, end });
          }}
          className="btn-accent text-xs"
          type="button"
        >
          <Plus className="w-4 h-4" />
          אירוע חדש
        </button>
      }
    >
      <div className="space-y-3">
        <ListsBanner
          screenKey="calendar"
          kind="task"
          extra={<TasksEventsToggle value={layer} onChange={setLayer} />}
        />
        <FilterBar
          screenKey="calendar"
          filters={filters}
          onChange={setFilters}
          fields={fields}
        />
        <CalendarToolbar
          view={view}
          onViewChange={setView}
          anchor={anchor}
          onAnchorChange={setAnchor}
          availableViews={availableViews}
        />

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

        <CalendarLegend />
      </div>

      <TaskEditModal taskId={editingTaskId} onClose={() => setEditingTaskId(null)} />
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

function CalendarLegend() {
  return (
    <div className="text-[11px] text-ink-500 flex items-center gap-4 flex-wrap px-1">
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block w-4 h-2 rounded-sm"
          style={{ border: "1.5px solid #6b6b80", backgroundColor: "white" }}
        />
        משימה מתוזמנת
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block w-4 h-2 rounded-sm"
          style={{
            border: "1.5px solid #f59e0b",
            backgroundColor: "rgba(245, 158, 11, 0.85)",
          }}
        />
        אירוע
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block w-4 h-2 rounded-sm"
          style={{ border: "1.5px solid #ef4444", backgroundColor: "rgba(239, 68, 68, 0.1)" }}
        />
        משימה באיחור
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block w-4 h-2 rounded-sm"
          style={{
            border: "1.5px solid #6b6b80",
            backgroundColor: "rgba(107, 107, 128, 0.35)",
          }}
        />
        זמן בפועל
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block w-3 h-0.5 bg-danger-500" />
        כעת
      </span>
    </div>
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
