import { useEffect, useMemo, useState } from "react";
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
import { DayNoteDialog } from "@/components/calendar/DayNoteDialog";
import { EventCalendarEditDialog } from "@/components/calendar/EventCalendarEditDialog";
import { DragHoverPill } from "@/components/calendar/DragHoverPill";
import type { DropAction } from "@/components/calendar/calendar-drag";
import {
  useCalendarDayNotes,
} from "@/lib/hooks/useCalendarDayNotes";
import { dateKey } from "@/lib/services/calendar-day-notes";
import {
  type CalendarItem,
  type LayerMode,
  addDays,
  eventToItem,
  expandRrule,
  startOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  taskToItem,
  timeEntryToStripe,
} from "@/components/calendar/calendar-utils";
import {
  useEvents,
  useEventCalendars,
  useListVisibility,
  useSetListVisibility,
  useTaskLists,
  useCreateTaskList,
  useTasks,
  useTimeEntriesByRange,
  useUpdateEvent,
  useUpdateTask,
} from "@/lib/hooks";
import { useCalendarPrefs } from "@/lib/hooks/useCalendarPrefs";
import type { FilterConfig } from "@/lib/types/domain";

// Min hour-row height. Below this the layout becomes hard to read.
const HOUR_HEIGHT_DAY_MIN = 36;
const HOUR_HEIGHT_WEEK_MIN = 32;
// Vertical chrome above the grid that we have to subtract from the
// viewport: top app bar, screen header, calendar chrome, optional
// filter/stats panels, and the bottom safety margin. Approximate; the
// grid will overflow gracefully if the actual chrome is taller.
const VERTICAL_CHROME_RESERVE = 280;

