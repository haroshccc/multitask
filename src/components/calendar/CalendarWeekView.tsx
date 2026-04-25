import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import {
  type ActualStripe,
  type CalendarItem,
  HOUR,
  MIN,
  addDays,
  clipItem,
  formatHour,
  isMultiDay,
  isOverdueTask,
  isPast,
  isPastDay,
  isSameDay,
  itemTooltip,
  layoutDayOverlaps,
  startOfDay,
  startOfWeek,
} from "./calendar-utils";
import {
  type ItemDropHandler,
  beginDrag,
  emitHover,
  endDrag,
  getDrag,
  isItemDraggable,
} from "./calendar-drag";
import { CalendarBlock } from "./CalendarDayView";
import { DayNoteSlot } from "./DayNoteSlot";
import { TaskCheckButton } from "./TaskCheckButton";

/** yyyy-mm-dd in local time — same shape as `dateKey()` in the service. */
function dayNoteKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

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
  /** Reposition or resize by drag. */
  onItemDrop?: ItemDropHandler;
  /** Lookup: per-date note body (yyyy-mm-dd → string). */
  notesByDate?: Map<string, string>;
  /** Click on a column's date digit → open the per-day note editor. */
  onDateNoteClick?: (date: Date) => void;
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
  onItemDrop,
  notesByDate,
  onDateNoteClick,
}: CalendarWeekViewProps) {
  const weekStart = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Items that span more than one visible day (all-day events OR timed items
  // that cross midnight). These render as a continuous band across the week
  // header, NOT as 24-hour blocks inside each day.
  const weekWindowStart = startOfDay(days[0]!);
  const multiDayBands = useMemo(
    () => buildMultiDayBands(items, days),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, weekWindowStart.getTime()]
  );

  const multiDayItemIds = useMemo(
    () => new Set(multiDayBands.map((b) => b.item.id)),
    [multiDayBands]
  );

  const perDay = useMemo(
    () =>
      days.map((day) => {
        const dayStart = startOfDay(day);
        const dayEnd = new Date(dayStart.getTime() + 24 * HOUR);
        const timed: CalendarItem[] = [];
        for (const raw of items) {
          if (multiDayItemIds.has(raw.id)) continue; // handled by the band row
          if (raw.allDay) continue; // handled by the band row
          if (raw.start >= dayEnd || raw.end <= dayStart) continue;
          const clipped = clipItem(raw, dayStart, dayEnd);
          if (!clipped) continue;
          timed.push(clipped);
        }
        const layout = layoutDayOverlaps(timed);
        const stripes = actualStripes.filter(
          (s) => s.start < dayEnd && s.end > dayStart
        );
        return { day, dayStart, dayEnd, layout, stripes };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, actualStripes, weekStart.getTime(), multiDayItemIds]
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

  /** Translate column-relative Y → snapped Date for one day-column. */
  const yToSnappedDate = (
    dayStart: Date,
    y: number,
    grabOffsetMin: number
  ): Date => {
    const minutesFromWindowStart = (y / hourHeight) * 60 - grabOffsetMin;
    const snapped = Math.round(minutesFromWindowStart / 15) * 15;
    return new Date(dayStart.getTime() + hourStart * HOUR + snapped * MIN);
  };

  const handleColDrop = (
    dayStart: Date,
    e: React.DragEvent<HTMLDivElement>
  ) => {
    const drag = getDrag();
    if (!drag || !onItemDrop) return;
    if (drag.item.allDay) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const date = yToSnappedDate(
      dayStart,
      e.clientY - rect.top,
      drag.mode === "move" ? drag.grabOffsetMin : 0
    );
    onItemDrop(drag.item, { kind: drag.mode, date });
    endDrag();
  };

  const handleColDragOver = (
    dayStart: Date,
    e: React.DragEvent<HTMLDivElement>
  ) => {
    const drag = getDrag();
    if (!drag) return;
    // All-day items can only drop on the all-day band — dropping on the
    // timed grid would silently strip the all-day flag.
    if (drag.item.allDay) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const date = yToSnappedDate(
      dayStart,
      e.clientY - rect.top,
      drag.mode === "move" ? drag.grabOffsetMin : 0
    );
    let labelStart: Date;
    let labelEnd: Date;
    if (drag.mode === "resize-end") {
      labelStart = drag.item.start;
      labelEnd = date;
    } else if (drag.mode === "resize-start") {
      labelStart = date;
      labelEnd = drag.item.end;
    } else {
      const dur = drag.item.end.getTime() - drag.item.start.getTime();
      labelStart = date;
      labelEnd = new Date(date.getTime() + dur);
    }
    emitHover({
      x: e.clientX,
      y: e.clientY,
      label: `${formatHour(labelStart)} עד ${formatHour(labelEnd)}`,
    });
  };

  /**
   * All-day band-row drop target. Each of 7 columns above the timed grid
   * accepts drops as "this day became the new anchor". For all-day items
   * we keep the whole-day semantics (no time component); for timed items
   * dropped here we keep their original time-of-day, just changing the
   * date. Resize modes change the corresponding edge to that day.
   */
  const handleAllDayCellDrop = (
    day: Date,
    e: React.DragEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    const drag = getDrag();
    if (!drag || !onItemDrop) return;
    const date = dateAtDay(day, drag.item, drag.mode);
    onItemDrop(drag.item, { kind: drag.mode, date });
    endDrag();
  };

  const handleAllDayCellDragOver = (
    day: Date,
    e: React.DragEvent<HTMLDivElement>
  ) => {
    const drag = getDrag();
    if (!drag) return;
    e.preventDefault();
    const date = dateAtDay(day, drag.item, drag.mode);
    let labelStart: Date;
    let labelEnd: Date;
    if (drag.mode === "resize-end") {
      labelStart = drag.item.start;
      labelEnd = date;
    } else if (drag.mode === "resize-start") {
      labelStart = date;
      labelEnd = drag.item.end;
    } else {
      const dur = drag.item.end.getTime() - drag.item.start.getTime();
      labelStart = date;
      labelEnd = new Date(date.getTime() + dur);
    }
    emitHover({
      x: e.clientX,
      y: e.clientY,
      label: `${shortDate(labelStart)} עד ${shortDate(labelEnd)}`,
    });
  };

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
          const noteBody = notesByDate?.get(dayNoteKey(day));
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "px-2 py-2 border-s border-ink-200",
                today && "bg-primary-50",
                past && !today && "bg-ink-100/60"
              )}
            >
              <div className="flex items-start justify-between gap-1 min-w-0">
                <button
                  onClick={() => onDateNoteClick?.(day)}
                  className={cn(
                    "text-end shrink-0 rounded-md px-1 hover:bg-ink-100",
                    today ? "text-primary-700" : past ? "text-ink-500" : "text-ink-900"
                  )}
                  title="לחצי לעריכת הערה ליום"
                  type="button"
                >
                  <div className="text-[10px] text-ink-500">{DAY_NAMES[day.getDay()]}</div>
                  <div className="text-sm font-semibold">{day.getDate()}</div>
                </button>
                <DayNoteSlot body={noteBody} className="flex-1 text-end" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Multi-day / all-day band row — items that span 2+ days render as a
          continuous horizontal bar across the days they cover. */}
      {/* All-day band row. Always rendered so it can serve as a drop
          target even when empty (drag a multi-day item from one row to
          another). When `multiDayBands` is empty the row collapses to
          a thin strip — keeps drop targets without taking real estate. */}
      <div
        className="grid border-b border-ink-200 bg-ink-50/40"
        style={headerGrid()}
      >
        <div className="text-[10px] text-ink-500 px-2 py-1 self-start">
          כל היום
        </div>
        <div
          className="col-span-7 relative"
          style={{
            minHeight: Math.max(
              22,
              bandRowsNeeded(multiDayBands) * 26 + 6
            ),
          }}
        >
          {/* Sub-grid of 7 transparent drop cells so dropping anywhere
              in the band row resolves to a specific day-column. */}
          <div className="absolute inset-0 grid grid-cols-7 pointer-events-auto">
            {perDay.map(({ day }) => (
              <div
                key={day.toISOString() + "-allday-drop"}
                onDragOver={(e) => handleAllDayCellDragOver(day, e)}
                onDrop={(e) => handleAllDayCellDrop(day, e)}
                className="border-s border-ink-100/60"
              />
            ))}
          </div>
          {multiDayBands.map(({ item, startCol, span, row }) => (
            <MultiDayBand
              key={item.id}
              item={item}
              now={now}
              startCol={startCol}
              span={span}
              row={row}
              onClick={() => onItemClick(item)}
            />
          ))}
        </div>
      </div>

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
              onDragOver={(e) => handleColDragOver(dayStart, e)}
              onDrop={(e) => handleColDrop(dayStart, e)}
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

