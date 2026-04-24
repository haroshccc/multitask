import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import {
  type ActualStripe,
  type CalendarItem,
  HOUR,
  MIN,
  addDays,
  clipItem,
  isPastDay,
  isSameDay,
  layoutDayOverlaps,
  startOfDay,
  startOfWeek,
} from "./calendar-utils";
import { CalendarBlock } from "./CalendarDayView";

const DAY_NAMES = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

interface CalendarWeekViewProps {
  anchor: Date;
  items: CalendarItem[];
  actualStripes: ActualStripe[];
  hourStart: number;
  hourEnd: number;
  hourHeight: number;
  onItemClick: (item: CalendarItem) => void;
  onCreateAt: (start: Date) => void;
}

export function CalendarWeekView({
  anchor,
  items,
  actualStripes,
  hourStart,
  hourEnd,
  hourHeight,
  onItemClick,
  onCreateAt,
}: CalendarWeekViewProps) {
  const weekStart = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

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

  const hourMarks = Array.from(
    { length: hourEnd - hourStart },
    (_, i) => hourStart + i
  );
  const gridHeight = (hourEnd - hourStart) * hourHeight;
  const now = new Date();

  const handleColClick = (dayStart: Date, e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutesFromWindowStart = Math.round(((y / hourHeight) * 60) / 15) * 15;
    const slotStart = new Date(dayStart.getTime() + hourStart * HOUR + minutesFromWindowStart * MIN);
    onCreateAt(slotStart);
  };

  const hasAllDay = perDay.some((d) => d.allDay.length > 0);

  const percentFor = (date: Date, dayStart: Date) => {
    const windowStart = dayStart.getTime() + hourStart * HOUR;
    const windowEnd = dayStart.getTime() + hourEnd * HOUR;
    const span = windowEnd - windowStart;
    const clamped = Math.max(windowStart, Math.min(windowEnd, date.getTime()));
    return ((clamped - windowStart) / span) * 100;
  };

  const durationPercentFor = (ms: number) => {
    const span = (hourEnd - hourStart) * HOUR;
    return (ms / span) * 100;
  };

  return (
    <div className="card overflow-hidden">
      {/* Header row */}
      <div className="grid border-b border-ink-200 bg-ink-50/60" style={headerGrid()}>
        <div className="px-2 py-2" />
        {perDay.map(({ day }) => {
          const today = isSameDay(day, now);
          const past = isPastDay(day, now);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "px-2 py-2 text-center border-s border-ink-200",
                today && "bg-primary-50",
                past && !today && "bg-ink-100/60"
              )}
            >
              <div className="text-[10px] text-ink-500">{DAY_NAMES[day.getDay()]}</div>
              <div
                className={cn(
                  "text-sm font-semibold",
                  today ? "text-primary-700" : past ? "text-ink-500" : "text-ink-900"
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
                <AllDayMini key={it.id} item={it} now={now} onClick={() => onItemClick(it)} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="grid" style={{ ...headerGrid(), height: gridHeight }}>
        {/* Hours column */}
        <div className="relative bg-ink-50/30">
          {hourMarks.map((h, i) => (
            <div
              key={h}
              style={{ height: hourHeight, top: i * hourHeight }}
              className="absolute inset-x-0 text-[10px] text-ink-500"
            >
              <span className="absolute top-0 start-2 -translate-y-1/2">
                {pad(h)}:00
              </span>
            </div>
          ))}
        </div>

        {perDay.map(({ day, dayStart, layout, stripes }) => {
          const today = isSameDay(day, now);
          const past = isPastDay(day, now);
          const windowStart = dayStart.getTime() + hourStart * HOUR;
          const windowEnd = dayStart.getTime() + hourEnd * HOUR;
          const nowPercent =
            today && now.getTime() >= windowStart && now.getTime() <= windowEnd
              ? percentFor(now, dayStart)
              : null;
          // Past-time tint for today's elapsed portion.
          const pastTodayPercent = today && now.getTime() > windowStart
            ? Math.min(percentFor(now, dayStart), 100)
            : 0;

          return (
            <div
              key={day.toISOString() + "-body"}
              className={cn(
                "relative border-s border-ink-200 cursor-pointer",
                past && !today && "bg-ink-100/30"
              )}
              onClick={(e) => handleColClick(dayStart, e)}
            >
              {/* Past-time tint (today only) */}
              {pastTodayPercent > 0 && (
                <div
                  className="absolute inset-x-0 top-0 bg-ink-900/[0.035] pointer-events-none"
                  style={{ height: `${pastTodayPercent}%` }}
                />
              )}

              {/* Hour lines */}
              {hourMarks.map((h, i) => (
                <div
                  key={h}
                  style={{ top: i * hourHeight }}
                  className="absolute inset-x-0 border-t border-ink-150 pointer-events-none"
                />
              ))}

              {/* Planned blocks with actual overlays */}
              {layout.map(({ item, column, columns }) => {
                const top = percentFor(item.start, dayStart);
                const height = durationPercentFor(
                  item.end.getTime() - item.start.getTime()
                );
                const widthPct = 100 / columns;
                const leftPct = column * widthPct;

                const taskActuals =
                  item.kind === "task"
                    ? stripes
                        .filter((s) => s.taskId === (item.source as { id: string }).id)
                        .map((s) => {
                          const segStart = Math.max(s.start.getTime(), windowStart);
                          const segEnd = Math.min(s.end.getTime(), windowEnd);
                          if (segEnd <= segStart) return null;
                          return {
                            topPct: percentFor(new Date(segStart), dayStart),
                            heightPct: durationPercentFor(segEnd - segStart),
                          };
                        })
                        .filter((x): x is { topPct: number; heightPct: number } => !!x)
                    : [];

                return (
                  <CalendarBlock
                    key={item.id}
                    item={item}
                    now={now}
                    top={top}
                    height={height}
                    leftPct={leftPct}
                    widthPct={widthPct}
                    actuals={taskActuals}
                    onClick={() => onItemClick(item)}
                    compact
                  />
                );
              })}

              {/* Now line */}
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

function AllDayMini({
  item,
  now,
  onClick,
}: {
  item: CalendarItem;
  now: Date;
  onClick: () => void;
}) {
  const past = item.end.getTime() < now.getTime();
  const overdue = item.kind === "task" && !item.completed && past;
  const accent = item.color ?? (item.kind === "task" ? "#6b6b80" : "#f59e0b");

  if (item.kind === "event") {
    return (
      <button
        onClick={onClick}
        className={cn(
          "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium border text-white",
          past && "opacity-55"
        )}
        style={{
          backgroundColor: `${accent}D9`,
          borderColor: accent,
        }}
        title={item.title}
        type="button"
      >
        <span className="truncate max-w-[80px]">{item.title}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-sm px-1.5 py-0.5 text-[10px] font-medium border bg-white",
        item.completed && "line-through opacity-60"
      )}
      style={{
        borderColor: overdue ? "#ef4444" : accent,
        color: overdue ? "#b91c1c" : "#2d2d3a",
        backgroundColor: overdue ? "rgba(239, 68, 68, 0.06)" : "white",
      }}
      title={item.title}
      type="button"
    >
      <span className="truncate max-w-[80px]">
        📋 {item.title}
      </span>
    </button>
  );
}

function headerGrid(): React.CSSProperties {
  return { gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))" };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
