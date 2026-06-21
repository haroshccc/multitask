import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
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
import { CalendarMonthMobile } from "@/components/calendar/CalendarMonthMobile";
import { CalendarAgendaView } from "@/components/calendar/CalendarAgendaView";
import { CalendarStatsStrip } from "@/components/calendar/CalendarStatsStrip";
import { EventEditModal } from "@/components/calendar/EventEditModal";
import { DayNoteDialog } from "@/components/calendar/DayNoteDialog";
import { EventCalendarEditDialog } from "@/components/calendar/EventCalendarEditDialog";
import { DragHoverPill } from "@/components/calendar/DragHoverPill";
import { TaskSchedulingPanel } from "@/components/calendar/TaskSchedulingPanel";
import { MeetingSchedulingPanel } from "@/components/calendar/MeetingSchedulingPanel";
import { TaskActionsMenu } from "@/components/calendar/TaskActionsMenu";
import { TimerLogPopup } from "@/components/projects/blocks/TimerLogPopup";
import type { DropAction } from "@/components/calendar/calendar-drag";
import { cn } from "@/lib/utils/cn";
import {
  CalendarRange,
  Frame,
  Eye,
  EyeOff,
  Users,
  CheckSquare,
  UsersRound,
  ChevronDown,
  X,
  Plus,
} from "lucide-react";
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
  formatDayLong,
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
  useHiddenProjectListIds,
  useHiddenProjectIds,
} from "@/lib/hooks";
import { useCalendarPrefs } from "@/lib/hooks/useCalendarPrefs";
import { useOrgMembers } from "@/lib/hooks/useOrgMembers";
import {
  useMeetingsForProjects,
  useSaveProjectMeeting,
} from "@/lib/hooks/useProjectMeetings";
import {
  useFrameworks,
  useFrameworkVisibility,
  useSetFrameworkVisibility,
  useFrameworkContentForMany,
  useSetBlockOccurrence,
} from "@/lib/hooks/useFrameworks";
import { useMealPlanDays, useMeals } from "@/lib/hooks/useFood";
import { MEAL_TIME_LABELS, type MealTimeKey } from "@/lib/types/domain";
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

// Sort hour for the synthetic all-day meal chips — keeps בוקר before
// צהריים before ערב inside the all-day strip without a timed block.
const MEAL_TIME_SORT_HOUR: Record<string, number> = {
  breakfast: 6,
  lunch: 12,
  between: 16,
  dinner: 19,
  snack: 21,
};

// Stable empty references for non-primary lanes in multi-user mode, where we
// suppress the shared day-notes / framework overlays (they'd repeat per lane).
const EMPTY_DATE_MAP = new Map<string, string>();
const EMPTY_FW_BLOCKS: FrameworkBlockOccurrenceView[] = [];
const EMPTY_FW_LABELS = new Map<string, FrameworkDayLabelView[]>();