interface MultiDayBandData {
  item: CalendarItem;
  /** Column index inside the visible 7-day week (0 = first visible day). */
  startCol: number;
  /** How many consecutive days it spans inside the visible week. */
  span: number;
  /** Row in the stacked band area; 0 = top. */
  row: number;
}

/** Build the packed list of multi-day bands. Each row avoids column overlap. */
function buildMultiDayBands(
  items: CalendarItem[],
  days: Date[]
): MultiDayBandData[] {
  const windowStart = startOfDay(days[0]!).getTime();
  const windowEnd = new Date(startOfDay(days[6]!).getTime() + 24 * HOUR).getTime();
  const candidates = items
    .filter((it) => isMultiDay(it))
    .filter((it) => it.end.getTime() > windowStart && it.start.getTime() < windowEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const rows: Array<Array<[number, number]>> = []; // rows[rowIdx] = [[startCol, endCol)...]
  const out: MultiDayBandData[] = [];

  for (const it of candidates) {
    const startMs = Math.max(it.start.getTime(), windowStart);
    const endMs = Math.min(it.end.getTime(), windowEnd);
    const startCol = Math.max(
      0,
      Math.floor((startMs - windowStart) / (24 * HOUR))
    );
    const endColExclusive = Math.min(
      7,
      Math.ceil((endMs - windowStart) / (24 * HOUR))
    );
    const span = Math.max(1, endColExclusive - startCol);

    // Find first row without overlap.
    let rowIdx = 0;
    while (rowIdx < rows.length) {
      const conflicts = rows[rowIdx]!.some(
        ([s, e]) => !(endColExclusive <= s || startCol >= e)
      );
      if (!conflicts) break;
      rowIdx++;
    }
    if (rowIdx === rows.length) rows.push([]);
    rows[rowIdx]!.push([startCol, endColExclusive]);

    out.push({ item: it, startCol, span, row: rowIdx });
  }
  return out;
}

function bandRowsNeeded(bands: MultiDayBandData[]): number {
  if (bands.length === 0) return 0;
  return Math.max(...bands.map((b) => b.row)) + 1;
}

function MultiDayBand({
  item,
  now,
  startCol,
  span,
  row,
  onClick,
}: {
  item: CalendarItem;
  now: Date;
  startCol: number;
  span: number;
  row: number;
  onClick: () => void;
}) {
  const isTask = item.kind === "task";
  const isPhase = !!item.isPhase;
  const past = isPast(item, now);
  const overdue = isOverdueTask(item, now);
  const accent = item.color ?? (isTask ? "#6b6b80" : "#f59e0b");
  const strokeColor = accent;
  // Phases stay un-draggable (visualize phase lifetimes, not movable).
  const draggable = !isPhase && isItemDraggable(item);

  const width = `calc(${(span / 7) * 100}% - 6px)`;
  const left = `calc(${(startCol / 7) * 100}% + 3px)`;
  const top = row * 26 + 3;

  const eventStyle: React.CSSProperties = {
    backgroundColor: `${accent}D9`,
    borderColor: item.originalColor ?? accent,
    color: "#fff",
  };
  const taskStyle: React.CSSProperties = {
    backgroundColor: "white",
    borderColor: strokeColor,
    color: "#2d2d3a",
  };
  const phaseStyle: React.CSSProperties = {
    backgroundColor: accent,
    borderColor: accent,
    color: "#fff",
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        beginDrag(item, 0, "move");
        e.dataTransfer.effectAllowed = "move";
        try {
          e.dataTransfer.setData("text/plain", item.id);
        } catch {
          /* ignore */
        }
      }}
      onDragEnd={() => endDrag()}
      className={cn(
        "absolute rounded-md px-2 py-1 text-xs font-medium border-[1.5px] truncate text-start shadow-soft inline-flex items-center gap-1",
        past && "opacity-65",
        item.completed && "opacity-55",
        isPhase && "font-bold uppercase tracking-wider",
        draggable && "cursor-grab active:cursor-grabbing"
      )}
      style={{
        top,
        insetInlineStart: left,
        width,
        height: 22,
        ...(isPhase ? phaseStyle : isTask ? taskStyle : eventStyle),
      }}
      title={itemTooltip(item)}
    >
      {isTask && !isPhase && (
        <TaskCheckButton
          taskId={(item.source as { id: string }).id}
          completed={item.completed}
          accent={accent}
          size="sm"
        />
      )}
      <span className={cn(item.completed && "line-through", "truncate flex-1")}>
        {isPhase ? `שלב · ${item.title}` : item.title}
      </span>
      {isTask && overdue && !item.completed && (
        <span
          className="absolute -top-1 -end-1 w-1.5 h-1.5 rounded-full bg-danger-500 pointer-events-none"
          title="באיחור"
        />
      )}
      {/* Edge resize handles — left and right grab strips. The drop target
          decides which date the user landed on; this just begins a drag in
          the right mode. */}
      {draggable && (
        <>
          <ResizeHandle item={item} edge="start" />
          <ResizeHandle item={item} edge="end" />
        </>
      )}
    </div>
  );
}

