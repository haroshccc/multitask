import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import {
  type ActualStripe,
  type CalendarItem,
  HOUR,
  MIN,
  addDays,
  clipItem,
  dayPercent,
  durationPercent,
  isSameDay,
  layoutDayOverlaps,
  startOfDay,
  startOfWeek,
} from "./calendar-utils";
import { CalendarBlock } from "./CalendarDayView";

const HOUR_HEIGHT = 40;
const GRID_HEIGHT = 24 * HOUR_HEIGHT;

const DAY_NAMES = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

interface CalendarWeekViewProps {
  anchor: Date;
  items: CalendarItem[];
  actualStripes: ActualStripe[];
  onItemClick: (item: CalendarItem) => void;
  onCreateAt: (start: Date) => void;
}

export function CalendarWeekView({
  anchor,
  items,
  actualStripes,
  onItemClick,
  onCreateAt,
}: CalendarWeekViewProps) {
  const weekStart = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Per-day splits (clip items to each day, then column-pack).
  const perDay = useMemo(
    () =>
      days.map((day) => {
        const dayStart = startOfDay(day);
        const dayEnd = new Date(dayStart.getTime() + 24 * HOUR);
        const allDay: CalendarItem[] = [];
        const timed: CalendarItem[] = [];
        for (const raw of items) {
          if (raw.start >= dayEnd || raw.end <= dayStart) continue;
          const clipped = clipItem(raw, dayStart, dayEnd);
          if (!clipped) continue;
          if (clipped.allDay) allDay.push(clipped);
          else timed.push(clipped);
        }
        const layout = layoutDayOverlaps(timed);
        const stripes = actualStripes.filter(
          (s) => s.start < dayEnd && s.end > dayStart
        );
        return { day, dayStart, dayEnd, allDay, layout, stripes };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, actualStripes, weekStart.getTime()]
  );

  const hourMarks = Array.from({ length: 24 }, (_, i) => i);
  const now = new Date();

  const handleColClick = (dayStart: Date, e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = Math.round(((y / HOUR_HEIGHT) * 60) / 15) * 15;
    onCreateAt(new Date(dayStart.getTime() + minutes * MIN));
  };

  const hasAllDay = perDay.some((d) => d.allDay.length > 0);

  return (
    <div className="card overflow-hidden">
      {/* Header row */}
      <div className="grid border-b border-ink-200 bg-ink-50/60" style={headerGrid()}>
        <div className="px-2 py-2" />
        {perDay.map(({ day }) => {
          const today = isSameDay(day, now);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "px-2 py-2 text-center border-s border-ink-200",
                today && "bg-primary-50"
              )}
            >
              <div className="text-[10px] text-ink-500">
                {DAY_NAMES[day.getDay()]}
              </div>
              <div
                className={cn(
                  "text-sm font-semibold",
                  today ? "text-primary-700" : "text-ink-900"
                )}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day row */}
      {hasAllDay && (
        <div
          className="grid border-b border-ink-200 bg-ink-50/40 min-h-[28px]"
          style={headerGrid()}
        >
          <div className="text-[10px] text-ink-500 px-2 py-1 self-center">כל היום</div>
          {perDay.map(({ day, allDay }) => (
            <div
              key={day.toISOString() + "-ad"}
              className="border-s border-ink-200 px-1 py-1 flex flex-wrap gap-1"
            >
              {allDay.map((it) => (
                <button
                  key={it.id}
                  onClick={() => onItemClick(it)}
                  className={cn(
                    "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium border",
                    it.kind === "event"
                      ? "bg-primary-50 border-primary-200 text-ink-900"
                      : "bg-white border-ink-200 text-ink-900"
                  )}
                  title={it.title}
                  type="button"
                >
                  <span className="truncate max-w-[80px]">{it.title}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Body: hours + 7 day columns */}
      <div className="grid" style={{ ...headerGrid(), height: GRID_HEIGHT }}>
        {/* Hours column */}
        <div className="relative">
          {hourMarks.map((h) => (
            <div
              key={h}
              style={{ height: HOUR_HEIGHT }}
              className="relative text-[10px] text-ink-500"
            >
              <span className="absolute top-0 start-2">{pad(h)}:00</span>
            </div>
          ))}
        </div>

        {perDay.map(({ day, dayStart, layout, stripes }) => {
          const today = isSameDay(day, now);
          const nowPercent = today ? dayPercent(now, dayStart) : null;
          return (
            <div
              key={day.toISOString() + "-body"}
              className="relative border-s border-ink-200 cursor-pointer"
              onClick={(e) => handleColClick(dayStart, e)}
            >
              {/* Hour lines */}
              {hourMarks.map((h) => (
                <div
                  key={h}
                  style={{ top: h * HOUR_HEIGHT }}
                  className="absolute inset-x-0 border-t border-ink-150 pointer-events-none"
                />
              ))}

              {/* Actual stripes */}
              {stripes.map((s, i) => {
                const dayEnd = new Date(dayStart.getTime() + 24 * HOUR);
                const top = dayPercent(
                  s.start < dayStart ? dayStart : s.start,
                  dayStart
                );
                const bottom = dayPercent(
                  s.end > dayEnd ? dayEnd : s.end,
                  dayStart
                );
                const height = bottom - top;
                if (height <= 0) return null;
                return (
                  <div
                    key={`${s.taskId}-${i}`}
                    className="absolute start-0 w-1 rounded-full bg-success-500/70 pointer-events-none"
                    style={{ top: `${top}%`, height: `${height}%` }}
                    title="זמן בפועל"
                  />
                );
              })}

              {/* Planned blocks */}
              {layout.map(({ item, column, columns }) => {
                const top = dayPercent(item.start, dayStart);
                const height = durationPercent(
                  item.end.getTime() - item.start.getTime()
                );
                const widthPct = 100 / columns;
                const leftPct = column * widthPct;
                return (
                  <CalendarBlock
                    key={item.id}
                    item={item}
                    top={top}
                    height={height}
                    leftPct={leftPct}
                    widthPct={widthPct}
                    onClick={() => onItemClick(item)}
                    compact
                  />
                );
              })}

              {nowPercent !== null && (
                <div
                  className="absolute inset-x-0 pointer-events-none z-10"
                  style={{ top: `${nowPercent}%` }}
                >
                  <div className="h-px bg-danger-500/80 relative">
                    <span className="absolute -start-1 -top-1 w-2 h-2 rounded-full bg-danger-500" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function headerGrid(): React.CSSProperties {
  return { gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))" };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
