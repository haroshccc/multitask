import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface UnsavedChangesGuardProps {
  open: boolean;
  /** "Save and close." Closes the dialog after a successful save. */
  onSaveAndClose: () => void | Promise<void>;
  /** "Discard." Drops the dirty draft and closes the parent modal. */
  onDiscardAndClose: () => void;
  /** "Don't close." Returns to editing without saving. */
  onCancel: () => void;
  /** Disables "Save and close" while a save is in flight. */
  saving?: boolean;
}

/**
 * Confirmation dialog shown when the user tries to close an editing modal
 * with unsaved changes. Three explicit choices match the spec:
 *
 *   1. שמור וסגור — saves the draft and closes.
 *   2. סגור בלי לשמור — drops the draft and closes.
 *   3. אל תסגור — returns to the editor.
 *
 * Wraps in a portal-free modal at z-index above the parent so it sits over
 * the editor it belongs to.
 */
export function UnsavedChangesGuard({
  open,
  onSaveAndClose,
  onDiscardAndClose,
  onCancel,
  saving,
}: UnsavedChangesGuardProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-ink-900/40 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="bg-white rounded-2xl shadow-lift max-w-sm w-full p-5"
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-9 h-9 rounded-full bg-warning-500/15 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-warning-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-ink-900 mb-1">
                  יש לך שינויים שלא נשמרו
                </h3>
                <p className="text-xs text-ink-500">
                  מה לעשות לפני הסגירה?
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 mt-4">
              <button
                onClick={onSaveAndClose}
                disabled={saving}
                className={cn(
                  "btn-primary text-sm w-full",
                  saving && "opacity-60 cursor-not-allowed"
                )}
                type="button"
              >
                {saving ? "שומר..." : "שמור וסגור"}
              </button>
              <button
                onClick={onDiscardAndClose}
                className="btn-ghost text-sm text-danger-600 hover:bg-danger-50 w-full"
                type="button"
              >
                סגור בלי לשמור
              </button>
              <button
                onClick={onCancel}
                className="btn-ghost text-sm w-full"
                type="button"
              >
                אל תסגור
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
