import { create } from "zustand";

/**
 * Per-task expand/collapse state for the tasks screen, persisted to
 * localStorage so refreshing the page doesn't blow away which subtrees
 * the user had folded shut. Stored as the set of task ids that are
 * currently collapsed; an id NOT in the set is treated as expanded, so
 * fresh tasks default to open (which matches what users expect on a
 * newly-created sibling/subtask).
 */
const STORAGE_KEY = "multitask.collapsedTasks";

function load(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function save(collapsed: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from(collapsed))
    );
  } catch {
    /* quota / disabled storage — best-effort only */
  }
}

interface CollapsedState {
  collapsed: Set<string>;
  toggle: (id: string) => void;
  collapse: (id: string) => void;
  expand: (id: string) => void;
}

export const useCollapsedTasksStore = create<CollapsedState>((set) => ({
  collapsed: load(),
  toggle(id) {
    set((s) => {
      const next = new Set(s.collapsed);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      save(next);
      return { collapsed: next };
    });
  },
  collapse(id) {
    set((s) => {
      if (s.collapsed.has(id)) return s;
      const next = new Set(s.collapsed);
      next.add(id);
      save(next);
      return { collapsed: next };
    });
  },
  expand(id) {
    set((s) => {
      if (!s.collapsed.has(id)) return s;
      const next = new Set(s.collapsed);
      next.delete(id);
      save(next);
      return { collapsed: next };
    });
  },
}));
