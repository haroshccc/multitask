import { motion, AnimatePresence } from "framer-motion";
import { X, Keyboard } from "lucide-react";

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

const GROUPS: ShortcutGroup[] = [
  {
    title: "גלובלי",
    shortcuts: [
      { keys: ["Ctrl", "K"], description: "חיפוש מהיר" },
      { keys: ["Ctrl", "N"], description: "יצירה חדשה (לפי מסך)" },
      { keys: ["Ctrl", "Z"], description: "בטל פעולה אחרונה" },
      { keys: ["Ctrl", "Y"], description: "בצע מחדש" },
      { keys: ["Ctrl", "Shift", "Z"], description: "בצע מחדש (Mac)" },
      { keys: ["Ctrl", "."], description: "פתח / סגור תפריט צד" },
      { keys: ["?"], description: "הצג חלונית קיצורים זו" },
      { keys: ["Escape"], description: "סגור חלון / ביטול" },
    ],
  },
  {
    title: "ניווט מהיר (G →)",
    shortcuts: [
      { keys: ["G", "T"], description: "מסך משימות" },
      { keys: ["G", "G"], description: "מסך יעדים" },
      { keys: ["G", "C"], description: "יומן" },
      { keys: ["G", "R"], description: "הקלטות" },
      { keys: ["G", "H"], description: "מחשבות" },
      { keys: ["G", "P"], description: "פרויקטים" },
      { keys: ["G", "F"], description: "אוכל" },
      { keys: ["G", "D"], description: "דשבורד" },
    ],
  },
  {
    title: "שורת משימה",
    shortcuts: [
      { keys: ["Enter"], description: "משימה חדשה (סיבלינג)" },
      { keys: ["Ctrl", "Enter"], description: "תת-משימה חדשה" },
      { keys: ["Ctrl", "E"], description: "פתח עריכה מלאה" },
      { keys: ["Ctrl", "D"], description: "שכפל משימה" },
      { keys: ["Tab"], description: "הזח פנימה (הפוך לתת-משימה)" },
      { keys: ["Shift", "Tab"], description: "הזח החוצה" },
      { keys: ["Escape"], description: "בטל עריכת כותרת" },
    ],
  },
  {
    title: "חלון עריכת משימה",
    shortcuts: [
      { keys: ["Ctrl", "S"], description: "שמור" },
      { keys: ["Ctrl", "B"], description: "מודגש (בתיאור)" },
      { keys: ["Ctrl", "I"], description: "נטוי (בתיאור)" },
      { keys: ["Ctrl", "U"], description: "קו תחתון (בתיאור)" },
      { keys: ["Escape"], description: "סגור" },
    ],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

function Key({ label }: { label: string }) {
  return (
    <kbd className="inline-flex items-center justify-center px-1.5 py-0.5 rounded border border-ink-300 bg-ink-100 text-ink-700 text-[11px] font-mono font-medium min-w-[22px]">
      {label}
    </kbd>
  );
}

export function KeyboardShortcutsPanel({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] bg-ink-900/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ y: 20, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-lift w-full max-w-2xl max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-ink-200 sticky top-0 bg-white">
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-ink-500" />
                <h2 className="font-semibold text-ink-900 text-sm">קיצורי מקלדת</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-500"
                aria-label="סגור"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
              {GROUPS.map((g) => (
                <section key={g.title}>
                  <h3 className="text-[10px] font-semibold uppercase tracking-wide text-ink-500 mb-2">
                    {g.title}
                  </h3>
                  <div className="space-y-1.5">
                    {g.shortcuts.map((s) => (
                      <div key={s.description} className="flex items-center justify-between gap-3">
                        <span className="text-xs text-ink-700">{s.description}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {s.keys.map((k, i) => (
                            <span key={i} className="flex items-center gap-0.5">
                              {i > 0 && <span className="text-ink-400 text-[10px]">+</span>}
                              <Key label={k} />
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="px-5 py-3 border-t border-ink-200 text-[10px] text-ink-400 text-center">
              לחצי <Key label="?" /> בכל מסך לפתיחת חלונית זו · <Key label="Esc" /> לסגירה
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
