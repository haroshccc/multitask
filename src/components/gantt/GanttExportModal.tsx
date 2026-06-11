import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileDown, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { GanttRow } from "./gantt-utils";
import { downloadGanttExcel, type ExcelGranularity } from "./gantt-excel-export";
import { DateField } from "@/components/ui/DateField";

interface GanttExportModalProps {
  open: boolean;
  onClose: () => void;
  rows: GanttRow[];
  /** Default range — current Gantt window. */
  defaultFrom: Date;
  defaultTo: Date;
  /** For filling the "list name" + assignee columns in the export. */
  listNames?: Map<string, string>;
  memberNames?: Map<string, string>;
  /** Used as filename + sheet name. */
  title?: string;
}

const GRANULARITY_LABELS: Record<ExcelGranularity, string> = {
  day: "יום",
  week: "שבוע",
  month: "חודש",
};

function toIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIsoDate(s: string): Date | null {
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function GanttExportModal({
  open,
  onClose,
  rows,
  defaultFrom,
  defaultTo,
  listNames,
  memberNames,
  title,
}: GanttExportModalProps) {
  const [from, setFrom] = useState<string>(toIsoDate(defaultFrom));
  const [to, setTo] = useState<string>(toIsoDate(defaultTo));
  const [granularity, setGranularity] = useState<ExcelGranularity>("week");
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    const fromDate = parseIsoDate(from);
    const toDate = parseIsoDate(to);
    if (!fromDate || !toDate || fromDate >= toDate) return;
    setExporting(true);
    try {
      downloadGanttExcel({
        rows,
        from: fromDate,
        to: toDate,
        granularity,
        title,
        listNames,
        memberNames,
      });
      onClose();
    } finally {
      setExporting(false);
    }
  };

  const presets: { label: string; days: number }[] = [
    { label: "חודש קדימה", days: 30 },
    { label: "רבעון", days: 91 },
    { label: "חצי שנה", days: 182 },
    { label: "שנה", days: 365 },
  ];

  const applyPreset = (days: number) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + days);
    setFrom(toIsoDate(start));
    setTo(toIsoDate(end));
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
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-lift w-full max-w-md overflow-hidden"
          >
            <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileDown className="w-4 h-4 text-primary-600" />
                <h2 className="font-semibold text-ink-900">ייצוא Excel</h2>
              </div>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-ink-100">
                <X className="w-4 h-4 text-ink-600" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="eyebrow mb-1.5 block">טווח תאריכים</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-ink-500 mb-0.5 block">מ-</label>
                    <DateField
                      value={from}
                      onChange={setFrom}
                      max={to || undefined}
                      className="w-full"
                      required
                      label="מתאריך"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-ink-500 mb-0.5 block">עד</label>
                    <DateField
                      value={to}
                      onChange={setTo}
                      min={from || undefined}
                      className="w-full"
                      required
                      label="עד תאריך"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1 mt-2 flex-wrap">
                  {presets.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => applyPreset(p.days)}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border border-ink-200 hover:bg-ink-50 text-ink-600"
                    >
                      <CalendarIcon className="w-3 h-3" />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="eyebrow mb-1.5 block">רזולוציה (עמודה = ...)</label>
                <div className="inline-flex rounded-md border border-ink-200 p-0.5 bg-ink-50">
                  {(["day", "week", "month"] as ExcelGranularity[]).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGranularity(g)}
                      className={cn(
                        "px-3 py-1 rounded-sm text-sm font-medium transition-colors",
                        granularity === g
                          ? "bg-white text-ink-900 shadow-soft"
                          : "text-ink-600 hover:text-ink-900"
                      )}
                      type="button"
                    >
                      {GRANULARITY_LABELS[g]}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-ink-400 mt-1">
                  הקובץ יכלל עמודה לכל יחידת זמן, עם תאים צבועים על משימות פעילות.
                </p>
              </div>

              <div className="bg-ink-50 rounded-lg p-3 text-xs text-ink-600 leading-relaxed">
                <strong className="text-ink-900">מה יוצא?</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>טבלה מלאה: כותרת, סטטוס, אחראי, רשימה, התחלה, סיום, אחוז הושלם</li>
                  <li>ציר זמן ויזואלי — תאים צבועים כסרגלי גאנט</li>
                  <li>שורת כותרת קפואה כך שצריך לגלול אופקית בלבד</li>
                </ul>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-ink-200 flex items-center justify-end gap-2">
              <button onClick={onClose} className="btn-ghost text-sm" type="button">
                בטל
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className={cn(
                  "btn-primary text-sm",
                  exporting && "opacity-50 cursor-not-allowed"
                )}
                type="button"
              >
                <FileDown className="w-3.5 h-3.5" />
                {exporting ? "מייצא..." : "ייצא לאקסל"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
