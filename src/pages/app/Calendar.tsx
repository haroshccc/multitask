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
  useListVisibility,
  useSetListVisibility,
  useTaskLists,
  useCreateTaskList,
  useTasks,
  useTimeEntriesByRange,
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
      for (const e of events) {
        const base = eventToItem(e);
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
  }, [tasks, events, layer, hiddenLists, listColorById, range]);

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

  /** Click on an empty time-slot in any view → open the picker (defaults
   *  to event since that's the most common create). The user can flip to
   *  task via the toggle inside the modal. */
  const handleCreateAt = (start: Date) => {
    const end = new Date(start.getTime() + 60 * 60_000);
    setCreating({ start, end, kind: "event" });
  };

  /** Month-view: click on a day cell area (not the date digit) opens the
   *  picker pinned to 9:00 of that day. Clicking the digit still navigates
   *  to day view (the existing affordance). */
  const handleMonthDayClick = (day: Date) => {
    setAnchor(day);
    setView("day");
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
            onCellClick={handleMonthCellClick}
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
