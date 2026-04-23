import { useMemo, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
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
import { EventDrawer } from "@/components/events/EventDrawer";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCreateTask, useTasksInRange } from "@/lib/queries/tasks";
import { useEventsInRange } from "@/lib/queries/events";
import type { EventRow, Task } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";

type View = "month" | "week" | "day";
const WEEK_STARTS_ON = 0 as const;

type EventDrawerMode =
  | { kind: "create"; defaultStartsAt?: Date }
  | { kind: "edit"; event: EventRow };

type Item =
  | { kind: "task"; at: Date; task: Task }
  | { kind: "event"; at: Date; event: EventRow };

export function Calendar() {
  const { user, activeOrganizationId } = useAuth();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [eventDrawer, setEventDrawer] = useState<EventDrawerMode | null>(null);
  const [newTitle, setNewTitle] = useState("");

  const { from, to } = useMemo(() => computeRange(view, cursor), [view, cursor]);

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

  const selectedDayItems = itemsByDay.get(dayKey(selectedDay)) ?? [];
  const loading = tasks.isLoading || events.isLoading;

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

  const cursorLabel =
    view === "month"
      ? format(cursor, "MMMM yyyy", { locale: he })
      : view === "week"
        ? `${format(startOfWeek(cursor, { weekStartsOn: WEEK_STARTS_ON }), "d/M", { locale: he })} – ${format(endOfWeek(cursor, { weekStartsOn: WEEK_STARTS_ON }), "d/M", { locale: he })}`
        : format(cursor, "EEEE, d בMMMM", { locale: he });

  const goPrev = () => {
    if (view === "month") setCursor((c) => subMonths(c, 1));
    else if (view === "week") setCursor((c) => subWeeks(c, 1));
    else setCursor((c) => subDays(c, 1));
  };
  const goNext = () => {
    if (view === "month") setCursor((c) => addMonths(c, 1));
    else if (view === "week") setCursor((c) => addWeeks(c, 1));
    else setCursor((c) => addDays(c, 1));
  };

  return (
    <ScreenScaffold
      title="יומן"
      subtitle="משימות מתוזמנות ואירועים"
      actions={
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-ink-100 rounded-2xl">
            {(["month", "week", "day"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "px-3 py-1 rounded-xl text-xs font-medium",
                  view === v
                    ? "bg-white shadow-soft text-ink-900"
                    : "text-ink-600"
                )}
              >
                {v === "month" ? "חודש" : v === "week" ? "שבוע" : "יום"}
              </button>
            ))}
          </div>
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
          <div className="flex items-center gap-1">
            <button
              onClick={goPrev}
              className="p-2 rounded-xl hover:bg-ink-100"
              aria-label="הקודם"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <div className="text-sm font-medium text-ink-900 min-w-[120px] text-center">
              {cursorLabel}
            </div>
            <button
              onClick={goNext}
              className="p-2 rounded-xl hover:bg-ink-100"
              aria-label="הבא"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      }
    >
      {view === "month" ? (
        <MonthView
          cursor={cursor}
          itemsByDay={itemsByDay}
          selectedDay={selectedDay}
          onSelectDay={setSelectedDay}
          loading={loading}
          selectedDayItems={selectedDayItems}
          onOpenTask={setOpenTask}
          onOpenEvent={(event) => setEventDrawer({ kind: "edit", event })}
          onCreateEvent={() => {
            const start = new Date(selectedDay);
            start.setHours(10, 0, 0, 0);
            setEventDrawer({ kind: "create", defaultStartsAt: start });
          }}
          newTitle={newTitle}
          setNewTitle={setNewTitle}
          addTaskForSelectedDay={addTaskForSelectedDay}
          createTaskPending={createTask.isPending}
          canWrite={Boolean(user && activeOrganizationId)}
        />
      ) : view === "week" ? (
        <WeekView
          cursor={cursor}
          itemsByDay={itemsByDay}
          loading={loading}
          onOpenTask={setOpenTask}
          onOpenEvent={(event) => setEventDrawer({ kind: "edit", event })}
          onSlotClick={(at) =>
            setEventDrawer({ kind: "create", defaultStartsAt: at })
          }
        />
      ) : (
        <DayView
          cursor={cursor}
          itemsByDay={itemsByDay}
          loading={loading}
          onOpenTask={setOpenTask}
          onOpenEvent={(event) => setEventDrawer({ kind: "edit", event })}
          onSlotClick={(at) =>
            setEventDrawer({ kind: "create", defaultStartsAt: at })
          }
        />
      )}

      {openTask && (
        <TaskDetailDrawer task={openTask} onClose={() => setOpenTask(null)} />
      )}
      {eventDrawer && (
        <EventDrawer mode={eventDrawer} onClose={() => setEventDrawer(null)} />
      )}
    </ScreenScaffold>
  );
}

