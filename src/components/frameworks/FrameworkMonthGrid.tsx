import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useCreateDayLabel,
  useUpdateDayLabel,
  useDeleteDayLabel,
} from "@/lib/hooks/useFrameworks";
import {
  projectFrameworkBlocks,
  projectFrameworkDayLabels,
  toDateKey,
  minutesToHHMM,
} from "@/lib/frameworks/projection";
import type { Framework } from "@/lib/types/frameworks";
import type { FrameworkContent } from "@/lib/services/frameworks";

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
  start.setDate(start.getDate() - start.getDay()); // back to the Sunday
  const out: Date[] = [];
  const cur = new Date(start);
  for (let i = 0; i < 42; i++) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/**
 * Month-grid view of a framework: see the resolved day-labels and blocks across
 * a whole month, and quickly assign a per-day header (כותרת) to any day via the
 * side editor — reminiscent of the calendar's scheduling mode.
 *
 * Editing a day's header writes a date-scoped label (specific_date) that
 * overrides the weekly/periodic label for that day only. Time blocks are still
 * managed in the week view (shown here read-only for context).
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
    const m = new Map<string, typeof all>();
    for (const b of all) {
      const arr = m.get(b.date) ?? [];
      arr.push(b);
      m.set(b.date, arr);
    }
    return m;
  }, [framework, content.blocks, content.occurrences, from, to]);

  const todayKey = toDateKey(new Date());
  const curMonth = monthAnchor.getMonth();

  return (
    <div className="flex flex-col lg:flex-row gap-3">
      <div className="flex-1 min-w-0">
        {/* Month nav */}
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

        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAY_SHORT.map((w) => (
            <div key={w} className="text-[10px] text-ink-400 text-center font-medium">
              {w}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const key = toDateKey(day);
            const inMonth = day.getMonth() === curMonth;
            const lbl = labelMap.get(key);
            const dayBlocks = blocksByDate.get(key) ?? [];
            const isSel = selected === key;
            const isToday = key === todayKey;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={cn(
                  "min-h-[58px] sm:min-h-[72px] rounded-lg border p-1 text-start flex flex-col gap-0.5 transition-colors",
                  inMonth ? "bg-white" : "bg-ink-50/50",
                  isSel ? "border-primary-500 ring-1 ring-primary-300" : "border-ink-150 hover:border-ink-300"
                )}
              >
                <span
                  className={cn(
                    "text-[11px] font-medium tabular-nums",
                    isToday
                      ? "text-primary-700"
                      : inMonth
                      ? "text-ink-700"
                      : "text-ink-300"
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
                {dayBlocks.length > 0 && (
                  <span className="text-[8px] text-ink-400 mt-auto">
                    {dayBlocks.length} בלוק{dayBlocks.length > 1 ? "ים" : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Side editor */}
      {selected && (
        <DaySidePanel
          framework={framework}
          content={content}
          dateKey={selected}
          inheritedLabel={labelMap.get(selected)?.label ?? null}
          blocks={blocksByDate.get(selected) ?? []}
          readOnly={readOnly}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function formatDateHe(key: string): string {
  const d = new Date(key + "T00:00:00");
  return `${WEEKDAY_SHORT[d.getDay()]}׳ · ${d.getDate()} ${MONTHS_HE[d.getMonth()]}`;
}

function DaySidePanel({
  framework,
  content,
  dateKey,
  inheritedLabel,
  blocks,
  readOnly,
  onClose,
}: {
  framework: Framework;
  content: FrameworkContent;
  dateKey: string;
  inheritedLabel: string | null;
  blocks: { id: string; title: string; start: Date; end: Date }[];
  readOnly: boolean;
  onClose: () => void;
}) {
  const createLabel = useCreateDayLabel();
  const updateLabel = useUpdateDayLabel();
  const deleteLabel = useDeleteDayLabel();

  // The date-scoped override for this exact day, if any.
  const dateLabel = content.labels.find(
    (l) => l.scope === "date" && l.specific_date === dateKey
  );
  const [draft, setDraft] = useState(dateLabel?.label ?? "");

  // Keep the draft in sync when switching days (key change remounts via parent? no — guard).
  // Parent re-renders with same component instance; reset when dateKey changes.
  const [lastKey, setLastKey] = useState(dateKey);
  if (lastKey !== dateKey) {
    setLastKey(dateKey);
    setDraft(dateLabel?.label ?? "");
  }

  const save = () => {
    const next = draft.trim();
    if (next === (dateLabel?.label ?? "")) return;
    if (!next && dateLabel) {
      deleteLabel.mutate({ id: dateLabel.id, frameworkId: framework.id });
    } else if (dateLabel) {
      updateLabel.mutate({ id: dateLabel.id, patch: { label: next } });
    } else if (next) {
      createLabel.mutate({
        framework_id: framework.id,
        organization_id: framework.organization_id,
        scope: "date",
        day_of_week: null,
        specific_date: dateKey,
        month_interval: null,
        month_anchor: null,
        period_unit: "month",
        label: next,
        color: null,
        effective_from: null,
        effective_to: null,
      });
    }
  };

  return (
    <aside className="lg:w-64 shrink-0 rounded-2xl border border-ink-200 bg-white p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-ink-800">{formatDateHe(dateKey)}</div>
        <button onClick={onClose} className="p-1 rounded hover:bg-ink-100" aria-label="סגירה">
          <X className="w-4 h-4 text-ink-500" />
        </button>
      </div>

      {/* Day header editor */}
      <div className="space-y-1">
        <label className="text-[11px] text-ink-500">כותרת ליום זה</label>
        <input
          className="field !py-1.5 !text-sm w-full"
          placeholder={inheritedLabel ?? "ללא כותרת"}
          value={draft}
          disabled={readOnly}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          onBlur={save}
        />
        {!readOnly && (
          <div className="flex items-center gap-1 justify-end">
            {dateLabel && (
              <button
                onClick={() => {
                  deleteLabel.mutate({ id: dateLabel.id, frameworkId: framework.id });
                  setDraft("");
                }}
                className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:bg-rose-50 rounded-lg px-2 py-1"
              >
                <Trash2 className="w-3 h-3" /> הסרה
              </button>
            )}
            <button
              onClick={save}
              className="inline-flex items-center gap-1 text-[11px] text-white bg-primary-500 hover:bg-primary-600 rounded-lg px-2 py-1"
            >
              <Check className="w-3 h-3" /> שמירה
            </button>
          </div>
        )}
        {inheritedLabel && !dateLabel && (
          <p className="text-[10px] text-ink-400 leading-relaxed">
            כרגע מוצג "{inheritedLabel}" (מהתבנית הקבועה). כתיבת כותרת כאן תחליף אותה ליום הזה בלבד.
          </p>
        )}
      </div>

      {/* Blocks on this day (read-only context) */}
      <div className="space-y-1">
        <div className="text-[11px] text-ink-500">בלוקים ביום זה</div>
        {blocks.length === 0 ? (
          <p className="text-[10px] text-ink-400">אין בלוקים. להוספה/עריכה — תצוגת שבוע.</p>
        ) : (
          <div className="space-y-1">
            {blocks.map((b) => (
              <div
                key={b.id}
                className="text-[11px] rounded-lg px-2 py-1"
                style={{ background: (framework.color ?? "#6366f1") + "1a" }}
              >
                <span className="font-medium text-ink-700">{b.title || "ללא שם"}</span>{" "}
                <span className="text-ink-500">
                  {minutesToHHMM(b.start.getHours() * 60 + b.start.getMinutes())}–
                  {minutesToHHMM(b.end.getHours() * 60 + b.end.getMinutes())}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