/**
 * Tiny edge handle on a band — drag begins in resize mode. The visual is
 * a 6px-wide grab strip flush with the band's edge, only visible on hover
 * to keep the band's main appearance unchanged when you're not editing.
 */
function ResizeHandle({
  item,
  edge,
}: {
  item: CalendarItem;
  edge: "start" | "end";
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        beginDrag(item, 0, edge === "start" ? "resize-start" : "resize-end");
        e.dataTransfer.effectAllowed = "move";
        try {
          e.dataTransfer.setData("text/plain", item.id);
        } catch {
          /* ignore */
        }
      }}
      onDragEnd={() => endDrag()}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "absolute top-0 bottom-0 w-1.5 cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity bg-white/80 rounded-sm",
        edge === "start" ? "start-0" : "end-0"
      )}
      title={edge === "start" ? "גרור כדי לשנות התחלה" : "גרור כדי לשנות סיום"}
    />
  );
}

function headerGrid(): React.CSSProperties {
  return { gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))" };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Compute the target Date when a drag is dropped on `day`'s all-day cell.
 *   - all-day items: drop at midnight of `day`.
 *   - timed items: keep the original time-of-day, swap the date to `day`.
 * Resize modes use the corresponding edge of the item to source the
 * time-of-day so a resize on a timed multi-day item doesn't lose its hour.
 */
function dateAtDay(
  day: Date,
  item: CalendarItem,
  mode: "move" | "resize-start" | "resize-end"
): Date {
  const out = new Date(day);
  if (item.allDay) {
    out.setHours(0, 0, 0, 0);
    // All-day end is stored as start-of-NEXT-day (exclusive). When the
    // user drops the end-handle on "Friday", they mean "Friday is the
    // last inclusive day" → ends_at = Saturday 00:00.
    if (mode === "resize-end") {
      out.setDate(out.getDate() + 1);
    }
    return out;
  }
  const sourceTime =
    mode === "resize-end" ? item.end : mode === "resize-start" ? item.start : item.start;
  out.setHours(
    sourceTime.getHours(),
    sourceTime.getMinutes(),
    sourceTime.getSeconds(),
    sourceTime.getMilliseconds()
  );
  return out;
}

function shortDate(d: Date): string {
  return d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
}
