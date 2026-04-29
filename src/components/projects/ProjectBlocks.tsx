import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import type { WidgetDefinition } from "@/components/dashboard/DashboardGrid";
import {
  useProject,
  useDebouncedProjectUpdate,
  useProjectExpenses,
  useCreateProjectExpense,
  useUpdateProjectExpense,
  useDeleteProjectExpense,
} from "@/lib/hooks/useProjects";
import { useTasksByProject } from "@/lib/hooks";
import type { ProjectExpense } from "@/lib/types/domain";
import { Trash2 } from "lucide-react";
import type { ProjectPricingMode } from "@/lib/types/domain";
import { TasksBlock } from "@/components/projects/blocks/TasksBlock";
import { StatsBlock } from "@/components/projects/blocks/StatsBlock";
import { CalendarBlock } from "@/components/projects/blocks/CalendarBlock";
import { TemplatesBlock } from "@/components/projects/blocks/TemplatesBlock";
import { QuoteBlock } from "@/components/projects/blocks/QuoteBlock";
import { UploadBlock } from "@/components/projects/blocks/UploadBlock";
import { QuestionsBlock } from "@/components/projects/blocks/QuestionsBlock";
import {
  computeFixedBreakdown,
  computeHourlyBreakdown,
  formatMoney,
  type Currency,
} from "@/lib/utils/pricing";

const PRICING_MODES: { value: ProjectPricingMode; label: string }[] = [
  { value: "hourly", label: "שעתי" },
  { value: "fixed_price", label: "מחיר קבוע" },
  { value: "quote", label: "הצעת מחיר" },
];

// ─── PricingBlock ───────────────────────────────────────────────────────────

function PricingBlock({ scopeId }: { scopeId?: string | null }) {
  const { data: project } = useProject(scopeId);
  const { scheduleUpdate, flush } = useDebouncedProjectUpdate(scopeId);

  const [rate, setRate] = useState(0);
  const [profit, setProfit] = useState(0);
  const [spareMode, setSpareMode] = useState<"percent" | "hours">("percent");
  const [spareValue, setSpareValue] = useState(0);
  const [totalPrice, setTotalPrice] = useState(0);
  const [mode, setMode] = useState<ProjectPricingMode>("hourly");
  const [vatPct, setVatPct] = useState(17);

  useEffect(() => {
    if (!project) return;
    setMode(project.pricing_mode);
    setRate(Math.round((project.hourly_rate_cents ?? 0) / 100));
    setProfit(project.profit_percentage ?? 0);
    setSpareMode((project.spare_mode as "percent" | "hours" | null) ?? "percent");
    setSpareValue(project.spare_value ?? 0);
    setTotalPrice(Math.round((project.total_price_cents ?? 0) / 100));
    setVatPct(project.vat_percentage ?? 17);
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!project) return <BlockEmpty hint="טוען…" />;

  const setModeAndSave = (m: ProjectPricingMode) => {
    setMode(m);
    scheduleUpdate({ pricing_mode: m });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        {PRICING_MODES.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setModeAndSave(opt.value)}
            className={
              "px-3 py-1 rounded-sm text-xs font-medium transition-colors " +
              (mode === opt.value
                ? "bg-ink-900 text-white"
                : "bg-ink-100 text-ink-600 hover:bg-ink-200")
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      {mode === "hourly" && (
        <>
          <SliderRow
            label="תעריף שעתי (₪)"
            value={rate}
            min={0}
            max={500}
            step={10}
            onChange={(v) => {
              setRate(v);
              scheduleUpdate({ hourly_rate_cents: v * 100 });
            }}
            onCommit={flush}
          />
          <SliderRow
            label="אחוז רווח (%)"
            value={profit}
            min={0}
            max={100}
            step={1}
            onChange={(v) => {
              setProfit(v);
              scheduleUpdate({ profit_percentage: v });
            }}
            onCommit={flush}
          />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="eyebrow">מלאי שעות ספייר</span>
              <div className="flex bg-ink-100 rounded-sm p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setSpareMode("hours");
                    scheduleUpdate({ spare_mode: "hours" });
                  }}
                  className={
                    "px-2 py-0.5 rounded-xs transition-colors " +
                    (spareMode === "hours"
                      ? "bg-ink-900 text-white"
                      : "text-ink-600")
                  }
                >
                  שעות
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSpareMode("percent");
                    scheduleUpdate({ spare_mode: "percent" });
                  }}
                  className={
                    "px-2 py-0.5 rounded-xs transition-colors " +
                    (spareMode === "percent"
                      ? "bg-ink-900 text-white"
                      : "text-ink-600")
                  }
                >
                  %
                </button>
              </div>
            </div>
            <SliderTrack
              value={spareValue}
              min={0}
              max={spareMode === "percent" ? 50 : 100}
              step={1}
              onChange={(v) => {
                setSpareValue(v);
                scheduleUpdate({ spare_value: v });
              }}
              onCommit={flush}
              suffix={spareMode === "percent" ? "%" : "ש"}
            />
          </div>
        </>
      )}

      {mode === "fixed_price" && (
        <div className="space-y-3">
          <div>
            <label className="eyebrow mb-1.5 block">מחיר סופי (₪)</label>
            <input
              type="number"
              min={0}
              step={50}
              value={totalPrice}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10) || 0;
                setTotalPrice(v);
                scheduleUpdate({ total_price_cents: v * 100 });
              }}
              onBlur={flush}
              className="field"
            />
          </div>
          <p className="text-xs text-ink-500">
            הצגת התעריף השעתי האפקטיבי בבלוק "סיכום בזמן אמת".
          </p>
        </div>
      )}

      {mode === "quote" && (
        <div className="rounded-lg border border-dashed border-ink-300 p-5 text-center text-xs text-ink-500">
          שלב הצעת מחיר — בלי תמחור פעיל. עברי ל"שעתי" או "מחיר קבוע" כדי להפעיל
          את המחשבון.
        </div>
      )}

      {mode !== "quote" && (
        <SliderRow
          label='מע"מ (%)'
          value={vatPct}
          min={0}
          max={25}
          step={1}
          onChange={(v) => {
            setVatPct(v);
            scheduleUpdate({ vat_percentage: v });
          }}
          onCommit={flush}
        />
      )}

      {project.id && <ExpensesSection projectId={project.id} />}
    </div>
  );
}

