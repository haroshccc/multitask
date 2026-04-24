import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import {
  type CalendarItem,
  addDays,
  formatHour,
  isOverdueTask,
  isPast,
  isSameDay,
  startOfDay,
  startOfWeek,
} from "./calendar-utils";

interface CalendarAgendaViewProps {
  /** Anchor date — shows a 2-week window starting from `startOfWeek(anchor)`. */
  anchor: Date;
  items: CalendarItem[];
  onItemClick: (item: CalendarItem) => void;
  onCreateAt: (start: Date) => void;
}

/**
 * Agenda (list) view — optimized for narrow screens. Groups items under
 * clearly-separated day headers so you never lose track of the day boundary.
 */
export function CalendarAgendaView({
  anchor,
  items,
  onItemClick,
  onCreateAt,
}: CalendarAgendaViewProps) {
  const windowStart = startOfDay(startOfWeek(anchor));
  const windowDays = 14;
  const days = useMemo(
    () => Array.from({ length: windowDays }, (_, i) => addDays(windowStart, i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [windowStart.getTime()]
  );

  const now = new Date();

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const it of items) {
      const k = keyOf(it.start);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a.start.getTime() - b.start.getTime());
    }
    return m;
  }, [items]);

  return (
    <div className="space-y-2">
      {days.map((day) => {
        const today = isSameDay(day, now);
        const list = byDay.get(keyOf(day)) ?? [];
        return (
          <div key={day.toISOString()} className="card overflow-hidden">
            <DayHeader day={day} today={today} count={list.length} onCreate={() => onCreateAt(day)} />
            {list.length === 0 ? (
              <div className="px-4 py-3 text-[11px] text-ink-400">
                אין פריטים ליום זה
              </div>
            ) : (
              <ul className="divide-y divide-ink-150">
                {list.map((it) => (
                  <AgendaRow
                    key={it.id}
                    item={it}
                    now={now}
                    onClick={() => onItemClick(it)}
                  />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DayHeader({
  day,
  today,
  count,
  onCreate,
}: {
  day: Date;
  today: boolean;
  count: number;
  onCreate: () => void;
}) {
  const dayName = day.toLocaleDateString("he-IL", { weekday: "long" });
  const dateLong = day.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return (
    <div
      className={cn(
        "sticky top-14 z-10 px-3 py-1.5 flex items-baseline gap-2 border-b-2 backdrop-blur-sm",
        today
          ? "bg-primary-50/90 border-primary-300"
          : "bg-ink-50/90 border-ink-300"
      )}
    >
      <span
        className={cn(
          "text-sm font-bold",
          today ? "text-primary-700" : "text-ink-900"
        )}
      >
        {today ? "היום" : dayName}
      </span>
      <span
        className={cn(
          "text-[11px]",
          today ? "text-primary-700" : "text-ink-600"
        )}
      >
        {dateLong}
      </span>
      <span className="text-[10px] text-ink-500">· {count} פריטים</span>
      <button
        onClick={onCreate}
        className="ms-auto text-[11px] text-ink-500 hover:text-primary-600"
        type="button"
      >
        + אירוע
      </button>
    </div>
  );
}

function AgendaRow({
  item,
  now,
  onClick,
}: {
  item: CalendarItem;
  now: Date;
  onClick: () => void;
}) {
  const isTask = item.kind === "task";
  const past = isPast(item, now);
  const overdue = isOverdueTask(item, now);
  const accent = item.color ?? (isTask ? "#6b6b80" : "#f59e0b");

  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          "w-full px-4 py-2.5 flex items-center gap-3 text-start hover:bg-ink-50",
          past && "opacity-70",
          item.completed && "line-through opacity-55"
        )}
        type="button"
      >
        <div
          className="w-1.5 h-10 rounded-full shrink-0"
          style={{ backgroundColor: overdue ? "#ef4444" : accent }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-ink-900 truncate">
            
            {item.title}
          </div>
          <div className="text-[11px] text-ink-500 mt-0.5">
            {item.allDay
              ? "כל היום"
              : `${formatHour(item.start)}–${formatHour(item.end)}`}
            {overdue && <span className="ms-2 text-danger-600 font-medium">באיחור</span>}
            {item.completed && <span className="ms-2 text-success-600 font-medium">בוצע</span>}
          </div>
        </div>
      </button>
    </li>
  );
}

function keyOf(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
