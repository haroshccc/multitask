import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  MapPin,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCompleteTask, useTasks } from "@/lib/hooks/useTasks";
import { useTaskLists } from "@/lib/hooks/useTaskLists";
import { useEvents } from "@/lib/hooks/useEvents";
import { pushUndo } from "@/lib/undo/store";
import { ListIcon } from "@/components/tasks/list-icons";
import { staticDayRange, toIsoDate } from "./static-range";
import type { EventRow, Task, TaskList } from "@/lib/types/domain";

// =============================================================================
// "סדר היום" — one merged, chronological timeline of the day: events and
// tasks on a single axis instead of two separate widgets. Tasks complete
// inline; everything deep-links to its editor (?edit= / ?event=).
// =============================================================================

interface TodayAgendaProps {
  date: Date;
  onDateChange: (d: Date) => void;
}

type TimelineRow =
  | { kind: "event"; event: EventRow; startMs: number }
  | { kind: "task"; task: Task; startMs: number };

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Tasks saved without a specific time land exactly at local midnight. */
function hasSpecificTime(iso: string): boolean {
  const d = new Date(iso);
  return d.getHours() !== 0 || d.getMinutes() !== 0;
}

export function TodayAgenda({ date, onDateChange }: TodayAgendaProps) {
  const navigate = useNavigate();
  const day = useMemo(() => staticDayRange(date), [date]);
  const { data: events = [] } = useEvents(day.range);
  const { data: tasks = [] } = useTasks();
  const { data: lists = [] } = useTaskLists();

  const listMap = useMemo(
    () => new Map(lists.map((l) => [l.id, l] as const)),
    [lists],
  );

  const isToday = toIsoDate(date) === toIsoDate(new Date());
  const nowMs = Date.now();

  const grouped = useMemo(() => {
    const fromMs = new Date(day.range.from).getTime();
    const toMs = new Date(day.range.to).getTime();
    const inDay = (iso: string | null | undefined) => {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return t >= fromMs && t < toMs;
    };

    // Tasks overdue from previous days — surfaced only on today's agenda,
    // because that's where they actually need attention.
    const overdue = isToday
      ? tasks
          .filter(
            (t) =>
              !t.completed_at &&
              !!t.scheduled_at &&
              new Date(t.scheduled_at).getTime() < fromMs,
          )
          .sort(
            (a, b) =>
              new Date(a.scheduled_at!).getTime() -
              new Date(b.scheduled_at!).getTime(),
          )
      : [];

    const openInDay = tasks.filter(
      (t) => !t.completed_at && inDay(t.scheduled_at),
    );
    const noTime = openInDay.filter((t) => !hasSpecificTime(t.scheduled_at!));

    const timeline: TimelineRow[] = [
      ...events
        .filter((e) => inDay(e.starts_at))
        .map((e) => ({
          kind: "event" as const,
          event: e,
          startMs: new Date(e.starts_at).getTime(),
        })),
      ...openInDay
        .filter((t) => hasSpecificTime(t.scheduled_at!))
        .map((t) => ({
          kind: "task" as const,
          task: t,
          startMs: new Date(t.scheduled_at!).getTime(),
        })),
    ].sort((a, b) => a.startMs - b.startMs);

    const done = tasks
      .filter((t) => inDay(t.completed_at))
      .sort(
        (a, b) =>
          new Date(a.completed_at!).getTime() -
          new Date(b.completed_at!).getTime(),
      );

    return { overdue, noTime, timeline, done };
  }, [tasks, events, day.range.from, day.range.to, isToday]);

  const dayDiff = Math.round(
    (new Date(toIsoDate(date)).getTime() -
      new Date(toIsoDate(new Date())).getTime()) /
      (24 * 60 * 60 * 1000),
  );
  const dayLabel = isToday
    ? "היום"
    : dayDiff === 1
      ? "מחר"
      : dayDiff === -1
        ? "אתמול"
        : date.toLocaleDateString("he-IL", { weekday: "long" });
  const dateLabel = date.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
  });

  const stepDay = (dir: -1 | 1) => {
    const next = new Date(date);
    next.setDate(next.getDate() + dir);
    onDateChange(next);
  };

  const isEmpty =
    grouped.overdue.length === 0 &&
    grouped.noTime.length === 0 &&
    grouped.timeline.length === 0 &&
    grouped.done.length === 0;

  // Where the "now" divider sits inside the timeline (today only).
  const nowIndex = isToday
    ? grouped.timeline.findIndex((r) => r.startMs > nowMs)
    : -1;

  return (
    <section className="card p-4 flex flex-col overflow-hidden">
      <header className="flex items-center gap-2 mb-3 shrink-0">
        <span
          className="w-7 h-7 rounded-lg bg-ink-50 border border-ink-100 flex items-center justify-center text-primary-600"
          aria-hidden="true"
        >
          <ListTodo className="w-4 h-4" />
        </span>
        <h3 className="text-sm font-bold text-ink-900">
          סדר היום · {dayLabel}
        </h3>
        <span className="text-xs text-ink-500">{dateLabel}</span>

        {/* RTL stepper: the visually-right chevron steps back in time. */}
        <span className="ms-auto inline-flex items-center gap-0.5 shrink-0">
          {!isToday && (
            <button
              type="button"
              onClick={() => onDateChange(new Date())}
              className="me-1 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-ink-100 hover:bg-ink-200 text-xs text-ink-700"
              title="חזרה להיום"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
              היום
            </button>
          )}
          <button
            type="button"
            onClick={() => stepDay(-1)}
            aria-label="יום קודם"
            className="p-1.5 rounded-md hover:bg-ink-100 text-ink-600"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => stepDay(1)}
            aria-label="יום הבא"
            className="p-1.5 rounded-md hover:bg-ink-100 text-ink-600"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </span>
      </header>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center text-center py-8 gap-2">
          <span
            className="w-10 h-10 rounded-full bg-ink-50 flex items-center justify-center"
            aria-hidden="true"
          >
            <CalendarDays className="w-5 h-5 text-ink-400" />
          </span>
          <p className="text-sm text-ink-600">אין שום דבר מתוזמן ליום הזה.</p>
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={() => navigate("/app/tasks")}
              className="btn-outline text-xs"
            >
              + משימה
            </button>
            <button
              type="button"
              onClick={() => navigate("/app/calendar")}
              className="btn-outline text-xs"
            >
              + אירוע
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.overdue.length > 0 && (
            <AgendaGroup title="באיחור" tone="danger">
              {grouped.overdue.slice(0, 5).map((t) => (
                <AgendaTaskRow
                  key={t.id}
                  task={t}
                  listMap={listMap}
                  timeLabel={new Date(t.scheduled_at!).toLocaleDateString(
                    "he-IL",
                    { day: "numeric", month: "numeric" },
                  )}
                  overdue
                />
              ))}
              {grouped.overdue.length > 5 && (
                <button
                  type="button"
                  onClick={() => navigate("/app/tasks")}
                  className="text-[11px] text-danger-600 hover:text-danger-700 font-medium ps-[52px]"
                >
                  ועוד {grouped.overdue.length - 5} משימות באיחור…
                </button>
              )}
            </AgendaGroup>
          )}

          {grouped.noTime.length > 0 && (
            <AgendaGroup title="ללא שעה">
              {grouped.noTime.map((t) => (
                <AgendaTaskRow key={t.id} task={t} listMap={listMap} />
              ))}
            </AgendaGroup>
          )}

          {grouped.timeline.length > 0 && (
            <AgendaGroup title="על ציר הזמן">
              {grouped.timeline.map((row, i) => {
                const isPast =
                  isToday &&
                  (row.kind === "event"
                    ? new Date(row.event.ends_at).getTime() < nowMs
                    : row.startMs < nowMs);
                return (
                  <div key={row.kind === "event" ? `e-${row.event.id}` : `t-${row.task.id}`}>
                    {i === nowIndex && <NowDivider />}
                    {row.kind === "event" ? (
                      <AgendaEventRow event={row.event} isPast={isPast} />
                    ) : (
                      <AgendaTaskRow
                        task={row.task}
                        listMap={listMap}
                        timeLabel={fmtTime(row.task.scheduled_at!)}
                        isPast={isPast}
                      />
                    )}
                  </div>
                );
              })}
              {/* Everything already happened → the divider closes the list. */}
              {nowIndex === -1 && isToday && <NowDivider />}
            </AgendaGroup>
          )}

          {grouped.done.length > 0 && (
            <AgendaGroup title={`בוצעו (${grouped.done.length})`}>
              {grouped.done.map((t) => (
                <AgendaTaskRow key={t.id} task={t} listMap={listMap} done />
              ))}
            </AgendaGroup>
          )}
        </div>
      )}
    </section>
  );
}