// ─── Expenses inline editor ─────────────────────────────────────────────────

function ExpensesSection({ projectId }: { projectId: string }) {
  const { data: expenses = [] } = useProjectExpenses(projectId);
  const create = useCreateProjectExpense();
  const update = useUpdateProjectExpense();
  const del = useDeleteProjectExpense();
  const total = expenses.reduce((s, e) => s + (e.amount_cents ?? 0), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="eyebrow">הוצאות נוספות</span>
        <span className="text-xs text-ink-500 tabular-nums">
          סה״כ ₪{(total / 100).toFixed(0)}
        </span>
      </div>
      <ul className="space-y-1">
        {expenses.map((e) => (
          <ExpenseRow
            key={e.id}
            expense={e}
            onSave={(patch) =>
              update.mutate({ expenseId: e.id, projectId, patch })
            }
            onDelete={() => del.mutate({ expenseId: e.id, projectId })}
          />
        ))}
      </ul>
      <button
        type="button"
        onClick={() =>
          create.mutate({ project_id: projectId, label: "", amount_cents: 0 })
        }
        disabled={create.isPending}
        className="mt-1 text-[11px] text-primary-600 hover:text-primary-700 disabled:opacity-50"
      >
        + הוסיפי הוצאה
      </button>
    </div>
  );
}

function ExpenseRow({
  expense,
  onSave,
  onDelete,
}: {
  expense: ProjectExpense;
  onSave: (patch: { label?: string; amount_cents?: number }) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(expense.label ?? "");
  const [amount, setAmount] = useState(
    expense.amount_cents ? String(expense.amount_cents / 100) : ""
  );
  useEffect(() => setLabel(expense.label ?? ""), [expense.label]);
  useEffect(
    () =>
      setAmount(
        expense.amount_cents ? String(expense.amount_cents / 100) : ""
      ),
    [expense.amount_cents]
  );

  const commitLabel = () => {
    const v = label.trim();
    if (v !== (expense.label ?? "").trim()) onSave({ label: v });
  };
  const commitAmount = () => {
    const n = parseFloat(amount) || 0;
    const cents = Math.round(n * 100);
    if (cents !== (expense.amount_cents ?? 0)) onSave({ amount_cents: cents });
  };

  return (
    <li className="group/exp flex items-center gap-1.5">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commitLabel}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder="תיאור הוצאה"
        className="field py-1 text-xs flex-1"
      />
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        onBlur={commitAmount}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        placeholder="₪"
        inputMode="decimal"
        className="field py-1 text-xs w-20 tabular-nums text-end"
      />
      <button
        type="button"
        onClick={() => {
          if (confirm("למחוק את ההוצאה?")) onDelete();
        }}
        className="opacity-0 group-hover/exp:opacity-100 text-ink-400 hover:text-danger transition-opacity p-1"
        aria-label="מחקי"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </li>
  );
}

