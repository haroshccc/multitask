import { useMemo, useState } from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useCalendarPrefs } from "@/lib/hooks/useCalendarPrefs";
import { useCalendarDayNotes } from "@/lib/hooks/useCalendarDayNotes";
import { dateKey } from "@/lib/services/calendar-day-notes";
import { CalendarWeekView } from "@/components/calendar/CalendarWeekView";
import { CalendarMonthView } from "@/components/calendar/CalendarMonthView";
import { DayNoteDialog } from "@/components/calendar/DayNoteDialog";
import {
  type CalendarItem,
  addDays,
  addMonths,
  eventToItem,
  expandRrule,
  expandTaskOccurrences,
  taskExtraOccurrences,
  formatMonthYear,
  formatWeekRange,
  startOfMonth,
  startOfWeek,
  taskDeadlineToItem,
  taskToItem,
} from "@/components/calendar/calendar-utils";
import type { DropAction } from "@/components/calendar/calendar-drag";
import type { GanttRow } from "./gantt-utils";

type CalMode = "week" | "month";

interface GanttCalendarProps {
  rows: GanttRow[];
  /** List id → color, used for tasks that don't sit under a colored phase. */
  listColorById: Map<string, string | null>;
  userId?: string | null;
  /** Click a calendar item → open the underlying task/event, same as a
   *  click on the timeline grid. */
  onRowClick: (row: GanttRow) => void;
  /** Drag a plain (non-recurring) task/event to a new date → reschedule.
   *  Mirrors the timeline grid's bar-change handler. */
  onBarChange: (
    row: GanttRow,
    patch: { scheduled_at: string; duration_minutes: number }
  ) => void;
  /** Drag a single occurrence of a recurring task and choose "this
   *  occurrence only" → suppress the original instance and add a
   *  standalone replacement at `newStart`. */
  onMoveOccurrence: (
    row: GanttRow,
    originalStart: Date,
    newStart: Date
  ) => void;
}

/**
 * GanttCalendar — a read-leaning calendar view rendered inside the Gantt
 * page. It reuses the real calendar's week/month components verbatim (so it
 * looks identical to the Calendar screen) but feeds them rows coming from
 * the Gantt: phase colors are preserved (`row.accentColor`), phases render
 * as bands rather than checkable todos, and recurring tasks/events are
 * expanded into one block per occurrence so they're visible on every day
 * and hour they recur.
 */
