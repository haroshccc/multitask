import { useState } from "react";
import { X, Trash2, Repeat, Target, Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useCreateDayLabel,
  useDeleteDayLabel,
  useCreateBlock,
  useDeleteBlock,
} from "@/lib/hooks/useFrameworks";
import { minutesToHHMM, hhmmToMinutes, itemAffectsDate } from "@/lib/frameworks/projection";
import type {
  Framework,
  FrameworkBlock,
  FrameworkDayLabel,
  FrameworkGoalPeriod,
  FrameworkPeriodUnit,
} from "@/lib/types/frameworks";
import type { FrameworkContent } from "@/lib/services/frameworks";

const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

const UNIT_SINGULAR: Record<FrameworkPeriodUnit, string> = {
  hour: "שעה", day: "יום", week: "שבוע", month: "חודש",
};
const UNIT_PLURAL: Record<FrameworkPeriodUnit, string> = {
  hour: "שעות", day: "ימים", week: "שבועות", month: "חודשים",
};

function fmtDate(key: string): string {
  const d = new Date(key + "T00:00:00");
  return `יום ${WEEKDAYS[d.getDay()]} · ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function recurBadge(item: {
  scope: string;
  month_interval: number | null;
  period_unit: FrameworkPeriodUnit;
}): string {
  if (item.scope === "date") return "חד-פעמי";
  if (item.scope === "weekly") return "כל שבוע";
  const n = Math.max(1, item.month_interval ?? 1);
  return n === 1 ? `כל ${UNIT_SINGULAR[item.period_unit]}` : `כל ${n} ${UNIT_PLURAL[item.period_unit]}`;
}

/**
 * Calendar-style day editor. Click a day → this opens. Lists everything that
 * lands on the day (headers + blocks) with delete, and lets you add either a
 * header or a block, each as one-time (this day) or recurring with a flexible
 * cadence (every N hours/days/weeks/months). The clicked day is the anchor.
 */
export function FrameworkDayEditor({
  framework,
  content,
  dateKey,
  readOnly = false,
  onClose,
}: {
  framework: Framework;
  content: FrameworkContent;
  dateKey: string;
  readOnly?: boolean;
  onClose: () => void;
}) {
  const deleteLabel = useDeleteDayLabel();
  const deleteBlock = useDeleteBlock();

  const labels = content.labels.filter((l) => itemAffectsDate(l, dateKey));
  const blocks = content.blocks
    .filter((b) => itemAffectsDate(b, dateKey))
    .sort((a, b) => a.start_minute - b.start_minute);

  const [tab, setTab] = useState<"header" | "block">("header");

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-lift max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white px-4 py-3 border-b border-ink-200 flex items-center justify-between">
          <div className="text-sm font-semibold text-ink-900">{fmtDate(dateKey)}</div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-ink-100" aria-label="סגירה">
            <X className="w-4 h-4 text-ink-500" />
          </button>
        </div>

        {/* What's on this day */}
        <div className="px-4 py-3 space-y-1.5 border-b border-ink-100">
          {labels.length === 0 && blocks.length === 0 && (
            <p className="text-xs text-ink-400">אין שיבוצים ביום זה עדיין.</p>
          )}
          {labels.map((l) => (
            <ItemRow
              key={l.id}
              title={l.label}
              kind="header"
              badge={recurBadge(l)}
              color={l.color ?? framework.color}
              readOnly={readOnly}
              onDelete={() => deleteLabel.mutate({ id: l.id, frameworkId: framework.id })}
            />
          ))}
          {blocks.map((b) => (
            <ItemRow
              key={b.id}
              title={`${b.title || "ללא שם"} · ${minutesToHHMM(b.start_minute)}–${minutesToHHMM(b.end_minute)}`}
              kind="block"
              badge={recurBadge(b)}
              hasGoal={!!b.goal_period}
              color={b.color ?? framework.color}
              readOnly={readOnly}
              onDelete={() => deleteBlock.mutate({ id: b.id, frameworkId: framework.id })}
            />
          ))}
        </div>

        {/* Add */}
        {!readOnly && (
          <div className="px-4 py-3">
            <div className="inline-flex rounded-xl border border-ink-200 p-0.5 text-sm mb-3">
              <button
                onClick={() => setTab("header")}
                className={cn(
                  "px-3 py-1 rounded-lg",
                  tab === "header" ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100"
                )}
              >
                כותרת
              </button>
              <button
                onClick={() => setTab("block")}
                className={cn(
                  "px-3 py-1 rounded-lg",
                  tab === "block" ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100"
                )}
              >
                מופע
              </button>
            </div>

            {tab === "header" ? (
              <HeaderForm framework={framework} dateKey={dateKey} onDone={onClose} />
            ) : (
              <BlockForm framework={framework} dateKey={dateKey} onDone={onClose} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ItemRow({
  title,
  kind,
  badge,
  hasGoal,
  color,
  readOnly,
  onDelete,
}: {
  title: string;
  kind: "header" | "block";
  badge: string;
  hasGoal?: boolean;
  color: string | null;
  readOnly: boolean;
  onDelete: () => void;
}) {
  return (
    <div
      className="group flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs"
      style={{ background: (color ?? "#6366f1") + (kind === "block" ? "1f" : "14") }}
    >
      <span className="font-medium text-ink-800 truncate flex-1 flex items-center gap-1">
        {hasGoal && <Target className="w-3 h-3 text-ink-500 shrink-0" />}
        {title}
      </span>
      <span className="inline-flex items-center gap-0.5 text-[10px] text-ink-500 shrink-0">
        {badge !== "חד-פעמי" && <Repeat className="w-2.5 h-2.5" />}
        {badge}
      </span>
      {!readOnly && (
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-white/60 opacity-0 group-hover:opacity-100 transition-opacity"
          title="מחיקה"
        >
          <Trash2 className="w-3 h-3 text-rose-500" />
        </button>
      )}
    </div>
  );
}

/** Recurrence picker shared by both forms. */
function RecurrenceFields({
  recurring,
  setRecurring,
  interval,
  setInterval,
  unit,
  setUnit,
  units,
}: {
  recurring: boolean;
  setRecurring: (v: boolean) => void;
  interval: number;
  setInterval: (n: number) => void;
  unit: FrameworkPeriodUnit;
  setUnit: (u: FrameworkPeriodUnit) => void;
  units: FrameworkPeriodUnit[];
}) {
  return (
    <div className="space-y-1.5">
      <div className="inline-flex rounded-lg border border-ink-200 p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setRecurring(false)}
          className={cn("px-2.5 py-1 rounded-md", !recurring ? "bg-ink-900 text-white" : "text-ink-600")}
        >
          חד-פעמי
        </button>
        <button
          type="button"
          onClick={() => setRecurring(true)}
          className={cn("px-2.5 py-1 rounded-md", recurring ? "bg-ink-900 text-white" : "text-ink-600")}
        >
          חוזר
        </button>
      </div>
      {recurring && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-ink-500">כל</span>
          <input
            type="number"
            min={1}
            className="field !py-1 !text-xs w-14"
            value={interval}
            onChange={(e) => setInterval(Math.max(1, Number(e.target.value) || 1))}
          />
          <select
            className="field !py-1 !text-xs w-24"
            value={unit}
            onChange={(e) => setUnit(e.target.value as FrameworkPeriodUnit)}
          >
            {units.map((u) => (
              <option key={u} value={u}>
                {interval === 1 ? UNIT_SINGULAR[u] : UNIT_PLURAL[u]}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function HeaderForm({
  framework,
  dateKey,
  onDone,
}: {
  framework: Framework;
  dateKey: string;
  onDone: () => void;
}) {
  const createLabel = useCreateDayLabel();
  const [label, setLabel] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [interval, setInterval] = useState(1);
  const [unit, setUnit] = useState<FrameworkPeriodUnit>("week");

  const save = () => {
    const text = label.trim();
    if (!text) return;
    const base = {
      framework_id: framework.id,
      organization_id: framework.organization_id,
      label: text,
      color: null,
      effective_from: null,
      effective_to: null,
    };
    const payload: Omit<FrameworkDayLabel, "id" | "created_at" | "updated_at"> = recurring
      ? {
          ...base,
          scope: "monthly",
          day_of_week: null,
          specific_date: null,
          month_interval: Math.max(1, interval),
          month_anchor: dateKey,
          period_unit: unit,
        }
      : {
          ...base,
          scope: "date",
          day_of_week: null,
          specific_date: dateKey,
          month_interval: null,
          month_anchor: null,
          period_unit: "month",
        };
    createLabel.mutate(payload, { onSuccess: onDone });
  };

  return (
    <div className="space-y-2.5">
      <input
        autoFocus
        className="field !py-1.5 !text-sm w-full"
        placeholder="כותרת היום (למשל: יום לימודים)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <RecurrenceFields
        recurring={recurring}
        setRecurring={setRecurring}
        interval={interval}
        setInterval={setInterval}
        unit={unit}
        setUnit={setUnit}
        units={["day", "week", "month"]}
      />
      <button
        onClick={save}
        className="w-full inline-flex items-center justify-center gap-1 text-sm text-white bg-primary-500 hover:bg-primary-600 rounded-xl py-2"
      >
        <Plus className="w-4 h-4" /> הוספת כותרת
      </button>
    </div>
  );
}

function BlockForm({
  framework,
  dateKey,
  onDone,
}: {
  framework: Framework;
  dateKey: string;
  onDone: () => void;
}) {
  const createBlock = useCreateBlock();
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [recurring, setRecurring] = useState(false);
  const [interval, setInterval] = useState(1);
  const [unit, setUnit] = useState<FrameworkPeriodUnit>("week");
  const [goalOn, setGoalOn] = useState(false);
  const [goalPeriod, setGoalPeriod] = useState<FrameworkGoalPeriod>("week");
  const [goalTarget, setGoalTarget] = useState(1);

  const save = () => {
    const startMin = hhmmToMinutes(start);
    let endMin = hhmmToMinutes(end);
    if (endMin <= startMin) endMin = Math.min(startMin + 30, 1440);
    const base = {
      framework_id: framework.id,
      organization_id: framework.organization_id,
      title: title.trim(),
      color: null,
      start_minute: startMin,
      end_minute: endMin,
      effective_from: null,
      effective_to: null,
      goal_period: goalOn ? goalPeriod : null,
      goal_target: goalOn ? goalTarget : null,
      goal_started_on: null,
      goal_min_streak_periods: null,
    };
    const payload: Omit<FrameworkBlock, "id" | "created_at" | "updated_at" | "sort_order"> = recurring
      ? {
          ...base,
          scope: "monthly",
          day_of_week: null,
          specific_date: null,
          month_interval: Math.max(1, interval),
          month_anchor: dateKey,
          period_unit: unit,
          override_kind: null,
          source_block_id: null,
        }
      : {
          ...base,
          scope: "date",
          day_of_week: null,
          specific_date: dateKey,
          month_interval: null,
          month_anchor: null,
          period_unit: "month",
          override_kind: "add",
          source_block_id: null,
        };
    createBlock.mutate(payload, { onSuccess: onDone });
  };

  return (
    <div className="space-y-2.5">
      <input
        autoFocus
        className="field !py-1.5 !text-sm w-full"
        placeholder="שם המופע (למשל: אימון)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="flex items-center gap-1.5">
        <input type="time" className="field !py-1 !text-xs flex-1" value={start} onChange={(e) => setStart(e.target.value)} />
        <span className="text-ink-400 text-xs">–</span>
        <input type="time" className="field !py-1 !text-xs flex-1" value={end} onChange={(e) => setEnd(e.target.value)} />
      </div>
      <RecurrenceFields
        recurring={recurring}
        setRecurring={setRecurring}
        interval={interval}
        setInterval={setInterval}
        unit={unit}
        setUnit={setUnit}
        units={["hour", "day", "week", "month"]}
      />
      <div className="space-y-1">
        <label className="flex items-center gap-1.5 text-[11px] text-ink-600">
          <input type="checkbox" checked={goalOn} onChange={(e) => setGoalOn(e.target.checked)} />
          יעד (לעקוב כמה פעמים מבצעים)
        </label>
        {goalOn && (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              className="field !py-1 !text-xs w-14"
              value={goalTarget}
              onChange={(e) => setGoalTarget(Math.max(1, Number(e.target.value) || 1))}
            />
            <select
              className="field !py-1 !text-xs flex-1"
              value={goalPeriod}
              onChange={(e) => setGoalPeriod(e.target.value as FrameworkGoalPeriod)}
            >
              <option value="day">ביום</option>
              <option value="week">בשבוע</option>
              <option value="month">בחודש</option>
            </select>
          </div>
        )}
      </div>
      <button
        onClick={save}
        className="w-full inline-flex items-center justify-center gap-1 text-sm text-white bg-primary-500 hover:bg-primary-600 rounded-xl py-2"
      >
        <Plus className="w-4 h-4" /> הוספת מופע
      </button>
    </div>
  );
}
