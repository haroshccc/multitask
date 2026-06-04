import { useMemo, useState } from "react";
import { ChevronDown, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  type CalendarItem,
  addDays,
  formatHour,
  isHourless,
  isOverdueTask,
  isPast,
  isSameDay,
  startOfDay,
  startOfWeek,
} from "./calendar-utils";
import { useCalendarPrefs } from "@/lib/hooks/useCalendarPrefs";
import { TaskCheckButton } from "./TaskCheckButton";
import { FrameworkInlineChip } from "./FrameworkBlockChip";
import type {
  FrameworkBlockOccurrenceView,
  FrameworkDayLabelView,
} from "@/lib/types/frameworks";

/** yyyy-mm-dd in local time. */
function agendaDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

interface CalendarAgendaViewProps {
  /** Anchor date — shows a 2-week window starting from `startOfWeek(anchor)`. */
  anchor: Date;
  items: CalendarItem[];
  onItemClick: (item: CalendarItem) => void;
  onCreateAt: (start: Date) => void;
  /** Lookup: per-date note body (yyyy-mm-dd → string). */
  notesByDate?: Map<string, string>;
  /** Click on a section's date digit → open the per-day note editor. */
  onDateNoteClick?: (date: Date) => void;
  /** Framework occurrences (timed + all-day) shown per day. */
  frameworkBlocks?: FrameworkBlockOccurrenceView[];
  /** Per-day framework headers (yyyy-mm-dd → labels). */
  frameworkLabelsByDate?: Map<string, FrameworkDayLabelView[]>;
  /** Left-click a framework occurrence → cycle its check state. */
  onFrameworkBlockClick?: (occ: FrameworkBlockOccurrenceView) => void;
}

/**
 * Agenda (list) view — redesigned for clarity: single continuous list, days
 * separated by a large rounded date chip on the right with a vertical rule
 * beside it. Today gets a colored stripe. Unlike the previous "one card per
 * day" approach this keeps the eye flowing down a single column and the day
 * separator is unmissable without burning vertical space.
 */
export function CalendarAgendaView({
  anchor,
  items,
  onItemClick,
  onCreateAt,
  notesByDate,
  onDateNoteClick,
  frameworkBlocks,
  frameworkLabelsByDate,
  onFrameworkBlockClick,
}: CalendarAgendaViewProps) {
  const windowStart = startOfDay(startOfWeek(anchor));
  const windowDays = 14;
  const days = useMemo(
    () => Array.from({ length: windowDays }, (_, i) => addDays(windowStart, i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [windowStart.getTime()]
  );

  const now = new Date();
  const [collapsePast, setCollapsePast] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const todayStart = startOfDay(now).getTime();

  const fwByDay = useMemo(() => {
    const m = new Map<string, FrameworkBlockOccurrenceView[]>();
    for (const b of frameworkBlocks ?? []) {
      const arr = m.get(b.date) ?? [];
      arr.push(b);
      m.set(b.date, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.start.getTime() - b.start.getTime());
    return m;
  }, [frameworkBlocks]);

  const hasPast = days.some((d) => d.getTime() < todayStart);

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarItem[]>();
    for (const it of items) {
      const k = keyOf(it.start);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(it);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => {
        // Completed task with no specific hour sinks; timed completed
        // tasks stay at their hour (per spec).
        const aSink = a.kind === "task" && a.completed && isHourless(a) ? 1 : 0;
        const bSink = b.kind === "task" && b.completed && isHourless(b) ? 1 : 0;
        if (aSink !== bSink) return aSink - bSink;
        return a.start.getTime() - b.start.getTime();
      });
    }
    return m;
  }, [items]);

  return (
    <div className="card overflow-hidden">
      {hasPast && (
        <button
          type="button"
          onClick={() => setCollapsePast((v) => !v)}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-ink-500 hover:bg-ink-50 border-b border-ink-200"
        >
          <EyeOff className="w-3.5 h-3.5" />
          {collapsePast ? "הצגת ימים שעברו" : "מזעור ימים שעברו"}
        </button>
      )}
      {days.map((day) => {
        const today = isSameDay(day, now);
        const list = byDay.get(keyOf(day)) ?? [];
        const key = agendaDayKey(day);
        const isPastDay = day.getTime() < todayStart;
        const collapsed = collapsePast && isPastDay && !expanded.has(key);
        return (
          <DayGroup
            key={day.toISOString()}
            day={day}
            today={today}
            items={list}
            onItemClick={onItemClick}
            onCreateAt={onCreateAt}
            noteBody={notesByDate?.get(key)}
            onDateNoteClick={onDateNoteClick}
            frameworkLabels={frameworkLabelsByDate?.get(key) ?? []}
            frameworkOccs={fwByDay.get(key) ?? []}
            onFrameworkBlockClick={onFrameworkBlockClick}
            collapsed={collapsed}
            onExpand={() =>
              setExpanded((prev) => {
                const next = new Set(prev);
                next.add(key);
                return next;
              })
            }
          />
        );
      })}
    </div>
  );
}

