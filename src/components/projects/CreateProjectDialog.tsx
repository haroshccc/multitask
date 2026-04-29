import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FolderPlus } from "lucide-react";
import { useCreateProject } from "@/lib/hooks/useProjects";
import type { ProjectPricingMode } from "@/lib/types/domain";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (projectId: string) => void;
}

const PRICING_OPTIONS: { value: ProjectPricingMode; label: string; hint: string }[] = [
  {
    value: "hourly",
    label: "תעריף שעתי",
    hint: "תעריף פר שעה + רווח. מציג מחיר מוצע מחושב.",
  },
  {
    value: "fixed_price",
    label: "מחיר סופי",
    hint: "הלקוח נתן מספר. רואים תעריף שעתי אפקטיבי.",
  },
  {
    value: "quote",
    label: "הצעת מחיר",
    hint: "ללא תמחור פעיל — שלב מחקר/תכנון.",
  },
];

const COLOR_PALETTE = [
  "#f59e0b",
  "#ec4899",
  "#8b5cf6",
  "#3b82f6",
  "#10b981",
  "#ef4444",
  "#14b8a6",
  "#a8a8bc",
];

export function CreateProjectDialog({ open, onClose, onCreated }: Props) {
  const create = useCreateProject();
  const [name, setName] = useState("");
  const [pricingMode, setPricingMode] = useState<ProjectPricingMode>("hourly");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState<string>(COLOR_PALETTE[0]);

  useEffect(() => {
    if (!open) return;
    setName("");
    setPricingMode("hourly");
    setEmoji("");
    setColor(COLOR_PALETTE[0]);
  }, [open]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const project = await create.mutateAsync({
      name: trimmed,
      pricing_mode: pricingMode,
      emoji: emoji.trim() || null,
      color,
      vat_percentage: 18,
      currency: "ILS",
      profit_percentage: 20,
      spare_mode: "percent",
      spare_value: 10,
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
                <label className="eyebrow mb-1.5 block">מצב תמחור</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {PRICING_OPTIONS.map((opt) => {
                    const active = pricingMode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setPricingMode(opt.value)}
                        className={
                          "text-start rounded-lg border px-3 py-2 transition-colors " +
                          (active
                            ? "border-primary-500 bg-primary-50"
                            : "border-ink-200 hover:bg-ink-50")
                        }
                      >
                        <div className="text-sm font-semibold text-ink-900">
                          {opt.label}
                        </div>
                        <div className="text-xs text-ink-500 mt-0.5">{opt.hint}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-3">
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
                  <label className="eyebrow mb-1.5 block">אימוג'י</label>
                  <input
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
                    placeholder="📁"
                    className="field text-center w-16"
                    maxLength={4}
                  />
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