export function Calendar() {
  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [layer, setLayer] = useState<LayerMode>("both");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  const { effectiveRange } = useCalendarPrefs();

  // Dynamic hour-height — stretches the grid to fill the viewport while
  // keeping a sensible floor so rows stay readable on small displays.
  // Re-computes on resize.
  const [viewportH, setViewportH] = useState(() =>
    typeof window === "undefined" ? 900 : window.innerHeight
  );
  useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const visibleHours = Math.max(
    1,
    effectiveRange.hourEnd - effectiveRange.hourStart
  );
  const dynamicHourHeightDay = Math.max(
    HOUR_HEIGHT_DAY_MIN,
    Math.floor((viewportH - VERTICAL_CHROME_RESERVE) / visibleHours)
  );
  const dynamicHourHeightWeek = Math.max(
    HOUR_HEIGHT_WEEK_MIN,
    Math.floor((viewportH - VERTICAL_CHROME_RESERVE) / visibleHours)
  );

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

  // Per-day notes for the visible window. Empty `notesByDate` is fine —
  // the views just render the date digit without a note next to it.
  const { notesByDate } = useCalendarDayNotes(
    dateKey(range.from),
    dateKey(range.to)
  );
  // Open the per-day note editor when the user clicks a date digit.
  const [editingNoteDate, setEditingNoteDate] = useState<Date | null>(null);

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

  const { data: eventCalendars = [] } = useEventCalendars();
  const calendarColorById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const c of eventCalendars) m.set(c.id, c.color);
    return m;
  }, [eventCalendars]);
  // Visibility for event calendars piggybacks on the same `hidden_list_ids`
  // set as task lists — both are UUIDs and never collide. Toggling either
  // pushes/pulls the id from the same array.

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
      for (const e of events) {
        // Calendar visibility (via the same `hiddenLists` set, which holds
        // both task_list_ids and event_calendar_ids).
        if (e.calendar_id && hiddenLists.has(e.calendar_id)) continue;
        const base = eventToItem(e, calendarColorById);
        // Recurring event → expand into concrete occurrences inside the window.
        // The server returns the master row (its own `starts_at` as the anchor).
        if (e.recurrence_rule) {
          const anchorStart = base.start;
          const duration = base.end.getTime() - anchorStart.getTime();
          const occurrences = expandRrule(
            e.recurrence_rule,
            anchorStart,
            range.from,
            range.to
          );
          for (const occStart of occurrences) {
            out.push({
              ...base,
              id: `${base.id}:${occStart.getTime()}`,
              start: occStart,
              end: new Date(occStart.getTime() + duration),
            });
          }
          // If the master itself falls inside the window but `expandRrule`
          // didn't emit it (edge case: rules like "weekly on TU" anchored on a
          // MON), still show it so the user can edit the series.
          if (
            occurrences.length === 0 &&
            anchorStart >= range.from &&
            anchorStart < range.to
          ) {
            out.push(base);
          }
        } else {
          out.push(base);
        }
      }
    }
    return out;
  }, [tasks, events, layer, hiddenLists, listColorById, calendarColorById, range]);

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
  /**
   * Single "create" state shared by event and task. The user can flip
   * between the two via the picker rendered inside the modal's `topSlot`.
   * The actual create only happens on save — discarding never persists.
   */
  const [creating, setCreating] = useState<{
    start: Date;
    end: Date;
    kind: "event" | "task";
  } | null>(null);

  const handleCreateTask = () => {
    const now = new Date();
    const start = new Date(now);
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    const end = new Date(start.getTime() + 60 * 60_000);
    setCreating({ start, end, kind: "task" });
  };

  const handleCreateEvent = () => {
    const now = new Date();
    const start = new Date(now);
    start.setMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60_000);
    setCreating({ start, end, kind: "event" });
  };

  const handleItemClick = (item: CalendarItem) => {
    if (item.kind === "task") setEditingTaskId((item.source as { id: string }).id);
    else setEditingEventId((item.source as { id: string }).id);
  };

  const updateTask = useUpdateTask();
  const updateEvent = useUpdateEvent();

  /**
   * Persist a drag-drop change. Three modes: pure move (preserve duration),
   * resize-end (extend/shrink toward later — change end only), resize-start
   * (drag the leading edge — change start only). For tasks, "end" is
   * scheduled_at + duration_minutes, so resize-end updates duration; resize
   * -start updates both scheduled_at and duration to keep the implicit end
   * fixed.
   */
  const handleItemDrop = (item: CalendarItem, action: DropAction) => {
    let newStart = item.start;
    let newEnd = item.end;
    if (action.kind === "move") {
      const durationMs = item.end.getTime() - item.start.getTime();
      newStart = action.date;
      newEnd = new Date(newStart.getTime() + durationMs);
    } else if (action.kind === "resize-end") {
      newEnd = action.date;
      // Guard: never let end fall below start + 15min.
      if (newEnd.getTime() <= newStart.getTime()) {
        newEnd = new Date(newStart.getTime() + 15 * 60_000);
      }
    } else if (action.kind === "resize-start") {
      newStart = action.date;
      if (newStart.getTime() >= newEnd.getTime()) {
        newStart = new Date(newEnd.getTime() - 15 * 60_000);
      }
    }
    if (item.kind === "task") {
      const taskId = (item.source as { id: string }).id;
      updateTask.mutate({
        taskId,
        patch: {
          scheduled_at: newStart.toISOString(),
          duration_minutes: Math.round(
            (newEnd.getTime() - newStart.getTime()) / 60_000
          ),
        },
      });
    } else {
      const eventId = (item.source as { id: string }).id;
      updateEvent.mutate({
        eventId,
        patch: {
          starts_at: newStart.toISOString(),
          ends_at: newEnd.toISOString(),
        },
      });
    }
  };

  /** Click on an empty time-slot in any view → open the picker (defaults
   *  to event since that's the most common create). The user can flip to
   *  task via the toggle inside the modal. */
  const handleCreateAt = (start: Date) => {
    const end = new Date(start.getTime() + 60 * 60_000);
    setCreating({ start, end, kind: "event" });
  };

  /** Month-view: click on the date digit → open the per-day note editor
   *  (consistent with the other views). Cell-area click → create picker. */
  const handleMonthDayClick = (day: Date) => {
    setEditingNoteDate(day);
  };

  const handleMonthCellClick = (day: Date) => {
    const start = new Date(day);
    start.setHours(9, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60_000);
    setCreating({ start, end, kind: "event" });
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

  const unifiedCalendars = useMemo(
    () =>
      eventCalendars.map((c) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        color: c.color,
      })),
    [eventCalendars]
  );

  // Edit-state for event-calendar create / edit dialog.
  const [calendarDialog, setCalendarDialog] = useState<{
    open: boolean;
    calendarId: string | null;
  }>({ open: false, calendarId: null });
  const editingCalendar = useMemo(
    () =>
      calendarDialog.calendarId
        ? eventCalendars.find((c) => c.id === calendarDialog.calendarId) ?? null
        : null,
    [calendarDialog.calendarId, eventCalendars]
  );

  // Agenda + week + month + day are all peers — agenda is NOT a replacement
  // for week. Same set on every breakpoint.
  const availableViews: CalendarView[] = ["day", "week", "month", "agenda"];

  return (
    <ScreenScaffold title="יומן" subtitle="">
      <DragHoverPill />
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
          eventCalendars={unifiedCalendars}
          onToggleCalendarVisibility={toggleListVisibility}
          onCreateCalendar={() =>
            setCalendarDialog({ open: true, calendarId: null })
          }
          onEditCalendar={(calId) =>
            setCalendarDialog({ open: true, calendarId: calId })
          }
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
            hourHeight={dynamicHourHeightDay}
            onItemClick={handleItemClick}
            onCreateAt={handleCreateAt}
            onItemDrop={handleItemDrop}
            dayNote={notesByDate.get(dateKey(anchor))}
            onDateNoteClick={setEditingNoteDate}
          />
        )}
        {view === "week" && (
          <CalendarWeekView
            anchor={anchor}
            items={items}
            actualStripes={actualStripes}
            hourStart={effectiveRange.hourStart}
            hourEnd={effectiveRange.hourEnd}
            hourHeight={dynamicHourHeightWeek}
            onItemClick={handleItemClick}
            onCreateAt={handleCreateAt}
            onItemDrop={handleItemDrop}
            notesByDate={notesByDate}
            onDateNoteClick={setEditingNoteDate}
          />
        )}
        {view === "month" && (
          <CalendarMonthView
            anchor={anchor}
            items={items}
            onItemClick={handleItemClick}
            onDayClick={handleMonthDayClick}
            onCellClick={handleMonthCellClick}
            onItemDrop={handleItemDrop}
            notesByDate={notesByDate}
          />
        )}
        {view === "agenda" && (
          <CalendarAgendaView
            anchor={anchor}
            items={items}
            onItemClick={handleItemClick}
            onCreateAt={handleCreateAt}
            notesByDate={notesByDate}
            onDateNoteClick={setEditingNoteDate}
          />
        )}
      </div>

      {/* Edit-existing-task modal */}
      <TaskEditModal
        taskId={editingTaskId}
        onClose={() => setEditingTaskId(null)}
        defaultTab="schedule"
      />

      {/* Edit-existing-event modal */}
      <EventEditModal
        open={!!editingEventId}
        eventId={editingEventId}
        onClose={() => setEditingEventId(null)}
      />

      {/* Create-flow: a single picker drives either a new event or a new
          task, with the toggle living in the modal's top slot so the user
          can flip without losing the time/date context. The entity is only
          persisted on save — discarding the modal creates nothing. */}
      {creating?.kind === "event" && (
        <EventEditModal
          open
          eventId={null}
          initialStart={creating.start}
          initialEnd={creating.end}
          onClose={() => setCreating(null)}
          topSlot={
            <CreateKindToggle
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
            <CreateKindToggle
              kind="task"
              onChange={(k) =>
                setCreating((c) => (c ? { ...c, kind: k } : c))
              }
            />
          }
        />
      )}

      {/* Per-day note editor — opens when the user clicks a date digit
          in any calendar view. */}
      <EventCalendarEditDialog
        open={calendarDialog.open}
        calendar={editingCalendar}
        onClose={() => setCalendarDialog({ open: false, calendarId: null })}
      />

      <DayNoteDialog
        date={editingNoteDate}
        initialBody={
          editingNoteDate ? notesByDate.get(dateKey(editingNoteDate)) ?? "" : ""
        }
        onClose={() => setEditingNoteDate(null)}
      />
    </ScreenScaffold>
  );
}

/**
 * Two-button toggle for the "create event vs create task" picker. Lives
 * inside both modals' `topSlot` and lifts state to the parent so flipping
 * preserves the time/date context.
 */
function CreateKindToggle({
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