// ─── SummaryBlock ───────────────────────────────────────────────────────────

function SummaryBlock({ scopeId }: { scopeId?: string | null }) {
  const { data: project } = useProject(scopeId);
  const { data: tasks = [] } = useTasksByProject(scopeId);
  const { data: expenses = [] } = useProjectExpenses(scopeId);

  const estimatedHours = tasks.reduce(
    (sum, t) => sum + (t.estimated_hours ?? 0),
    0
  );
  const actualSeconds = tasks.reduce(
    (sum, t) => sum + (t.actual_seconds ?? 0),
    0
  );
  const expensesCents = expenses.reduce((s, e) => s + (e.amount_cents ?? 0), 0);

  if (!project) return <BlockEmpty hint="טוען…" />;

  const currency = (project.currency as Currency) ?? "ILS";
  const vatPct = project.vat_percentage ?? 0;
  const spareHours =
    project.spare_mode === "percent"
      ? (estimatedHours * (project.spare_value ?? 0)) / 100
      : project.spare_value ?? 0;
  const effectiveHours = estimatedHours + spareHours;

  let laborCents = 0;
  let perHourCents = 0;

  if (project.pricing_mode === "hourly" && project.hourly_rate_cents) {
    const breakdown = computeHourlyBreakdown({
      hourlyRateCents: project.hourly_rate_cents,
      profitPercentage: project.profit_percentage ?? 0,
      spareMode: (project.spare_mode as "percent" | "hours" | null) ?? "percent",
      spareValue: 0, // spare already factored into effectiveHours
      vatPercentage: 0,
    });
    perHourCents = breakdown.subtotalCents;
    laborCents = Math.round(perHourCents * effectiveHours);
  } else if (
    project.pricing_mode === "fixed_price" &&
    project.total_price_cents
  ) {
    const breakdown = computeFixedBreakdown({
      totalPriceCents: project.total_price_cents,
      vatPercentage: 0,
      priceIncludesVat: false,
    });
    laborCents = breakdown.totalGrossCents;
    perHourCents =
      effectiveHours > 0 ? Math.round(laborCents / effectiveHours) : 0;
  }

  // suggested = labor (with profit) + expenses, then × VAT.
  const subtotalCents = laborCents + expensesCents;
  const vatCents = Math.round(subtotalCents * (vatPct / 100));
  const suggestedCents = subtotalCents + vatCents;

  return (
    <div className="space-y-3">
      <SummaryRow
        label="שעות משוערות"
        value={`${estimatedHours.toFixed(1)} ש`}
        muted
      />
      <SummaryRow
        label="+ ספייר"
        value={`${spareHours.toFixed(1)} ש`}
        muted
      />
      <SummaryRow
        label="שעות אפקטיביות"
        value={`${effectiveHours.toFixed(1)} ש`}
      />
      {expensesCents > 0 && (
        <SummaryRow
          label="+ הוצאות"
          value={formatMoney(expensesCents, currency)}
          muted
        />
      )}
      {vatPct > 0 && (
        <SummaryRow
          label={`+ מע"מ ${vatPct}%`}
          value={formatMoney(vatCents, currency)}
          muted
        />
      )}

      <div className="rounded-lg bg-brand-gradient-soft border border-primary-200 p-3 mt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold text-ink-700">מחיר מוצע</span>
          <span className="text-xl font-bold tabular-nums text-gradient">
            {project.pricing_mode === "quote"
              ? "—"
              : formatMoney(suggestedCents, currency)}
          </span>
        </div>
      </div>

      <p className="text-[11px] text-ink-500 flex items-center gap-2">
        <TrendingUp className="w-3 h-3" />
        {(actualSeconds / 3600).toFixed(1)} ש בפועל · {formatMoney(
          perHourCents,
          currency
        )}/ש
      </p>
    </div>
  );
}

// ─── Building blocks ────────────────────────────────────────────────────────

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="eyebrow">{label}</span>
        <span className="text-xs font-semibold text-ink-900 tabular-nums">
          {value}
        </span>
      </div>
      <SliderTrack
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        onCommit={onCommit}
      />
    </div>
  );
}

