import { create } from "zustand";

/**
 * Multi-task selection state for the tasks screen. Lives in a Zustand store so
 * the row component, the bulk-actions toolbar, and the keyboard handlers all
 * share one source of truth without prop-drilling. The flat ordered list of
 * task ids visible on the screen is also kept here so Shift+click range-select
 * can resolve which rows lie between the anchor and the click.
 */
interface SelectionState {
  selected: Set<string>;
  /** Last id the user clicked — anchor for Shift+click range select. */
  anchorId: string | null;
  /** Flat ordered list of currently-visible task ids (top to bottom across
   *  all lists). Tasks.tsx publishes this on every render. */
  orderedIds: string[];

  toggle: (id: string) => void;
  /** Toggle a parent + all of its descendants together. If the parent is
   *  currently selected, the whole subtree gets deselected; otherwise it
   *  all becomes selected. The parent's id is recorded as the anchor. */
  toggleSubtree: (rootId: string, descendantIds: string[]) => void;
  selectOnly: (id: string) => void;
  /** Range-select between the anchor and `id`, inclusive. If no anchor, falls
   *  back to selectOnly. Adds to the existing selection (does not clear). */
  shiftSelect: (id: string) => void;
  clear: () => void;
  setOrderedIds: (ids: string[]) => void;
}

export const useTaskSelectionStore = create<SelectionState>((set, get) => ({
  selected: new Set<string>(),
  anchorId: null,
  orderedIds: [],

  toggle(id) {
    set((s) => {
      const next = new Set(s.selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selected: next, anchorId: id };
    });
  },

  toggleSubtree(rootId, descendantIds) {
    set((s) => {
      const next = new Set(s.selected);
      // Decide direction based on the root: if root is currently selected,
      // we deselect the whole subtree; otherwise we select it all. This
      // matches the "click checkbox = the whole branch follows" model the
      // user described and lets a second click undo the cascade.
      const turnOff = next.has(rootId);
      const allIds = [rootId, ...descendantIds];
      if (turnOff) {
        for (const id of allIds) next.delete(id);
      } else {
        for (const id of allIds) next.add(id);
      }
      return { selected: next, anchorId: rootId };
    });
  },

  selectOnly(id) {
    set({ selected: new Set([id]), anchorId: id });
  },

  shiftSelect(id) {
    const { anchorId, orderedIds, selected } = get();
    if (!anchorId) {
      set({ selected: new Set([id]), anchorId: id });
      return;
    }
    const a = orderedIds.indexOf(anchorId);
    const b = orderedIds.indexOf(id);
    if (a === -1 || b === -1) {
      // Anchor or target not in current view — fall back to single-toggle.
      const next = new Set(selected);
      next.add(id);
      set({ selected: next, anchorId: id });
      return;
    }
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const next = new Set(selected);
    for (let i = lo; i <= hi; i++) next.add(orderedIds[i]!);
    set({ selected: next });
    // Anchor stays put so successive Shift+clicks expand from the same origin.
  },

  clear() {
    set({ selected: new Set<string>(), anchorId: null });
  },

  setOrderedIds(ids) {
    set({ orderedIds: ids });
  },
}));

/** Returns whether the row is currently selected, subscribed only to that
 *  particular id so unrelated selection changes don't re-render every row. */
export function useIsTaskSelected(id: string): boolean {
  return useTaskSelectionStore((s) => s.selected.has(id));
}

/** Lightweight "is anything selected" hook for bulk-actions toolbar gating. */
export function useSelectionCount(): number {
  return useTaskSelectionStore((s) => s.selected.size);
}
