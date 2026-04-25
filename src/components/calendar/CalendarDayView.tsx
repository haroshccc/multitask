import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import {
  HOUR,
  MIN,
  type ActualStripe,
  type CalendarItem,
  clipItem,
  formatHour,
  isMultiDay,
  isOverdueTask,
  isPast,
  isSameDay,
  layoutDayOverlaps,
  startOfDay,
} from "./calendar-utils";
import { useCalendarPrefs } from "@/lib/hooks/useCalendarPrefs";
import { DayNoteSlot } from "./DayNoteSlot";

interface CalendarDayViewProps {
  date: Date;
  items: CalendarItem[];
  actualStripes: ActualStripe[];
  hourStart: number;
  hourEnd: number;
  hourHeight: number;
  onItemClick: (item: CalendarItem) => void;
  onCreateAt: (start: Date) => void;
  /** Per-day note body — `undefined` means no note. */
  dayNote?: string;
  /** Click on the date digit → open the per-day note editor. */
  onDateNoteClick?: (date: Date) => void;
}

export function CalendarDayView({
  date,
  items,
  actualStripes,
  hourStart,
  hourEnd,
  hourHeight,
  onItemClick,
  onCreateAt,
  dayNote,
  onDateNoteClick,
}: CalendarDayViewProps) {
  const dayStart = startOfDay(date);
  const dayEnd = new Date(dayStart.getTime() + 24 * HOUR);
  const now = new Date();
  const isToday = isSameDay(date, now);

  const { allDay, timed } = useMemo(() => {
    const allDay: CalendarItem[] = [];
    const timed: CalendarItem[] = [];
    for (const raw of items) {
      // Multi-day items (all-day OR timed items that cross midnight) collapse
      // into the all-day band above the timed grid. This keeps 24h-stretched
      // blocks out of the per-hour area.
      if (raw.allDay || isMultiDay(raw)) {
        // Only include on this day if the range covers it.
        if (raw.start < dayEnd && raw.end > dayStart) allDay.push(raw);
        continue;
      }
      const clipped = clipItem(raw, dayStart, dayEnd);
      if (!clipped) continue;
      timed.push(clipped);
    }
    return { allDay, timed };
  }, [items, dayStart, dayEnd]);

  const laidOut = useMemo(() => layoutDayOverlaps(timed), [timed]);

  const windowStart = dayStart.getTime() + hourStart * HOUR;
  const windowEnd = dayStart.getTime() + hourEnd * HOUR;
  const windowSpanMs = windowEnd - windowStart;
  const gridHeight = (hourEnd - hourStart) * hourHeight;

  const hourMarks = Array.from(
    { length: hourEnd - hourStart },
    (_, i) => hourStart + i
  );

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutesFromWindowStart = (y / hourHeight) * 60;
    const snapped = Math.round(minutesFromWindowStart / 15) * 15;
    const start = new Date(windowStart + snapped * MIN);
    onCreateAt(start);
  };

  const toPercent = (d: Date): number => {
    const ms = d.getTime() - windowStart;
    return (ms / windowSpanMs) * 100;
  };

  const toDurationPercent = (ms: number): number => (ms / windowSpanMs) * 100;

  const nowPercent = isToday && now.getTime() >= windowStart && now.getTime() <= windowEnd
    ? toPercent(now)
    : null;

  // Past-time overlay (today, up to now).
  const pastTodayPercent = isToday && now.getTime() > windowStart
    ? Math.min(toPercent(now), 100)
    : 0;

  return (
    <div className="card overflow-hidden">
      {/* Date header — date number on the start side, day note slot to its
          left (per spec). Clicking the digit opens the note editor. */}
      <div className="px-3 py-1.5 border-b border-ink-200 bg-white flex items-center gap-2">
        <button
          onClick={() => onDateNoteClick?.(date)}
          className={cn(
            "text-base font-bold tabular-nums px-1 rounded-md hover:bg-ink-100 shrink-0",
            isToday ? "text-primary-700" : "text-ink-900"
          )}
          type="button"
          title="לחצי לעריכת הערה ליום"
        >
          {date.getDate()}
        </button>
        <DayNoteSlot body={dayNote} />
      </div>

      {/* All-day strip */}
      {allDay.length > 0 && (
        <div className="px-3 py-2 border-b border-ink-200 bg-ink-50/60">
          <div className="eyebrow mb-1">כל היום</div>
          <div className="flex flex-wrap gap-1">
            {allDay.map((it) => (
              <AllDayChip key={it.id} item={it} now={now} onClick={() => onItemClick(it)} />
            ))}
          </div>
        </div>
      )}

      {/* Timed grid */}
      <div className="flex">
        {/* Hours column */}
        <div className="w-16 border-e border-ink-200 shrink-0 bg-ink-50/30">
          {hourMarks.map((h) => (
            <div
              key={h}
              style={{ height: hourHeight }}
              className="relative text-[11px] text-ink-500"
            >
              <span className="absolute top-0 start-2 -translate-y-1/2">{pad(h)}:00</span>
            </div>
          ))}
        </div>

        {/* Day column */}
        <div
          className="relative flex-1 cursor-pointer"
          style={{ height: gridHeight }}
          onClick={handleGridClick}
        >
          {/* Past-time tint — subtle gray over elapsed portion of today. */}
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

          {/* Planned blocks */}
          {laidOut.map(({ item, column, columns }) => {
            const top = toPercent(item.start);
            const height = toDurationPercent(item.end.getTime() - item.start.getTime());
            const widthPct = 100 / columns;
            const leftPct = column * widthPct;

            // Actual stripes for this task (if it's a task).
            const taskActuals =
              item.kind === "task"
                ? actualStripes
                    .filter(
                      (s) =>
                        s.taskId === (item.source as { id: string }).id &&
                        s.start < dayEnd &&
                        s.end > dayStart
                    )
                    .map((s) => ({
                      topPct: toPercent(s.start < new Date(windowStart) ? new Date(windowStart) : s.start),
                      heightPct: toDurationPercent(
                        (s.end > new Date(windowEnd) ? windowEnd : s.end.getTime()) -
                          (s.start < new Date(windowStart) ? windowStart : s.start.getTime())
                      ),
                    }))
                    .filter((x) => x.heightPct > 0)
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

/**
 * Single calendar block. Visual language (per user decision):
 *   - Event: solid filled (list color or primary). Past events: slightly transparent.
 *   - Task: outlined (border only), empty inside — colored by its list.
 *     - Completed: strike-through through the block + title.
 *     - Overdue (past-end, not completed): light red.
 *   - Actual time_entries overlay: solid-filled band INSIDE the planned block,
 *     in the same column at the same y-axis range as the time spent.
 */
export function CalendarBlock({
  item,
  now,
  top,
  height,
  leftPct,
  widthPct,
  actuals,
  onClick,
  compact,
}: {
  item: CalendarItem;
  now: Date;
  top: number;
  height: number;
  leftPct: number;
  widthPct: number;
  /** Actual time-spent segments for the containing task, already percent-mapped
   *  to the same coordinate system as `top`/`height`. */
  actuals?: { topPct: number; heightPct: number }[];
  onClick: () => void;
  compact?: boolean;
}) {
  const { prefs } = useCalendarPrefs();
  const tz = prefs.timezone;
  const isTask = item.kind === "task";
  const past = isPast(item, now);
  const overdue = isOverdueTask(item, now);
  const completed = item.completed;

  // Color: list color for both (tasks borrow from list, events either list or primary).
  const accent = item.color ?? (isTask ? "#6b6b80" : "#f59e0b");

  // Overdue overrides: light red.
  const overdueAccent = "#ef4444";
  const overdueBg = "rgba(239, 68, 68, 0.10)";
  const strokeColor = overdue ? overdueAccent : accent;

  let bg: string;
  let textColor = "#2d2d3a";
  let opacity = 1;

  if (isTask) {
    // Tasks: outline only, empty inside.
    bg = overdue ? overdueBg : "transparent";
  } else {
    // Events: solid filled.
    bg = hexToRgba(accent, 0.85);
    textColor = "#ffffff";
    if (past) opacity = 0.55;
  }

  // Relative offsets for actuals — re-map percent within the block's own box.
  const mapActualToLocal = (topPct: number, heightPct: number) => {
    const start = ((topPct - top) / height) * 100;
    const h = (heightPct / height) * 100;
    return {
      top: `${Math.max(0, start)}%`,
      height: `${Math.min(100 - Math.max(0, start), h)}%`,
    };
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "absolute rounded-md px-1.5 py-1 text-[11px] text-start overflow-hidden transition-all hover:z-20 hover:shadow-lift"
      )}
      style={{
        top: `${top}%`,
        height: `${Math.max(height, 1.5)}%`,
        insetInlineStart: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        border: `1.5px solid ${strokeColor}`,
        backgroundColor: bg,
        color: textColor,
        opacity,
      }}
      type="button"
      title={item.title}
    >
      {/* Actual time overlay — a solid-filled band in the task's list color
          sitting inside the outlined planned block, in the same column at the
          y-range of the time entry. This gives the "planned vs actual" read
          the SPEC asks for: planned outline, filled region = what you did. */}
      {isTask && actuals && actuals.length > 0 && (
        <>
          {actuals.map((a, i) => {
            const { top: tl, height: hl } = mapActualToLocal(a.topPct, a.heightPct);
            return (
              <div
                key={i}
                className="absolute inset-x-0 pointer-events-none"
                style={{
                  top: tl,
                  height: hl,
                  backgroundColor: hexToRgba(accent, 0.35),
                }}
              />
            );
          })}
        </>
      )}

      <div className="relative">
        {!compact && (
          <div
            className={cn(
              "text-[10px] font-medium leading-tight",
              isTask ? "text-ink-500" : "text-white/90"
            )}
          >
            {formatHour(item.start, tz)}
          </div>
        )}
        <div
          className={cn(
            "font-medium leading-tight truncate",
            completed && "line-through"
          )}
        >
          
          {item.title}
        </div>
      </div>

      {/* Completed tasks get a full diagonal line across the block too — a
          second, heavier cue for quick scanning. */}
      {isTask && completed && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom right, transparent calc(50% - 1px), rgba(45,45,58,0.5) 50%, transparent calc(50% + 1px))",
          }}
        />
      )}
    </button>
  );
}

function AllDayChip({
  item,
  now,
  onClick,
}: {
  item: CalendarItem;
  now: Date;
  onClick: () => void;
}) {
  const past = isPast(item, now);
  const overdue = isOverdueTask(item, now);
  const accent = item.color ?? (item.kind === "task" ? "#6b6b80" : "#f59e0b");

  if (item.kind === "event") {
    return (
      <button
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium border text-white",
          past && "opacity-60"
        )}
        style={{ backgroundColor: hexToRgba(accent, 0.85), borderColor: accent }}
        title={item.title}
        type="button"
      >
        <span className="truncate max-w-[140px]">{item.title}</span>
      </button>
    );
  }

  // Task chip: outline, empty inside.
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium border bg-white",
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
      <span className="truncate max-w-[140px]">{item.title}</span>
    </button>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
