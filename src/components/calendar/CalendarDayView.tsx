import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import {
  HOUR,
  MIN,
  type ActualStripe,
  type CalendarItem,
  clipItem,
  dayPercent,
  durationPercent,
  formatHour,
  isSameDay,
  layoutDayOverlaps,
  startOfDay,
} from "./calendar-utils";

const HOUR_HEIGHT = 48; // px — one hour row
const DAY_START_HOUR = 0;
const DAY_END_HOUR = 24;
const GRID_HEIGHT = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT;

interface CalendarDayViewProps {
  date: Date;
  items: CalendarItem[];
  actualStripes: ActualStripe[];
  onItemClick: (item: CalendarItem) => void;
  /** Click on empty grid slot → "new event at time". */
  onCreateAt: (start: Date) => void;
}

export function CalendarDayView({
  date,
  items,
  actualStripes,
  onItemClick,
  onCreateAt,
}: CalendarDayViewProps) {
  const dayStart = startOfDay(date);
  const dayEnd = new Date(dayStart.getTime() + 24 * HOUR);
  const now = new Date();
  const isToday = isSameDay(date, now);

  const { allDay, timed } = useMemo(() => {
    const allDay: CalendarItem[] = [];
    const timed: CalendarItem[] = [];
    for (const raw of items) {
      if (!isSameDay(raw.start, date) && raw.start > dayStart) {
        // Skip items that start after the day.
      }
      const clipped = clipItem(raw, dayStart, dayEnd);
      if (!clipped) continue;
      if (clipped.allDay) allDay.push(clipped);
      else timed.push(clipped);
    }
    return { allDay, timed };
  }, [items, date, dayStart, dayEnd]);

  const laidOut = useMemo(() => layoutDayOverlaps(timed), [timed]);

  const hourMarks = Array.from(
    { length: DAY_END_HOUR - DAY_START_HOUR },
    (_, i) => DAY_START_HOUR + i
  );

  // Handle click on the empty grid background.
  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutesFromDayStart = (y / HOUR_HEIGHT) * 60;
    // Snap to 15-minute grid.
    const snapped = Math.round(minutesFromDayStart / 15) * 15;
    const start = new Date(dayStart.getTime() + snapped * MIN);
    onCreateAt(start);
  };

  const nowPercent = isToday ? dayPercent(now, dayStart) : null;

  return (
    <div className="card overflow-hidden">
      {/* All-day strip */}
      {allDay.length > 0 && (
        <div className="px-3 py-2 border-b border-ink-200 bg-ink-50/60">
          <div className="eyebrow mb-1">כל היום</div>
          <div className="flex flex-wrap gap-1">
            {allDay.map((it) => (
              <button
                key={it.id}
                onClick={() => onItemClick(it)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium border text-ink-900",
                  it.kind === "event"
                    ? "bg-primary-50 border-primary-200"
                    : "bg-white border-ink-200"
                )}
                title={it.title}
                type="button"
              >
                <span className="truncate max-w-[140px]">{it.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Timed grid */}
      <div className="flex">
        {/* Hours column */}
        <div className="w-16 border-e border-ink-200 shrink-0">
          {hourMarks.map((h) => (
            <div
              key={h}
              style={{ height: HOUR_HEIGHT }}
              className="relative text-[11px] text-ink-500 text-start px-2"
            >
              <span className="absolute top-0 start-2">{pad(h)}:00</span>
            </div>
          ))}
        </div>

        {/* Day column */}
        <div
          className="relative flex-1 cursor-pointer"
          style={{ height: GRID_HEIGHT }}
          onClick={handleGridClick}
        >
          {/* Hour lines */}
          {hourMarks.map((h) => (
            <div
              key={h}
              style={{ top: h * HOUR_HEIGHT - DAY_START_HOUR * HOUR_HEIGHT }}
              className="absolute inset-x-0 border-t border-ink-150 pointer-events-none"
            />
          ))}

          {/* Actual (solid) stripes — rendered BEHIND planned blocks.
              Shown as thin solid left stripe on the day column so you can
              compare planned vs actual at a glance, per SPEC §16. */}
          {actualStripes.map((s, i) => {
            const top = dayPercent(s.start < dayStart ? dayStart : s.start, dayStart);
            const bottom = dayPercent(s.end > dayEnd ? dayEnd : s.end, dayStart);
            const height = bottom - top;
            if (height <= 0) return null;
            return (
              <div
                key={`${s.taskId}-${i}`}
                className="absolute start-0 w-1 rounded-full bg-success-500/70 pointer-events-none"
                style={{
                  top: `${top}%`,
                  height: `${height}%`,
                }}
                title="זמן בפועל"
              />
            );
          })}

          {/* Planned blocks */}
          {laidOut.map(({ item, column, columns }) => {
            const top = dayPercent(item.start, dayStart);
            const height = durationPercent(item.end.getTime() - item.start.getTime());
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
      </div>
    </div>
  );
}

export function CalendarBlock({
  item,
  top,
  height,
  leftPct,
  widthPct,
  onClick,
  compact,
}: {
  item: CalendarItem;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
  onClick: () => void;
  compact?: boolean;
}) {
  const isTask = item.kind === "task";
  // Planned = dashed outline; "actual" overlay sits separately (green stripes).
  // Tasks use dashed, events use solid — the instant-read cue from SPEC §16.
  const borderStyle = isTask ? "dashed" : "solid";

  // Default color: tasks borrow from list color (fallback ink), events use primary.
  const accent = item.color ?? (isTask ? "#6b6b80" : "#f59e0b");
  const bg = isTask ? "rgba(245, 158, 11, 0.08)" : "rgba(245, 158, 11, 0.14)";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "absolute rounded-md px-1.5 py-1 text-[11px] text-start overflow-hidden shadow-soft transition-all hover:z-20 hover:shadow-lift",
        item.completed && "opacity-50 line-through"
      )}
      style={{
        top: `${top}%`,
        height: `${Math.max(height, 1.5)}%`,
        // Items fill the column inset a bit so overlaps read as tiled.
        insetInlineStart: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        border: `1.5px ${borderStyle} ${accent}`,
        backgroundColor: bg,
        color: "#2d2d3a",
      }}
      type="button"
      title={item.title}
    >
      {!compact && (
        <div className="text-[10px] text-ink-500 font-medium leading-tight">
          {formatHour(item.start)}
        </div>
      )}
      <div className="font-medium truncate leading-tight">
        {isTask ? "📋 " : ""}
        {item.title}
      </div>
    </button>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