function DayGroup({
  day,
  today,
  items,
  onItemClick,
  onCreateAt,
  noteBody,
  onDateNoteClick,
  frameworkLabels,
  frameworkOccs,
  onFrameworkBlockClick,
  collapsed,
  onExpand,
}: {
  day: Date;
  today: boolean;
  items: CalendarItem[];
  onItemClick: (item: CalendarItem) => void;
  onCreateAt: (start: Date) => void;
  noteBody?: string;
  onDateNoteClick?: (date: Date) => void;
  frameworkLabels: FrameworkDayLabelView[];
  frameworkOccs: FrameworkBlockOccurrenceView[];
  onFrameworkBlockClick?: (occ: FrameworkBlockOccurrenceView) => void;
  collapsed: boolean;
  onExpand: () => void;
}) {
  const { prefs } = useCalendarPrefs();
  const tz = prefs.timezone;
  const now = new Date();
  const dayName = day.toLocaleDateString("he-IL", { weekday: "long", timeZone: tz });
  // Mobile-friendly form: "יום שלישי" → "שלישי". Saves ~30px so the
  // date chip can compress on narrow screens without cropping.
  const dayNameShort = dayName.replace(/^יום\s+/, "");
  const dayNum = day.getDate();
  const monthShort = day.toLocaleDateString("he-IL", { month: "short", timeZone: tz });
  const past = day.getTime() < startOfDay(now).getTime();

  // Collapsed (minimized past day) — a thin clickable summary line.
  if (collapsed) {
    const count = items.length + frameworkOccs.length;
    return (
      <button
        type="button"
        onClick={onExpand}
        className="w-full flex items-center gap-2 px-3 py-1.5 border-b border-ink-200 bg-ink-50/40 text-start hover:bg-ink-50"
      >
        <span className="text-[11px] font-medium text-ink-500 tabular-nums shrink-0 w-16 sm:w-32">
          {dayNameShort} {dayNum}/{day.getMonth() + 1}
        </span>
        <span className="text-[11px] text-ink-400 flex-1 truncate">
          {count > 0 ? `${count} פריטים` : "—"}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-ink-400 shrink-0" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex border-b border-ink-200 last:border-b-0",
        today && "bg-primary-50/30",
        past && !today && "bg-ink-50/40"
      )}
    >
      {/* Big date chip on the right (start in RTL). The day-number is
          clickable to open the note editor; the note slot lives BELOW the
          number on the right side (per spec "מימין מתחת למספר תאריך"). */}
      <div
        className={cn(
          "flex flex-col items-stretch py-3 w-16 sm:w-32 shrink-0 border-e px-1 sm:px-2",
          today ? "border-primary-500 bg-primary-500" : "border-ink-200 bg-ink-50/60"
        )}
      >
        <button
          onClick={() => onDateNoteClick?.(day)}
          className="flex flex-col items-center text-center rounded-md px-1 hover:bg-black/5"
          title="לחצי לעריכת הערה ליום"
          type="button"
        >
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wider leading-none mb-1 truncate max-w-full",
              today ? "text-white/90" : past ? "text-ink-400" : "text-ink-500"
            )}
          >
            {today ? "היום" : (
              <>
                <span className="sm:hidden">{dayNameShort}</span>
                <span className="hidden sm:inline">{dayName}</span>
              </>
            )}
          </span>
          <span
            className={cn(
              "text-xl sm:text-2xl font-bold leading-none tabular-nums",
              today ? "text-white" : past ? "text-ink-500" : "text-ink-900"
            )}
          >
            {dayNum}
          </span>
          <span
            className={cn(
              "text-[10px] mt-0.5 leading-none",
              today ? "text-white/80" : past ? "text-ink-400" : "text-ink-500"
            )}
          >
            {monthShort}
          </span>
        </button>
        {frameworkLabels.map((lbl, i) => (
          <div
            key={i}
            className={cn("mt-1.5 text-[10px] font-bold leading-tight px-1 truncate", today && "drop-shadow")}
            style={{ color: today ? "#fff" : lbl.color ?? "#6366f1" }}
            title={lbl.label}
          >
            {lbl.label}
          </div>
        ))}
        {noteBody && (
          <div
            className={cn(
              "mt-1.5 text-[10px] leading-tight px-1 truncate",
              today ? "text-white/90" : "text-ink-500"
            )}
            title={noteBody}
          >
            {noteBody}
          </div>
        )}
      </div>

      {/* Items column */}
      <div className="flex-1 min-w-0 py-1">
        {frameworkOccs.length > 0 && (
          <div className="px-3 py-1.5 flex flex-col gap-1">
            {frameworkOccs.map((occ) => (
              <FrameworkInlineChip
                key={occ.id}
                occ={occ}
                showTime
                onClick={onFrameworkBlockClick}
              />
            ))}
          </div>
        )}
        {items.length === 0 ? (
          frameworkOccs.length === 0 ? (
            <button
              onClick={() => onCreateAt(day)}
              className="w-full text-start px-4 py-2.5 text-[11px] text-ink-400 hover:text-primary-600 hover:bg-ink-50"
              type="button"
            >
              + הוסף אירוע ליום זה
            </button>
          ) : null
        ) : (
          <ul className="divide-y divide-ink-150">
            {items.map((it) => (
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
  const { prefs } = useCalendarPrefs();
  const tz = prefs.timezone;
  const isTask = item.kind === "task";
  const past = isPast(item, now);
  const overdue = isOverdueTask(item, now);
  const accent = item.color ?? (isTask ? "#6b6b80" : "#f59e0b");

  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          "w-full px-3 py-2 flex items-center gap-2 text-start hover:bg-ink-50",
          past && "opacity-75",
          item.completed && "opacity-60"
        )}
        type="button"
      >
        {/* Time block — fixed width so titles align */}
        <div className="w-14 shrink-0 text-[11px] text-ink-500 tabular-nums leading-tight">
          {item.allDay ? (
            <span className="font-medium">כל היום</span>
          ) : isHourless(item) ? (
            <span className="font-medium">ללא שעה</span>
          ) : (
            <>
              <div>{formatHour(item.start, tz)}</div>
              <div className="text-ink-400">{formatHour(item.end, tz)}</div>
            </>
          )}
        </div>

        {/* Color accent bar */}
        <div
          className="w-1 self-stretch rounded-full shrink-0"
          style={{ backgroundColor: accent }}
        />

        {/* Task complete-checkbox — only for tasks. Stops propagation so
            it doesn't fire the row's edit-modal click. Placed next to the
            title so the visual association is immediate. */}
        {isTask ? (
          <div className="relative shrink-0">
            <TaskCheckButton
              taskId={(item.source as { id: string }).id}
              completed={item.completed}
              accent={accent}
              size="md"
              occurrenceStart={
                item.id.split(":").length === 3 ? item.start : undefined
              }
            />
            {overdue && !item.completed && (
              <span
                className="absolute -top-0.5 -end-0.5 w-1.5 h-1.5 rounded-full bg-danger-500 pointer-events-none"
                title="באיחור"
              />
            )}
          </div>
        ) : (
          <span className="w-4 h-4 shrink-0" />
        )}

        {/* Title + meta. On mobile the title is horizontally scrollable so
            long task names can be read in full without truncation; desktop
            keeps the cleaner truncated look since rows are wider there. */}
        <div className="flex-1 min-w-0">
          <div className="overflow-x-auto sm:overflow-x-hidden no-scrollbar">
            <div
              className={cn(
                "text-[13px] font-medium text-ink-900 whitespace-nowrap sm:truncate",
                item.completed && "line-through"
              )}
            >
              {item.title || <span className="italic text-ink-400">ללא כותרת</span>}
            </div>
          </div>
          <div className="text-[10px] text-ink-500 mt-0.5 flex items-center gap-2">
            <span>{isTask ? "משימה" : "אירוע"}</span>
            {overdue && (
              <span className="text-danger-600 font-medium">· באיחור</span>
            )}
            {item.completed && (
              <span className="text-success-600 font-medium">· בוצע</span>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}

function keyOf(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
