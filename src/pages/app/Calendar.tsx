import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
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
import { TaskSchedulingPanel } from "@/components/calendar/TaskSchedulingPanel";
import { TaskActionsMenu } from "@/components/calendar/TaskActionsMenu";
import { TimerLogPopup } from "@/components/projects/blocks/TimerLogPopup";
import type { DropAction } from "@/components/calendar/calendar-drag";
import { cn } from "@/lib/utils/cn";
import { CalendarRange, Frame, Eye, EyeOff } from "lucide-react";
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
  expandTaskOccurrences,
  taskExtraOccurrences,
  startOfDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  taskToItem,
  taskDeadlineToItem,
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
import {
  useFrameworks,
  useFrameworkVisibility,
  useSetFrameworkVisibility,
  useFrameworkContentForMany,
  useSetBlockOccurrence,
} from "@/lib/hooks/useFrameworks";
import {
  projectFrameworkBlocks,
  projectFrameworkDayLabels,
} from "@/lib/frameworks/projection";
import type {
  FrameworkBlockOccurrenceView,
  FrameworkDayLabelView,
  FrameworkOccurrenceStatus,
} from "@/lib/types/frameworks";
import { pushUndo } from "@/lib/undo/store";
import type { FilterConfig, Task } from "@/lib/types/domain";

// Min hour-row height. Below this the layout becomes hard to read.
// Mobile mins are intentionally larger than desktop: the page is allowed
// to grow beyond the viewport (scrollable), so we'd rather have roomy,
// non-overlapping task blocks than try to cram 24h into one screen.
const HOUR_HEIGHT_DAY_MIN_DESKTOP = 36;
const HOUR_HEIGHT_WEEK_MIN_DESKTOP = 32;
const HOUR_HEIGHT_DAY_MIN_MOBILE = 80;
const HOUR_HEIGHT_WEEK_MIN_MOBILE = 72;
const MOBILE_BREAKPOINT_PX = 640;
// Vertical chrome above the grid that we have to subtract from the
// viewport: top app bar, screen header, calendar chrome, optional
// filter/stats panels, and the bottom safety margin. Approximate; the
// grid will overflow gracefully if the actual chrome is taller.
const VERTICAL_CHROME_RESERVE = 280;

