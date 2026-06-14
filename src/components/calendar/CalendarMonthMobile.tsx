import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import {
  type CalendarItem,
  addDays,
  endOfMonth,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "./calendar-utils";

const DAY_NAMES = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

/** Local key per calendar day. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

interface CalendarMonthMobileProps {
  anchor: Date;
  items: CalendarItem[];
  /** Tap a day → jump to that day's agenda. */
  onDayClick: (day: Date) => void;
}

/**
 * Compact month grid for mobile: just the day numbers with up to three small
 * colored dots marking days that have items (no chips / bands). Tapping a day
 * jumps to that day's agenda. Desktop keeps the full `CalendarMonthView`.
 */
export function CalendarMonthMobile({
  anchor,
  items,
  onDayClick,
}: CalendarMonthMobileProps) {
  const gridStart = startOfWeek(startOfMonth(anchor));
  const daysInMonth = endOfMonth(anchor).getDate();
  const firstCol = startOfMonth(anchor).getDay(); // 0 = Sunday
  const weeks = Math.ceil((firstCol + daysInMonth) / 7);

  const days = useMemo(
    () => Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i)),
    [gridStart.getTime(), weeks]
  );

  // Up to three dot colors per day (one per item, capped).
  const dotsByDay = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const it of items) {
      const k = dayKey(it.start);
      const arr = m.get(k) ?? [];
      if (arr.length < 3) arr.push(it.color ?? "#6b6b80");
      m.set(k, arr);
    }
    return m;
  }, [items]);

  const now = new Date();

  return (
    <div className="select-none px-1">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((n) => (
          <div
            key={n}
            className="text-center text-xs font-medium text-ink-400 py-1"
          >
            {n}׳
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day) => {
          if (!isSameMonth(day, anchor)) {
            return <div key={day.getTime()} aria-hidden />;
          }
          const today = isSameDay(day, now);
          const dots = dotsByDay.get(dayKey(day)) ?? [];
          return (
            <button
              key={day.getTime()}
              type="button"
              onClick={() => onDayClick(day)}
              className="flex flex-col items-center gap-1 py-1.5"
              title="לתצוגת אג׳נדה של היום"
            >
              <span
                className={cn(
                  "w-9 h-9 flex items-center justify-center rounded-full text-lg leading-none",
                  today
                    ? "bg-primary-600 text-white font-semibold"
                    : "text-ink-800"
                )}
              >
                {day.getDate()}
              </span>
              <span className="flex items-center gap-0.5 h-1.5">
                {dots.map((c, i) => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