export function GanttCalendar({
  rows,
  listColorById,
  userId,
  onRowClick,
  onBarChange,
  onMoveOccurrence,
}: GanttCalendarProps) {
  const { effectiveRange } = useCalendarPrefs();

  const [mode, setMode] = useState<CalMode>(() => {
    if (typeof window === "undefined") return "month";
    return localStorage.getItem("multitask.gantt.calendarMode") === "week"
      ? "week"
      : "month";
  });
  const changeMode = (m: CalMode) => {
    setMode(m);
    if (typeof window !== "undefined") {
      localStorage.setItem("multitask.gantt.calendarMode", m);
    }
  };

  const [anchor, setAnchor] = useState<Date>(() => new Date());

  // Expansion window — wide enough to cover the grid the chosen view draws.
  // Month renders a 6-week grid starting on the week of the 1st.
  const range = useMemo(() => {
    if (mode === "week") {
      const from = startOfWeek(anchor);
      return { from, to: addDays(from, 7) };
    }
    const from = startOfWeek(startOfMonth(anchor));
    return { from, to: addDays(from, 42) };
  }, [mode, anchor]);

  // Per-day notes — shared with the regular Calendar (same table). The
  // Gantt calendar can both display and edit them.
  const { notesByDate, noteColorsByDate } = useCalendarDayNotes(
    dateKey(range.from),
    dateKey(range.to)
  );
  const [editingNoteDate, setEditingNoteDate] = useState<Date | null>(null);

  const { items, rowByItemId } = useMemo(() => {
    const out: CalendarItem[] = [];
    const map = new Map<string, GanttRow>();

    for (const r of rows) {
      if (r.kind === "task" && r.task) {
        const t = r.task;
        // Phase color first, then the task's list color, then null (the
        // calendar falls back to its default amber).
        const color =
          r.accentColor ?? listColorById.get(t.task_list_id ?? "") ?? null;

        if (t.scheduled_at) {
          const base = taskToItem(t, color, userId);
          if (base) {
            const hasExtras = taskExtraOccurrences(t).length > 0;
            if (t.recurrence_rule || hasExtras) {
              const duration = base.end.getTime() - base.start.getTime();
              // RRULE occurrences merged with ad-hoc extra_occurrences.
              const occ = expandTaskOccurrences(
                t,
                base,
                range.from,
                range.to
              );
              const completedSet = new Set(
                Array.isArray(t.completed_occurrences)
                  ? (t.completed_occurrences as unknown[]).filter(
                      (x): x is string => typeof x === "string"
                    )
                  : []
              );
              for (const s of occ) {
                const isNoTime =
                  s.getHours() === 0 && s.getMinutes() === 0;
                const id = `${base.id}:${s.getTime()}`;
                out.push({
                  ...base,
                  id,
                  start: s,
                  end: new Date(s.getTime() + duration),
                  completed: completedSet.has(s.toISOString()),
                  allDay: isNoTime,
                });
                map.set(id, r);
              }
              if (
                occ.length === 0 &&
                base.start >= range.from &&
                base.start < range.to
              ) {
                out.push(base);
                map.set(base.id, r);
              }
            } else {
              out.push(base);
              map.set(base.id, r);
            }
          }
        }

        const dl = taskDeadlineToItem(t, color);
        if (dl) {
          out.push(dl);
          map.set(dl.id, r);
        }
      } else if (r.kind === "event" && r.event) {
        const e = r.event;
        const base = eventToItem(e);
        if (e.recurrence_rule) {
          const duration = base.end.getTime() - base.start.getTime();
          let occ: Date[] = [];
          try {
            occ = expandRrule(
              e.recurrence_rule,
              base.start,
              range.from,
              range.to
            );
          } catch {
            // malformed RRULE — treat as non-recurring below
          }
          for (const s of occ) {
            const id = `${base.id}:${s.getTime()}`;
            out.push({
              ...base,
              id,
              start: s,
              end: new Date(s.getTime() + duration),
            });
            map.set(id, r);
          }
          if (
            occ.length === 0 &&
            base.start >= range.from &&
            base.start < range.to
          ) {
            out.push(base);
            map.set(base.id, r);
          }
        } else {
          out.push(base);
          map.set(base.id, r);
        }
      }
    }

    return { items: out, rowByItemId: map };
  }, [rows, listColorById, userId, range]);

  const handleItemClick = (item: CalendarItem) => {
    const row = rowByItemId.get(item.id);
    if (row) onRowClick(row);
  };

  const handleItemDrop = (item: CalendarItem, action: DropAction) => {
    const row = rowByItemId.get(item.id);
    if (!row) return;
    // A deadline marker isn't a field the timeline's bar-change understands.
    if (item.kind === "deadline") return;
    // `entity:uuid:timestamp` → an expanded occurrence of a recurring item.
    const isOccurrence = item.id.split(":").length > 2;
    // Recurring EVENT occurrences aren't individually movable (no
    // per-occurrence storage for events) — leave the series untouched.
    if (isOccurrence && item.kind !== "task") return;

    let newStart = item.start;
    let newEnd = item.end;
    if (action.kind === "move") {
      const durationMs = item.end.getTime() - item.start.getTime();
      newStart = action.date;
      newEnd = new Date(newStart.getTime() + durationMs);
    } else if (action.kind === "resize-end") {
      newEnd = action.date;
      if (newEnd.getTime() <= newStart.getTime()) {
        newEnd = new Date(newStart.getTime() + 15 * 60_000);
      }
    } else {
      newStart = action.date;
      if (newStart.getTime() >= newEnd.getTime()) {
        newStart = new Date(newEnd.getTime() - 15 * 60_000);
      }
    }
    const durationMinutes = Math.round(
      (newEnd.getTime() - newStart.getTime()) / 60_000
    );

    if (isOccurrence) {
      // Resizing a single occurrence isn't supported — duration is a
      // series-level property and there's no per-occurrence store for it.
      if (action.kind !== "move") return;
      const moveAll = window.confirm(
        "להזיז את כל החזרות של המשימה?\n\n" +
          "אישור = כל הסדרה תזוז יחד.\n" +
          "ביטול = רק המופע הזה יזוז (ייווצר מועד ספציפי בתוך הסדרה)."
      );
      if (moveAll) {
        onBarChange(row, {
          scheduled_at: newStart.toISOString(),
          duration_minutes: durationMinutes,
        });
      } else {
        onMoveOccurrence(row, item.start, newStart);
      }
      return;
    }

    onBarChange(row, {
      scheduled_at: newStart.toISOString(),
      duration_minutes: durationMinutes,
    });
  };

  const goPrev = () =>
    setAnchor((a) => (mode === "week" ? addDays(a, -7) : addMonths(a, -1)));
  const goNext = () =>
    setAnchor((a) => (mode === "week" ? addDays(a, 7) : addMonths(a, 1)));
  const label = mode === "week" ? formatWeekRange(anchor) : formatMonthYear(anchor);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-ink-200 flex-wrap">
        <div className="inline-flex items-center gap-0.5">
          <button
            onClick={goPrev}
            className="p-1.5 rounded-md hover:bg-ink-100 text-ink-700"
            type="button"
            aria-label="הקודם"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setAnchor(new Date())}
            className="text-xs px-2 py-1 rounded-md hover:bg-ink-100 text-ink-700 font-medium"
            type="button"
            title="חזרה להיום"
          >
            היום
          </button>
          <button
            onClick={goNext}
            className="p-1.5 rounded-md hover:bg-ink-100 text-ink-700"
            type="button"
            aria-label="הבא"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
        <span className="text-sm font-semibold text-ink-800">{label}</span>
        <div className="ms-auto inline-flex rounded-md border border-ink-200 p-0.5 bg-ink-50 text-[11px]">
          {(["week", "month"] as CalMode[]).map((m) => (
            <button
              key={m}
              onClick={() => changeMode(m)}
              type="button"
              className={cn(
                "px-2 py-0.5 rounded-sm font-medium transition-colors",
                mode === m
                  ? "bg-white text-ink-900 shadow-soft"
                  : "text-ink-600 hover:text-ink-900"
              )}
            >
              {m === "week" ? "שבוע" : "חודש"}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-auto scrollbar-thin max-h-[calc(100vh-240px)]">
        {mode === "week" ? (
          <CalendarWeekView
            anchor={anchor}
            items={items}
            actualStripes={[]}
            hourStart={effectiveRange.hourStart}
            hourEnd={effectiveRange.hourEnd}
            hourHeight={44}
            onItemClick={handleItemClick}
            onCreateAt={() => {}}
            onItemDrop={handleItemDrop}
            notesByDate={notesByDate}
            noteColorsByDate={noteColorsByDate}
            onDateNoteClick={setEditingNoteDate}
            readOnly
          />
        ) : (
          <CalendarMonthView
            anchor={anchor}
            items={items}
            onItemClick={handleItemClick}
            onDayClick={setEditingNoteDate}
            onItemDrop={handleItemDrop}
            notesByDate={notesByDate}
            noteColorsByDate={noteColorsByDate}
            readOnly
          />
        )}
      </div>

      <DayNoteDialog
        date={editingNoteDate}
        initialBody={
          editingNoteDate
            ? notesByDate.get(dateKey(editingNoteDate)) ?? ""
            : ""
        }
        initialColor={
          editingNoteDate
            ? noteColorsByDate.get(dateKey(editingNoteDate)) ?? null
            : null
        }
        onClose={() => setEditingNoteDate(null)}
      />
    </div>
  );
}
