import { create } from "zustand";

/** Global open/closed state for the assistant panel. The active skill is
 *  chosen by the panel from the current route (see registry), so the store
 *  only needs the visibility toggle. */
interface AssistantUiState {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const useAssistantUi = create<AssistantUiState>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}));
