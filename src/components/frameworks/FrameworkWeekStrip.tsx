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

const WEEKDAY = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const WEEKDAY_SHORT = ["ראש׳", "שני", "שלי׳", "רבי׳", "חמי׳", "שישי", "שבת"];

function startOfWeek(d: Date): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - s.getDay());
  return s;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function hhmm(start: Date): string {
  return `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
}

/**
 * Week view: the seven real days of a week (with prev/next nav). Each day shows
 * its resolved header + blocks; clicking a day opens the day editor — same
 * calendar-style scheduling as the month view, but laid out a week at a time.
 */
export function FrameworkWeekStrip({
  framework,
  content,
  readOnly = false,
}: {
  framework: Framework;
  content: FrameworkContent;
  readOnly?: boolean;
}) {
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()));
  const [selected, setSelected] = useState<string | null>(null);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekAnchor, i)),
    [weekAnchor]
  );
  const from = days[0]!;
  const to = days[6]!;

  const labelMap = useMemo(
    () => projectFrameworkDayLabels(framework, content.labels, from, to),
    [framework, content.labels, from, to]
  );
  const blocksByDate = useMemo(() => {
    const all = projectFrameworkBlocks(framework, content.blocks, content.occurrences, from, to);
    const m = new Map<string, typeof all>();
    for (const b of all) {
      const arr = m.get(b.date) ?? [];
      arr.push(b);
      m.set(b.date, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.start.getTime() - b.start.getTime());
    return m;
  }, [framework, content.blocks, content.occurrences, from, to]);

  const todayKey = toDateKey(new Date());
  const rangeLabel = `${from.getDate()}/${from.getMonth() + 1} – ${to.getDate()}/${to.getMonth() + 1}`;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setWeekAnchor((w) => addDays(w, -7))}
          className="p-1.5 rounded-lg hover:bg-ink-100"
          aria-label="שבוע קודם"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="text-sm font-semibold text-ink-800">{rangeLabel}</div>
        <button
          type="button"
          onClick={() => setWeekAnchor((w) => addDays(w, 7))}
          className="p-1.5 rounded-lg hover:bg-ink-100"
          aria-label="שבוע הבא"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {days.map((day) => {
          const key = toDateKey(day);
          const lbl = labelMap.get(key);
          const blocks = blocksByDate.get(key) ?? [];
          const isToday = key === todayKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              className={cn(
                "rounded-2xl border bg-white p-2 text-start min-h-[120px] flex flex-col gap-1 transition-colors hover:border-primary-400",
                isToday ? "border-primary-300 ring-1 ring-primary-200" : "border-ink-200"
              )}
            >
              <div className="flex items-baseline justify-between">
                <span className={cn("text-xs font-semibold", isToday ? "text-primary-700" : "text-ink-700")}>
                  <span className="sm:hidden">{WEEKDAY_SHORT[day.getDay()]}</span>
                  <span className="hidden sm:inline">{WEEKDAY[day.getDay()]}</span>
                </span>
                <span className="text-[11px] text-ink-400 tabular-nums">{day.getDate()}</span>
              </div>
              {lbl && (
                <span
                  className="text-[11px] font-bold leading-tight truncate"
                  style={{ color: lbl.color ?? framework.color ?? "#6366f1" }}
                  title={lbl.label}
                >
                  {lbl.label}
                </span>
              )}
              <div className="flex flex-col gap-0.5">
                {blocks.map((b) => (
                  <span
                    key={b.id}
                    className="text-[10px] leading-tight rounded px-1 py-0.5 flex items-center gap-1"
                    style={{ background: (b.color ?? framework.color ?? "#6366f1") + "1a", color: "#3a3a46" }}
                  >
                    <span className="tabular-nums text-ink-500">{hhmm(b.start)}</span>
                    <span className="truncate flex-1">{b.title || "ללא שם"}</span>
                  </span>
                ))}
              </div>
              {!lbl && blocks.length === 0 && (
                <span className="text-[10px] text-ink-300 mt-auto">לחצי להוספה</span>
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
