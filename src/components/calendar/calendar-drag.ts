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

export function beginDrag(
  item: CalendarItem,
  grabOffsetMin: number,
  mode: DragMode = "move"
): void {
  current = { item, mode, grabOffsetMin };
}

export function endDrag(): void {
  current = null;
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
