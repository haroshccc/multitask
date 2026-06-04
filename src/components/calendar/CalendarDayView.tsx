import { useMemo, useRef } from "react";
import { AlertTriangle, Repeat } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  HOUR,
  MIN,
  type ActualStripe,
  type CalendarItem,
  clipItem,
  formatHour,
  isHourless,
  isMultiDay,
  isOverdueTask,
  isPast,
  isSameDay,
  itemTooltip,
  layoutDayOverlaps,
  startOfDay,
} from "./calendar-utils";
import {
  type DropAction,
  type ItemDropHandler,
  beginDrag,
  durationMin,
  emitHover,
  emptyDragImage,
  endDrag,
  formatDragHoverLabel,
  getDrag,
  isItemDraggable,
  startPointerMove,
} from "./calendar-drag";
import { useCalendarPrefs } from "@/lib/hooks/useCalendarPrefs";
import { DayNoteSlot } from "./DayNoteSlot";
import { TaskCheckButton } from "./TaskCheckButton";
import { HalfCheckIcon } from "@/components/ui/HalfCheckIcon";
import { RecurringMarker } from "./RecurringMarker";
import { FrameworkBlockChip } from "./FrameworkBlockChip";
import type {
  FrameworkBlockOccurrenceView,
  FrameworkDayLabelView,
} from "@/lib/types/frameworks";

interface CalendarDayViewProps {
  date: Date;
  items: CalendarItem[];
  actualStripes: ActualStripe[];
  hourStart: number;
  hourEnd: number;
  hourHeight: number;
  onItemClick: (item: CalendarItem) => void;
  /** Right-click a task block → open the actions menu at the cursor. */
  onItemContextMenu?: (item: CalendarItem, x: number, y: number) => void;
  onCreateAt: (start: Date) => void;
  /** Reposition or resize an item by drag-drop. The page is responsible
   *  for translating the action into the right entity patch. */
  onItemDrop?: ItemDropHandler;
  /** Per-day note body — `undefined` means no note. */
  dayNote?: string;
  /** Per-day note text color — overrides the muted default. */
  dayNoteColor?: string | null;
  /** Click on the date digit → open the per-day note editor. */
  onDateNoteClick?: (date: Date) => void;
  /** Framework time-blocks (faded background layer), already projected to dates. */
  frameworkBlocks?: FrameworkBlockOccurrenceView[];
  /** Per-day framework labels (yyyy-mm-dd → labels), shown under the date. */
  frameworkLabelsByDate?: Map<string, FrameworkDayLabelView[]>;
  /** Left-click a framework block → cycle its check state. */
  onFrameworkBlockClick?: (occ: FrameworkBlockOccurrenceView) => void;
  /** Right-click a framework block → move gesture (single/future prompt). */
  onFrameworkBlockContextMenu?: (
    occ: FrameworkBlockOccurrenceView,
    x: number,
    y: number
  ) => void;
}

