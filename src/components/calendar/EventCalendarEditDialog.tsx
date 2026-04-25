import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Trash2, Link2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useCreateEventCalendar,
  useUpdateEventCalendar,
  useArchiveEventCalendar,
  useLinkCalendarToList,
  useTaskLists,
} from "@/lib/hooks";
import type { EventCalendar } from "@/lib/types/domain";
import { LIST_ICON_PRESETS, ListIcon } from "@/components/tasks/list-icons";

const COLOR_PRESETS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", "#dc2626", "#b45309",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0891b2",
  "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#c026d3",
  "#ec4899", "#f43f5e", "#db2777", "#64748b", "#6b7280", "#374151",
];

interface EventCalendarEditDialogProps {
  open: boolean;
  /** Non-null = edit mode. Null = create mode. */
  calendar: EventCalendar | null;
  onClose: () => void;
}

/**
 * Modal for creating or editing an event calendar (the per-event grouping
 * that carries a color). Mirrors the task / thought list editors but adds
 * a "linked task list" picker so the user can twin a calendar with a list
 * for shared color (per user-spec #6).
 */
export function EventCalendarEditDialog({
  open,
  calendar,
  onClose,
}: EventCalendarEditDialogProps) {
  const isEdit = !!calendar;
  const create = useCreateEventCalendar();
  const update = useUpdateEventCalendar();
  const archive = useArchiveEventCalendar();
  const linkToList = useLinkCalendarToList();
  const { data: taskLists = [] } = useTaskLists();

  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(COLOR_PRESETS[0]);
  const [emoji, setEmoji] = useState<string | null>(null);
  const [linkedTaskListId, setLinkedTaskListId] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(calendar?.name ?? "");
    setColor(calendar?.color ?? COLOR_PRESETS[0]);
    setEmoji(calendar?.emoji ?? null);
    setLinkedTaskListId(calendar?.linked_task_list_id ?? null);
    setConfirmArchive(false);
  }, [open, calendar?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSave = name.trim().length > 0;
  const [error, setError] = useState<string | null>(null);

  const friendlyError = (e: unknown): string => {
    const msg =
      typeof e === "object" && e && "message" in e
        ? String((e as { message: unknown }).message)
        : String(e);
    if (
      msg.includes("event_calendars") ||
      msg.includes("does not exist") ||
      msg.includes("relation")
    ) {
      return "טבלת יומני האירועים עוד לא נוצרה ב-DB. הריצי את המיגרציה supabase/migrations/20260425000002_event_calendars.sql דרך SQL Editor.";
    }
    return msg;
  };

  const handleSave = async () => {
    if (!canSave) return;
    setError(null);
    try {
      let calendarId = calendar?.id;
      if (isEdit && calendar) {
        await update.mutateAsync({
          calendarId: calendar.id,
          patch: { name: name.trim(), color, emoji },
        });
      } else {
        const created = await create.mutateAsync({
          name: name.trim(),
          color,
          emoji: emoji ?? undefined,
        });
        calendarId = created.id;
      }
      if (calendarId) {
        // Apply / clear the link if it changed.
        const previousLink = calendar?.linked_task_list_id ?? null;
        if (previousLink !== linkedTaskListId) {
          await linkToList.mutateAsync({
            calendarId,
            taskListId: linkedTaskListId,
          });
        }
      }
      onClose();
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  const handleArchive = async () => {
    if (!calendar) return;
    await archive.mutateAsync(calendar.id);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-lift w-full max-w-md overflow-hidden relative"
          >
            <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink-900">
                {isEdit ? "עריכת יומן אירועים" : "יומן אירועים חדש"}
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-ink-100"
                type="button"
              >
                <X className="w-4 h-4 text-ink-600" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2 p-2 rounded-md bg-ink-50/60 border border-ink-200">
                <span
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: color }}
                />
                {emoji && <ListIcon emoji={emoji} className="w-4 h-4" />}
                <span className="text-sm font-semibold text-ink-900 truncate">
                  {name.trim() || "תצוגה מקדימה"}
                </span>
              </div>

              <label className="block">
                <span className="eyebrow mb-1 block">שם</span>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canSave) handleSave();
                  }}
                  className="field text-sm"
                  placeholder="למשל: עבודה / משפחה / פגישות"
                />
              </label>

              <div>
                <div className="eyebrow mb-1">צבע</div>
                <div className="grid grid-cols-6 gap-1.5">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="w-8 h-8 rounded-full border border-ink-200 hover:scale-110 transition-transform flex items-center justify-center"
                      style={{ backgroundColor: c }}
                      title={c}
                    >
                      {color === c && (
                        <Check
                          className="w-3.5 h-3.5 text-white"
                          strokeWidth={3}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="eyebrow mb-1">אייקון</div>
                <div className="grid grid-cols-7 gap-1">
                  <button
                    type="button"
                    onClick={() => setEmoji(null)}
                    className={cn(
                      "w-9 h-9 rounded-md flex items-center justify-center text-[11px] text-ink-500 hover:bg-ink-100",
                      emoji === null && "bg-ink-100 ring-1 ring-ink-300"
                    )}
                    title="ללא אייקון"
                  >
                    —
                  </button>
                  {LIST_ICON_PRESETS.map((preset) => {
                    const PresetIcon = preset.icon;
                    const stored = `icon:${preset.key}`;
                    const selected = emoji === stored;
                    return (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => setEmoji(stored)}
                        title={preset.label}
                        className={cn(
                          "w-9 h-9 rounded-md flex items-center justify-center text-ink-900 hover:bg-ink-100",
                          selected && "bg-ink-100 ring-1 ring-ink-300"
                        )}
                      >
                        <PresetIcon className="w-4 h-4" strokeWidth={1.6} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="eyebrow mb-1 flex items-center gap-1">
                  <Link2 className="w-3 h-3" />
                  קישור לרשימת משימות
                </div>
                <p className="text-[11px] text-ink-500 mb-1">
                  בחירה כאן תקשר ביניהם — צבע אחיד, ובהמשך נוכל להוסיף
                  שיתופי פעולה נוספים.
                </p>
                <select
                  value={linkedTaskListId ?? ""}
                  onChange={(e) =>
                    setLinkedTaskListId(e.target.value || null)
                  }
                  className="field text-sm"
                >
                  <option value="">ללא קישור</option>
                  {taskLists.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="p-2 rounded-md bg-warning-500/10 border border-warning-500/30 text-warning-700 text-[11px] leading-relaxed">
                  {error}
                </div>
              )}
            </div>

            <div className="px-5 py-3 border-t border-ink-200 flex items-center gap-2">
              {isEdit && (
                <button
                  onClick={() => setConfirmArchive(true)}
                  className="btn-ghost text-danger-600 text-sm"
                  type="button"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  ארכב יומן
                </button>
              )}
              <button
                onClick={onClose}
                className="btn-ghost text-sm ms-auto"
                type="button"
              >
                ביטול
              </button>
              <button
                onClick={handleSave}
                disabled={!canSave}
                className={cn(
                  "btn-primary text-sm",
                  !canSave && "opacity-40 cursor-not-allowed"
                )}
                type="button"
              >
                {isEdit ? "שמור" : "צור"}
              </button>
            </div>

            {confirmArchive && (
              <div
                className="absolute inset-0 bg-white/95 flex items-center justify-center p-6 rounded-3xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center space-y-3 max-w-xs">
                  <p className="text-sm text-ink-900 font-medium">
                    לארכב את היומן?
                  </p>
                  <p className="text-xs text-ink-500">
                    האירועים עצמם נשארים. רק היומן עצמו עובר לארכיון.
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => setConfirmArchive(false)}
                      className="btn-ghost text-sm"
                      type="button"
                    >
                      ביטול
                    </button>
                    <button
                      onClick={handleArchive}
                      className="btn-primary text-sm bg-danger-600 hover:bg-danger-700"
                      type="button"
                    >
                      ארכב
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
