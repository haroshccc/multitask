import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, Target } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DAY_OF_WEEK_LABELS, type DayOfWeek } from "@/lib/types/domain";
import {
  useCreateBlock,
  useUpdateBlock,
  useDeleteBlock,
  useCreateDayLabel,
  useUpdateDayLabel,
  useDeleteDayLabel,
} from "@/lib/hooks/useFrameworks";
import { minutesToHHMM, hhmmToMinutes } from "@/lib/frameworks/projection";
import type {
  Framework,
  FrameworkBlock,
  FrameworkDayLabel,
  FrameworkGoalPeriod,
  FrameworkPeriodUnit,
} from "@/lib/types/frameworks";
import type { FrameworkContent } from "@/lib/services/frameworks";

const DOW: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

interface Props {
  framework: Framework;
  content: FrameworkContent;
  /** Owner can edit; shared (view-only) viewers cannot. */
  readOnly?: boolean;
}

/**
 * The weekly-base editor. Each day-of-week column holds an optional day label
 * ("יום לימודים") and the recurring time blocks for that weekday. Edits here
 * are the weekly template; per-date overrides happen on the calendar.
 */
export function FrameworkWeekEditor({ framework, content, readOnly = false }: Props) {
  const weeklyLabels = content.labels.filter((l) => l.scope === "weekly");
  const weeklyBlocks = content.blocks.filter((b) => b.scope === "weekly");
  const monthlyBlocks = content.blocks
    .filter((b) => b.scope === "monthly")
    .sort((a, b) => (a.month_anchor ?? "").localeCompare(b.month_anchor ?? ""));
  const monthlyLabels = content.labels
    .filter((l) => l.scope === "monthly")
    .sort((a, b) => (a.month_anchor ?? "").localeCompare(b.month_anchor ?? ""));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {DOW.map((dow) => (
          <DayColumn
            key={dow}
            framework={framework}
            dow={dow}
            label={weeklyLabels.find((l) => l.day_of_week === dow) ?? null}
            blocks={weeklyBlocks
              .filter((b) => b.day_of_week === dow)
              .sort((a, b) => a.start_minute - b.start_minute)}
            readOnly={readOnly}
          />
        ))}
      </div>

      <MonthlySection
        framework={framework}
        blocks={monthlyBlocks}
        labels={monthlyLabels}
        readOnly={readOnly}
      />
    </div>
  );
}

