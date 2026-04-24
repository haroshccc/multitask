import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import {
  type CalendarItem,
  addDays,
  endOfMonth,
  formatHour,
  isOverdueTask,
  isPast,
  isPastDay,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "./calendar-utils";

const MAX_PER_DAY = 3;
const DAY_NAMES = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

interface CalendarMonthViewProps {
  anchor: Date;
  items: CalendarItem[];
  onItemClick: (item: CalendarItem) => void;
  onDayClick: (day: Date) => void;
}

export function CalendarMonthView({
  anchor,
  items,
  onItemClick,
  onDayClick,
}: CalendarMonthViewProps) {
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const gridStart = startOfWeek(monthStart);
  const weekCount = Math.ceil(
    (endOfWeekOffset(monthEnd, gridStart) + 1) / 7
  );
  const totalDays = weekCount * 7;

  const days = useMemo(
    () => Array.from({ length: totalDays }, (_, i) => addDays(gridStart, i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gridStart.getTime(), totalDays]
  );

  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items) {
      const key = keyOf(it.start);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.start.getTime() - b.start.getTime());
    }
    return map;
  }, [items]);

  const now = new Date();

  return (
    <div className="card overflow-hidden">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-ink-200 bg-ink-50/60">
        {DAY_NAMES.map((n, i) => (
          <div
            key={n}
            className={cn(
              "px-2 py-1.5 text-center text-[11px] font-semibold text-ink-500",
              i > 0 && "border-s border-ink-200"
            )}
          >
            {n}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-fr">
        {days.map((day, i) => {
          const inMonth = isSameMonth(day, anchor);
          const today = isSameDay(day, now);
          const past = isPastDay(day, now);
          const list = itemsByDay.get(keyOf(day)) ?? [];
          const visible = list.slice(0, MAX_PER_DAY);
          const overflow = list.length - visible.length;
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "min-h-[100px] p-1 border-t border-ink-200 relative",
                i % 7 !== 0 && "border-s border-ink-200",
                !inMonth && "bg-ink-50/50 text-ink-400",
                past && inMonth && !today && "bg-ink-100/40",
                today && "bg-primary-50/40"
              )}
            >
              <button
                onClick={() => onDayClick(day)}
                className={cn(
                  "text-[11px] font-semibold px-1 py-0.5 rounded-sm hover:bg-ink-100 transition-colors",
                  today
                    ? "text-primary-700"
                    : past
                    ? "text-ink-500"
                    : inMonth
                    ? "text-ink-900"
                    : "text-ink-400"
                )}
                type="button"
              >
                {day.getDate()}
              </button>
              <div className="mt-0.5 space-y-0.5">
                {visible.map((it) => (
                  <MonthItemChip
                    key={it.id}
                    item={it}
                    now={now}
                    onClick={() => onItemClick(it)}
                  />
                ))}
                {overflow > 0 && (
                  <button
                    onClick={() => onDayClick(day)}
                    className="w-full text-start text-[10px] text-ink-500 hover:text-primary-600 px-1.5"
                    type="button"
                  >
                    + עוד {overflow}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthItemChip({
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

  // Events: filled.
  if (!isTask) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "w-full text-start inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium border text-white truncate",
          past && "opacity-55"
        )}
        style={{ backgroundColor: `${accent}D9`, borderColor: accent }}
        title={`${item.title} · ${formatHour(item.start)}`}
        type="button"
      >
        <span className="shrink-0 text-white/85 font-normal">
          {item.allDay ? "" : formatHour(item.start)}
        </span>
        <span className="truncate">{item.title}</span>
      </button>
    );
  }

  // Tasks: outlined only.
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-start inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium border bg-white truncate",
        item.completed && "line-through opacity-60"
      )}
      style={{
        borderColor: overdue ? "#ef4444" : accent,
        color: overdue ? "#b91c1c" : "#2d2d3a",
        backgroundColor: overdue ? "rgba(239, 68, 68, 0.06)" : "white",
      }}
      title={`${item.title} · ${formatHour(item.start)}`}
      type="button"
    >
      <span className="shrink-0 text-ink-500">
        {item.allDay ? "" : formatHour(item.start)}
      </span>
      <span className="truncate">📋 {item.title}</span>
    </button>
  );
}

function keyOf(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function endOfWeekOffset(end: Date, gridStart: Date): number {
  const ms = end.getTime() - gridStart.getTime();
  return Math.floor(ms / (24 * 60 * 60_000));
}
