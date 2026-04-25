import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useCreateThoughtList,
  useUpdateThoughtList,
  useArchiveThoughtList,
} from "@/lib/hooks";
import type { ThoughtList } from "@/lib/types/domain";
import { LIST_ICON_PRESETS, ListIcon } from "@/components/tasks/list-icons";

/**
 * Color palette tuned to feel a notch *cooler / more muted* than the task-list
 * palette, so a thoughts column doesn't visually mimic a tasks column even
 * when the user picks vivid hues. Same hex shapes; rearranged set.
 */
const THOUGHT_COLOR_PRESETS = [
  // Cool greys & inks (the "default neutral" feel)
  "#1f2937", "#374151", "#4b5563", "#6b7280", "#94a3b8", "#a8a8bc",
  // Cool blues / teals
  "#0ea5e9", "#0891b2", "#06b6d4", "#14b8a6", "#10b981", "#22c55e",
  // Soft warms
  "#84cc16", "#eab308", "#f59e0b", "#f97316", "#ef4444", "#ec4899",
  // Purples
  "#8b5cf6", "#6366f1", "#3b82f6", "#a855f7", "#c026d3", "#db2777",
];

interface ThoughtListEditDialogProps {
  open: boolean;
  /** When non-null = edit mode. When null = create mode. */
  list: ThoughtList | null;
  onClose: () => void;
}

/**
 * Modal for creating or editing a thought list. Mirrors the task-list
 * affordances (name + color + icon + archive) but uses a cooler palette
 * and a *monochrome* icon preview, so a thoughts column reads as a
 * different surface than a tasks column at a glance.
 */
export function ThoughtListEditDialog({
  open,
  list,
  onClose,
}: ThoughtListEditDialogProps) {
  const isEdit = !!list;
  const createList = useCreateThoughtList();
  const updateList = useUpdateThoughtList();
  const archiveList = useArchiveThoughtList();

  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(THOUGHT_COLOR_PRESETS[0]);
  const [emoji, setEmoji] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(list?.name ?? "");
    setColor(list?.color ?? THOUGHT_COLOR_PRESETS[0]);
    setEmoji(list?.emoji ?? null);
    setConfirmArchive(false);
  }, [open, list?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSave = name.trim().length > 0;

  const handleSave = async () => {
    if (!canSave) return;
    if (isEdit && list) {
      await updateList.mutateAsync({
        listId: list.id,
        patch: { name: name.trim(), color, emoji },
      });
    } else {
      await createList.mutateAsync({
        name: name.trim(),
        color,
        emoji: emoji ?? undefined,
      });
    }
    onClose();
  };

  const handleArchive = async () => {
    if (!list) return;
    await archiveList.mutateAsync(list.id);
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
            className="bg-white rounded-3xl shadow-lift w-full max-w-md overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-ink-900">
                {isEdit ? "עריכת רשימה" : "רשימת מחשבות חדשה"}
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
              {/* Preview chip */}
              <div className="flex items-center gap-2 p-2 rounded-md bg-ink-50/60 border border-ink-200">
                <span
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: color }}
                />
                {emoji ? (
                  <ListIcon emoji={emoji} className="w-4 h-4 text-ink-900" />
                ) : null}
                <span className="text-sm font-semibold text-ink-900 truncate">
                  {name.trim() || "תצוגה מקדימה"}
                </span>
              </div>

              {/* Name */}
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
                  placeholder="למשל: רעיונות לעבודה"
                />
              </label>

              {/* Color */}
              <div>
                <div className="eyebrow mb-1">צבע</div>
                <div className="grid grid-cols-6 gap-1.5">
                  {THOUGHT_COLOR_PRESETS.map((c) => (
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

              {/* Icon — monochrome line icons (the "פשוט שחור ויפה" brief). */}
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
                        <PresetIcon
                          className="w-4 h-4"
                          strokeWidth={1.6}
                          color="#1f2937"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-ink-200 flex items-center gap-2">
              {isEdit && (
                <button
                  onClick={() => setConfirmArchive(true)}
                  className="btn-ghost text-danger-600 text-sm"
                  type="button"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  ארכב רשימה
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
                    לארכב את הרשימה?
                  </p>
                  <p className="text-xs text-ink-500">
                    המחשבות עצמן לא נמחקות, רק מתבטל השיוך לרשימה הזו.
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