export function CalendarDayView({
  date,
  items,
  actualStripes,
  hourStart,
  hourEnd,
  hourHeight,
  onItemClick,
  onItemContextMenu,
  onCreateAt,
  onItemDrop,
  dayNote,
  dayNoteColor,
  onDateNoteClick,
  frameworkBlocks,
  frameworkLabelsByDate,
  onFrameworkBlockClick,
  onFrameworkBlockContextMenu,
}: CalendarDayViewProps) {
  const dayStart = startOfDay(date);
  const dayEnd = new Date(dayStart.getTime() + 24 * HOUR);
  const now = new Date();
  const isToday = isSameDay(date, now);
  const dayKey = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const dayFrameworkLabels = frameworkLabelsByDate?.get(dayKey) ?? [];
  const dayFrameworkBlocks = (frameworkBlocks ?? []).filter((b) => b.date === dayKey);

  const { allDay, timed } = useMemo(() => {
    const allDay: CalendarItem[] = [];
    const timed: CalendarItem[] = [];
    for (const raw of items) {
      // Multi-day items (all-day OR timed items that cross midnight) collapse
      // into the all-day band above the timed grid. This keeps 24h-stretched
      // blocks out of the per-hour area. Hourless tasks (midnight = "no
      // specific time") join the same band so they're visible regardless
      // of the timed-grid's hourStart range.
      if (raw.allDay || isMultiDay(raw) || isHourless(raw)) {
        // Only include on this day if the range covers it.
        if (raw.start < dayEnd && raw.end > dayStart) allDay.push(raw);
        continue;
      }
      const clipped = clipItem(raw, dayStart, dayEnd);
      if (!clipped) continue;
      timed.push(clipped);
    }
    // Sort: completed all-day tasks slide to the end. Everything else
    // keeps its natural order. (Timed tasks aren't here — they stay
    // pinned to their hour in the grid below.)
    allDay.sort((a, b) => {
      const aDone = a.kind === "task" && a.completed ? 1 : 0;
      const bDone = b.kind === "task" && b.completed ? 1 : 0;
      return aDone - bDone;
    });
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

  /**
   * Translate a column-relative pointer Y to a snapped, dragOffset-adjusted
   * Date. Shared by the drop handler and the live hover-pill updater so
   * both agree on the time the user is targeting.
   */
  const yToSnappedDate = (y: number, grabOffsetMin: number): Date => {
    const minutesFromWindowStart = (y / hourHeight) * 60 - grabOffsetMin;
    const snapped = Math.round(minutesFromWindowStart / 15) * 15;
    return new Date(windowStart + snapped * MIN);
  };

  const handleColumnDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const drag = getDrag();
    if (!drag || !onItemDrop) return;
    if (drag.item.allDay) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const date = yToSnappedDate(
      e.clientY - rect.top,
      drag.mode === "move" ? drag.grabOffsetMin : 0
    );
    const action: DropAction = { kind: drag.mode, date };
    onItemDrop(drag.item, action);
    endDrag();
  };

  /**
   * Live hover-pill updater — computes the would-be new start/end
   * (accounting for the drag mode) and emits a "08:00 עד 09:00" label
   * that follows the cursor.
   */
  const handleColumnDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    const drag = getDrag();
    if (!drag) return;
    if (drag.item.allDay) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const date = yToSnappedDate(
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
      label: formatDragHoverLabel(drag, labelStart, labelEnd),
      resizeEdge:
        drag.mode !== "move"
          ? { left: rect.left, right: rect.right, top: e.clientY }
          : undefined,
    });
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
        {/* Framework header(s) on the date line */}
        {dayFrameworkLabels.map((lbl, i) => (
          <span
            key={i}
            className="text-[13px] font-bold truncate shrink-0"
            style={{ color: lbl.color ?? "#6366f1" }}
            title={lbl.label}
          >
            {lbl.label}
          </span>
        ))}
        <DayNoteSlot body={dayNote} textColor={dayNoteColor} className="flex-1" />
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
          data-cal-daycol="1"
          data-window-start={windowStart}
          data-hour-height={hourHeight}
          onClick={handleGridClick}
          onDragOver={handleColumnDragOver}
          onDrop={handleColumnDrop}
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

          {/* Framework background blocks (faded) — behind planned items */}
          {dayFrameworkBlocks.map((b) => (
            <FrameworkBlockChip
              key={b.id}
              occ={b}
              top={toPercent(b.start)}
              height={toDurationPercent(b.end.getTime() - b.start.getTime())}
              onClick={onFrameworkBlockClick}
              onContextMenu={onFrameworkBlockContextMenu}
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
                onContextMenu={
                  onItemContextMenu
                    ? (x, y) => onItemContextMenu(item, x, y)
                    : undefined
                }
                onItemDrop={onItemDrop}
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
  onContextMenu,
  onItemDrop,
  compact,
  readOnly,
  recurringAsMarker,
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
  /** Right-click → page actions menu at the cursor (viewport coords). */
  onContextMenu?: (x: number, y: number) => void;
  /** Touch/pen move support — applies a "move" drop. Mouse uses native DnD. */
  onItemDrop?: ItemDropHandler;
  compact?: boolean;
  /** When true the block is display-only — no task check-off control. */
  readOnly?: boolean;
  /** When true, a recurring task renders as a flat deadline-style marker
   *  (repeat glyph + start time + underline) instead of a bordered block. */
  recurringAsMarker?: boolean;
}) {
  const { prefs } = useCalendarPrefs();
  const tz = prefs.timezone;
  // Set while a touch/pen move gesture is in flight so the click fired on
  // release (which would open the edit dialog) is swallowed. A plain tap
  // never sets it, so tapping still opens the editor.
  const touchDragRef = useRef(false);
  const isTask = item.kind === "task";
  const isDeadline = item.kind === "deadline";
  const past = isPast(item, now);
  const overdue = isOverdueTask(item, now);
  const completed = item.completed;

  // Color: list color for both (tasks borrow from list, events either list or primary).
  const accent = item.color ?? (isTask || isDeadline ? "#6b6b80" : "#f59e0b");

  // Gantt calendar view: a recurring task renders as a flat marker — no
  // bordered block, just repeat glyph + start time + title + underline.
  if (recurringAsMarker && isTask && item.recurring) {
    return (
      <div
        className="absolute"
        style={{
          top: `${top}%`,
          insetInlineStart: `calc(${leftPct}% + 2px)`,
          width: `calc(${widthPct}% - 4px)`,
        }}
      >
        <RecurringMarker item={item} accent={accent} tz={tz} onClick={onClick} />
      </div>
    );
  }

  // Deadline marker — rendered inline rather than as a bordered block. Title
  // + warning triangle icon, with a coloured underline in the list's color. Sits in
  // the time grid at the deadline timestamp, claiming a 15-minute slot. No
  // border, no background, no time-range header — visually distinct from a
  // regular task block at first glance.
  if (isDeadline) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className="absolute px-1 text-start cursor-pointer hover:z-20 hover:bg-ink-50/60 rounded-sm transition-colors"
        style={{
          top: `${top}%`,
          height: `${Math.max(height, 1.5)}%`,
          insetInlineStart: `calc(${leftPct}% + 2px)`,
          width: `calc(${widthPct}% - 4px)`,
        }}
        title={`דד-ליין: ${item.title}`}
      >
        <div className="flex items-center justify-between gap-1 text-[11px]">
          <span className="truncate font-medium text-ink-900 flex-1 min-w-0">
            {item.title}
          </span>
          <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
        </div>
        {/* Underline in the list color — the only chrome we draw. */}
        <div
          className="h-[2px] mt-0.5 rounded-full"
          style={{ backgroundColor: accent }}
        />
      </div>
    );
  }

  // Override visualization (events only): when an event has its own color
  // overriding its parent calendar's color, use the calendar color for the
  // BORDER and the override for the FILL — so both colors stay visible at
  // a glance. When there's no override, both are the same (= calendar
  // color or default).
  const strokeColor =
    !isTask && item.originalColor ? item.originalColor : accent;

  let bg: string;
  let textColor = "#2d2d3a";
  let opacity = 1;

  if (isTask) {
    // Tasks: outline only, empty inside (border-style carries ownership signal).
    bg = "transparent";
  } else {
    // Events: solid filled.
    bg = hexToRgba(accent, 0.85);
    textColor = "#ffffff";
    if (past) opacity = 0.55;
  }
  // Completed tasks fade to half-strength so they visually recede behind
  // active work. Paired with the title strikethrough this is enough cue
  // without the heavier full-block diagonal we used to draw.
  if (isTask && item.completed) opacity = 0.5;

  // Relative offsets for actuals — re-map percent within the block's own box.
  const mapActualToLocal = (topPct: number, heightPct: number) => {
    const start = ((topPct - top) / height) * 100;
    const h = (heightPct / height) * 100;
    return {
      top: `${Math.max(0, start)}%`,
      height: `${Math.min(100 - Math.max(0, start), h)}%`,
    };
  };

  const draggable = isItemDraggable(item);
  // Resize is enabled on timed (non-allDay), non-deadline blocks that are
  // also draggable. Multi-day/all-day bands have their own band-edge
  // handles in the band rendering paths.
  const resizable = draggable && !item.allDay && item.kind !== "deadline";

  // The title gets lifted out of the block when the duration is too short
  // for it to fit inside (≤ 15 min ≈ 12px tall, where the time line alone
  // already eats the whole height). The lifted title is absolutely
  // positioned above the block so it remains associated visually but
  // doesn't fight the time-line for space.
  const blockMinutes = durationMin(item);
  // Blocks ≤ 30 min are too short for two lines (time + title) with py-1
  // padding at the minimum hour-height of 36 px (30 min = 18 px).
  // Use a compact single-line layout instead; keep the full layout above.
  const titleLifted = blockMinutes <= 30;

  // Resolve the would-be drag mode from the grab position. Top 20% =
  // resize-start, bottom 20% = resize-end, otherwise move. This frees us
  // from needing separate strip elements that don't fit on short blocks
  // — every block size now resizes naturally.
  const resolveDragMode = (
    grabRatio: number
  ): "move" | "resize-start" | "resize-end" => {
    if (!resizable) return "move";
    if (grabRatio < 0.2) return "resize-start";
    if (grabRatio > 0.8) return "resize-end";
    return "move";
  };

  // Render as a `<div role="button">` rather than a `<button>` because the
  // block hosts a nested `<button>` (the TaskCheckButton) — nested buttons
  // are invalid HTML and break dragstart in some browsers.
  return (
    <>
    <div
      role="button"
      tabIndex={0}
      data-cal-band
      onPointerDown={(e) => {
        if (!draggable || e.pointerType === "mouse" || !onItemDrop) return;
        // Touch/pen MOVE only — grab offset keeps the block from jumping.
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const grabRatio = (e.clientY - rect.top) / Math.max(rect.height, 1);
        const grabOffsetMin = grabRatio * durationMin(item);
        startPointerMove(item, e, grabOffsetMin, {
          onItemDrop,
          onDragRecognised: () => {
            touchDragRef.current = true;
          },
          onLongPress: onContextMenu
            ? (x, y) => onContextMenu(x, y)
            : undefined,
        });
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (touchDragRef.current) {
          touchDragRef.current = false;
          return;
        }
        onClick();
      }}
      onContextMenu={
        onContextMenu
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onContextMenu(e.clientX, e.clientY);
            }
          : undefined
      }
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseMove={(e) => {
        // Live cursor hint — ns-resize when the cursor is near a top/bottom
        // edge, grab in the middle. Pure visual; the actual drag-mode is
        // resolved again at dragstart from the same grabRatio formula.
        if (!resizable) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const ratio = (e.clientY - rect.top) / Math.max(rect.height, 1);
        const next =
          ratio < 0.2 || ratio > 0.8 ? "ns-resize" : "grab";
        const el = e.currentTarget as HTMLElement;
        if (el.style.cursor !== next) el.style.cursor = next;
      }}
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const blockMin = durationMin(item);
        const grabPxFromTop = e.clientY - rect.top;
        const grabRatio = grabPxFromTop / Math.max(rect.height, 1);
        const mode = resolveDragMode(grabRatio);
        // Only "move" needs the grab offset; resize gestures peg the drop
        // point directly to the cursor.
        const grabMinFromStart =
          mode === "move" ? grabRatio * blockMin : 0;
        beginDrag(item, grabMinFromStart, mode);
        e.dataTransfer.effectAllowed = "move";
        // Resize: hide the whole-block ghost — only the edge line + pill
        // should be visible, making it clear this is a resize not a move.
        if (mode !== "move") {
          e.dataTransfer.setDragImage(emptyDragImage(), 0, 0);
        }
        try {
          e.dataTransfer.setData("text/plain", item.id);
        } catch {
          /* ignore — some browsers throw on synthetic events in tests */
        }
      }}
      onDragEnd={() => endDrag()}
      className={cn(
        "absolute rounded-md px-1.5 text-start overflow-hidden transition-all hover:z-20 hover:shadow-lift group",
        titleLifted ? "py-0" : "py-1 text-[11px]",
        draggable && "cursor-grab active:cursor-grabbing"
      )}
      style={{
        top: `${top}%`,
        height: `${Math.max(height, 1.5)}%`,
        insetInlineStart: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        // Touch/pen: claim the gesture for our manual move drag instead of
        // letting the browser scroll. Mouse uses native DnD (unaffected).
        touchAction: draggable ? "none" : undefined,
        border: `1.5px ${
          isTask && item.ownershipMode === "delegated"
            ? "dashed"
            : isTask && item.ownershipMode === "assigned"
            ? "dotted"
            : "solid"
        } ${strokeColor}`,
        backgroundColor: bg,
        color: textColor,
        opacity,
      }}
      title={itemTooltip(item)}
    >
      {/* Resize affordances — visual-only hairlines on top/bottom edges
          that fade in on hover. Pointer-events:none so the parent's
          mousemove + dragstart still own the gesture; the edges are just
          a hint that the user can drag from the top/bottom 20% of the
          block to resize. */}
      {resizable && blockMinutes > 30 && (
        <>
          <div
            className="absolute inset-x-0 top-0 h-1.5 opacity-0 group-hover:opacity-70 transition-opacity rounded-t-md pointer-events-none"
            style={{ backgroundColor: strokeColor }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-1.5 opacity-0 group-hover:opacity-70 transition-opacity rounded-b-md pointer-events-none"
            style={{ backgroundColor: strokeColor }}
          />
        </>
      )}
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

      {titleLifted ? (
        /* Compact single-line for ≤30 min blocks: [time] [title] [dot?] [☐] */
        <div className="flex items-center gap-1 h-full leading-none overflow-hidden">
          <span className={cn("text-[9px] tabular-nums font-medium shrink-0", isTask ? "text-ink-400" : "text-white/80")}>
            {`${String(item.start.getHours()).padStart(2, "0")}:${String(item.start.getMinutes()).padStart(2, "0")}`}
          </span>
          <span className={cn("text-[9px] font-medium truncate flex-1 min-w-0", completed && "line-through")}>
            {item.title}
          </span>
          {item.recurring && (
            <Repeat
              className={cn("w-2.5 h-2.5 shrink-0", isTask ? "text-ink-400" : "text-white/80")}
            />
          )}
          {isTask && overdue && !completed && (
            <span className="w-1.5 h-1.5 rounded-full bg-danger-500 shrink-0" title="באיחור" />
          )}
          {isTask && !readOnly && (
            <TaskCheckButton
              taskId={(item.source as { id: string }).id}
              completed={completed}
              accent={accent}
              size="sm"
              occurrenceStart={
                item.id.split(":").length === 3 ? item.start : undefined
              }
            />
          )}
        </div>
      ) : (
        <div className="relative">
          <div
            className={cn(
              "font-medium leading-tight tabular-nums",
              compact ? "text-[9px]" : "text-[10px]",
              isTask ? "text-ink-500" : "text-white/90"
            )}
          >
            {formatHour(item.start, tz)} עד {formatHour(item.end, tz)}
          </div>
          {/* [title] [dot?] [☐] — dot sits inline between title and checkbox */}
          <div className="flex items-start gap-1">
            <span
              className={cn(
                "font-medium leading-tight truncate flex-1 min-w-0",
                completed && "line-through"
              )}
            >
              {item.title}
            </span>
            {item.recurring && (
              <Repeat
                className={cn(
                  "w-3 h-3 shrink-0 mt-0.5",
                  isTask ? "text-ink-400" : "text-white/80"
                )}
              />
            )}
            {isTask && item.ownershipMode === "assigned" && (
              <span className="shrink-0 text-[8px] text-ink-500 font-medium leading-tight mt-0.5">הוצאל</span>
            )}
            {isTask && item.ownershipMode === "delegated" && (
              <span className="shrink-0 text-[8px] text-ink-500 font-medium leading-tight mt-0.5">האצלתי</span>
            )}
            {isTask && item.pendingApproval && (
              <HalfCheckIcon size={11} className="mt-0.5" />
            )}
            {isTask && overdue && !completed && (
              <span className="w-1.5 h-1.5 rounded-full bg-danger-500 shrink-0 mt-1" title="באיחור" />
            )}
            {isTask && !readOnly && (
              <TaskCheckButton
                taskId={(item.source as { id: string }).id}
                completed={completed}
                accent={accent}
                size="sm"
                className="mt-0.5"
                occurrenceStart={
                  item.id.split(":").length === 3 ? item.start : undefined
                }
              />
            )}
          </div>
        </div>
      )}

      {/* (Override visualization is now expressed via the block's border
          color = calendar color + fill = override color, set above. No
          extra indicator needed.) */}
    </div>
    </>
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
          past && "opacity-60",
          // Override-bound chip: thicker border so the calendar-color
          // ring reads at chip size.
          item.originalColor && "border-[2px]"
        )}
        style={{
          backgroundColor: hexToRgba(accent, 0.85),
          // Border = original calendar color when there's an override;
          // otherwise the resolved color.
          borderColor: item.originalColor ?? accent,
        }}
        title={itemTooltip(item)}
        type="button"
      >
        <span className="truncate max-w-[140px]">{item.title}</span>
      </button>
    );
  }

  // Task chip: outline, empty inside. Overdue → tiny red dot, not a
  // red border/bg.
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium border bg-white",
        item.completed && "opacity-60"
      )}
      style={{
        borderColor: accent,
        color: "#2d2d3a",
        backgroundColor: "white",
      }}
      title={itemTooltip(item)}
      type="button"
    >
      <TaskCheckButton
        taskId={(item.source as { id: string }).id}
        completed={item.completed}
        accent={accent}
        size="sm"
        occurrenceStart={
          item.id.split(":").length === 3 ? item.start : undefined
        }
      />
      <span
        className={cn(
          "truncate max-w-[140px]",
          item.completed && "line-through"
        )}
      >
        {item.title}
      </span>
      {overdue && !item.completed && (
        <span
          className="absolute -top-0.5 -end-0.5 w-1.5 h-1.5 rounded-full bg-danger-500 pointer-events-none"
          title="באיחור"
        />
      )}
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
