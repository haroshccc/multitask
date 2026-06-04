import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  projectFrameworkBlocks,
  projectFrameworkDayLabels,
  toDateKey,
} from "@/lib/frameworks/projection";
import type { Framework } from "@/lib/types/frameworks";
import type { FrameworkContent } from "@/lib/services/frameworks";
import { FrameworkDayEditor } from "./FrameworkDayEditor";

const WEEKDAY_SHORT = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
const MONTHS_HE = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
/** 42 cells (6 weeks), Sunday-first, covering the month. */
function gridDays(monthAnchor: Date): Date[] {
  const start = startOfMonth(monthAnchor);
  start.setDate(start.getDate() - start.getDay());
  const out: Date[] = [];
  const cur = new Date(start);
  for (let i = 0; i < 42; i++) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/**
 * Month-grid view: see the resolved day-headers + blocks across a month, and
 * click any day to open the day editor (add header/block, one-time or
 * recurring). Calendar-style scheduling for the framework.
 */
export function FrameworkMonthGrid({
  framework,
  content,
  readOnly = false,
}: {
  framework: Framework;
  content: FrameworkContent;
  readOnly?: boolean;
}) {
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<string | null>(null);

  const days = useMemo(() => gridDays(monthAnchor), [monthAnchor]);
  const from = days[0]!;
  const to = days[days.length - 1]!;

  const labelMap = useMemo(
    () => projectFrameworkDayLabels(framework, content.labels, from, to),
    [framework, content.labels, from, to]
  );
  const blocksByDate = useMemo(() => {
    const all = projectFrameworkBlocks(framework, content.blocks, content.occurrences, from, to);
    const m = new Map<string, number>();
    for (const b of all) m.set(b.date, (m.get(b.date) ?? 0) + 1);
    return m;
  }, [framework, content.blocks, content.occurrences, from, to]);

  const todayKey = toDateKey(new Date());
  const curMonth = monthAnchor.getMonth();

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setMonthAnchor((m) => addMonths(m, -1))}
          className="p-1.5 rounded-lg hover:bg-ink-100"
          aria-label="חודש קודם"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="text-sm font-semibold text-ink-800">
          {MONTHS_HE[curMonth]} {monthAnchor.getFullYear()}
        </div>
        <button
          type="button"
          onClick={() => setMonthAnchor((m) => addMonths(m, 1))}
          className="p-1.5 rounded-lg hover:bg-ink-100"
          aria-label="חודש הבא"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_SHORT.map((w) => (
          <div key={w} className="text-[10px] text-ink-400 text-center font-medium">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = toDateKey(day);
          const inMonth = day.getMonth() === curMonth;
          const lbl = labelMap.get(key);
          const count = blocksByDate.get(key) ?? 0;
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              className={cn(
                "min-h-[58px] sm:min-h-[76px] rounded-lg border p-1 text-start flex flex-col gap-0.5 transition-colors hover:border-primary-400",
                inMonth ? "bg-white" : "bg-ink-50/50",
                "border-ink-150"
              )}
            >
              <span
                className={cn(
                  "text-[11px] font-medium tabular-nums",
                  isToday ? "text-primary-700" : inMonth ? "text-ink-700" : "text-ink-300"
                )}
              >
                {day.getDate()}
              </span>
              {lbl && (
                <span
                  className="text-[9px] leading-tight rounded px-1 py-0.5 truncate"
                  style={{
                    background: (lbl.color ?? framework.color ?? "#6366f1") + "1f",
                    color: lbl.color ?? framework.color ?? "#6366f1",
                  }}
                >
                  {lbl.label}
                </span>
              )}
              {count > 0 && (
                <span className="text-[8px] text-ink-400 mt-auto">
                  {count} בלוק{count > 1 ? "ים" : ""}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selected && (
        <FrameworkDayEditor
          framework={framework}
          content={content}
          dateKey={selected}
          readOnly={readOnly}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
