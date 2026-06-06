import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CalendarRange,
  GanttChartSquare,
  CalendarDays,
  CheckSquare,
  Users,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useProjectContext } from "@/pages/app/ProjectShell";
import { cn } from "@/lib/utils/cn";

import { type CalendarView } from "@/components/calendar/CalendarToolbar";
import { CalendarChrome } from "@/components/calendar/CalendarChrome";
import { CalendarDayView } from "@/components/calendar/CalendarDayView";
import { CalendarWeekView } from "@/components/calendar/CalendarWeekView";
import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import { CalendarAgendaView } from "@/components/calendar/CalendarAgendaView";
import { EventEditModal } from "@/components/calendar/EventEditModal";
import { DragHoverPill } from "@/components/calendar/DragHoverPill";
import { TaskSchedulingPanel } from "@/components/calendar/TaskSchedulingPanel";
import { MeetingSchedulingPanel } from "@/components/calendar/MeetingSchedulingPanel";
import { TaskEditModal } from "@/components/tasks/TaskEditModal";
import type { DropAction } from "@/components/calendar/calendar-drag";
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
} from "@/components/calendar/calendar-utils";

import { GanttTable } from "@/components/gantt/GanttTable";
import { GanttGrid } from "@/components/gantt/GanttGrid";
import {
  type GanttRow,
  buildRows,
  startOfDay as ganttStartOfDay,
} from "@/components/gantt/gantt-utils";

import { useTaskLists, useCreateTaskList } from "@/lib/hooks/useTaskLists";
import { useTasks, useUpdateTask, useCreateTask } from "@/lib/hooks/useTasks";
import { useEvents, useUpdateEvent, useCreateEvent } from "@/lib/hooks/useEvents";
import { useEventCalendars } from "@/lib/hooks/useEventCalendars";
import {
  useProjectMeetings,
  useCreateProjectMeeting,
  useSaveProjectMeeting,
} from "@/lib/hooks/useProjectMeetings";
import { pushUndo } from "@/lib/undo/store";
import type { Task } from "@/lib/types/domain";

const MODE_KEY = "multitask.projectCalendar.mode";
const VIEW_KEY = "multitask.projectCalendar.view";

type Mode = "calendar" | "gantt";

const HOUR_START = 6;
const HOUR_END = 23;
const DAY_HOUR_HEIGHT = 44;
const WEEK_HOUR_HEIGHT = 40;