// ============================================================ MONTH VIEW

interface MonthViewProps {
  cursor: Date;
  itemsByDay: Map<string, Item[]>;
  selectedDay: Date;
  onSelectDay: (d: Date) => void;
  loading: boolean;
  selectedDayItems: Item[];
  onOpenTask: (t: Task) => void;
  onOpenEvent: (e: EventRow) => void;
  onCreateEvent: () => void;
  newTitle: string;
  setNewTitle: (s: string) => void;
  addTaskForSelectedDay: () => Promise<void>;
  createTaskPending: boolean;
  canWrite: boolean;
}

function MonthView({
  cursor,
  itemsByDay,
  selectedDay,
  onSelectDay,
  loading,
  selectedDayItems,
  onOpenTask,
  onOpenEvent,
  onCreateEvent,
  newTitle,
  setNewTitle,
  addTaskForSelectedDay,
  createTaskPending,
  canWrite,
}: MonthViewProps) {
  const days = useMemo(() => buildGridDays(cursor), [cursor]);

  return (
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
                onClick={() => onSelectDay(day)}
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

      <DayPanel
        day={selectedDay}
        items={selectedDayItems}
        onOpenTask={onOpenTask}
        onOpenEvent={onOpenEvent}
        onCreateEvent={onCreateEvent}
        newTitle={newTitle}
        setNewTitle={setNewTitle}
        addTaskForSelectedDay={addTaskForSelectedDay}
        createTaskPending={createTaskPending}
        canWrite={canWrite}
      />
    </div>
  );
}

// ============================================================ WEEK VIEW

interface WeekViewProps {
  cursor: Date;
  itemsByDay: Map<string, Item[]>;
  loading: boolean;
  onOpenTask: (t: Task) => void;
  onOpenEvent: (e: EventRow) => void;
  onSlotClick: (at: Date) => void;
}

const HOURS = Array.from({ length: 18 }, (_, i) => 6 + i); // 06:00 → 23:00

