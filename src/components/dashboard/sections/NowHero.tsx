import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  MapPin,
  PartyPopper,
  Plus,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCompleteTask, useTasks } from "@/lib/hooks/useTasks";
import { useEvents } from "@/lib/hooks/useEvents";
import { pushUndo } from "@/lib/undo/store";
import { staticDayRange } from "./static-range";
import type { EventRow, Task } from "@/lib/types/domain";

// =============================================================================
// "מה עכשיו" — the dashboard hero. One big, unmissable answer to the first
// question of the day: what should I be doing right now? A running event
// wins; otherwise the next timed item (task or event) today.
// =============================================================================

type HeroItem =
  | { kind: "event"; event: EventRow; running: boolean }
  | { kind: "task"; task: Task };

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

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

export function NowHero() {
  const navigate = useNavigate();
  const completeTask = useCompleteTask();
  const now = useNow(30_000);
  const day = useMemo(() => staticDayRange(new Date()), []);
  const { data: events = [] } = useEvents(day.range);
  const { data: tasks = [] } = useTasks();

  const computed = useMemo(() => {
    const dayFromMs = new Date(day.range.from).getTime();
    const dayToMs = new Date(day.range.to).getTime();
    const inDay = (iso: string | null | undefined) => {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return t >= dayFromMs && t < dayToMs;
    };

    const todaysEvents = events.filter((e) => inDay(e.starts_at));
    const runningEvent = todaysEvents
      .filter(
        (e) =>
          new Date(e.starts_at).getTime() <= now &&
          new Date(e.ends_at).getTime() > now,
      )
      .sort(
        (a, b) =>
          new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime(),
      )[0];
    const upcomingEvents = todaysEvents
      .filter((e) => new Date(e.starts_at).getTime() > now)
      .sort(
        (a, b) =>
          new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      );

    const openTodayTasks = tasks.filter(
      (t) => !t.completed_at && inDay(t.scheduled_at),
    );
    const upcomingTasks = openTodayTasks
      .filter(
        (t) =>
          hasSpecificTime(t.scheduled_at!) &&
          new Date(t.scheduled_at!).getTime() > now,
      )
      .sort(
        (a, b) =>
          new Date(a.scheduled_at!).getTime() -
          new Date(b.scheduled_at!).getTime(),
      );

    const overdueCount = tasks.filter(
      (t) =>
        !t.completed_at &&
        !!t.scheduled_at &&
        new Date(t.scheduled_at).getTime() < dayFromMs,
    ).length;

    let hero: HeroItem | null = null;
    if (runningEvent) {
      hero = { kind: "event", event: runningEvent, running: true };
    } else {
      const nextEvent = upcomingEvents[0];
      const nextTask = upcomingTasks[0];
      if (nextEvent && nextTask) {
        hero =
          new Date(nextEvent.starts_at).getTime() <=
          new Date(nextTask.scheduled_at!).getTime()
            ? { kind: "event", event: nextEvent, running: false }
            : { kind: "task", task: nextTask };
      } else if (nextEvent) {
        hero = { kind: "event", event: nextEvent, running: false };
      } else if (nextTask) {
        hero = { kind: "task", task: nextTask };
      }
    }

    return {
      hero,
      remainingTasks: openTodayTasks.length,
      remainingEvents: upcomingEvents.length + (runningEvent ? 1 : 0),
      hadAnythingToday:
        todaysEvents.length > 0 || openTodayTasks.length > 0,
      overdueCount,
    };
  }, [events, tasks, day.range.from, day.range.to, now]);

  const { hero, remainingTasks, remainingEvents, hadAnythingToday, overdueCount } =
    computed;

  const handleCompleteHeroTask = async (task: Task) => {
    await completeTask.mutateAsync({ taskId: task.id, completed: true });
    pushUndo({
      description: `סימון "${task.title}" כבוצעה`,
      undo: () => completeTask.mutate({ taskId: task.id, completed: false }),
      redo: () => completeTask.mutate({ taskId: task.id, completed: true }),
    });
  };

  // --- Empty variants ---------------------------------------------------

  if (!hero) {
    return (
      <section className="card p-5 border-primary-100 bg-gradient-to-l from-primary-50/70 via-white to-white">
        <div className="flex items-start gap-3">
          <span
            className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            {hadAnythingToday ? (
              <PartyPopper className="w-5 h-5 text-primary-600" />
            ) : (
              <Sun className="w-5 h-5 text-amber-500" />
            )}
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-ink-900">
              {hadAnythingToday
                ? remainingTasks > 0
                  ? "אין עוד שעות תפוסות היום"
                  : "סיימת את כל מה שתוזמן להיום 🎉"
                : "היום פנוי לגמרי"}
            </h2>
            <p className="mt-1 text-sm text-ink-600">
              {hadAnythingToday
                ? remainingTasks > 0
                  ? `נשארו ${remainingTasks} משימות פתוחות להיום — בלי שעה מוגדרת.`
                  : "אפשר לנוח, או לתכנן את מחר."
                : "זה זמן טוב לתזמן משהו — או פשוט ליהנות מהשקט."}
            </p>
            {overdueCount > 0 && (
              <button
                type="button"
                onClick={() => navigate("/app/tasks")}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-danger-600 hover:text-danger-700"
              >
                <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                {overdueCount} משימות באיחור מימים קודמים
              </button>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate("/app/tasks")}
                className="btn-outline text-xs inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                משימה חדשה
              </button>
              <button
                type="button"
                onClick={() => navigate("/app/calendar")}
                className="btn-outline text-xs inline-flex items-center gap-1"
              >
                <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
                אירוע חדש
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // --- Hero with content --------------------------------------------------

  const isEvent = hero.kind === "event";
  const title = isEvent ? hero.event.title : hero.task.title;
  const startIso = isEvent ? hero.event.starts_at : hero.task.scheduled_at!;
  const running = isEvent && hero.running;

  const minutesUntil = Math.max(
    0,
    Math.round((new Date(startIso).getTime() - now) / 60_000),
  );
  const whenLabel = hero.kind === "event" && hero.running
    ? `עד ${fmtTime(hero.event.ends_at)}`
    : minutesUntil === 0
      ? "ממש עכשיו"
      : minutesUntil < 60
        ? `בעוד ${minutesUntil} דק'`
        : `בשעה ${fmtTime(startIso)}`;

  return (
    <section className="card p-5 border-primary-100 bg-gradient-to-l from-primary-50/70 via-white to-white">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-primary-700">
        <span
          className={cn(
            "w-2 h-2 rounded-full",
            running ? "bg-success-500 animate-pulse" : "bg-primary-500",
          )}
          aria-hidden="true"
        />
        {running ? "מתרחש עכשיו" : "הבא בתור"}
        <span className="font-medium normal-case text-ink-500">
          {whenLabel}
        </span>
      </div>

      <h2 className="mt-1.5 text-xl sm:text-2xl font-bold text-ink-900 leading-snug">
        {title?.trim() || "ללא כותרת"}
      </h2>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-600">
        <span className="inline-flex items-center gap-1">
          {isEvent ? (
            <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <CheckSquare className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          {isEvent
            ? `${fmtTime(hero.event.starts_at)}–${fmtTime(hero.event.ends_at)}`
            : fmtTime(startIso)}
        </span>
        {isEvent && hero.event.location && (
          <span className="inline-flex items-center gap-1 truncate max-w-[220px]">
            <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
            {hero.event.location}
          </span>
        )}
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() =>
            navigate(
              isEvent
                ? `/app/calendar?event=${hero.event.id}`
                : `/app/tasks?edit=${hero.task.id}`,
            )
          }
          className="btn-primary text-xs"
        >
          פתח
        </button>
        {!isEvent && (
          <button
            type="button"
            onClick={() => handleCompleteHeroTask(hero.task)}
            disabled={completeTask.isPending}
            className="btn-outline text-xs inline-flex items-center gap-1 disabled:opacity-50"
          >
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
            סמן כבוצע
          </button>
        )}
        <span className="ms-auto text-xs text-ink-500 tabular-nums">
          נשארו היום: {remainingTasks} משימות · {remainingEvents} אירועים
        </span>
      </div>

      {overdueCount > 0 && (
        <button
          type="button"
          onClick={() => navigate("/app/tasks")}
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-danger-600 hover:text-danger-700"
        >
          <AlertCircle className="w-3 h-3" aria-hidden="true" />
          {overdueCount} משימות באיחור מימים קודמים
        </button>
      )}
    </section>
  );
}
