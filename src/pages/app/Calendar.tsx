import { useMemo, useState } from "react";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { he } from "date-fns/locale";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Plus,
} from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { TaskDetailDrawer } from "@/components/tasks/TaskDetailDrawer";
import { useAuth } from "@/lib/auth/AuthContext";
import { useTasksInRange, useCreateTask } from "@/lib/queries/tasks";
import { useEventsInRange } from "@/lib/queries/events";
import type { EventRow, Task } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";

const WEEK_STARTS_ON = 0 as const; // Sunday — matches Israeli convention

type Item =
  | { kind: "task"; at: Date; task: Task }
  | { kind: "event"; at: Date; event: EventRow };

export function Calendar() {
  const { user, activeOrganizationId } = useAuth();
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const { from, to } = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: WEEK_STARTS_ON });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: WEEK_STARTS_ON });
    const toExclusive = new Date(end);
    toExclusive.setDate(toExclusive.getDate() + 1);
    return { from: start.toISOString(), to: toExclusive.toISOString() };
  }, [cursor]);

  const tasks = useTasksInRange(activeOrganizationId, from, to);
  const events = useEventsInRange(activeOrganizationId, from, to);
  const createTask = useCreateTask();

  const itemsByDay = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const task of tasks.data ?? []) {
      if (!task.scheduled_at) continue;
      const at = new Date(task.scheduled_at);
      const key = dayKey(at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ kind: "task", at, task });
    }
    for (const event of events.data ?? []) {
      const at = new Date(event.starts_at);
      const key = dayKey(at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push({ kind: "event", at, event });
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.at.getTime() - b.at.getTime());
    }
    return map;
  }, [tasks.data, events.data]);

  const days = useMemo(() => buildGridDays(cursor), [cursor]);
  const selectedDayItems = itemsByDay.get(dayKey(selectedDay)) ?? [];

  const addTaskForSelectedDay = async () => {
    const title = newTitle.trim();
    if (!title || !user || !activeOrganizationId) return;
    const scheduled = new Date(selectedDay);
    scheduled.setHours(9, 0, 0, 0);
    await createTask.mutateAsync({
      orgId: activeOrganizationId,
      ownerId: user.id,
      title,
      scheduledAt: scheduled.toISOString(),
    });
    setNewTitle("");
  };

  const loading = tasks.isLoading || events.isLoading;

  return (
    <ScreenScaffold
      title="יומן"
      subtitle="משימות מתוזמנות ואירועים — חודש אחד בכל פעם"
      actions={
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const now = new Date();
              setCursor(now);
              setSelectedDay(now);
            }}
            className="btn-ghost text-xs py-1.5"
          >
            היום
          </button>
          <button
            onClick={() => setCursor((c) => subMonths(c, 1))}
            className="p-2 rounded-xl hover:bg-ink-100"
            aria-label="חודש קודם"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="text-sm font-medium text-ink-900 min-w-[96px] text-center">
            {format(cursor, "MMMM yyyy", { locale: he })}
          </div>
          <button
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className="p-2 rounded-xl hover:bg-ink-100"
            aria-label="חודש הבא"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-ink-200 bg-ink-50">
            {["א", "ב", "ג", "ד", "ה", "ו", "ש"].map((d) => (
              <div
                key={d}
                className="py-2 text-center text-xs font-semibold text-ink-500"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = dayKey(day);
              const items = itemsByDay.get(key) ?? [];
              const inMonth = isSameMonth(day, cursor);
              const today = isToday(day);
              const selected = isSameDay(day, selectedDay);
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "relative min-h-[92px] p-1.5 border-b border-s border-ink-200 text-start flex flex-col gap-1 transition-colors",
                    !inMonth && "bg-ink-50 text-ink-400",
                    inMonth && "bg-white hover:bg-ink-50",
                    selected && "ring-2 ring-primary-500 ring-inset z-10"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        today
                          ? "bg-primary-500 text-white rounded-full w-5 h-5 flex items-center justify-center font-semibold"
                          : "text-ink-700"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {items.length > 3 && (
                      <span className="text-[10px] text-ink-400">+{items.length - 3}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 overflow-hidden">
                    {items.slice(0, 3).map((item, i) => (
                      <CalendarChip key={i} item={item} />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {loading && (
            <div className="p-3 flex items-center justify-center text-ink-400">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}
        </div>

        <div className="card p-4 h-fit lg:sticky lg:top-20">
          <div className="flex items-center gap-2 mb-3">
            <CalendarPlus className="w-4 h-4 text-ink-500" />
            <h3 className="font-semibold text-ink-900 text-sm flex-1">
              {format(selectedDay, "EEEE, d בMMMM", { locale: he })}
            </h3>
          </div>

          {user && activeOrganizationId && (
            <div className="flex items-center gap-2 mb-3">
              <input
                className="field text-sm"
                placeholder="משימה חדשה ליום הזה"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTaskForSelectedDay();
                  }
                }}
                disabled={createTask.isPending}
              />
              <button
                onClick={addTaskForSelectedDay}
                disabled={!newTitle.trim() || createTask.isPending}
                className="btn-accent shrink-0 py-2 px-3"
                aria-label="הוספה"
              >
                {createTask.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </button>
            </div>
          )}

          {selectedDayItems.length === 0 ? (
            <div className="py-6 text-center text-sm text-ink-500">
              אין משימות או אירועים ליום הזה.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {selectedDayItems.map((item, i) => (
                <li key={i}>
                  {item.kind === "task" ? (
                    <button
                      onClick={() => setOpenTask(item.task)}
                      className="w-full text-start p-2 rounded-xl hover:bg-ink-100 flex items-start gap-2"
                    >
                      <div className="w-2 h-2 rounded-full bg-primary-500 mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div
                          className={cn(
                            "text-sm break-words",
                            item.task.status === "done"
                              ? "line-through text-ink-500"
                              : "text-ink-900"
                          )}
                        >
                          {item.task.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-ink-500">
                          <Clock className="w-3 h-3" />
                          {format(item.at, "HH:mm")}
                          {item.task.location && (
                            <>
                              <MapPin className="w-3 h-3" />
                              {item.task.location}
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  ) : (
                    <div className="p-2 rounded-xl bg-accent-purple/5 flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full bg-accent-purple mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-ink-900 break-words">
                          {item.event.title}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-ink-500">
                          <Clock className="w-3 h-3" />
                          {format(item.at, "HH:mm")}
                          {item.event.location && (
                            <>
                              <MapPin className="w-3 h-3" />
                              {item.event.location}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {openTask && (
        <TaskDetailDrawer task={openTask} onClose={() => setOpenTask(null)} />
      )}
    </ScreenScaffold>
  );
}

function CalendarChip({ item }: { item: Item }) {
  if (item.kind === "task") {
    const done = item.task.status === "done";
    return (
      <div
        className={cn(
          "text-[10px] truncate rounded px-1 py-0.5",
          done
            ? "bg-ink-100 text-ink-500 line-through"
            : item.task.urgency >= 4
              ? "bg-danger-500/10 text-danger-600"
              : "bg-primary-500/10 text-primary-700"
        )}
      >
        {format(item.at, "HH:mm")} · {item.task.title}
      </div>
    );
  }
  return (
    <div className="text-[10px] truncate rounded px-1 py-0.5 bg-accent-purple/10 text-accent-purple">
      {format(item.at, "HH:mm")} · {item.event.title}
    </div>
  );
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function buildGridDays(cursor: Date): Date[] {
  const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: WEEK_STARTS_ON });
  const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: WEEK_STARTS_ON });
  const days: Date[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    days.push(new Date(d));
  }
  return days;
}
