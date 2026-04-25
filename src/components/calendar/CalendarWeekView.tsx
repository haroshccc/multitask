import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import {
  type ActualStripe,
  type CalendarItem,
  HOUR,
  MIN,
  addDays,
  clipItem,
  isMultiDay,
  isOverdueTask,
  isPast,
  isPastDay,
  isSameDay,
  layoutDayOverlaps,
  startOfDay,
  startOfWeek,
} from "./calendar-utils";
import { CalendarBlock } from "./CalendarDayView";
import { DayNoteSlot } from "./DayNoteSlot";

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
                <DayNoteSlot body={noteBody} className="flex-1 text-start" />
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
              </div>
            </div>
          );
        })}
      </div>

      {/* Multi-day / all-day band row — items that span 2+ days render as a
          continuous horizontal bar across the days they cover. */}
      {multiDayBands.length > 0 && (
        <div
          className="grid border-b border-ink-200 bg-ink-50/40"
          style={headerGrid()}
        >
          <div className="text-[10px] text-ink-500 px-2 py-1 self-start">
            כל היום
          </div>
          <div
            className="col-span-7 relative"
            style={{ minHeight: bandRowsNeeded(multiDayBands) * 26 + 6 }}
          >
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
  const strokeColor = overdue ? "#ef4444" : accent;

  const width = `calc(${(span / 7) * 100}% - 6px)`;
  const left = `calc(${(startCol / 7) * 100}% + 3px)`;
  const top = row * 26 + 3;

  const eventStyle: React.CSSProperties = {
    backgroundColor: `${accent}D9`,
    borderColor: accent,
    color: "#fff",
  };
  const taskStyle: React.CSSProperties = {
    backgroundColor: overdue ? "rgba(239, 68, 68, 0.08)" : "white",
    borderColor: strokeColor,
    color: overdue ? "#b91c1c" : "#2d2d3a",
  };
  // Phase: filled-shade background + white text, no stripes inside.
  const phaseStyle: React.CSSProperties = {
    backgroundColor: accent,
    borderColor: accent,
    color: "#fff",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "absolute rounded-md px-2 py-1 text-xs font-medium border-[1.5px] truncate text-start shadow-soft",
        past && "opacity-65",
        item.completed && "line-through opacity-55",
        isPhase && "font-bold uppercase tracking-wider"
      )}
      style={{
        top,
        insetInlineStart: left,
        width,
        height: 22,
        ...(isPhase ? phaseStyle : isTask ? taskStyle : eventStyle),
      }}
      title={item.title}
      type="button"
    >
      {isPhase ? `שלב · ${item.title}` : item.title}
    </button>
  );
}

function headerGrid(): React.CSSProperties {
  return { gridTemplateColumns: "56px repeat(7, minmax(0, 1fr))" };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