function WeekView({
  cursor,
  itemsByDay,
  loading,
  onOpenTask,
  onOpenEvent,
  onSlotClick,
}: WeekViewProps) {
  const weekStart = startOfWeek(cursor, { weekStartsOn: WEEK_STARTS_ON });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="card overflow-hidden">
      <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-ink-200 bg-ink-50">
        <div />
        {days.map((d) => (
          <div key={d.toISOString()} className="py-2 text-center border-s border-ink-200">
            <div className="text-[10px] text-ink-500 uppercase">
              {format(d, "EEE", { locale: he })}
            </div>
            <div
              className={cn(
                "text-sm font-semibold",
                isToday(d)
                  ? "text-primary-600"
                  : "text-ink-700"
              )}
            >
              {format(d, "d")}
            </div>
          </div>
        ))}
      </div>
      <div className="overflow-y-auto max-h-[70vh] scrollbar-thin">
        <div className="grid grid-cols-[48px_repeat(7,1fr)]">
          {HOURS.map((hour) => (
            <HourRow
              key={hour}
              hour={hour}
              days={days}
              itemsByDay={itemsByDay}
              onSlotClick={onSlotClick}
              onOpenTask={onOpenTask}
              onOpenEvent={onOpenEvent}
            />
          ))}
        </div>
        {loading && (
          <div className="p-3 flex items-center justify-center text-ink-400">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

function HourRow({
  hour,
  days,
  itemsByDay,
  onSlotClick,
  onOpenTask,
  onOpenEvent,
}: {
  hour: number;
  days: Date[];
  itemsByDay: Map<string, Item[]>;
  onSlotClick: (at: Date) => void;
  onOpenTask: (t: Task) => void;
  onOpenEvent: (e: EventRow) => void;
}) {
  return (
    <>
      <div className="border-b border-ink-200 text-[10px] text-ink-400 px-1 pt-1 tabular-nums">
        {String(hour).padStart(2, "0")}:00
      </div>
      {days.map((day) => {
        const dayItems = itemsByDay.get(dayKey(day)) ?? [];
        const slotItems = dayItems.filter(
          (it) => it.at.getHours() === hour
        );
        const slotDate = new Date(day);
        slotDate.setHours(hour, 0, 0, 0);
        return (
          <button
            key={day.toISOString() + hour}
            onClick={() => slotItems.length === 0 && onSlotClick(slotDate)}
            className={cn(
              "border-b border-s border-ink-200 min-h-[44px] p-1 text-start flex flex-col gap-0.5 transition-colors",
              slotItems.length === 0 && "hover:bg-primary-50/30"
            )}
          >
            {slotItems.map((it, i) => (
              <SlotChip
                key={i}
                item={it}
                onClick={() => {
                  if (it.kind === "task") onOpenTask(it.task);
                  else onOpenEvent(it.event);
                }}
              />
            ))}
          </button>
        );
      })}
    </>
  );
}

function SlotChip({ item, onClick }: { item: Item; onClick: () => void }) {
  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "block w-full text-[11px] truncate rounded px-1.5 py-1 cursor-pointer",
        item.kind === "task"
          ? item.task.urgency >= 4
            ? "bg-danger-500/10 text-danger-600"
            : "bg-primary-500/10 text-primary-700"
          : "bg-accent-purple/10 text-accent-purple"
      )}
    >
      {format(item.at, "HH:mm")} · {item.kind === "task" ? item.task.title : item.event.title}
    </span>
  );
}

// ============================================================ DAY VIEW

interface DayViewProps {
  cursor: Date;
  itemsByDay: Map<string, Item[]>;
  loading: boolean;
  onOpenTask: (t: Task) => void;
  onOpenEvent: (e: EventRow) => void;
  onSlotClick: (at: Date) => void;
}

