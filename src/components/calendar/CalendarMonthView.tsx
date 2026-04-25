import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import {
  type CalendarItem,
  addDays,
  endOfMonth,
  formatHour,
  isMultiDay,
  isOverdueTask,
  isPast,
  isPastDay,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "./calendar-utils";
import { useCalendarPrefs } from "@/lib/hooks/useCalendarPrefs";

const BAND_HEIGHT = 20;
const BAND_GAP = 2;

const DAY_NAMES = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

interface CalendarMonthViewProps {
  anchor: Date;
  items: CalendarItem[];
  onItemClick: (item: CalendarItem) => void;
  /** Click on the date digit — usually navigates to day view. */
  onDayClick: (day: Date) => void;
  /** Click on the empty area of a day cell — opens the create picker. */
  onCellClick?: (day: Date) => void;
}

export function CalendarMonthView({
  anchor,
  items,
  onItemClick,
  onDayClick,
  onCellClick,
}: CalendarMonthViewProps) {
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const gridStart = startOfWeek(monthStart);
  const weekCount = Math.ceil(
    (endOfWeekOffset(monthEnd, gridStart) + 1) / 7
  );

  const weeks = useMemo(
    () =>
      Array.from({ length: weekCount }, (_, w) =>
        Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d))
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gridStart.getTime(), weekCount]
  );

  // Items that appear only on their start day (non-multi-day) — grouped.
  const singleDayByDate = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const it of items) {
      if (isMultiDay(it)) continue;
      const k = keyOf(it.start);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a.start.getTime() - b.start.getTime());
    }
    return m;
  }, [items]);

  // Multi-day items, clipped + packed per week row.
  const multiDayPerWeek = useMemo(
    () =>
      weeks.map((weekDays) => buildWeekBands(items, weekDays)),
    [items, weeks]
  );

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

      {/* Weeks */}
      <div className="divide-y divide-ink-200">
        {weeks.map((weekDays, weekIdx) => {
          const bands = multiDayPerWeek[weekIdx]!;
          const bandRows = bandRowsCount(bands);
          const bandAreaHeight =
            bandRows > 0 ? bandRows * (BAND_HEIGHT + BAND_GAP) + BAND_GAP : 0;

          return (
            <div key={weekIdx} className="relative">
              {/* Band overlay — sits on top of the week, aligned to the
                  top of the cells. Cells get paddingTop = bandAreaHeight
                  so chips start below the bands. */}
              {bandAreaHeight > 0 && (
                <div
                  className="absolute inset-x-0 top-0 pointer-events-none z-10"
                  style={{ height: bandAreaHeight }}
                >
                  {bands.map(({ item, startCol, span, row }) => (
                    <MonthBand
                      key={item.id + "-w" + weekIdx}
                      item={item}
                      now={now}
                      startCol={startCol}
                      span={span}
                      row={row}
                      onClick={() => onItemClick(item)}
                    />
                  ))}
                </div>
              )}

              <div className="grid grid-cols-7 auto-rows-fr">
                {weekDays.map((day, colIdx) => {
                  const inMonth = isSameMonth(day, anchor);
                  const today = isSameDay(day, now);
                  const past = isPastDay(day, now);
                  const singleItems = singleDayByDate.get(keyOf(day)) ?? [];
                  const cap = 3;
                  const visible = singleItems.slice(0, cap);
                  const overflow = singleItems.length - visible.length;
                  return (
                    <div
                      key={day.toISOString()}
                      onClick={(e) => {
                        // Only open the create picker when the user clicks
                        // the empty area of the cell — not on a child
                        // (date digit or chip), which has its own handler.
                        if (e.target === e.currentTarget && onCellClick) {
                          onCellClick(day);
                        }
                      }}
                      className={cn(
                        "min-h-[110px] p-1 relative flex flex-col",
                        colIdx > 0 && "border-s border-ink-200",
                        !inMonth && "bg-ink-50/50 text-ink-400",
                        past && inMonth && !today && "bg-ink-100/40",
                        today && "bg-primary-50/40",
                        onCellClick && "cursor-pointer"
                      )}
                      style={{ paddingTop: 4 + bandAreaHeight }}
                    >
                      {/* Date number — kept in normal flow at the top of the
                          cell so it can never be obscured by an event chip
                          below it. (Earlier `position: absolute + z-20`
                          version had subtle stacking-context issues that let
                          chips paint over the digits.) */}
                      <div className="flex items-center justify-start mb-0.5">
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
                      </div>
                      <div className="space-y-0.5">
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
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers

interface WeekBand {
  item: CalendarItem;
  startCol: number;
  span: number;
  row: number;
}

function buildWeekBands(items: CalendarItem[], weekDays: Date[]): WeekBand[] {
  const weekStartMs = weekDays[0]!.getTime();
  const weekEndMs = addDays(weekDays[6]!, 1).getTime();

  const candidates = items
    .filter((it) => isMultiDay(it))
    .filter((it) => it.end.getTime() > weekStartMs && it.start.getTime() < weekEndMs)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const rows: Array<Array<[number, number]>> = [];
  const out: WeekBand[] = [];

  for (const it of candidates) {
    const startMs = Math.max(it.start.getTime(), weekStartMs);
    const endMs = Math.min(it.end.getTime(), weekEndMs);
    const startCol = Math.max(
      0,
      Math.floor((startMs - weekStartMs) / (24 * 3_600_000))
    );
    const endColExclusive = Math.min(
      7,
      Math.ceil((endMs - weekStartMs) / (24 * 3_600_000))
    );
    const span = Math.max(1, endColExclusive - startCol);

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

function bandRowsCount(bands: WeekBand[]): number {
  if (bands.length === 0) return 0;
  return Math.max(...bands.map((b) => b.row)) + 1;
}

function MonthBand({
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

  const width = `calc(${(span / 7) * 100}% - 4px)`;
  const left = `calc(${(startCol / 7) * 100}% + 2px)`;
  const top = row * (BAND_HEIGHT + BAND_GAP) + BAND_GAP;

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
  const phaseStyle: React.CSSProperties = {
    backgroundColor: accent,
    borderColor: accent,
    color: "#fff",
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "absolute rounded-sm px-1.5 text-[10px] font-medium border-[1.5px] truncate text-start pointer-events-auto",
        past && "opacity-60",
        item.completed && "line-through opacity-55",
        isPhase && "font-bold uppercase"
      )}
      style={{
        top,
        insetInlineStart: left,
        width,
        height: BAND_HEIGHT,
        lineHeight: `${BAND_HEIGHT - 3}px`,
        ...(isPhase ? phaseStyle : isTask ? taskStyle : eventStyle),
      }}
      title={item.title}
      type="button"
    >
      {isPhase ? `שלב · ${item.title}` : item.title}
    </button>
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
  const { prefs } = useCalendarPrefs();
  const tz = prefs.timezone;
  const isTask = item.kind === "task";
  const past = isPast(item, now);
  const overdue = isOverdueTask(item, now);
  const accent = item.color ?? (isTask ? "#6b6b80" : "#f59e0b");

  if (!isTask) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "w-full text-start inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-medium border text-white truncate",
          past && "opacity-55"
        )}
        style={{ backgroundColor: `${accent}D9`, borderColor: accent }}
        title={`${item.title} · ${formatHour(item.start, tz)}`}
        type="button"
      >
        <span className="shrink-0 text-white/85 font-normal">
          {item.allDay ? "" : formatHour(item.start, tz)}
        </span>
        <span className="truncate">{item.title}</span>
      </button>
    );
  }

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
      title={`${item.title} · ${formatHour(item.start, tz)}`}
      type="button"
    >
      <span className="shrink-0 text-ink-500">
        {item.allDay ? "" : formatHour(item.start, tz)}
      </span>
      <span className="truncate">{item.title}</span>
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