function DayColumn({
  framework,
  dow,
  label,
  blocks,
  readOnly,
}: {
  framework: Framework;
  dow: DayOfWeek;
  label: FrameworkDayLabel | null;
  blocks: FrameworkBlock[];
  readOnly: boolean;
}) {
  const createLabel = useCreateDayLabel();
  const updateLabel = useUpdateDayLabel();
  const deleteLabel = useDeleteDayLabel();
  const createBlock = useCreateBlock();
  const [adding, setAdding] = useState(false);
  const [labelDraft, setLabelDraft] = useState(label?.label ?? "");

  const commitLabel = () => {
    const next = labelDraft.trim();
    if (next === (label?.label ?? "")) return;
    if (!next && label) {
      deleteLabel.mutate({ id: label.id, frameworkId: framework.id });
    } else if (label) {
      updateLabel.mutate({ id: label.id, patch: { label: next } });
    } else if (next) {
      createLabel.mutate({
        framework_id: framework.id,
        organization_id: framework.organization_id,
        scope: "weekly",
        day_of_week: dow,
        specific_date: null,
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
    <div className="rounded-2xl border border-ink-200 bg-white flex flex-col min-h-[140px]">
      <div className="px-3 pt-2.5 pb-2 border-b border-ink-100">
        <div className="text-xs font-semibold text-ink-700 mb-1">
          {DAY_OF_WEEK_LABELS[dow]}
        </div>
        <input
          className="field !py-1 !text-xs w-full"
          placeholder="כותרת יום…"
          value={labelDraft}
          disabled={readOnly}
          onChange={(e) => setLabelDraft(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      </div>

      <div className="p-2 flex-1 space-y-1.5">
        {blocks.map((b) => (
          <BlockRow key={b.id} framework={framework} block={b} readOnly={readOnly} />
        ))}

        {adding && (
          <BlockEditForm
            framework={framework}
            dow={dow}
            onDone={() => setAdding(false)}
            onSave={(payload) =>
              createBlock.mutate(payload, { onSuccess: () => setAdding(false) })
            }
          />
        )}

        {!readOnly && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full text-xs text-ink-500 hover:text-ink-800 hover:bg-ink-50 rounded-lg py-1.5 flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> בלוק
          </button>
        )}
      </div>
    </div>
  );
}

function BlockRow({
  framework,
  block,
  readOnly,
}: {
  framework: Framework;
  block: FrameworkBlock;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const updateBlock = useUpdateBlock();
  const deleteBlock = useDeleteBlock();

  if (editing) {
    return (
      <BlockEditForm
        framework={framework}
        dow={(block.day_of_week ?? 0) as DayOfWeek}
        initial={block}
        onDone={() => setEditing(false)}
        onSave={(payload) =>
          updateBlock.mutate(
            {
              id: block.id,
              patch: {
                title: payload.title,
                start_minute: payload.start_minute,
                end_minute: payload.end_minute,
                color: payload.color ?? null,
                goal_period: payload.goal_period ?? null,
                goal_target: payload.goal_target ?? null,
              },
            },
            { onSuccess: () => setEditing(false) }
          )
        }
      />
    );
  }

  return (
    <div
      className="group rounded-lg px-2 py-1.5 text-xs flex items-center gap-2"
      style={{
        background: (block.color ?? framework.color ?? "#6366f1") + "22",
        borderInlineStart: `3px solid ${block.color ?? framework.color ?? "#6366f1"}`,
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium text-ink-800 truncate flex items-center gap-1">
          {block.goal_period && <Target className="w-3 h-3 text-ink-500 shrink-0" />}
          {block.title || "ללא שם"}
        </div>
        <div className="text-[10px] text-ink-500">
          {minutesToHHMM(block.start_minute)}–{minutesToHHMM(block.end_minute)}
        </div>
      </div>
      {!readOnly && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setEditing(true)}
            className="p-1 rounded hover:bg-white/60"
            title="עריכה"
          >
            <Pencil className="w-3 h-3 text-ink-600" />
          </button>
          <button
            onClick={() => deleteBlock.mutate({ id: block.id, frameworkId: framework.id })}
            className="p-1 rounded hover:bg-white/60"
            title="מחיקה"
          >
            <Trash2 className="w-3 h-3 text-rose-500" />
          </button>
        </div>
      )}
    </div>
  );
}

interface BlockFormValue {
  framework_id: string;
  organization_id: string;
  scope: "weekly" | "monthly";
  day_of_week: number | null;
  specific_date: null;
  month_interval: number | null;
  month_anchor: string | null;
  period_unit: FrameworkPeriodUnit;
  title: string;
  color: string | null;
  start_minute: number;
  end_minute: number;
  effective_from: null;
  effective_to: null;
  override_kind: null;
  source_block_id: null;
  goal_period: FrameworkGoalPeriod | null;
  goal_target: number | null;
  goal_started_on: null;
  goal_min_streak_periods: null;
}

const GOAL_PERIOD_LABELS: Record<FrameworkGoalPeriod, string> = {
  day: "ביום",
  week: "בשבוע",
  month: "בחודש",
};

function BlockEditForm({
  framework,
  dow,
  initial,
  onDone,
  onSave,
}: {
  framework: Framework;
  dow: DayOfWeek;
  initial?: FrameworkBlock;
  onDone: () => void;
  onSave: (payload: BlockFormValue) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [start, setStart] = useState(minutesToHHMM(initial?.start_minute ?? 540));
  const [end, setEnd] = useState(minutesToHHMM(initial?.end_minute ?? 600));
  const [goalOn, setGoalOn] = useState(!!initial?.goal_period);
  const [goalPeriod, setGoalPeriod] = useState<FrameworkGoalPeriod>(
    (initial?.goal_period as FrameworkGoalPeriod) ?? "week"
  );
  const [goalTarget, setGoalTarget] = useState<number>(initial?.goal_target ?? 1);

  const save = () => {
    const startMin = hhmmToMinutes(start);
    let endMin = hhmmToMinutes(end);
    if (endMin <= startMin) endMin = Math.min(startMin + 30, 1440);
    onSave({
      framework_id: framework.id,
      organization_id: framework.organization_id,
      scope: "weekly",
      day_of_week: dow,
      specific_date: null,
      month_interval: null,
      month_anchor: null,
      period_unit: "month",
      title: title.trim(),
      color: null,
      start_minute: startMin,
      end_minute: endMin,
      effective_from: null,
      effective_to: null,
      override_kind: null,
      source_block_id: null,
      goal_period: goalOn ? goalPeriod : null,
      goal_target: goalOn ? goalTarget : null,
      goal_started_on: null,
      goal_min_streak_periods: null,
    });
  };

  return (
    <div className="rounded-lg border border-ink-200 bg-ink-50/50 p-2 space-y-1.5">
      <input
        autoFocus
        className="field !py-1 !text-xs w-full"
        placeholder="שם הבלוק"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="flex items-center gap-1.5">
        <input
          type="time"
          className="field !py-1 !text-xs flex-1"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <span className="text-ink-400 text-xs">–</span>
        <input
          type="time"
          className="field !py-1 !text-xs flex-1"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="flex items-center gap-1.5 text-[11px] text-ink-600">
          <input
            type="checkbox"
            checked={goalOn}
            onChange={(e) => setGoalOn(e.target.checked)}
          />
          יעד
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
              {(["day", "week", "month"] as FrameworkGoalPeriod[]).map((p) => (
                <option key={p} value={p}>
                  {GOAL_PERIOD_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-1">
        <button onClick={onDone} className="p-1 rounded hover:bg-ink-100" title="ביטול">
          <X className="w-3.5 h-3.5 text-ink-500" />
        </button>
        <button
          onClick={save}
          className={cn(
            "p-1 rounded text-white",
            "bg-primary-500 hover:bg-primary-600"
          )}
          title="שמירה"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Monthly / periodic items ────────────────────────────────────────────────

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

const UNIT_OPTIONS: { value: FrameworkPeriodUnit; singular: string; plural: string }[] = [
  { value: "day", singular: "יום", plural: "ימים" },
  { value: "week", singular: "שבוע", plural: "שבועות" },
  { value: "month", singular: "חודש", plural: "חודשים" },
];

/** "כל 3 שבועות" / "כל חודש · יום 15 בחודש" etc. */
function cadenceText(
  unit: FrameworkPeriodUnit,
  interval: number | null,
  anchor: string | null
): string {
  const n = Math.max(1, interval ?? 1);
  const u = UNIT_OPTIONS.find((o) => o.value === unit) ?? UNIT_OPTIONS[2];
  const every = n === 1 ? `כל ${u.singular}` : `כל ${n} ${u.plural}`;
  if (unit === "month" && anchor) {
    const d = new Date(anchor + "T00:00:00");
    return `${every} · יום ${d.getDate()} בחודש`;
  }
  return every;
}

/**
 * The monthly/periodic section: items that repeat every N months on a chosen
 * day-of-month (e.g. "errands day" once a month, "vet" every 4 months). Shown
 * below the weekly grid; rendered on the calendar on their occurrence days.
 */
function MonthlySection({
  framework,
  blocks,
  labels,
  readOnly,
}: {
  framework: Framework;
  blocks: FrameworkBlock[];
  labels: FrameworkDayLabel[];
  readOnly: boolean;
}) {
  const createBlock = useCreateBlock();
  const createLabel = useCreateDayLabel();
  const [addingBlock, setAddingBlock] = useState(false);
  const [addingLabel, setAddingLabel] = useState(false);

  const empty = blocks.length === 0 && labels.length === 0;

  return (
    <div className="rounded-2xl border border-ink-200 bg-white">
      <div className="px-3 sm:px-4 py-2.5 border-b border-ink-100 flex items-center justify-between gap-2 flex-wrap">
        <div className="text-sm font-semibold text-ink-700">פעם בחודש / מחזורי</div>
        {!readOnly && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setAddingLabel(true)}
              className="inline-flex items-center gap-1 text-xs text-ink-600 hover:text-ink-900 hover:bg-ink-100 rounded-lg px-2 py-1"
            >
              <Plus className="w-3.5 h-3.5" /> כותרת יום
            </button>
            <button
              type="button"
              onClick={() => setAddingBlock(true)}
              className="inline-flex items-center gap-1 text-xs text-ink-600 hover:text-ink-900 hover:bg-ink-100 rounded-lg px-2 py-1"
            >
              <Plus className="w-3.5 h-3.5" /> פריט מחזורי
            </button>
          </div>
        )}
      </div>

      <div className="p-2 sm:p-3 space-y-1.5">
        {empty && !addingBlock && !addingLabel && (
          <p className="text-xs text-ink-400 px-1 py-1 leading-relaxed">
            דברים שחוזרים כל כמה ימים / שבועות / חודשים — יום סידורים פעם בחודש,
            וטרינר כל 4 חודשים, ניקיון כל 3 שבועות, השקיה כל 10 ימים וכו׳.
            "פריט מחזורי" = משבצת עם שעה (אפשר יעד); "כותרת יום" = שם לכל היום.
          </p>
        )}

        {labels.map((l) => (
          <MonthlyLabelRow key={l.id} framework={framework} label={l} readOnly={readOnly} />
        ))}
        {addingLabel && (
          <MonthlyLabelForm
            framework={framework}
            onDone={() => setAddingLabel(false)}
            onSave={(payload) =>
              createLabel.mutate(payload, { onSuccess: () => setAddingLabel(false) })
            }
          />
        )}

        {blocks.map((b) => (
          <MonthlyBlockRow key={b.id} framework={framework} block={b} readOnly={readOnly} />
        ))}
        {addingBlock && (
          <MonthlyBlockForm
            framework={framework}
            onDone={() => setAddingBlock(false)}
            onSave={(payload) =>
              createBlock.mutate(payload, { onSuccess: () => setAddingBlock(false) })
            }
          />
        )}
      </div>
    </div>
  );
}

interface LabelFormValue {
  framework_id: string;
  organization_id: string;
  scope: "monthly";
  day_of_week: null;
  specific_date: null;
  month_interval: number;
  month_anchor: string;
  period_unit: FrameworkPeriodUnit;
  label: string;
  color: null;
  effective_from: null;
  effective_to: null;
}

function MonthlyLabelRow({
  framework,
  label,
  readOnly,
}: {
  framework: Framework;
  label: FrameworkDayLabel;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const updateLabel = useUpdateDayLabel();
  const deleteLabel = useDeleteDayLabel();

  if (editing) {
    return (
      <MonthlyLabelForm
        framework={framework}
        initial={label}
        onDone={() => setEditing(false)}
        onSave={(payload) =>
          updateLabel.mutate(
            {
              id: label.id,
              patch: {
                label: payload.label,
                month_interval: payload.month_interval,
                month_anchor: payload.month_anchor,
                period_unit: payload.period_unit,
              },
            },
            { onSuccess: () => setEditing(false) }
          )
        }
      />
    );
  }

  const cadence = cadenceText(label.period_unit, label.month_interval, label.month_anchor);

  return (
    <div
      className="group rounded-lg px-2 py-1.5 text-xs flex items-center gap-2 border border-dashed"
      style={{ borderColor: (label.color ?? framework.color ?? "#6366f1") + "88" }}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium text-ink-800 truncate">{label.label || "כותרת יום"}</div>
        <div className="text-[10px] text-ink-500">כותרת יום · {cadence}</div>
      </div>
      {!readOnly && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-ink-100" title="עריכה">
            <Pencil className="w-3 h-3 text-ink-600" />
          </button>
          <button
            onClick={() => deleteLabel.mutate({ id: label.id, frameworkId: framework.id })}
            className="p-1 rounded hover:bg-ink-100"
            title="מחיקה"
          >
            <Trash2 className="w-3 h-3 text-rose-500" />
          </button>
        </div>
      )}
    </div>
  );
}

function MonthlyLabelForm({
  framework,
  initial,
  onDone,
  onSave,
}: {
  framework: Framework;
  initial?: FrameworkDayLabel;
  onDone: () => void;
  onSave: (payload: LabelFormValue) => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [interval, setInterval] = useState<number>(initial?.month_interval ?? 1);
  const [unit, setUnit] = useState<FrameworkPeriodUnit>(initial?.period_unit ?? "month");
  const [anchor, setAnchor] = useState<string>(initial?.month_anchor ?? todayKey());

  const save = () => {
    if (!label.trim()) return;
    onSave({
      framework_id: framework.id,
      organization_id: framework.organization_id,
      scope: "monthly",
      day_of_week: null,
      specific_date: null,
      month_interval: Math.max(1, interval || 1),
      month_anchor: anchor || todayKey(),
      period_unit: unit,
      label: label.trim(),
      color: null,
      effective_from: null,
      effective_to: null,
    });
  };

  return (
    <div className="rounded-lg border border-ink-200 bg-ink-50/50 p-2 space-y-2">
      <input
        autoFocus
        className="field !py-1 !text-xs w-full"
        placeholder="כותרת היום (למשל: יום סידורים)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
      />
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-ink-500 shrink-0">כל</span>
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
          {UNIT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {interval === 1 ? o.singular : o.plural}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-ink-500 shrink-0">החל מ־</span>
        <input
          type="date"
          className="field !py-1 !text-xs flex-1 min-w-[120px]"
          value={anchor}
          onChange={(e) => setAnchor(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-end gap-1">
        <button onClick={onDone} className="p-1 rounded hover:bg-ink-100" title="ביטול">
          <X className="w-3.5 h-3.5 text-ink-500" />
        </button>
        <button
          onClick={save}
          className="p-1 rounded text-white bg-primary-500 hover:bg-primary-600"
          title="שמירה"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function MonthlyBlockRow({
  framework,
  block,
  readOnly,
}: {
  framework: Framework;
  block: FrameworkBlock;
  readOnly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const updateBlock = useUpdateBlock();
  const deleteBlock = useDeleteBlock();

  if (editing) {
    return (
      <MonthlyBlockForm
        framework={framework}
        initial={block}
        onDone={() => setEditing(false)}
        onSave={(payload) =>
          updateBlock.mutate(
            {
              id: block.id,
              patch: {
                title: payload.title,
                start_minute: payload.start_minute,
                end_minute: payload.end_minute,
                month_interval: payload.month_interval,
                month_anchor: payload.month_anchor,
                period_unit: payload.period_unit,
                goal_period: payload.goal_period ?? null,
                goal_target: payload.goal_target ?? null,
              },
            },
            { onSuccess: () => setEditing(false) }
          )
        }
      />
    );
  }

  return (
    <div
      className="group rounded-lg px-2 py-1.5 text-xs flex items-center gap-2"
      style={{
        background: (block.color ?? framework.color ?? "#6366f1") + "22",
        borderInlineStart: `3px solid ${block.color ?? framework.color ?? "#6366f1"}`,
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium text-ink-800 truncate flex items-center gap-1">
          {block.goal_period && <Target className="w-3 h-3 text-ink-500 shrink-0" />}
          {block.title || "ללא שם"}
        </div>
        <div className="text-[10px] text-ink-500">
          {cadenceText(block.period_unit, block.month_interval, block.month_anchor)} ·{" "}
          {minutesToHHMM(block.start_minute)}–{minutesToHHMM(block.end_minute)}
        </div>
      </div>
      {!readOnly && (
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-white/60" title="עריכה">
            <Pencil className="w-3 h-3 text-ink-600" />
          </button>
          <button
            onClick={() => deleteBlock.mutate({ id: block.id, frameworkId: framework.id })}
            className="p-1 rounded hover:bg-white/60"
            title="מחיקה"
          >
            <Trash2 className="w-3 h-3 text-rose-500" />
          </button>
        </div>
      )}
    </div>
  );
}

function MonthlyBlockForm({
  framework,
  initial,
  onDone,
  onSave,
}: {
  framework: Framework;
  initial?: FrameworkBlock;
  onDone: () => void;
  onSave: (payload: BlockFormValue) => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [start, setStart] = useState(minutesToHHMM(initial?.start_minute ?? 540));
  const [end, setEnd] = useState(minutesToHHMM(initial?.end_minute ?? 600));
  const [interval, setInterval] = useState<number>(initial?.month_interval ?? 1);
  const [unit, setUnit] = useState<FrameworkPeriodUnit>(initial?.period_unit ?? "month");
  const [anchor, setAnchor] = useState<string>(initial?.month_anchor ?? todayKey());
  const [goalOn, setGoalOn] = useState(!!initial?.goal_period);
  const [goalPeriod, setGoalPeriod] = useState<FrameworkGoalPeriod>(
    (initial?.goal_period as FrameworkGoalPeriod) ?? "month"
  );
  const [goalTarget, setGoalTarget] = useState<number>(initial?.goal_target ?? 1);

  const save = () => {
    const startMin = hhmmToMinutes(start);
    let endMin = hhmmToMinutes(end);
    if (endMin <= startMin) endMin = Math.min(startMin + 30, 1440);
    onSave({
      framework_id: framework.id,
      organization_id: framework.organization_id,
      scope: "monthly",
      day_of_week: null,
      specific_date: null,
      month_interval: Math.max(1, interval || 1),
      month_anchor: anchor || todayKey(),
      period_unit: unit,
      title: title.trim(),
      color: null,
      start_minute: startMin,
      end_minute: endMin,
      effective_from: null,
      effective_to: null,
      override_kind: null,
      source_block_id: null,
      goal_period: goalOn ? goalPeriod : null,
      goal_target: goalOn ? goalTarget : null,
      goal_started_on: null,
      goal_min_streak_periods: null,
    });
  };

  return (
    <div className="rounded-lg border border-ink-200 bg-ink-50/50 p-2 space-y-2">
      <input
        autoFocus
        className="field !py-1 !text-xs w-full"
        placeholder="שם הפריט (למשל: וטרינר)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-ink-500 shrink-0">כל</span>
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
          {UNIT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {interval === 1 ? o.singular : o.plural}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-ink-500 shrink-0">החל מ־</span>
        <input
          type="date"
          className="field !py-1 !text-xs flex-1 min-w-[120px]"
          value={anchor}
          onChange={(e) => setAnchor(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="time"
          className="field !py-1 !text-xs flex-1"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />
        <span className="text-ink-400 text-xs">–</span>
        <input
          type="time"
          className="field !py-1 !text-xs flex-1"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <label className="flex items-center gap-1.5 text-[11px] text-ink-600">
          <input type="checkbox" checked={goalOn} onChange={(e) => setGoalOn(e.target.checked)} />
          יעד
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
              {(["day", "week", "month"] as FrameworkGoalPeriod[]).map((p) => (
                <option key={p} value={p}>
                  {GOAL_PERIOD_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="flex items-center justify-end gap-1">
        <button onClick={onDone} className="p-1 rounded hover:bg-ink-100" title="ביטול">
          <X className="w-3.5 h-3.5 text-ink-500" />
        </button>
        <button
          onClick={save}
          className="p-1 rounded text-white bg-primary-500 hover:bg-primary-600"
          title="שמירה"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
