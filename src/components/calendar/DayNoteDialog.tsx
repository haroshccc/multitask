import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Trash2, Save, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useUpsertDayNote,
  useDeleteDayNote,
} from "@/lib/hooks/useCalendarDayNotes";
import { dateKey } from "@/lib/services/calendar-day-notes";

interface DayNoteDialogProps {
  /** Date the user clicked. Modal closed when null. */
  date: Date | null;
  /** Existing body for that date (or "" if none yet). */
  initialBody: string;
  /** Existing text color for that date (or null if none). */
  initialColor?: string | null;
  onClose: () => void;
}

const NOTE_COLOR_PRESETS = [
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

/**
 * Compact editor for the per-day note. Opens when the user clicks the
 * date digit in any calendar view. Save persists; Delete clears the note;
 * Esc / backdrop / Cancel closes without changes.
 */
export function DayNoteDialog({
  date,
  initialBody,
  initialColor = null,
  onClose,
}: DayNoteDialogProps) {
  const [body, setBody] = useState(initialBody);
  const [color, setColor] = useState<string | null>(initialColor);
  const [error, setError] = useState<string | null>(null);
  const upsert = useUpsertDayNote();
  const del = useDeleteDayNote();

  useEffect(() => {
    if (date) {
      setBody(initialBody);
      setColor(initialColor);
      setError(null);
    }
  }, [date, initialBody, initialColor]);

  if (!date) return null;
  const dateStr = date.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const dirty =
    body.trim() !== initialBody.trim() || color !== initialColor;

  /**
   * Save / delete catch the error and surface it inline instead of
   * letting the rejected mutation bubble silently. The most likely cause
   * is the migration not being applied yet — show the user what's wrong
   * instead of leaving the dialog open with no feedback.
   */
  const friendlyError = (e: unknown): string => {
    const msg =
      typeof e === "object" && e && "message" in e
        ? String((e as { message: unknown }).message)
        : String(e);
    if (
      msg.includes("calendar_day_notes") ||
      msg.includes("does not exist") ||
      msg.includes("relation")
    ) {
      return "טבלת הערות יומיות עוד לא נוצרה ב-DB. הריצי את המיגרציה supabase/migrations/20260425000001_calendar_day_notes.sql";
    }
    return `השמירה נכשלה: ${msg}`;
  };

  const handleSave = async () => {
    setError(null);
    try {
      await upsert.mutateAsync({
        date: dateKey(date),
        body,
        text_color: body.trim() ? color : null,
      });
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    }
  };
  const handleDelete = async () => {
    setError(null);
    try {
      await del.mutateAsync(dateKey(date));
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  return (
    <AnimatePresence>
      {!!date && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[55] bg-ink-900/40 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-lift max-w-md w-full overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-ink-500">הערה ליום</div>
                <div className="text-sm font-semibold text-ink-900">
                  {dateStr}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-ink-100"
                type="button"
              >
                <X className="w-4 h-4 text-ink-600" />
              </button>
            </div>

            <div className="p-5">
              <textarea
                autoFocus
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") onClose();
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSave();
                  }
                }}
                rows={3}
                placeholder="הקלד הערה קצרה ליום זה..."
                className="field text-sm resize-y w-full min-h-[80px]"
              />
              <p className="text-[11px] text-ink-400 mt-1">
                Ctrl/⌘+Enter לשמירה. השאר ריק כדי למחוק את ההערה.
              </p>

              <div className="mt-3 flex items-center gap-2">
                <span className="text-[11px] text-ink-500">צבע הכיתוב:</span>
                <div className="flex items-center gap-1 flex-wrap">
                  {NOTE_COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={cn(
                        "w-5 h-5 rounded-full border transition-transform hover:scale-110",
                        color === c
                          ? "border-ink-900 ring-2 ring-offset-1 ring-ink-300"
                          : "border-ink-200"
                      )}
                      style={{ backgroundColor: c }}
                      title={c}
                      aria-label={`צבע ${c}`}
                    />
                  ))}
                  <label
                    className="w-5 h-5 rounded-full border border-ink-200 overflow-hidden cursor-pointer relative"
                    title="צבע מותאם אישית"
                    style={color ? { backgroundColor: color } : undefined}
                  >
                    {!color && (
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] text-ink-400">
                        +
                      </span>
                    )}
                    <input
                      type="color"
                      value={color ?? "#6b6b80"}
                      onChange={(e) => setColor(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </label>
                  {color && (
                    <button
                      type="button"
                      onClick={() => setColor(null)}
                      className="text-[11px] text-ink-400 hover:text-ink-700 px-0.5"
                      title="ברירת מחדל"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
              {error && (
                <div className="mt-2 flex items-start gap-2 p-2 rounded-md bg-warning-500/10 border border-warning-500/30 text-warning-700 text-[11px]">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-ink-200 flex items-center gap-2">
              {initialBody.trim().length > 0 && (
                <button
                  onClick={handleDelete}
                  disabled={del.isPending}
                  className="btn-ghost text-danger-600 text-sm"
                  type="button"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  מחק הערה
                </button>
              )}
              <div className="ms-auto flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="btn-ghost text-sm"
                  type="button"
                >
                  ביטול
                </button>
                <button
                  onClick={handleSave}
                  disabled={!dirty || upsert.isPending}
                  className={cn(
                    "btn-primary text-sm",
                    (!dirty || upsert.isPending) &&
                      "opacity-40 cursor-not-allowed"
                  )}
                  type="button"
                >
                  <Save className="w-3.5 h-3.5" />
                  {upsert.isPending ? "שומר..." : "שמור"}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