function DayView({
  cursor,
  itemsByDay,
  loading,
  onOpenTask,
  onOpenEvent,
  onSlotClick,
}: DayViewProps) {
  const dayItems = itemsByDay.get(dayKey(cursor)) ?? [];
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-ink-200 bg-ink-50">
        <div className="text-sm font-semibold text-ink-900">
          {format(cursor, "EEEE, d בMMMM yyyy", { locale: he })}
        </div>
      </div>
      <div className="overflow-y-auto max-h-[70vh] scrollbar-thin">
        <div className="grid grid-cols-[64px_1fr]">
          {HOURS.map((hour) => {
            const slotItems = dayItems.filter((it) => it.at.getHours() === hour);
            const slotDate = new Date(cursor);
            slotDate.setHours(hour, 0, 0, 0);
            return (
              <div key={hour} className="contents">
                <div className="border-b border-ink-200 text-xs text-ink-400 px-2 pt-1 tabular-nums">
                  {String(hour).padStart(2, "0")}:00
                </div>
                <button
                  onClick={() => slotItems.length === 0 && onSlotClick(slotDate)}
                  className={cn(
                    "border-b border-s border-ink-200 min-h-[60px] p-2 text-start flex flex-col gap-1",
                    slotItems.length === 0 && "hover:bg-primary-50/30"
                  )}
                >
                  {slotItems.map((it, i) => (
                    <button
                      key={i}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (it.kind === "task") onOpenTask(it.task);
                        else onOpenEvent(it.event);
                      }}
                      className={cn(
                        "w-full text-start rounded-lg px-3 py-2 text-sm",
                        it.kind === "task"
                          ? it.task.urgency >= 4
                            ? "bg-danger-500/10 text-danger-700"
                            : "bg-primary-500/10 text-primary-700"
                          : "bg-accent-purple/10 text-accent-purple"
                      )}
                    >
                      <div className="flex items-center gap-2 text-xs text-ink-500 mb-0.5">
                        <Clock className="w-3 h-3" />
                        {format(it.at, "HH:mm")}
                      </div>
                      <div className="font-medium">
                        {it.kind === "task" ? it.task.title : it.event.title}
                      </div>
                      {it.kind === "event" && it.event.location && (
                        <div className="flex items-center gap-1 text-xs text-ink-500 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {it.event.location}
                        </div>
                      )}
                    </button>
                  ))}
                </button>
              </div>
            );
          })}
        </div>
        {loading && (
          <div className="p-3 flex items-center justify-center text-ink-400">
            <Loader2 className="w-4 h-4 animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================ Day panel

interface DayPanelProps {
  day: Date;
  items: Item[];
  onOpenTask: (t: Task) => void;
  onOpenEvent: (e: EventRow) => void;
  onCreateEvent: () => void;
  newTitle: string;
  setNewTitle: (s: string) => void;
  addTaskForSelectedDay: () => Promise<void>;
  createTaskPending: boolean;
  canWrite: boolean;
}

function DayPanel({
  day,
  items,
  onOpenTask,
  onOpenEvent,
  onCreateEvent,
  newTitle,
  setNewTitle,
  addTaskForSelectedDay,
  createTaskPending,
  canWrite,
}: DayPanelProps) {
  return (
    <div className="card p-4 h-fit lg:sticky lg:top-20">
      <div className="flex items-center gap-2 mb-3">
        <CalendarPlus className="w-4 h-4 text-ink-500" />
        <h3 className="font-semibold text-ink-900 text-sm flex-1">
          {format(day, "EEEE, d בMMMM", { locale: he })}
        </h3>
        {canWrite && (
          <button
            onClick={onCreateEvent}
            className="text-xs btn-ghost py-1 px-2"
            title="אירוע חדש"
          >
            + אירוע
          </button>
        )}
      </div>

      {canWrite && (
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
            disabled={createTaskPending}
          />
          <button
            onClick={addTaskForSelectedDay}
            disabled={!newTitle.trim() || createTaskPending}
            className="btn-accent shrink-0 py-2 px-3"
            aria-label="הוספה"
          >
            {createTaskPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="py-6 text-center text-sm text-ink-500">
          אין משימות או אירועים ליום הזה.
        </div>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item, i) => (
            <li key={i}>
              {item.kind === "task" ? (
                <button
                  onClick={() => onOpenTask(item.task)}
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
                <button
                  onClick={() => onOpenEvent(item.event)}
                  className="w-full text-start p-2 rounded-xl bg-accent-purple/5 hover:bg-accent-purple/10 flex items-start gap-2"
                >
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
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================================ helpers

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

function computeRange(view: View, cursor: Date): { from: string; to: string } {
  if (view === "month") {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: WEEK_STARTS_ON });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: WEEK_STARTS_ON });
    const toExclusive = new Date(end);
    toExclusive.setDate(toExclusive.getDate() + 1);
    return { from: start.toISOString(), to: toExclusive.toISOString() };
  }
  if (view === "week") {
    const start = startOfWeek(cursor, { weekStartsOn: WEEK_STARTS_ON });
    const end = addDays(start, 7);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  const start = new Date(cursor);
  start.setHours(0, 0, 0, 0);
  const end = addDays(start, 1);
  return { from: start.toISOString(), to: end.toISOString() };
}
