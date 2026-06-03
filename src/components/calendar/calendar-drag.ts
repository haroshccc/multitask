/**
 * Calendar drag-and-drop — minimal HTML5-native implementation.
 *
 * Why not dnd-kit? The calendar already absolutely-positions every block at
 * known pixel offsets inside per-day columns. Native drag composes well with
 * that: the drop target reads the cursor's clientY/X, converts pixels back
 * into time, and fires `onItemDrop(item, newStart)`. dnd-kit would force us
 * to wrap every absolutely-positioned block in a `useDraggable` and re-do
 * the collision math — strictly more code for the same UX.
 *
 * The dragged payload is held in a module-level ref instead of `dataTransfer`
 * because we need the original CalendarItem (to preserve duration, identify
 * task vs event) and serializing the source row through `dataTransfer.getData`
 * is awkward.
 *
 * Modes:
 *   - "move": drop sets a new start; duration is preserved.
 *   - "resize-end": drop changes only the end (the start stays put).
 *   - "resize-start": drop changes only the start (the end stays put).
 *
 * Drop targets are responsible for applying the mode correctly when calling
 * the page's `onItemDrop` callback. They get the mode via `getDrag()`.
 */
import type { PointerEvent as ReactPointerEvent } from "react";
import type { CalendarItem } from "./calendar-utils";
import { MIN } from "./calendar-utils";

export type DragMode = "move" | "resize-start" | "resize-end";

/**
 * The shape that drop handlers pass back to the page. The view computes
 * the right `date` for the mode (for "move" it's the new start; for the
 * resize modes it's the new edge — start or end).
 */
export type DropAction =
  | { kind: "move"; date: Date }
  | { kind: "resize-start"; date: Date }
  | { kind: "resize-end"; date: Date };

export type ItemDropHandler = (item: import("./calendar-utils").CalendarItem, action: DropAction) => void;

interface DragState {
  item: CalendarItem;
  mode: DragMode;
  /**
   * Minutes between the item's start and where the user grabbed it. Lets
   * us drop "where the cursor is" instead of snapping the block's top-left
   * to the cursor (which feels jumpy). Only used for "move".
   */
  grabOffsetMin: number;
}

let current: DragState | null = null;

/**
 * `data-cal-dragging` on `<body>` while a calendar drag is in flight. CSS
 * (see index.css) uses this to mark all `[data-cal-band]` overlays as
 * `pointer-events: none` during a drag, so a drop on top of another band
 * passes through to the day cell beneath and isn't silently swallowed by
 * the band element itself (which has no drop handler).
 */
function setDraggingFlag(on: boolean): void {
  if (typeof document === "undefined") return;
  if (on) document.body.setAttribute("data-cal-dragging", "true");
  else document.body.removeAttribute("data-cal-dragging");
}

/**
 * The draggable source element itself carries `data-cal-band`. If we flip
 * the flag (→ `pointer-events: none` on every band) *synchronously* inside
 * the `dragstart` handler, Chrome re-hit-tests the pointer, finds the source
 * no longer interactive, ABORTS the just-started drag, and degrades the
 * gesture to a click — which opened the edit dialog instead of moving the
 * item. Deferring by one frame lets the native drag fully establish first;
 * flipping the bands a tick later still lets drops fall through bands that
 * sit between the cursor and the real (cell) drop target.
 */
let dragFlagRaf: number | null = null;

function cancelScheduledFlag(): void {
  if (dragFlagRaf != null && typeof cancelAnimationFrame !== "undefined") {
    cancelAnimationFrame(dragFlagRaf);
  }
  dragFlagRaf = null;
}

export function beginDrag(
  item: CalendarItem,
  grabOffsetMin: number,
  mode: DragMode = "move"
): void {
  current = { item, mode, grabOffsetMin };
  cancelScheduledFlag();
  if (typeof requestAnimationFrame === "undefined") {
    setDraggingFlag(true);
    return;
  }
  dragFlagRaf = requestAnimationFrame(() => {
    dragFlagRaf = null;
    // Only arm the flag if the drag is still in flight (endDrag may have
    // already run for a very short gesture).
    if (current) setDraggingFlag(true);
  });
}