export function Calendar() {
  const { user } = useAuth();
  const [view, setView] = useState<CalendarView>("week");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [layer, setLayer] = useState<LayerMode>("both");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  // Scheduling mode: a side panel of list tasks the user drags onto the grid.
  const [scheduling, setScheduling] = useState(false);
  // Right-click actions menu for a task (panel or grid).
  const [taskMenu, setTaskMenu] = useState<{
    task: Task;
    x: number;
    y: number;
  } | null>(null);
  const [logTask, setLogTask] = useState<Task | null>(null);
  const [newListDialogOpen, setNewListDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState("");

  const { effectiveRange } = useCalendarPrefs();

  // Dynamic hour-height — stretches the grid to fill the viewport while
  // keeping a sensible floor so rows stay readable on small displays.
  // Re-computes on resize. On mobile the floor is high enough that the
  // grid intentionally overflows the viewport (the user scrolls down),
  // since cramming 24h into one screen makes short tasks overlap visually.
  const [viewportH, setViewportH] = useState(() =>
    typeof window === "undefined" ? 900 : window.innerHeight
  );
  const [viewportW, setViewportW] = useState(() =>
    typeof window === "undefined" ? 1024 : window.innerWidth
  );
  useEffect(() => {
    const onResize = () => {
      setViewportH(window.innerHeight);
      setViewportW(window.innerWidth);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const visibleHours = Math.max(
    1,
    effectiveRange.hourEnd - effectiveRange.hourStart
  );
  const isMobile = viewportW < MOBILE_BREAKPOINT_PX;
  const dayMin = isMobile ? HOUR_HEIGHT_DAY_MIN_MOBILE : HOUR_HEIGHT_DAY_MIN_DESKTOP;
  const weekMin = isMobile ? HOUR_HEIGHT_WEEK_MIN_MOBILE : HOUR_HEIGHT_WEEK_MIN_DESKTOP;
  const dynamicHourHeightDay = Math.max(
    dayMin,
    Math.floor((viewportH - VERTICAL_CHROME_RESERVE) / visibleHours)
  );
  const dynamicHourHeightWeek = Math.max(
    weekMin,
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
  const { notesByDate, noteColorsByDate } = useCalendarDayNotes(
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
        if (t.task_list_id && hiddenLists.has(t.task_list_id)) continue;
        const listColor = listColorById.get(t.task_list_id ?? "") ?? null;
        // Scheduled work block (only if there's a scheduled_at).
        if (t.scheduled_at) {
          const base = taskToItem(t, listColor, user?.id);
          if (base) {
            // Recurring task → expand into per-day occurrences. The master
            // is the anchor; each occurrence is its own CalendarItem with
            // a synthesized id like `task:abc:1234567890` and a per-occurrence
            // `completed` flag based on `completed_occurrences[]`.
            const hasExtras = taskExtraOccurrences(t).length > 0;
            if (t.recurrence_rule || hasExtras) {
              const anchorStart = base.start;
              const duration = base.end.getTime() - anchorStart.getTime();
              // RRULE occurrences merged with ad-hoc extra_occurrences.
              const occurrences = expandTaskOccurrences(
                t,
                base,
                range.from,
                range.to
              );
              const completedSet = new Set(
                Array.isArray(t.completed_occurrences)
                  ? (t.completed_occurrences as unknown[]).filter(
                      (x): x is string => typeof x === "string"
                    )
                  : []
              );
              for (const occStart of occurrences) {
                const isNoTime = occStart.getHours() === 0 && occStart.getMinutes() === 0;
                out.push({
                  ...base,
                  id: `${base.id}:${occStart.getTime()}`,
                  start: occStart,
                  end: new Date(occStart.getTime() + duration),
                  completed: completedSet.has(occStart.toISOString()),
                  allDay: isNoTime,
                });
              }
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
        // Deadline marker — independent of scheduling. Both can coexist for
        // the same task: a work block at 10:00 plus a deadline marker at
        // 17:00 means "I plan to work on it in the morning, it must be done
        // by evening".
        const dl = taskDeadlineToItem(t, listColor);
        if (dl) out.push(dl);
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
          let occurrences: Date[] = [];
          try {
            occurrences = expandRrule(
              e.recurrence_rule,
              anchorStart,
              range.from,
              range.to
            );
          } catch {
            // malformed RRULE — treat as non-recurring
          }
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

  // ── Frameworks layer ────────────────────────────────────────────────────
  // Frameworks are an independent overlay: active ones contribute a banner
  // title, per-day labels, and faded background blocks. Toggling is per-user
  // and separate from list visibility.
  const { data: frameworks = [] } = useFrameworks();
  const { data: visibilityRows = [] } = useFrameworkVisibility();
  const setFrameworkVisibility = useSetFrameworkVisibility();
  const setBlockOccurrence = useSetBlockOccurrence();

  const frameworkActive = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const v of visibilityRows) m.set(v.framework_id, v.is_active);
    return m;
  }, [visibilityRows]);

  const activeFrameworks = useMemo(
    () => frameworks.filter((f) => frameworkActive.get(f.id) !== false),
    [frameworks, frameworkActive]
  );
  const activeFrameworkIds = useMemo(
    () => activeFrameworks.map((f) => f.id),
    [activeFrameworks]
  );
  const { data: frameworkContentById = {} } =
    useFrameworkContentForMany(activeFrameworkIds);

  const { frameworkBlocks, frameworkLabelsByDate } = useMemo(() => {
    const blocks: FrameworkBlockOccurrenceView[] = [];
    const labels = new Map<string, FrameworkDayLabelView[]>();
    for (const f of activeFrameworks) {
      const content = frameworkContentById[f.id];
      if (!content) continue;
      blocks.push(
        ...projectFrameworkBlocks(f, content.blocks, content.occurrences, range.from, range.to)
      );
      const labelMap = projectFrameworkDayLabels(f, content.labels, range.from, range.to);
      for (const [key, view] of labelMap) {
        const arr = labels.get(key) ?? [];
        arr.push(view);
        labels.set(key, arr);
      }
    }
    return { frameworkBlocks: blocks, frameworkLabelsByDate: labels };
  }, [activeFrameworks, frameworkContentById, range]);

  /** Left-click a framework block cycles: none → done → skipped → none. */
  const cycleFrameworkBlock = (occ: FrameworkBlockOccurrenceView) => {
    const next: FrameworkOccurrenceStatus | null =
      occ.status === null ? "done" : occ.status === "done" ? "skipped" : null;
    setBlockOccurrence.mutate({
      blockId: occ.blockId,
      frameworkId: occ.frameworkId,
      date: occ.date,
      status: next,
    });
  };

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

  // Ctrl+N from AppShell opens create-event modal when on this screen.
  useEffect(() => {
    const handler = () => handleCreateEvent();
    window.addEventListener("app:new-event", handler);
    return () => window.removeEventListener("app:new-event", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleItemClick = (item: CalendarItem) => {
    if (item.kind === "task" || item.kind === "deadline")
      setEditingTaskId((item.source as { id: string }).id);
    else setEditingEventId((item.source as { id: string }).id);
  };

  const handleItemContextMenu = (
    item: CalendarItem,
    x: number,
    y: number
  ) => {
    // Right-click actions are task-only (unschedule / duplicate / duration /
    // delete). Events keep the browser's default menu.
    if (item.kind === "task" || item.kind === "deadline") {
      setTaskMenu({ task: item.source as Task, x, y });
    }
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
    if (item.kind === "task" && item.isUnscheduledDraft) {
      // Scheduling a task out of the panel: set its start to the drop time and
      // keep its real duration (null stays null — "no duration", per spec).
      const src = item.source as { id: string; duration_minutes: number | null };
      const nextPatch = {
        scheduled_at: newStart.toISOString(),
        duration_minutes: src.duration_minutes ?? null,
      };
      updateTask.mutate({ taskId: src.id, patch: nextPatch });
      pushUndo({
        description: "שיבוץ משימה",
        undo: () =>
          updateTask.mutate({ taskId: src.id, patch: { scheduled_at: null } }),
        redo: () => updateTask.mutate({ taskId: src.id, patch: nextPatch }),
      });
      return;
    }
    if (item.kind === "task") {
      const taskId = (item.source as { id: string }).id;
      const prevScheduledAt = item.start.toISOString();
      const prevDuration = Math.round(
        (item.end.getTime() - item.start.getTime()) / 60_000
      );
      const nextPatch = {
        scheduled_at: newStart.toISOString(),
        duration_minutes: Math.round(
          (newEnd.getTime() - newStart.getTime()) / 60_000
        ),
      };
      updateTask.mutate({ taskId, patch: nextPatch });
      pushUndo({
        description: action.kind === "move" ? "תזמון משימה" : "שינוי משך משימה",
        undo: () =>
          updateTask.mutate({
            taskId,
            patch: {
              scheduled_at: prevScheduledAt,
              duration_minutes: prevDuration,
            },
          }),
        redo: () => updateTask.mutate({ taskId, patch: nextPatch }),
      });
    } else if (item.kind === "deadline") {
      // Dragging a deadline marker → update the task's deadline_at.
      const taskId = (item.source as { id: string }).id;
      const prevDeadline = item.start.toISOString();
      const nextDeadline = newStart.toISOString();
      updateTask.mutate({ taskId, patch: { deadline_at: nextDeadline } });
      pushUndo({
        description: "שינוי דד-ליין",
        undo: () =>
          updateTask.mutate({ taskId, patch: { deadline_at: prevDeadline } }),
        redo: () =>
          updateTask.mutate({ taskId, patch: { deadline_at: nextDeadline } }),
      });
    } else {
      const eventId = (item.source as { id: string }).id;
      const prevStarts = item.start.toISOString();
      const prevEnds = item.end.toISOString();
      const nextPatch = {
        starts_at: newStart.toISOString(),
        ends_at: newEnd.toISOString(),
      };
      updateEvent.mutate({ eventId, patch: nextPatch });
      pushUndo({
        description: action.kind === "move" ? "תזמון אירוע" : "שינוי משך אירוע",
        undo: () =>
          updateEvent.mutate({
            eventId,
            patch: { starts_at: prevStarts, ends_at: prevEnds },
          }),
        redo: () => updateEvent.mutate({ eventId, patch: nextPatch }),
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

  const handleCreateList = () => {
    setNewListName("");
    setNewListDialogOpen(true);
  };

  const handleCreateListSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = newListName.trim();
    if (!name) return;
    setNewListDialogOpen(false);
    await createTaskList.mutateAsync({ name, kind: "custom" });
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
      {taskMenu && (
        <TaskActionsMenu
          task={taskMenu.task}
          x={taskMenu.x}
          y={taskMenu.y}
          onClose={() => setTaskMenu(null)}
          onOpenTimeLog={(t) => setLogTask(t)}
        />
      )}
      {logTask && (
        <TimerLogPopup task={logTask} onClose={() => setLogTask(null)} />
      )}
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

        {/* Frameworks bar — active frameworks show their title as a filled
            pill (the banner above the calendar); click toggles on/off. */}
        {frameworks.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <span className="inline-flex items-center gap-1 text-xs text-ink-500 shrink-0">
              <Frame className="w-3.5 h-3.5" /> מסגרות
            </span>
            {frameworks.map((f) => {
              const active = frameworkActive.get(f.id) !== false;
              const color = f.color ?? "#6366f1";
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() =>
                    setFrameworkVisibility.mutate({
                      frameworkId: f.id,
                      isActive: !active,
                    })
                  }
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm border transition-colors"
                  style={
                    active
                      ? { background: color, color: "#fff", borderColor: color }
                      : { borderColor: "#e5e7eb", color: "#6b6b80" }
                  }
                  title={active ? "מסגרת פעילה — לחצי לכיבוי" : "מסגרת כבויה — לחצי להפעלה"}
                >
                  {active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>{f.name}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-end pt-1">
          <button
            type="button"
            onClick={() => setScheduling((v) => !v)}
            className={cn(
              "btn-ghost text-sm inline-flex items-center gap-1.5",
              scheduling && "bg-ink-100 text-ink-900"
            )}
            title="גררי משימות מרשימות אל היומן"
          >
            <CalendarRange className="w-4 h-4" />
            {scheduling ? "סגרי מצב שיבוץ" : "מצב שיבוץ משימות"}
          </button>
        </div>

        <div className="flex items-start gap-3">
          {scheduling && (
            <TaskSchedulingPanel
              tasks={tasks}
              taskLists={lists}
              hiddenListIds={hiddenLists}
              onItemDrop={handleItemDrop}
              onOpenTask={(id) => setEditingTaskId(id)}
              onContextMenu={(task, x, y) => setTaskMenu({ task, x, y })}
              onClose={() => setScheduling(false)}
            />
          )}
          <div className="flex-1 min-w-0">
        {view === "day" && (
          <CalendarDayView
            date={anchor}
            items={items}
            actualStripes={actualStripes}
            hourStart={effectiveRange.hourStart}
            hourEnd={effectiveRange.hourEnd}
            hourHeight={dynamicHourHeightDay}
            onItemClick={handleItemClick}
            onItemContextMenu={handleItemContextMenu}
            onCreateAt={handleCreateAt}
            onItemDrop={handleItemDrop}
            dayNote={notesByDate.get(dateKey(anchor))}
            dayNoteColor={noteColorsByDate.get(dateKey(anchor))}
            onDateNoteClick={setEditingNoteDate}
            frameworkBlocks={frameworkBlocks}
            frameworkLabelsByDate={frameworkLabelsByDate}
            onFrameworkBlockClick={cycleFrameworkBlock}
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
            onItemContextMenu={handleItemContextMenu}
            onCreateAt={handleCreateAt}
            onItemDrop={handleItemDrop}
            notesByDate={notesByDate}
            noteColorsByDate={noteColorsByDate}
            onDateNoteClick={setEditingNoteDate}
            frameworkBlocks={frameworkBlocks}
            frameworkLabelsByDate={frameworkLabelsByDate}
            onFrameworkBlockClick={cycleFrameworkBlock}
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
            noteColorsByDate={noteColorsByDate}
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
        </div>
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
        initialColor={
          editingNoteDate
            ? noteColorsByDate.get(dateKey(editingNoteDate)) ?? null
            : null
        }
        onClose={() => setEditingNoteDate(null)}
      />

      {newListDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40" onClick={() => setNewListDialogOpen(false)}>
          <form
            className="bg-white rounded-2xl shadow-lift p-6 w-80 flex flex-col gap-4"
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