export function Calendar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState<CalendarView>("agenda");
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [layer, setLayer] = useState<LayerMode>("both");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  // Mobile: the entire control stack collapses behind the header "minimize"
  // toggle (same concept as the Tasks screen). Default collapsed on mobile.
  const [chromeOpen, setChromeOpen] = useState(false);
  // Mobile month view: tapping a day opens a floating day-view banner over the
  // month (edit/add then close with the X). Null = closed.
  const [mobileDayOpen, setMobileDayOpen] = useState<Date | null>(null);
  // Scheduling mode: a side panel of list tasks the user drags onto the grid.
  const [scheduling, setScheduling] = useState(false);
  // Within scheduling mode: drag tasks (from lists) or meetings (from projects).
  const [panelMode, setPanelMode] = useState<"tasks" | "meetings">("tasks");
  // Multi-user mode: render one copy of the current view per selected person
  // (me always first). Stacked vertically in week/month, side-by-side in
  // day/agenda. `selectedPeople` holds the OTHER users' ids (me is implicit).
  const [multiUser, setMultiUser] = useState(false);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
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

  // Hidden projects (inactive/completed): their tasks (via list) and events
  // (via project_id) are kept off the calendar until set back to active.
  const inactiveListIds = useHiddenProjectListIds();
  const inactiveProjectIds = useHiddenProjectIds();

  // The set the whole calendar (board + scheduling panel + pickers) treats as
  // hidden: user-toggled lists PLUS lists of inactive/completed projects.
  const hiddenLists = useMemo(
    () => new Set([...(visibility?.hidden_list_ids ?? []), ...inactiveListIds]),
    [visibility, inactiveListIds]
  );

  // Meeting-scheduling panel: meetings from every project whose list is
  // currently visible on the calendar (mirrors how the task panel respects
  // list visibility). Hidden project → its meetings drop out of the panel.
  const visibleProjectIds = useMemo(() => {
    const s = new Set<string>();
    for (const l of lists) {
      if (l.project_id && !hiddenLists.has(l.id)) s.add(l.project_id);
    }
    return [...s];
  }, [lists, hiddenLists]);
  const { data: meetings = [] } = useMeetingsForProjects(visibleProjectIds);
  const saveMeeting = useSaveProjectMeeting();

  // Org members → the people picker for multi-user mode (me is always shown
  // first and is implicit, so the picker lists everyone else).
  const { data: orgMembers = [] } = useOrgMembers();
  const profileById = useMemo(() => {
    const m = new Map<
      string,
      { name: string; color: string | null }
    >();
    for (const om of orgMembers) {
      m.set(om.membership.user_id, {
        name: om.profile?.full_name?.trim() || "משתמש",
        color: om.profile?.display_color ?? null,
      });
    }
    return m;
  }, [orgMembers]);
  const otherPeople = useMemo(
    () =>
      orgMembers
        .map((om) => om.membership.user_id)
        .filter((id) => id !== user?.id),
    [orgMembers, user?.id]
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

  // In multi-user mode we need everyone's tasks (not just mine), so the
  // `onlyMine` filter is forced off — each person's lane filters locally.
  const { data: tasks = [] } = useTasks({
    ...filters,
    ...(multiUser ? { onlyMine: false } : null),
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

  // ── Meals overlay ─────────────────────────────────────────────────────────
  // The current user's planned menu (meal_plan_days) rendered as all-day
  // chips — one per (date, meal-time). Synthetic items: clicking navigates
  // to the food module instead of opening an event modal (see the `__meal`
  // guard in handleItemClick). Days without a plan contribute nothing.
  const { data: mealPlanRows = [] } = useMealPlanDays(
    dateKey(range.from),
    dateKey(range.to)
  );
  const { data: meals = [] } = useMeals();
  const mealItems: CalendarItem[] = useMemo(() => {
    const nameById = new Map(meals.map((m) => [m.id, m.name] as const));
    const groups = new Map<
      string,
      { date: string; mealTime: string; names: string[] }
    >();
    for (const r of mealPlanRows) {
      if (r.user_id !== user?.id) continue;
      const key = `${r.date}:${r.meal_time}`;
      let g = groups.get(key);
      if (!g) {
        g = { date: r.date, mealTime: r.meal_time, names: [] };
        groups.set(key, g);
      }
      const name = nameById.get(r.meal_id);
      if (name) g.names.push(name);
    }
    const out: CalendarItem[] = [];
    for (const g of groups.values()) {
      if (g.names.length === 0) continue;
      const [y, m, d] = g.date.split("-").map(Number);
      const hour = MEAL_TIME_SORT_HOUR[g.mealTime] ?? 12;
      const start = new Date(y, (m ?? 1) - 1, d ?? 1, hour, 0, 0, 0);
      const label =
        MEAL_TIME_LABELS[g.mealTime as MealTimeKey] ?? g.mealTime;
      const id = `meal:${g.date}:${g.mealTime}`;
      out.push({
        id,
        kind: "event",
        title: `🍽️ ${label}: ${g.names.join(", ")}`,
        description: "תפריט מתוכנן — לחיצה פותחת את מודול האוכל",
        start,
        end: new Date(start.getTime() + 60 * 60_000),
        allDay: true,
        color: "#f59e0b",
        listId: null,
        calendarId: null,
        completed: false,
        source: {
          __meal: true,
          id,
          owner_id: user?.id ?? "",
        } as unknown as CalendarItem["source"],
      });
    }
    return out;
  }, [mealPlanRows, meals, user?.id]);

  const items: CalendarItem[] = useMemo(() => {
    const out: CalendarItem[] = [];
    if (layer !== "events") {
      for (const t of tasks) {
        if (t.task_list_id && hiddenLists.has(t.task_list_id)) continue;
        if (t.task_list_id && inactiveListIds.has(t.task_list_id)) continue;
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
    // Meals overlay rides along regardless of the task/event layer toggle.
    out.push(...mealItems);
    if (layer !== "tasks") {
      for (const e of events) {
        // Calendar visibility (via the same `hiddenLists` set, which holds
        // both task_list_ids and event_calendar_ids).
        if (e.calendar_id && hiddenLists.has(e.calendar_id)) continue;
        if (e.project_id && inactiveProjectIds.has(e.project_id)) continue;
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
  }, [
    tasks,
    events,
    layer,
    hiddenLists,
    inactiveListIds,
    inactiveProjectIds,
    listColorById,
    calendarColorById,
    range,
    mealItems,
  ]);

  // ── Multi-user lanes ──────────────────────────────────────────────────────
  // One lane per person (me first), each carrying only that person's items.
  // A task belongs to its assignee (the person doing it) when assigned, else
  // its owner; an event belongs to its owner.
  const lanes = useMemo(() => {
    if (!multiUser) return [];
    const laneUserIds = [user?.id, ...selectedPeople].filter(
      (id): id is string => !!id
    );
    return laneUserIds.map((uid) => {
      const isMe = uid === user?.id;
      const profile = profileById.get(uid);
      return {
        id: uid,
        label: isMe ? "אני" : profile?.name ?? "משתמש",
        color: profile?.color ?? null,
        items: items.filter((it) => itemOwnerId(it) === uid),
      };
    });
  }, [multiUser, selectedPeople, user?.id, profileById, items]);

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

  // Allow ?event=<id> in the URL to pre-open the EventEditModal — used by
  // global search and the dashboard agenda. The param is stripped once
  // consumed so closing the modal doesn't snap it back open (mirrors the
  // ?edit= pattern on the Tasks screen).
  const [urlParams, setUrlParams] = useSearchParams();
  useEffect(() => {
    const eventId = urlParams.get("event");
    if (eventId && eventId !== editingEventId) {
      setEditingEventId(eventId);
      const next = new URLSearchParams(urlParams);
      next.delete("event");
      setUrlParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlParams]);
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
    // Synthetic meal chips deep-link to the food module.
    if ((item.source as { __meal?: boolean }).__meal) {
      navigate("/app/food");
      return;
    }
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
    // Dragged out of the meetings panel → set / move the meeting's `meeting_at`
    // and reconcile its linked calendar event (so it appears on the grid). The
    // meeting carries its own `project_id`, so we don't need a project scope.
    if (item.id.startsWith("meeting:")) {
      const meetingId = item.id.slice("meeting:".length);
      const m = meetings.find((x) => x.id === meetingId);
      if (!m) return;
      const prevAt = m.meeting_at;
      const saveAt = (at: string | null) =>
        saveMeeting.mutate(
          {
            id: m.id,
            projectId: m.project_id,
            existingEventId: m.event_id,
            patch: {
              title: m.title,
              meeting_at: at,
              all_day: m.all_day,
              location: m.location,
              status: m.status,
              notes: m.notes,
              summary: m.summary,
              recording_id: m.recording_id,
            },
          },
          {
            onSuccess: () =>
              queryClient.invalidateQueries({ queryKey: ["project-meetings"] }),
          }
        );
      const nextAt = newStart.toISOString();
      saveAt(nextAt);
      pushUndo({
        description: "שיבוץ פגישה",
        undo: () => saveAt(prevAt),
        redo: () => saveAt(nextAt),
      });
      return;
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
      lists
        .filter((l) => !inactiveListIds.has(l.id))
        .map((l) => ({
          id: l.id,
          name: l.name,
          emoji: l.emoji,
          color: l.color,
        })),
    [lists, inactiveListIds]
  );

  // Grouped lists picker: my personal lists first, then lists shared with me,
  // then project lists. Event calendars stay in their own section (rendered by
  // CalendarChrome after these). Empty groups are dropped.
  const listSections = useMemo(() => {
    const toUnified = (l: (typeof lists)[number]) => ({
      id: l.id,
      name: l.name,
      emoji: l.emoji,
      color: l.color,
    });
    const sections: {
      key: string;
      label: string | null;
      lists: typeof unifiedLists;
    }[] = [];

    const mine = lists.filter((l) => !l.project_id && l.owner_id === user?.id);
    if (mine.length > 0)
      sections.push({
        key: "mine",
        label: "רשימות אישיות שלי",
        lists: mine.map(toUnified),
      });

    const shared = lists.filter(
      (l) => !l.project_id && l.owner_id !== user?.id
    );
    if (shared.length > 0)
      sections.push({
        key: "shared",
        label: "רשימות ששותפו איתי",
        lists: shared.map(toUnified),
      });

    const projects = lists.filter(
      (l) => l.project_id && !inactiveListIds.has(l.id)
    );
    if (projects.length > 0)
      sections.push({
        key: "projects",
        label: "פרויקטים",
        lists: projects.map(toUnified),
      });

    return sections;
  }, [lists, unifiedLists, user?.id, inactiveListIds]);

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

  /**
   * Render the calendar body (one of the four views) for a given item set.
   * Extracted so multi-user mode can render one copy per person lane without
   * duplicating the view-switch. `overlays` toggles the shared day-notes and
   * framework overlays — only the primary (first) lane shows them, so they're
   * not repeated across every lane.
   */
  const renderBody = (bodyItems: CalendarItem[], overlays: boolean) => {
    const notes = overlays ? notesByDate : EMPTY_DATE_MAP;
    const noteColors = overlays ? noteColorsByDate : EMPTY_DATE_MAP;
    const fwBlocks = overlays ? frameworkBlocks : EMPTY_FW_BLOCKS;
    const fwLabels = overlays ? frameworkLabelsByDate : EMPTY_FW_LABELS;
    if (view === "day") {
      return (
        <CalendarDayView
          date={anchor}
          items={bodyItems}
          actualStripes={overlays ? actualStripes : []}
          hourStart={effectiveRange.hourStart}
          hourEnd={effectiveRange.hourEnd}
          hourHeight={dynamicHourHeightDay}
          onItemClick={handleItemClick}
          onItemContextMenu={handleItemContextMenu}
          onCreateAt={handleCreateAt}
          onItemDrop={handleItemDrop}
          dayNote={overlays ? notesByDate.get(dateKey(anchor)) : undefined}
          dayNoteColor={
            overlays ? noteColorsByDate.get(dateKey(anchor)) : undefined
          }
          onDateNoteClick={setEditingNoteDate}
          frameworkBlocks={fwBlocks}
          frameworkLabelsByDate={fwLabels}
          onFrameworkBlockClick={cycleFrameworkBlock}
        />
      );
    }
    if (view === "week") {
      return (
        <CalendarWeekView
          anchor={anchor}
          items={bodyItems}
          actualStripes={overlays ? actualStripes : []}
          hourStart={effectiveRange.hourStart}
          hourEnd={effectiveRange.hourEnd}
          hourHeight={dynamicHourHeightWeek}
          onItemClick={handleItemClick}
          onItemContextMenu={handleItemContextMenu}
          onCreateAt={handleCreateAt}
          onItemDrop={handleItemDrop}
          notesByDate={notes}
          noteColorsByDate={noteColors}
          onDateNoteClick={setEditingNoteDate}
          frameworkBlocks={fwBlocks}
          frameworkLabelsByDate={fwLabels}
          onFrameworkBlockClick={cycleFrameworkBlock}
        />
      );
    }
    if (view === "month") {
      return (
        <>
          {/* Mobile: compact dotted month; tapping a day opens a floating
              day-view banner over the month (see overlay below). */}
          <div className="md:hidden">
            <CalendarMonthMobile
              anchor={anchor}
              items={bodyItems}
              onDayClick={(day) => setMobileDayOpen(day)}
            />
          </div>
          <div className="hidden md:block">
            <CalendarMonthView
              anchor={anchor}
              items={bodyItems}
              onItemClick={handleItemClick}
              onItemContextMenu={handleItemContextMenu}
              onDayClick={handleMonthDayClick}
              onCellClick={handleMonthCellClick}
              onItemDrop={handleItemDrop}
              notesByDate={notes}
              noteColorsByDate={noteColors}
              frameworkBlocks={fwBlocks}
              frameworkLabelsByDate={fwLabels}
              onFrameworkBlockClick={cycleFrameworkBlock}
            />
          </div>
        </>
      );
    }
    return (
      <CalendarAgendaView
        anchor={anchor}
        items={bodyItems}
        onItemClick={handleItemClick}
        onItemContextMenu={handleItemContextMenu}
        onCreateAt={handleCreateAt}
        notesByDate={notes}
        onDateNoteClick={setEditingNoteDate}
        frameworkBlocks={fwBlocks}
        frameworkLabelsByDate={fwLabels}
        onFrameworkBlockClick={cycleFrameworkBlock}
      />
    );
  };

  // Layout direction for the lanes: stacked (week/month) vs side-by-side
  // (day/agenda). In RTL a flex-row places the first lane (me) on the right.
  const lanesSideBySide = view === "day" || view === "agenda";

  return (
    <ScreenScaffold
      title="יומן"
      subtitle=""
      icon={<CalendarRange className="w-5 h-5" />}
      chromeCollapsible
      chromeOpen={chromeOpen}
      onToggleChrome={() => setChromeOpen((v) => !v)}
      chromeIndicator={filtersActiveCount > 0}
      mobileExtra={
        // View switch stays exposed in the header row as three buttons
        // (agenda / week / month) even when the rest is minimized on mobile.
        <div className="inline-flex items-center rounded-lg border border-ink-200 bg-white overflow-hidden text-sm">
          {([
            ["agenda", "אג׳נדה"],
            ["week", "שבוע"],
            ["month", "חודש"],
          ] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn(
                "px-2.5 py-1.5 font-medium transition-colors",
                view === v
                  ? "bg-ink-900 text-white"
                  : "text-ink-600 hover:bg-ink-50"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      }
    >
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
        {/* Mobile: the whole control stack (nav + views + frameworks +
            scheduling/multi-user) collapses behind the header minimize toggle
            so the grid starts at the very top. Desktop always shows it. */}
        <div className={cn("space-y-2", chromeOpen ? "block" : "hidden md:block")}>
        <CalendarChrome
          view={view}
          onViewChange={setView}
          anchor={anchor}
          onAnchorChange={setAnchor}
          availableViews={availableViews}
          layer={layer}
          onLayerChange={setLayer}
          lists={unifiedLists}
          listSections={listSections}
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

        <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
          {/* Multi-user mode: toggle + manual people picker. */}
          <MultiUserControl
            active={multiUser}
            onToggle={() =>
              setMultiUser((v) => {
                const next = !v;
                if (next) setScheduling(false);
                return next;
              })
            }
            people={otherPeople}
            profileById={profileById}
            selected={selectedPeople}
            onTogglePerson={(id) =>
              setSelectedPeople((cur) =>
                cur.includes(id)
                  ? cur.filter((x) => x !== id)
                  : [...cur, id]
              )
            }
          />

          {/* Scheduling mode: task list ↔ project meetings toggle (only while
              the panel is open) + the open/close button. */}
          {scheduling && (
            <div className="inline-flex items-center rounded-md border border-ink-200 bg-white overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setPanelMode("tasks")}
                className={cn(
                  "px-2.5 py-1.5 inline-flex items-center gap-1",
                  panelMode === "tasks"
                    ? "bg-ink-900 text-white"
                    : "text-ink-600 hover:bg-ink-50"
                )}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                משימות
              </button>
              <button
                type="button"
                onClick={() => setPanelMode("meetings")}
                className={cn(
                  "px-2.5 py-1.5 inline-flex items-center gap-1",
                  panelMode === "meetings"
                    ? "bg-ink-900 text-white"
                    : "text-ink-600 hover:bg-ink-50"
                )}
              >
                <Users className="w-3.5 h-3.5" />
                פגישות
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() =>
              setScheduling((v) => {
                const next = !v;
                if (next) setMultiUser(false);
                return next;
              })
            }
            className={cn(
              "btn-ghost text-sm inline-flex items-center gap-1.5",
              scheduling && "bg-ink-100 text-ink-900"
            )}
            title="גררי משימות או פגישות אל היומן"
          >
            <CalendarRange className="w-4 h-4" />
            {scheduling ? "סגרי מצב שיבוץ" : "מצב שיבוץ"}
          </button>
        </div>
        </div>

        <div className="flex items-start gap-3">
          {scheduling &&
            (panelMode === "tasks" ? (
              <TaskSchedulingPanel
                tasks={tasks}
                taskLists={lists}
                hiddenListIds={hiddenLists}
                onItemDrop={handleItemDrop}
                onOpenTask={(id) => setEditingTaskId(id)}
                onContextMenu={(task, x, y) => setTaskMenu({ task, x, y })}
                onClose={() => setScheduling(false)}
                wide={view === "day" || view === "agenda"}
              />
            ) : (
              <MeetingSchedulingPanel
                meetings={meetings}
                onItemDrop={handleItemDrop}
                onOpenMeeting={(meetingId) => {
                  const m = meetings.find((x) => x.id === meetingId);
                  if (m)
                    navigate(`/app/projects/${m.project_id}/meetings`);
                }}
                onClose={() => setScheduling(false)}
                wide={view === "day" || view === "agenda"}
              />
            ))}
          <div className="flex-1 min-w-0">
            {multiUser ? (
              <div
                className={cn(
                  lanesSideBySide
                    ? "flex items-start gap-3"
                    : "flex flex-col gap-4"
                )}
              >
                {lanes.map((lane, i) => (
                  <section
                    key={lane.id}
                    className={cn(
                      "min-w-0",
                      lanesSideBySide ? "flex-1" : "w-full"
                    )}
                  >
                    <header className="flex items-center gap-1.5 mb-1 px-1">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: lane.color ?? "#6b6b80" }}
                      />
                      <span className="text-sm font-semibold text-ink-800 truncate">
                        {lane.label}
                      </span>
                    </header>
                    {renderBody(lane.items, i === 0)}
                  </section>
                ))}
              </div>
            ) : (
              renderBody(items, true)
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
            className="bg-white rounded-2xl shadow-lift p-6 w-80 max-w-[calc(100vw-1.5rem)] flex flex-col gap-4"
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
      {/* Mobile: floating day-view banner opened from the compact month.
          The month stays underneath; close with the X. Hidden while a
          create/edit modal is open so that modal isn't covered by the
          banner (it reappears when the modal closes). */}
      {mobileDayOpen &&
        !creating &&
        !editingTaskId &&
        !editingEventId &&
        !editingNoteDate && (
        <div
          className="md:hidden fixed inset-0 z-50 flex items-center justify-center p-3 bg-ink-900/40"
          onClick={() => setMobileDayOpen(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-lift w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-ink-200 shrink-0">
              <h3 className="font-semibold text-ink-900 text-sm flex-1 truncate">
                {formatDayLong(mobileDayOpen)}
              </h3>
              <button
                type="button"
                onClick={() => {
                  const start = new Date(mobileDayOpen);
                  start.setHours(effectiveRange.hourStart, 0, 0, 0);
                  handleCreateAt(start);
                }}
                className="p-1.5 rounded-md text-ink-600 hover:bg-ink-100"
                title="הוספת משימה/אירוע"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setMobileDayOpen(null)}
                className="p-1.5 rounded-md text-ink-500 hover:bg-ink-100"
                title="סגירה"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <CalendarDayView
                date={mobileDayOpen}
                items={items}
                actualStripes={actualStripes}
                hourStart={effectiveRange.hourStart}
                hourEnd={effectiveRange.hourEnd}
                hourHeight={dynamicHourHeightDay}
                onItemClick={handleItemClick}
                onItemContextMenu={handleItemContextMenu}
                onCreateAt={handleCreateAt}
                onItemDrop={handleItemDrop}
                dayNote={notesByDate.get(dateKey(mobileDayOpen))}
                dayNoteColor={noteColorsByDate.get(dateKey(mobileDayOpen))}
                onDateNoteClick={setEditingNoteDate}
                frameworkBlocks={frameworkBlocks}
                frameworkLabelsByDate={frameworkLabelsByDate}
                onFrameworkBlockClick={cycleFrameworkBlock}
              />
            </div>
          </div>
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

/**
 * The user a calendar item "belongs to" in the multi-user lanes: a task's
 * assignee (the person actually doing it) if set, otherwise its owner; an
 * event belongs to its owner.
 */
function itemOwnerId(item: CalendarItem): string | null {
  const src = item.source as {
    owner_id?: string | null;
    assignee_user_id?: string | null;
  };
  if (item.kind === "task" || item.kind === "deadline") {
    return src.assignee_user_id ?? src.owner_id ?? null;
  }
  return src.owner_id ?? null;
}

/**
 * Multi-user mode control: a toggle button plus a caret that opens a manual
 * people picker. "Me" is always the first lane and implicit, so the picker
 * only lists the other org members. The dropdown can be opened to pre-pick
 * people even before the mode is turned on.
 */
function MultiUserControl({
  active,
  onToggle,
  people,
  profileById,
  selected,
  onTogglePerson,
}: {
  active: boolean;
  onToggle: () => void;
  people: string[];
  profileById: Map<string, { name: string; color: string | null }>;
  selected: string[];
  onTogglePerson: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <div className="inline-flex items-center rounded-md border border-ink-200 bg-white overflow-hidden">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "text-sm inline-flex items-center gap-1.5 px-2.5 py-1.5",
            active ? "bg-ink-900 text-white" : "text-ink-700 hover:bg-ink-50"
          )}
          title="הצגת היומנים של כמה משתמשים זה מעל זה"
        >
          <UsersRound className="w-4 h-4" />
          ריבוי משתמשים
          {selected.length > 0 && (
            <span
              className={cn(
                "text-[10px] rounded-full px-1.5 leading-4",
                active ? "bg-white/25 text-white" : "bg-ink-100 text-ink-600"
              )}
            >
              {selected.length + 1}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="px-1.5 py-1.5 border-s border-ink-200 text-ink-500 hover:bg-ink-50"
          title="בחירת אנשים"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {open && (
        <div className="absolute top-full end-0 mt-1 z-50 w-56 bg-white rounded-xl shadow-lift border border-ink-200 overflow-hidden">
          <div className="px-3 py-2 border-b border-ink-100 text-[11px] text-ink-400">
            בחרי אנשים להצגה לצד היומן שלך
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {people.length === 0 ? (
              <p className="px-3 py-3 text-xs text-ink-400 text-center">
                אין משתמשים נוספים בארגון
              </p>
            ) : (
              people.map((id) => {
                const p = profileById.get(id);
                const checked = selected.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onTogglePerson(id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-start hover:bg-ink-50"
                  >
                    <input
                      type="checkbox"
                      readOnly
                      checked={checked}
                      className="pointer-events-none"
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: p?.color ?? "#6b6b80" }}
                    />
                    <span className="truncate text-ink-800">
                      {p?.name ?? "משתמש"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
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