// =============================================================================
// Pieces
// =============================================================================

function AgendaGroup({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: "danger";
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className={cn(
          "text-[10px] font-semibold uppercase tracking-wider mb-1.5",
          tone === "danger" ? "text-danger-600" : "text-ink-500",
        )}
      >
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function NowDivider() {
  return (
    <div className="flex items-center gap-2 py-1" aria-hidden="true">
      <span className="w-2 h-2 rounded-full bg-primary-500 shrink-0" />
      <span className="flex-1 h-px bg-gradient-to-l from-primary-400 to-transparent" />
      <span className="text-[10px] font-bold text-primary-600 tabular-nums">
        עכשיו{" "}
        {new Date().toLocaleTimeString("he-IL", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
}

function AgendaTaskRow({
  task,
  listMap,
  timeLabel,
  isPast,
  overdue,
  done,
}: {
  task: Task;
  listMap: Map<string, TaskList>;
  timeLabel?: string;
  isPast?: boolean;
  overdue?: boolean;
  done?: boolean;
}) {
  const navigate = useNavigate();
  const completeTask = useCompleteTask();
  const list = task.task_list_id ? listMap.get(task.task_list_id) : undefined;

  const toggle = async () => {
    const next = !done;
    await completeTask.mutateAsync({ taskId: task.id, completed: next });
    pushUndo({
      description: next
        ? `סימון "${task.title}" כבוצעה`
        : `ביטול ביצוע של "${task.title}"`,
      undo: () => completeTask.mutate({ taskId: task.id, completed: !next }),
      redo: () => completeTask.mutate({ taskId: task.id, completed: next }),
    });
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors",
        done
          ? "border-ink-100 bg-ink-50/60"
          : "border-ink-200 bg-white hover:border-primary-300 hover:bg-primary-50/40",
        isPast && !done && "opacity-60",
      )}
    >
      <button
        type="button"
        onClick={toggle}
        disabled={completeTask.isPending}
        aria-label={done ? "בטל סימון כבוצעה" : "סמן כבוצעה"}
        className={cn(
          "w-[18px] h-[18px] rounded-full border-2 shrink-0 flex items-center justify-center transition-colors",
          done
            ? "bg-success-500 border-success-500 text-white"
            : "border-ink-300 hover:border-success-500 text-transparent hover:text-success-500",
        )}
      >
        <Check className="w-3 h-3" aria-hidden="true" />
      </button>

      <span className="shrink-0 w-10 font-mono tabular-nums text-[10px] text-ink-500 text-start">
        {timeLabel ?? ""}
      </span>

      <button
        type="button"
        onClick={() => navigate(`/app/tasks?edit=${task.id}`)}
        className={cn(
          "flex-1 min-w-0 truncate text-start text-xs font-medium",
          done ? "text-ink-500 line-through" : "text-ink-800",
        )}
      >
        {task.title?.trim() || "ללא כותרת"}
      </button>

      {overdue && (
        <AlertCircle
          className="w-3 h-3 text-danger-600 shrink-0"
          aria-label="באיחור"
        />
      )}
      {list && (
        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] text-ink-500">
          <ListIcon emoji={list.emoji} className="w-3 h-3" />
          <span className="truncate max-w-[72px]">{list.name}</span>
        </span>
      )}
    </div>
  );
}

function AgendaEventRow({
  event,
  isPast,
}: {
  event: EventRow;
  isPast?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate(`/app/calendar?event=${event.id}`)}
      className={cn(
        "w-full flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-start transition-colors",
        "border-primary-200 bg-primary-50/50 hover:border-primary-300 hover:bg-primary-50",
        isPast && "opacity-60",
      )}
    >
      <span
        className="w-[18px] flex justify-center shrink-0"
        aria-hidden="true"
      >
        <span className="w-1 h-4 rounded-full bg-primary-400" />
      </span>
      <span className="shrink-0 w-10 font-mono tabular-nums text-[10px] text-ink-600 text-start">
        {fmtTime(event.starts_at)}
      </span>
      <span className="flex-1 min-w-0 truncate text-xs font-medium text-ink-800">
        {event.title?.trim() || "ללא כותרת"}
      </span>
      <span className="shrink-0 text-[10px] text-ink-500 tabular-nums">
        עד {fmtTime(event.ends_at)}
      </span>
      {event.location && (
        <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] text-ink-500 truncate max-w-[100px]">
          <MapPin className="w-2.5 h-2.5" aria-hidden="true" />
          {event.location}
        </span>
      )}
    </button>
  );
}
