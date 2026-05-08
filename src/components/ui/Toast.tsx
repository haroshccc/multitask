import { useEffect } from "react";
import { create } from "zustand";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, Undo2, Redo2, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type ToastVariant = "success" | "error" | "info" | "undo" | "redo";

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
  durationMs?: number;
}

interface ToastState {
  toasts: ToastItem[];
  add: (item: Omit<ToastItem, "id">) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add(item) {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts.slice(-4), { ...item, id }] }));
    const ms = item.durationMs ?? 2500;
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, ms);
  },
  remove(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

export function toast(message: string, variant: ToastVariant = "info", durationMs?: number) {
  useToastStore.getState().add({ message, variant, durationMs });
}

const ICONS: Record<ToastVariant, typeof Info> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  undo: Undo2,
  redo: Redo2,
};

const STYLES: Record<ToastVariant, string> = {
  success: "bg-success-50 border-success-200 text-success-800",
  error:   "bg-rose-50 border-rose-200 text-rose-800",
  info:    "bg-ink-50 border-ink-200 text-ink-800",
  undo:    "bg-primary-50 border-primary-200 text-primary-800",
  redo:    "bg-indigo-50 border-indigo-200 text-indigo-800",
};

export function ToastRegion() {
  const { toasts, remove } = useToastStore();
  return (
    <div
      dir="rtl"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-6 end-4 z-[200] flex flex-col gap-2 pointer-events-none"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => {
          const Icon = ICONS[t.variant];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.18 }}
              className={cn(
                "pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-xl border shadow-lift text-sm min-w-[160px] max-w-xs",
                STYLES[t.variant]
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 min-w-0">{t.message}</span>
              <button
                type="button"
                onClick={() => remove(t.id)}
                className="shrink-0 opacity-50 hover:opacity-100"
                aria-label="סגור"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/** Auto-dismiss toast with a countdown bar — for "nothing to undo" style messages */
export function useAutoToast(_open: boolean) {
  // reserved for future use
  useEffect(() => {}, [_open]);
}