export function endDrag(): void {
  current = null;
  cancelScheduledFlag();
  setDraggingFlag(false);
  emitHover(null);
}

export function getDrag(): DragState | null {
  return current;
}

/**
 * Some calendar items aren't safely draggable in the current iteration:
 *   - Phase tasks (visualized as background bands, conceptually not movable).
 *   - Recurring instances (dragging one occurrence shouldn't reschedule all).
 *
 * All-day and multi-day items ARE draggable (between days, or to resize),
 * just with different semantics handled by the drop target.
 */
export function isItemDraggable(item: CalendarItem): boolean {
  if (item.isPhase) return false;
  // Recurring event instances have IDs like "event:abc:1234567890" — extra
  // colon-segments after the entity id mark an expanded occurrence.
  const colons = item.id.split(":").length;
  if (item.kind === "event" && colons > 2) return false;
  return true;
}

/**
 * Multi-day / all-day items expose start + end resize handles in the bands.
 * Single-day timed items currently don't (resize there is a future iteration).
 */
export function isResizable(item: CalendarItem): boolean {
  if (!isItemDraggable(item)) return false;
  // We only show resize handles on bands (multi-day or all-day).
  return true;
}

/**
 * Compute the duration (minutes) of an item, used to re-derive the
 * end-time when a drop only changes the start.
 */
export function durationMin(item: CalendarItem): number {
  return Math.max(15, Math.round((item.end.getTime() - item.start.getTime()) / MIN));
}

// ----------------------------------------------------------------------------
// Live-hover pill: a small floating "HH:mm — HH:mm" label that follows the
// cursor while a drag is in progress. Drop targets emit hover updates as the
// user moves; a single subscriber (the page-level <DragHoverPill /> portal)
// renders the label.
// ----------------------------------------------------------------------------

export interface HoverInfo {
  x: number;
  y: number;
  label: string;
  /**
   * During a resize gesture: render a full-width horizontal line at this
   * viewport Y across the given column bounds. Gives clear "edge is here"
   * feedback without the browser's whole-block ghost.
   */
  resizeEdge?: { left: number; right: number; top: number };
}

let _emptyImg: HTMLImageElement | null = null;

/**
 * A transparent 1×1 GIF used as the drag image for resize gestures so the
 * browser shows no block-ghost — only our custom edge line + pill tooltip.
 */
export function emptyDragImage(): HTMLImageElement {
  if (!_emptyImg && typeof document !== "undefined") {
    _emptyImg = new Image(1, 1);
    _emptyImg.src =
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  }
  return _emptyImg ?? new Image(1, 1);
}

/**
 * Build the live drag-tooltip label. Shows the would-be time range plus
 * the resulting duration; for resize gestures it also reports the delta
 * (+30 דק׳ / -15 דק׳) so the user knows precisely how much they're
 * trimming or extending. Move gestures get just the duration since the
 * length doesn't change.
 */
export function formatDragHoverLabel(
  drag: { item: CalendarItem; mode: DragMode },
  newStart: Date,
  newEnd: Date
): string {
  const startLabel = formatHourMinute(newStart);
  const endLabel = formatHourMinute(newEnd);
  const newDurMin = Math.max(
    0,
    Math.round((newEnd.getTime() - newStart.getTime()) / MIN)
  );
  const oldDurMin = Math.max(
    0,
    Math.round((drag.item.end.getTime() - drag.item.start.getTime()) / MIN)
  );
  const range = `${startLabel} ← ${endLabel}`;
  const dur = formatDurationCompact(newDurMin);
  if (drag.mode === "move") {
    // Scheduling a task out of the panel has no "original" time — just show
    // where it will land (a single time when it has no duration).
    if (drag.item.isUnscheduledDraft) {
      return startLabel === endLabel ? startLabel : `${startLabel}–${endLabel}`;
    }
    // A move keeps the duration, so the total is noise. Surface the shift
    // itself: original range ← new range. (Only timed items reach this — the
    // grid drop handlers bail on all-day, which has its own date-range label.)
    const origRange = `${formatHourMinute(drag.item.start)}–${formatHourMinute(
      drag.item.end
    )}`;
    const newRange = `${startLabel}–${endLabel}`;
    return `${origRange} ← ${newRange}`;
  }
  // Resize — surface the delta. Positive = extended, negative = trimmed.
  const deltaMin = newDurMin - oldDurMin;
  if (deltaMin === 0) return `${range} · ${dur}`;
  const sign = deltaMin > 0 ? "+" : "−";
  return `${range} · ${dur} (${sign}${formatDurationCompact(Math.abs(deltaMin))})`;
}

