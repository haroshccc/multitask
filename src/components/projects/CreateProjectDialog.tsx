import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FolderPlus } from "lucide-react";
import { useCreateProject, useArchiveProject } from "@/lib/hooks/useProjects";
import { pushUndo } from "@/lib/undo/store";
import { LIST_ICON_PRESETS, ListIcon } from "@/components/tasks/list-icons";
import { cn } from "@/lib/utils/cn";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (projectId: string) => void;
}

const COLOR_PALETTE = [
  "#f59e0b", "#f97316", "#ef4444", "#ec4899",
  "#8b5cf6", "#6366f1", "#3b82f6", "#0ea5e9",
  "#06b6d4", "#14b8a6", "#10b981", "#22c55e",
  "#84cc16", "#eab308", "#a8a8bc", "#1f2937",
];

export function CreateProjectDialog({ open, onClose, onCreated }: Props) {
  const create = useCreateProject();
  const archive = useArchiveProject();
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState<string>(COLOR_PALETTE[0]);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setEmoji("");
    setColor(COLOR_PALETTE[0]);
    setIconPickerOpen(false);
  }, [open]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const payload = {
      name: trimmed,
      pricing_mode: "hourly" as const,
      emoji: emoji.trim() || null,
      color,
      vat_percentage: 18,
      currency: "ILS",
      profit_percentage: 20,
      spare_mode: "percent" as const,
      spare_value: 10,
    };
    const project = await create.mutateAsync(payload);
    let currentId = project.id;
    pushUndo({
      description: `יצירת פרויקט: ${trimmed}`,
      undo: () => archive.mutate(currentId),
      redo: async () => {
        const again = await create.mutateAsync(payload);
        currentId = again.id;
      },
    });
    onCreated?.(project.id);
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
          className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto"
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-lift w-full max-w-lg my-8 overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <FolderPlus className="w-4 h-4 text-primary-600" />
                <h3 className="text-sm font-semibold text-ink-900">פרויקט חדש</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-md hover:bg-ink-100"
                aria-label="סגור"
              >
                <X className="w-4 h-4 text-ink-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="eyebrow mb-1.5 block">שם הפרויקט</label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && name.trim()) submit();
                    if (e.key === "Escape") onClose();
                  }}
                  placeholder="למשל: שיפוץ דירת שלי"
                  className="field"
                />
              </div>

              <div>
                <label className="eyebrow mb-1.5 block">צבע</label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={
                        "w-7 h-7 rounded-full border-2 transition-transform " +
                        (color === c
                          ? "border-ink-900 scale-110"
                          : "border-white hover:scale-105")
                      }
                      style={{ backgroundColor: c }}
                      aria-label={`צבע ${c}`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="eyebrow mb-1.5 block">אייקון</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIconPickerOpen((v) => !v)}
                    className="flex items-center gap-2 rounded-lg border border-ink-300 px-3 py-2 text-sm hover:border-ink-400"
                  >
                    {emoji ? (
                      <ListIcon emoji={emoji} className="w-4 h-4" />
                    ) : (
                      <span className="text-ink-400">בחר אייקון...</span>
                    )}
                  </button>
                  {iconPickerOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setIconPickerOpen(false)} />
                      <div className="absolute start-0 top-full mt-1 z-20 bg-white border border-ink-200 rounded-xl shadow-lift p-2 w-64">
                        <div className="grid grid-cols-7 gap-1 max-h-48 overflow-y-auto">
                          {LIST_ICON_PRESETS.map((preset) => {
                            const PresetIcon = preset.icon;
                            const stored = `icon:${preset.key}`;
                            const selected = emoji === stored;
                            return (
                              <button
                                key={preset.key}
                                type="button"
                                onClick={() => { setEmoji(stored); setIconPickerOpen(false); }}
                                title={preset.label}
                                className={cn(
                                  "w-8 h-8 rounded-md flex items-center justify-center text-ink-900 hover:bg-ink-100",
                                  selected && "bg-ink-100 ring-1 ring-ink-300"
                                )}
                              >
                                <PresetIcon className="w-4 h-4" strokeWidth={1.75} />
                              </button>
                            );
                          })}
                        </div>
                        <div className="mt-1 pt-1 border-t border-ink-100 flex items-center gap-2">
                          <input
                            value={emoji.startsWith("icon:") ? "" : emoji}
                            onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
                            placeholder="אימוג'י מותאם..."
                            className="field text-sm flex-1"
                            maxLength={4}
                          />
                          {emoji && (
                            <button
                              type="button"
                              onClick={() => setEmoji("")}
                              className="text-xs text-ink-400 hover:text-danger-500"
                            >
                              הסר
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-ink-50 border-t border-ink-200 flex items-center justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-ghost text-sm">
                ביטול
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!name.trim() || create.isPending}
                className="btn-accent text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {create.isPending ? "יוצרת..." : "צרי פרויקט"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
