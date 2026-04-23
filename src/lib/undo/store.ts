import { create } from "zustand";

/**
 * One reversible action. `do` and `undo` are run by the global Ctrl+Z / Ctrl+Y
 * handlers; mutations remain optimistic so the user sees the change immediately
 * regardless of server ack.
 */
export interface UndoAction {
  description: string;
  /** Re-apply the change (Ctrl+Y). */
  redo: () => Promise<void> | void;
  /** Reverse the change (Ctrl+Z). */
  undo: () => Promise<void> | void;
}

interface UndoState {
  past: UndoAction[];
  future: UndoAction[];
  push: (a: UndoAction) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  clear: () => void;
}

const MAX_HISTORY = 100;

export const useUndoStore = create<UndoState>((set, get) => ({
  past: [],
  future: [],

  push(action) {
    set((s) => {
      const past = [...s.past, action].slice(-MAX_HISTORY);
      // Pushing a new action discards any pending redo branch.
      return { past, future: [] };
    });
  },

  async undo() {
    const action = get().past.at(-1);
    if (!action) return;
    set((s) => ({
      past: s.past.slice(0, -1),
      future: [...s.future, action],
    }));
    try {
      await action.undo();
    } catch (err) {
      console.error("undo failed:", err);
    }
  },

  async redo() {
    const action = get().future.at(-1);
    if (!action) return;
    set((s) => ({
      future: s.future.slice(0, -1),
      past: [...s.past, action],
    }));
    try {
      await action.redo();
    } catch (err) {
      console.error("redo failed:", err);
    }
  },

  clear() {
    set({ past: [], future: [] });
  },
}));

// Primitive selectors — Zustand v5 expects each selector to return a stable
// reference. Returning an object literal here would trigger
// "getSnapshot should be cached" and re-render loops.
export const useCanUndo = () => useUndoStore((s) => s.past.length > 0);
export const useCanRedo = () => useUndoStore((s) => s.future.length > 0);

/** Convenience for callers that just want `push` without subscribing to state. */
export const pushUndo = (a: UndoAction) => useUndoStore.getState().push(a);