function SliderTrack({
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
  suffix,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
  suffix?: string;
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className="relative">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
        className="block-slider"
        style={{
          background: `linear-gradient(to left, var(--ink-900, #111118) 0%, var(--ink-900, #111118) ${pct}%, #e2e2ea ${pct}%, #e2e2ea 100%)`,
        }}
      />
      {suffix && (
        <span className="absolute -top-5 end-0 text-xs text-ink-500 tabular-nums">
          {value} {suffix}
        </span>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={muted ? "text-ink-500" : "text-ink-800 font-medium"}>
        {label}
      </span>
      <span className="tabular-nums text-ink-900">{value}</span>
    </div>
  );
}

function BlockEmpty({ hint }: { hint: string }) {
  return (
    <div className="text-xs text-ink-500 text-center py-6">{hint}</div>
  );
}

// ─── Widget registry ───────────────────────────────────────────────────────

// Layout defaults
//  - lg (≥1200px, 12 cols): true 2-column dashboard layout per the spec
//  - md (768–1199px, 8 cols): single column — narrow desktops/tablets get
//    everything stacked full-width so nothing gets cramped
//  - sm (<768px, 4 cols): single column with mobile-friendly heights
export const PROJECT_WIDGETS: WidgetDefinition[] = [
  {
    key: "stats",
    title: "סטטיסטיקות",
    component: StatsBlock,
    defaultDesktop: { x: 6, y: 0, w: 6, h: 3, minW: 3, minH: 3 },
    defaultTablet: { x: 0, y: 0, w: 8, h: 4 },
    defaultMobile: { x: 0, y: 0, w: 4, h: 4 },
  },
  {
    key: "calendar",
    title: "לוח זמנים",
    component: CalendarBlock,
    defaultDesktop: { x: 0, y: 0, w: 6, h: 5, minW: 4, minH: 4 },
    defaultTablet: { x: 0, y: 4, w: 8, h: 5 },
    defaultMobile: { x: 0, y: 4, w: 4, h: 5 },
  },
  {
    key: "pricing",
    title: "פרמטרי תמחור",
    component: PricingBlock,
    defaultDesktop: { x: 6, y: 3, w: 6, h: 5, minW: 4, minH: 4 },
    defaultTablet: { x: 0, y: 9, w: 8, h: 6 },
    defaultMobile: { x: 0, y: 9, w: 4, h: 6 },
  },
  {
    key: "summary",
    title: "סיכום בזמן אמת",
    component: SummaryBlock,
    defaultDesktop: { x: 0, y: 5, w: 6, h: 4, minW: 4, minH: 3 },
    defaultTablet: { x: 0, y: 15, w: 8, h: 5 },
    defaultMobile: { x: 0, y: 15, w: 4, h: 5 },
  },
  {
    key: "tasks",
    title: "טבלת משימות",
    component: TasksBlock,
    defaultDesktop: { x: 0, y: 9, w: 12, h: 6, minW: 8, minH: 4 },
    defaultTablet: { x: 0, y: 20, w: 8, h: 10 },
    defaultMobile: { x: 0, y: 20, w: 4, h: 10 },
  },
  {
    key: "quote",
    title: "הצעת מחיר",
    component: QuoteBlock,
    defaultDesktop: { x: 4, y: 15, w: 8, h: 4, minW: 6, minH: 3 },
    defaultTablet: { x: 0, y: 30, w: 8, h: 4 },
    defaultMobile: { x: 0, y: 30, w: 4, h: 4 },
  },
  {
    key: "upload",
    title: "העלאת הקלטה",
    component: UploadBlock,
    defaultDesktop: { x: 0, y: 15, w: 4, h: 4, minW: 3, minH: 3 },
    defaultTablet: { x: 0, y: 34, w: 8, h: 4 },
    defaultMobile: { x: 0, y: 34, w: 4, h: 4 },
  },
  {
    key: "templates",
    title: "תבניות פרויקט",
    component: TemplatesBlock,
    defaultDesktop: { x: 0, y: 19, w: 12, h: 4, minW: 6, minH: 3 },
    defaultTablet: { x: 0, y: 38, w: 8, h: 4 },
    defaultMobile: { x: 0, y: 38, w: 4, h: 4 },
  },
  {
    key: "questions",
    title: "שאלות",
    component: QuestionsBlock,
    defaultDesktop: { x: 0, y: 23, w: 6, h: 5, minW: 4, minH: 4 },
    defaultTablet: { x: 0, y: 42, w: 8, h: 5 },
    defaultMobile: { x: 0, y: 42, w: 4, h: 6 },
  },
];