/**
 * Compact hour:minute label, always 2-digit on both sides. We can't reuse
 * calendar-utils' formatHour here because that one switches to "10 בבוקר"
 * style for round hours, which is too verbose for a drag tooltip.
 */
function formatHourMinute(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function formatDurationCompact(min: number): string {
  if (min < 60) return `${min} דק׳`;
  const hours = Math.floor(min / 60);
  const rem = min % 60;
  if (rem === 0) return hours === 1 ? "שעה" : hours === 2 ? "שעתיים" : `${hours} שעות`;
  // 1:30, 2:15 etc — compact for non-round durations.
  return `${hours}:${String(rem).padStart(2, "0")} ש׳`;
}

const hoverListeners = new Set<(info: HoverInfo | null) => void>();

export function subscribeHover(fn: (info: HoverInfo | null) => void): () => void {
  hoverListeners.add(fn);
  return () => {
    hoverListeners.delete(fn);
  };
}

export function emitHover(info: HoverInfo | null): void {
  hoverListeners.forEach((l) => l(info));
}

// ----------------------------------------------------------------------------
// Touch / pen MOVE support.
//
// The calendar's primary drag is HTML5-native, which only works with a mouse.
// For touch and pen we run a manual pointer-drag that reuses the same drag
// state (beginDrag/endDrag) and the page's onItemDrop. The target time is
// resolved from whichever timed day-column sits under the pointer — every
// such column is tagged `data-cal-daycol` and carries `data-window-start`
// (ms of the column's first visible hour) + `data-hour-height` (px per hour),
// which is all we need to convert a viewport Y back into a snapped time.
//
// Resize is intentionally NOT offered on touch — move only (per product
// decision); resizing stays mouse-only via the native band/edge handles.
// ----------------------------------------------------------------------------

/** Movement (px) before a press is treated as a drag rather than a tap. */
const POINTER_MOVE_THRESHOLD = 6;

export interface PointerMoveOptions {
  onItemDrop: ItemDropHandler;
  /** Fired once the press is recognised as a drag, so the host can suppress
   *  the click that would otherwise open the edit dialog on release. */
  onDragRecognised?: () => void;
  /** Long-press (touch/pen) without movement → open the context menu at the
   *  press point. Lets mobile users reach the right-click actions menu. */
  onLongPress?: (x: number, y: number) => void;
}

/** Long-press duration (ms) before a still press opens the context menu. */
const LONG_PRESS_MS = 450;

function dayColDateAtPoint(
  clientX: number,
  clientY: number,
  grabOffsetMin: number
): Date | null {
  if (typeof document === "undefined") return null;
  const col = document
    .elementFromPoint(clientX, clientY)
    ?.closest<HTMLElement>("[data-cal-daycol]");
  if (!col) return null;
  const windowStart = Number(col.dataset.windowStart);
  const hourHeight = Number(col.dataset.hourHeight);
  if (!Number.isFinite(windowStart) || !Number.isFinite(hourHeight) || hourHeight <= 0)
    return null;
  const rect = col.getBoundingClientRect();
  const y = clientY - rect.top;
  const minutesFromWindowStart = (y / hourHeight) * 60 - grabOffsetMin;
  const snapped = Math.round(minutesFromWindowStart / 15) * 15;
  return new Date(windowStart + snapped * MIN);
}

/** All-day move: resolve the day-cell ([data-cal-alldaycol]) under the
 *  pointer and return that day at midnight (whole-day semantics). */
function allDayDateAtPoint(clientX: number, clientY: number): Date | null {
  if (typeof document === "undefined") return null;
  const cell = document
    .elementFromPoint(clientX, clientY)
    ?.closest<HTMLElement>("[data-cal-alldaycol]");
  if (!cell) return null;
  const dayStart = Number(cell.dataset.dayStart);
  if (!Number.isFinite(dayStart)) return null;
  const d = new Date(dayStart);
  d.setHours(0, 0, 0, 0);
  return d;
}

function moveHoverLabel(item: CalendarItem, date: Date): string {
  const dur = item.end.getTime() - item.start.getTime();
  if (item.allDay) {
    // End is stored exclusive → inclusive last day is one earlier.
    const inclusiveEnd = new Date(date.getTime() + dur);
    inclusiveEnd.setDate(inclusiveEnd.getDate() - 1);
    const f = (d: Date) =>
      d.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" });
    return f(date) === f(inclusiveEnd) ? f(date) : `${f(date)} עד ${f(inclusiveEnd)}`;
  }
  return formatDragHoverLabel({ item, mode: "move" }, date, new Date(date.getTime() + dur));
}

/**
 * Begin a touch/pen move gesture on a calendar item. No-op for mouse (native
 * DnD owns that) and non-draggable items. Timed items resolve to a snapped
 * time in the day-column under the pointer; all-day items resolve to the day
 * under the pointer. Call from the item's onPointerDown.
 */
export function startPointerMove(
  item: CalendarItem,
  e: ReactPointerEvent,
  grabOffsetMin: number,
  opts: PointerMoveOptions
): void {
  if (e.pointerType === "mouse") return;
  if (!isItemDraggable(item)) return;
  if (typeof window === "undefined") return;

  const resolve = (x: number, y: number): Date | null =>
    item.allDay ? allDayDateAtPoint(x, y) : dayColDateAtPoint(x, y, grabOffsetMin);

  const pointerId = e.pointerId;
  const startX = e.clientX;
  const startY = e.clientY;
  const target = e.currentTarget as HTMLElement;
  let active = false;
  let longPressed = false;
  let lastDate: Date | null = null;
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;

  const clearLongPress = () => {
    if (longPressTimer != null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const cleanup = () => {
    clearLongPress();
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onCancel);
    try {
      target.releasePointerCapture(pointerId);
    } catch {
      /* noop */
    }
  };

  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    if (longPressed) return;
    if (!active) {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < POINTER_MOVE_THRESHOLD)
        return;
      // Moved past the threshold → it's a drag, not a long-press.
      clearLongPress();
      active = true;
      beginDrag(item, grabOffsetMin, "move");
      opts.onDragRecognised?.();
    }
    ev.preventDefault();
    const date = resolve(ev.clientX, ev.clientY);
    if (date) {
      lastDate = date;
      emitHover({ x: ev.clientX, y: ev.clientY, label: moveHoverLabel(item, date) });
    }
  };

  const onUp = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    cleanup();
    if (active) {
      if (lastDate) opts.onItemDrop(item, { kind: "move", date: lastDate });
      endDrag();
    }
  };

  const onCancel = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    cleanup();
    if (active) endDrag();
  };

  // Long-press → context menu. A still finger for LONG_PRESS_MS (no drag yet)
  // opens the actions menu at the press point. We flag onDragRecognised so the
  // release click is swallowed (no edit dialog after the menu opens).
  if (opts.onLongPress) {
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      if (active) return;
      longPressed = true;
      opts.onDragRecognised?.();
      opts.onLongPress?.(startX, startY);
      cleanup();
    }, LONG_PRESS_MS);
  }

  try {
    target.setPointerCapture(pointerId);
  } catch {
    /* noop */
  }
  window.addEventListener("pointermove", onMove, { passive: false });
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onCancel);
}
