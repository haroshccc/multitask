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
 */
import type { CalendarItem } from "./calendar-utils";
import { MIN } from "./calendar-utils";

interface DragState {
  item: CalendarItem;
  /**
   * Minutes between the item's start and where the user grabbed it. Lets
   * us drop "where the cursor is" instead of snapping the block's top-left
   * to the cursor (which feels jumpy).
   */
  grabOffsetMin: number;
}

let current: DragState | null = null;

export function beginDrag(item: CalendarItem, grabOffsetMin: number): void {
  current = { item, grabOffsetMin };
}

export function endDrag(): void {
  current = null;
}

export function getDrag(): DragState | null {
  return current;
}

/**
 * Some calendar items aren't safely draggable in the current iteration:
 *   - All-day items (no minute-granular drop target).
 *   - Multi-day items (would need to re-calculate end across days).
 *   - Recurring instances (dragging one occurrence shouldn't reschedule all).
 *   - Phase tasks (visualized as background bands, conceptually not movable).
 *
 * Returning false here makes the block render without `draggable` — clicks
 * still work, the user just can't drag.
 */
export function isItemDraggable(item: CalendarItem): boolean {
  if (item.allDay) return false;
  if (item.isPhase) return false;
  // Recurring event instances have IDs like "event:abc:1234567890" — extra
  // colon-segments after the entity id mark an expanded occurrence.
  const colons = item.id.split(":").length;
  if (item.kind === "event" && colons > 2) return false;
  return true;
}

/**
 * Compute the duration (minutes) of an item, used to re-derive the
 * end-time when a drop only changes the start.
 */
export function durationMin(item: CalendarItem): number {
  return Math.max(15, Math.round((item.end.getTime() - item.start.getTime()) / MIN));
}