export function ProjectCalendarTab() {
  const { projectId, project } = useProjectContext();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window === "undefined") return "calendar";
    return localStorage.getItem(MODE_KEY) === "gantt" ? "gantt" : "calendar";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  const [view, setView] = useState<CalendarView>(() => {
    if (typeof window === "undefined") return "week";
    const raw = localStorage.getItem(VIEW_KEY);
    return raw === "day" || raw === "week" || raw === "month" || raw === "agenda"
      ? (raw as CalendarView)
      : "week";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [layer, setLayer] = useState<LayerMode>("both");

  const { data: lists = [] } = useTaskLists();
  const { data: eventCalendars = [] } = useEventCalendars();
  const { data: meetings = [] } = useProjectMeetings(projectId);

  // The list(s) that belong to THIS project — visible by default. Everything
  // else (other projects' lists, general lists, event calendars) is hidden by
  // default and can be turned on per-project via the calendar's "רשימות"
  // picker, so the project calendar can show context from across the workspace.
  const projectListIds = useMemo(
    () => new Set(lists.filter((l) => l.project_id === projectId).map((l) => l.id)),
    [lists, projectId]
  );
  const projectList = useMemo(
    () => lists.find((l) => l.project_id === projectId) ?? null,
    [lists, projectId]
  );

  // ── Cross-project visibility (persisted per project) ────────────────────────
  // `hidden`  — project list ids the user turned OFF (default: all shown).
  // `extra`   — non-project list / calendar ids the user turned ON.
  // Adjusted during render when the project changes (the tab stays mounted
  // across :projectId param changes).
  const [vis, setVis] = useState<{
    projectId: string;
    hidden: Set<string>;
    extra: Set<string>;
  }>(() => ({
    projectId,
    hidden: loadIdSet(visHiddenKey(projectId)),
    extra: loadIdSet(visExtraKey(projectId)),
  }));
  if (vis.projectId !== projectId) {
    setVis({
      projectId,
      hidden: loadIdSet(visHiddenKey(projectId)),
      extra: loadIdSet(visExtraKey(projectId)),
    });
  }
  useEffect(() => {
    if (vis.projectId !== projectId) return;
    try {
      localStorage.setItem(visHiddenKey(projectId), JSON.stringify([...vis.hidden]));
      localStorage.setItem(visExtraKey(projectId), JSON.stringify([...vis.extra]));
    } catch {
      /* ignore quota / private-mode errors */
    }
  }, [vis, projectId]);

  const isVisible = (id: string | null | undefined): boolean => {
    if (!id) return false;
    return projectListIds.has(id) ? !vis.hidden.has(id) : vis.extra.has(id);
  };

  const toggleVisibility = (id: string) => {
    setVis((v) => {
      if (projectListIds.has(id)) {
        const hidden = new Set(v.hidden);
        if (hidden.has(id)) hidden.delete(id);
        else hidden.add(id);
        return { ...v, hidden };
      }
      const extra = new Set(v.extra);
      if (extra.has(id)) extra.delete(id);
      else extra.add(id);
      return { ...v, extra };
    });
  };

  // Hidden-set the CalendarChrome picker consumes (covers both lists and
  // event calendars; UUIDs never collide).
  const hiddenListIds = useMemo(() => {
    const s = new Set<string>();
    for (const l of lists) if (!isVisible(l.id)) s.add(l.id);
    for (const c of eventCalendars) if (!isVisible(c.id)) s.add(c.id);
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lists, eventCalendars, projectListIds, vis]);

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

  // Grouped lists picker: the project first (labeled with the project name,
  // checked by default), then other projects' lists, then the user's personal
  // lists, then lists shared with the user. Empty groups are dropped.
  const listSections = useMemo(() => {
    const toUnified = (l: (typeof lists)[number]) => ({
      id: l.id,
      name: l.name,
      emoji: l.emoji,
      color: l.color,
    });
    const sections: { key: string; label: string | null; lists: typeof unifiedLists }[] =
      [];

    const projLists = lists.filter((l) => l.project_id === projectId);
    if (projLists.length > 0) {
      sections.push({
        key: "project",
        label: "פרויקט",
        // Single list → show the project's name; multiple → keep list names.
        lists: projLists.map((l) =>
          projLists.length === 1 ? { ...toUnified(l), name: project.name } : toUnified(l)
        ),
      });
    }

    const otherProjectLists = lists.filter(
      (l) => l.project_id && l.project_id !== projectId
    );
    if (otherProjectLists.length > 0) {
      sections.push({
        key: "other-projects",
        label: "פרויקטים נוספים",
        lists: otherProjectLists.map(toUnified),
      });
    }

    const myLists = lists.filter(
      (l) => !l.project_id && l.owner_id === user?.id
    );
    if (myLists.length > 0) {
      sections.push({
        key: "mine",
        label: "רשימות אישיות שלי",
        lists: myLists.map(toUnified),
      });
    }

    const sharedLists = lists.filter(
      (l) => !l.project_id && l.owner_id !== user?.id
    );
    if (sharedLists.length > 0) {
      sections.push({
        key: "shared",
        label: "רשימות ששותפו איתי",
        lists: sharedLists.map(toUnified),
      });
    }

    return sections;
  }, [lists, unifiedLists, projectId, project.name, user?.id]);

  // The project meetings/events follow the project's own list visibility (the
  // first "פרויקט" entry in the picker). No project list → always shown.
  const projectVisible =
    projectListIds.size === 0 ||
    [...projectListIds].some((id) => isVisible(id));

  const listColorById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const l of lists) m.set(l.id, l.color);
    return m;
  }, [lists]);
  const calendarColorById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const c of eventCalendars) m.set(c.id, c.color);
    return m;
  }, [eventCalendars]);

  const range = useMemo(() => rangeFor(view, anchor), [view, anchor]);

  // Workspace-wide tasks/events; the project's own data shows by default and
  // the rest is filtered by the per-project visibility set below.
  const { data: allTasks = [] } = useTasks();
  const { data: events = [] } = useEvents({
    from: range.fromIso,
    to: range.toIso,
  });

  // Project tasks (derived) — drives the gantt sub-view + create defaults.
  const tasks = useMemo(
    () =>
      allTasks.filter(
        (t) => t.task_list_id && projectListIds.has(t.task_list_id)
      ),
    [allTasks, projectListIds]
  );

  // ── CalendarItem[] (mirrors Calendar.tsx, with cross-project visibility) ────
  const items: CalendarItem[] = useMemo(() => {
    const out: CalendarItem[] = [];
    if (layer !== "events") {
      for (const t of allTasks) {
        if (!isVisible(t.task_list_id)) continue;
        const listColor = listColorById.get(t.task_list_id ?? "") ?? null;
        if (t.scheduled_at) {
          const base = taskToItem(t, listColor, user?.id);
          if (base) {
            const hasExtras = taskExtraOccurrences(t).length > 0;
            if (t.recurrence_rule || hasExtras) {
              const anchorStart = base.start;
              const duration = base.end.getTime() - anchorStart.getTime();
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
                const isNoTime =
                  occStart.getHours() === 0 && occStart.getMinutes() === 0;
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
        const dl = taskDeadlineToItem(t, listColor);
        if (dl) out.push(dl);
      }
    }
    if (layer !== "tasks") {
      for (const e of events) {
        // The project's own events (incl. meeting-synced ones) follow the
        // project's list visibility; any other event shows only if its calendar
        // was turned on in the picker.
        const belongsToProject =
          (e as { project_id?: string | null }).project_id === projectId;
        if (belongsToProject) {
          if (!projectVisible) continue;
        } else if (!isVisible(e.calendar_id)) {
          continue;
        }
        const base = eventToItem(e, calendarColorById);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    allTasks,
    events,
    layer,
    listColorById,
    calendarColorById,
    range,
    user?.id,
    projectId,
    projectListIds,
    projectVisible,
    vis,
  ]);

  // ── Mutations ───────────────────────────────────────────────────────────────
  const updateTask = useUpdateTask();
  const updateEvent = useUpdateEvent();

  const handleItemClick = (item: CalendarItem) => {
    if (item.kind === "task" || item.kind === "deadline")
      setEditingTaskId((item.source as { id: string }).id);
    else setEditingEventId((item.source as { id: string }).id);
  };

  const handleItemDrop = (item: CalendarItem, action: DropAction) => {
    let newStart = item.start;
    let newEnd = item.end;
    if (action.kind === "move") {
      const durationMs = item.end.getTime() - item.start.getTime();
      newStart = action.date;
      newEnd = new Date(newStart.getTime() + durationMs);
    } else if (action.kind === "resize-end") {
      newEnd = action.date;
      if (newEnd.getTime() <= newStart.getTime())
        newEnd = new Date(newStart.getTime() + 15 * 60_000);
    } else if (action.kind === "resize-start") {
      newStart = action.date;
      if (newStart.getTime() >= newEnd.getTime())
        newStart = new Date(newEnd.getTime() - 15 * 60_000);
    }

    // Dragged out of the meetings scheduling panel → set / move meeting_at and
    // reconcile its linked calendar event (so it shows on the grid).
    if (item.id.startsWith("meeting:")) {
      const meetingId = item.id.slice("meeting:".length);
      const m = meetings.find((x) => x.id === meetingId);
      if (!m) return;
      const prevAt = m.meeting_at;
      const saveAt = (at: string | null) =>
        saveMeeting.mutate({
          id: m.id,
          projectId,
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
        });
      const nextAt = newStart.toISOString();
      saveAt(nextAt);
      pushUndo({
        description: "שיבוץ פגישה",
        undo: () => saveAt(prevAt),
        redo: () => saveAt(nextAt),
      });
      return;
    }

    // Dragged out of the tasks scheduling panel → schedule the task at the drop
    // time, preserving its real duration (null stays null = "no duration").
    if (item.kind === "task" && item.isUnscheduledDraft) {
      const src = item.source as {
        id: string;
        duration_minutes: number | null;
      };
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

  // ── Edit / create state ─────────────────────────────────────────────────────
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  // Scheduling side-panel: drag tasks or meetings from the side onto the grid.
  const [scheduling, setScheduling] = useState(false);
  const [panelMode, setPanelMode] = useState<"tasks" | "meetings">("tasks");

  // New-list dialog (the "רשימה חדשה" action in the lists picker, scoped to
  // this project).
  const [newListDialogOpen, setNewListDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const createTaskList = useCreateTaskList();
  const handleCreateList = () => {
    setNewListName("");
    setNewListDialogOpen(true);
  };
  const handleCreateListSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = newListName.trim();
    if (!name) return;
    setNewListDialogOpen(false);
    await createTaskList.mutateAsync({
      name,
      kind: "custom",
      project_id: projectId,
    });
  };

  // Scheduling chooser: a popover that lets the user pick task / event /
  // meeting for the clicked slot. Anchored at the cursor.
  const [chooser, setChooser] = useState<{
    start: Date;
    x: number;
    y: number;
  } | null>(null);
  // After picking "event", we create the project-scoped event row first (so
  // it carries project_id) then open it in edit mode.
  const [eventDraftStart, setEventDraftStart] = useState<{
    start: Date;
    end: Date;
  } | null>(null);
  const [taskDraft, setTaskDraft] = useState<{ start: Date; end: Date } | null>(
    null
  );

  const handleCreateAt = (start: Date) => {
    // No precise cursor coords from the view callbacks — anchor the popover
    // near the top of the grid area. The chooser itself is fixed-positioned.
    setChooser({ start, x: window.innerWidth / 2, y: window.innerHeight / 3 });
  };

  // Toolbar "+ task" / "+ event" — default to 1h from the next hour boundary.
  const handleCreateTaskToolbar = () => {
    const start = new Date();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    const end = new Date(start.getTime() + 60 * 60_000);
    setTaskDraft({ start, end });
  };
  const handleCreateEventToolbar = () => {
    const start = new Date();
    start.setMinutes(0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60_000);
    openEventDraft(start, end);
  };

  // ── Create handlers (the three chooser options) ─────────────────────────────
  const createTask = useCreateTask();
  const createEvent = useCreateEvent();
  const createMeeting = useCreateProjectMeeting();
  const saveMeeting = useSaveProjectMeeting();

  /** משימה — open the task editor pre-filled with the slot. The task is only
   *  persisted on save (TaskEditModal createDraft), scoped to the project's
   *  list via `task_list_id`. */
  const chooseTask = (start: Date) => {
    const end = new Date(start.getTime() + 60 * 60_000);
    setChooser(null);
    setTaskDraft({ start, end });
  };

  /** אירוע — create the event row immediately (so it carries project_id),
   *  then open it in edit mode for the user to fill in details. */
  const openEventDraft = async (start: Date, end: Date) => {
    try {
      const created = await createEvent.mutateAsync({
        title: "אירוע חדש",
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        all_day: false,
        // project_id is a real (nullable) column; the generated EventInsert
        // type lags behind, so cast just this payload.
        ...({ project_id: projectId } as Record<string, unknown>),
      } as Parameters<typeof createEvent.mutateAsync>[0]);
      setEditingEventId(created.id);
    } catch {
      // Fall back to a non-project draft so the user isn't blocked.
      setEventDraftStart({ start, end });
    }
  };
  const chooseEvent = (start: Date) => {
    const end = new Date(start.getTime() + 60 * 60_000);
    setChooser(null);
    void openEventDraft(start, end);
  };

  /** פגישה — create a project meeting at the slot, sync its calendar event
   *  (so it shows up here), then jump to the meetings tab to edit it. */
  const chooseMeeting = async (start: Date) => {
    setChooser(null);
    try {
      const meeting = await createMeeting.mutateAsync({
        projectId,
        title: "",
        meeting_at: start.toISOString(),
      });
      // Reconcile the linked event immediately so it appears on the calendar.
      await saveMeeting.mutateAsync({
        id: meeting.id,
        projectId,
        existingEventId: null,
        patch: {
          title: meeting.title,
          meeting_at: start.toISOString(),
          all_day: false,
          location: null,
          status: meeting.status,
          notes: null,
          summary: null,
          recording_id: null,
        },
      });
    } catch {
      // ignore — navigation below still lands the user on the meetings tab
    }
    navigate(`/app/projects/${projectId}/meetings`);
  };

  // ── Gantt mode ──────────────────────────────────────────────────────────────
  const ganttWindow = useMemo(() => {
    const start = ganttStartOfDay(addDays(new Date(), -14));
    const end = ganttStartOfDay(addDays(new Date(), 26 * 7));
    return { start, end };
  }, []);
  const ganttRows = useMemo(
    () => buildRows(tasks, [], "tasks", lists, user?.id),
    [tasks, lists, user?.id]
  );
  const handleGanttRowClick = (row: GanttRow) => {
    if (row.kind === "task" && row.task) setEditingTaskId(row.task.id);
  };
  const handleGanttBarChange = (
    row: GanttRow,
    patch: { scheduled_at: string; duration_minutes: number }
  ) => {
    if (row.kind === "task" && row.task)
      updateTask.mutate({ taskId: row.task.id, patch });
  };
  const handleGanttScheduleTask = (row: GanttRow, date: Date) => {
    if (row.kind === "task" && row.task)
      updateTask.mutate({
        taskId: row.task.id,
        patch: { scheduled_at: date.toISOString() },
      });
  };
  const handleGanttCreateTask = async (title: string) => {
    if (!projectList) return;
    await createTask.mutateAsync({
      title,
      task_list_id: projectList.id,
      parent_task_id: null,
      status: "todo",
      urgency: 0,
    });
  };

  const availableViews: CalendarView[] = ["day", "week", "month", "agenda"];

  return (
    <div className="space-y-2">
      <DragHoverPill />
      {/* Mode toggle (calendar ⇄ gantt) + scheduling controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <ModeToggle mode={mode} onChange={setMode} />
        {mode === "calendar" && (
          <div className="inline-flex items-center gap-2">
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
              onClick={() => setScheduling((v) => !v)}
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
        )}
      </div>

      {mode === "calendar" ? (
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
            listSections={listSections}
            hiddenListIds={hiddenListIds}
            onToggleListVisibility={toggleVisibility}
            onCreateList={handleCreateList}
            eventCalendars={unifiedCalendars}
            onToggleCalendarVisibility={toggleVisibility}
            filtersActiveCount={0}
            filtersOpen={false}
            onToggleFilters={() => {}}
            statsOpen={false}
            onToggleStats={() => {}}
            onCreateEvent={handleCreateEventToolbar}
            onCreateTask={handleCreateTaskToolbar}
          />

          <div className="flex items-start gap-3">
            {scheduling &&
              (panelMode === "tasks" ? (
                <TaskSchedulingPanel
                  tasks={allTasks}
                  taskLists={lists}
                  hiddenListIds={hiddenListIds}
                  onItemDrop={handleItemDrop}
                  onOpenTask={(id) => setEditingTaskId(id)}
                  onContextMenu={(task: Task) => setEditingTaskId(task.id)}
                  onClose={() => setScheduling(false)}
                  wide
                />
              ) : (
                <MeetingSchedulingPanel
                  meetings={meetings}
                  onItemDrop={handleItemDrop}
                  onOpenMeeting={() =>
                    navigate(`/app/projects/${projectId}/meetings`)
                  }
                  onClose={() => setScheduling(false)}
                  wide
                />
              ))}
            <div className="flex-1 min-w-0">
              {view === "day" && (
                <CalendarDayView
                  date={anchor}
                  items={items}
                  actualStripes={[]}
                  hourStart={HOUR_START}
                  hourEnd={HOUR_END}
                  hourHeight={DAY_HOUR_HEIGHT}
                  onItemClick={handleItemClick}
                  onCreateAt={handleCreateAt}
                  onItemDrop={handleItemDrop}
                />
              )}
              {view === "week" && (
                <CalendarWeekView
                  anchor={anchor}
                  items={items}
                  actualStripes={[]}
                  hourStart={HOUR_START}
                  hourEnd={HOUR_END}
                  hourHeight={WEEK_HOUR_HEIGHT}
                  onItemClick={handleItemClick}
                  onCreateAt={handleCreateAt}
                  onItemDrop={handleItemDrop}
                />
              )}
              {view === "month" && (
                <CalendarMonthView
                  anchor={anchor}
                  items={items}
                  onItemClick={handleItemClick}
                  onDayClick={(day) => handleCreateAt(noonOf(day))}
                  onCellClick={(day) => handleCreateAt(at9(day))}
                  onItemDrop={handleItemDrop}
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
          </div>
        </div>
      ) : (
        <ProjectGantt
          hasList={!!projectList}
          rows={ganttRows}
          lists={lists.map((l) => ({ id: l.id, name: l.name }))}
          windowStart={ganttWindow.start}
          windowEnd={ganttWindow.end}
          onRowClick={handleGanttRowClick}
          onBarChange={handleGanttBarChange}
          onScheduleTask={handleGanttScheduleTask}
          onCreateTask={handleGanttCreateTask}
        />
      )}

      {/* Scheduling chooser popover */}
      {chooser && (
        <SchedulingChooser
          start={chooser.start}
          x={chooser.x}
          y={chooser.y}
          onTask={() => chooseTask(chooser.start)}
          onEvent={() => chooseEvent(chooser.start)}
          onMeeting={() => void chooseMeeting(chooser.start)}
          onClose={() => setChooser(null)}
        />
      )}

      {/* Edit-existing-task */}
      <TaskEditModal
        taskId={editingTaskId}
        onClose={() => setEditingTaskId(null)}
        defaultTab="schedule"
      />

      {/* Create-task draft (scoped to the project's list) */}
      {taskDraft && (
        <TaskEditModal
          taskId={null}
          onClose={() => setTaskDraft(null)}
          createDraft={{
            title: "",
            scheduled_at: taskDraft.start.toISOString(),
            duration_minutes: Math.round(
              (taskDraft.end.getTime() - taskDraft.start.getTime()) / 60000
            ),
            task_list_id: projectList?.id ?? null,
          }}
          defaultTab="schedule"
        />
      )}

      {/* Edit-existing-event */}
      <EventEditModal
        open={!!editingEventId}
        eventId={editingEventId}
        onClose={() => setEditingEventId(null)}
      />

      {/* Fallback event draft (only used if the immediate create failed) */}
      {eventDraftStart && (
        <EventEditModal
          open
          eventId={null}
          initialStart={eventDraftStart.start}
          initialEnd={eventDraftStart.end}
          onClose={() => setEventDraftStart(null)}
        />
      )}

      {/* New-list dialog (scoped to this project) */}
      {newListDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40"
          onClick={() => setNewListDialogOpen(false)}
        >
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
              <button
                type="button"
                className="btn-ghost text-sm"
                onClick={() => setNewListDialogOpen(false)}
              >
                ביטול
              </button>
              <button
                type="submit"
                className="btn-dark text-sm"
                disabled={!newListName.trim()}
              >
                יצירה
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── Per-project visibility persistence ─────────────────────────────────────────

const visExtraKey = (projectId: string) =>
  `multitask.projectCalendar.extraLists.${projectId}`;
const visHiddenKey = (projectId: string) =>
  `multitask.projectCalendar.hiddenLists.${projectId}`;

function loadIdSet(key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(
      Array.isArray(arr)
        ? arr.filter((x): x is string => typeof x === "string")
        : []
    );
  } catch {
    return new Set();
  }
}

// ─── Gantt sub-view ────────────────────────────────────────────────────────────

function ProjectGantt({
  hasList,
  rows,
  lists,
  windowStart,
  windowEnd,
  onRowClick,
  onBarChange,
  onScheduleTask,
  onCreateTask,
}: {
  hasList: boolean;
  rows: GanttRow[];
  lists: Array<{ id: string; name: string }>;
  windowStart: Date;
  windowEnd: Date;
  onRowClick: (row: GanttRow) => void;
  onBarChange: (
    row: GanttRow,
    patch: { scheduled_at: string; duration_minutes: number }
  ) => void;
  onScheduleTask: (row: GanttRow, date: Date) => void;
  onCreateTask: (title: string) => Promise<void> | void;
}) {
  const emptyDeps = useMemo(() => [], []);
  const emptyCritical = useMemo(() => new Set<string>(), []);

  if (!hasList) {
    return (
      <div className="card p-8 text-center text-ink-500 text-sm">
        <CalendarDays className="w-8 h-8 text-ink-300 mx-auto mb-2" />
        עדיין אין רשימת משימות לפרויקט — צרי משימות בלשונית "משימות" כדי לראות
        אותן בגאנט.
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="card p-8 text-center text-ink-500 text-sm">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 opacity-40" />
        אין עדיין משימות להצגה בגאנט.
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-stretch">
      <div className="basis-1/3 min-w-0 shrink-0">
        <GanttTable
          rows={rows}
          deps={emptyDeps}
          criticalSet={emptyCritical}
          onRowClick={onRowClick}
          layout="side"
          onCreateTask={onCreateTask}
          lists={lists}
        />
      </div>
      <div className="basis-2/3 min-w-0 grow">
        <GanttGrid
          rows={rows}
          deps={emptyDeps}
          zoom="week"
          windowStart={windowStart}
          windowEnd={windowEnd}
          criticalSet={emptyCritical}
          onRowClick={onRowClick}
          onBarChange={onBarChange}
          onScheduleTask={onScheduleTask}
          hideInternalSidebar
        />
      </div>
    </div>
  );
}

// ─── Scheduling chooser popover ────────────────────────────────────────────────

function SchedulingChooser({
  start,
  x,
  y,
  onTask,
  onEvent,
  onMeeting,
  onClose,
}: {
  start: Date;
  x: number;
  y: number;
  onTask: () => void;
  onEvent: () => void;
  onMeeting: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onEsc);
    };
  }, [onClose]);

  const whenLabel = start.toLocaleString("he-IL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Clamp so the popover stays on-screen.
  const left = Math.min(x, window.innerWidth - 240);
  const top = Math.min(y, window.innerHeight - 200);

  return (
    <div className="fixed inset-0 z-50" onContextMenu={(e) => e.preventDefault()}>
      <div
        ref={ref}
        className="absolute bg-white rounded-2xl shadow-lift border border-ink-200 w-56 overflow-hidden"
        style={{ left, top }}
      >
        <div className="px-3 py-2 border-b border-ink-100">
          <div className="text-[11px] text-ink-400">שיבוץ ל־</div>
          <div className="text-sm font-semibold text-ink-900">{whenLabel}</div>
        </div>
        <button
          type="button"
          onClick={onTask}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-start hover:bg-ink-50"
        >
          <CheckSquare className="w-4 h-4 text-primary-600" />
          משימה
        </button>
        <button
          type="button"
          onClick={onEvent}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-start hover:bg-ink-50 border-t border-ink-100"
        >
          <CalendarDays className="w-4 h-4 text-amber-500" />
          אירוע
        </button>
        <button
          type="button"
          onClick={onMeeting}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-start hover:bg-ink-50 border-t border-ink-100"
        >
          <Users className="w-4 h-4 text-pink-500" />
          פגישה
        </button>
      </div>
    </div>
  );
}

// ─── Mode toggle (calendar ⇄ gantt) ────────────────────────────────────────────

function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-ink-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => onChange("calendar")}
        className={cn(
          "px-2.5 py-1.5 text-xs inline-flex items-center gap-1",
          mode === "calendar"
            ? "bg-ink-900 text-white"
            : "text-ink-600 hover:bg-ink-50"
        )}
      >
        <CalendarRange className="w-3.5 h-3.5" />
        יומן
      </button>
      <button
        type="button"
        onClick={() => onChange("gantt")}
        className={cn(
          "px-2.5 py-1.5 text-xs inline-flex items-center gap-1",
          mode === "gantt"
            ? "bg-ink-900 text-white"
            : "text-ink-600 hover:bg-ink-50"
        )}
      >
        <GanttChartSquare className="w-3.5 h-3.5" />
        גאנט
      </button>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function noonOf(day: Date): Date {
  const d = new Date(day);
  d.setHours(12, 0, 0, 0);
  return d;
}
function at9(day: Date): Date {
  const d = new Date(day);
  d.setHours(9, 0, 0, 0);
  return d;
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
