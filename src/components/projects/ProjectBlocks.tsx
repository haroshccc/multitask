import { useEffect, useState } from "react";
import {
  BarChart3,
  Calendar as CalendarIcon,
  ListTodo,
  FileText,
  Mic,
  LayoutTemplate,
  TrendingUp,
} from "lucide-react";
import type { WidgetDefinition } from "@/components/dashboard/DashboardGrid";
import { useProject, useDebouncedProjectUpdate } from "@/lib/hooks/useProjects";
import type { ProjectPricingMode } from "@/lib/types/domain";
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

  useEffect(() => {
    if (!project) return;
    setMode(project.pricing_mode);
    setRate(Math.round((project.hourly_rate_cents ?? 0) / 100));
    setProfit(project.profit_percentage ?? 0);
    setSpareMode((project.spare_mode as "percent" | "hours" | null) ?? "percent");
    setSpareValue(project.spare_value ?? 0);
    setTotalPrice(Math.round((project.total_price_cents ?? 0) / 100));
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
    </div>
  );
}

// ─── SummaryBlock ───────────────────────────────────────────────────────────

function SummaryBlock({ scopeId }: { scopeId?: string | null }) {
  const { data: project } = useProject(scopeId);
  if (!project) return <BlockEmpty hint="טוען…" />;

  const currency = (project.currency as Currency) ?? "ILS";
  // Tasks aggregation will land in PR-3; for now hours = 0 from tasks side.
  const estimatedHours = 0;
  const spareHours =
    project.spare_mode === "percent"
      ? (estimatedHours * (project.spare_value ?? 0)) / 100
      : project.spare_value ?? 0;
  const effectiveHours = estimatedHours + spareHours;

  let suggestedCents = 0;
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
    suggestedCents = Math.round(perHourCents * effectiveHours);
  } else if (project.pricing_mode === "fixed_price" && project.total_price_cents) {
    const breakdown = computeFixedBreakdown({
      totalPriceCents: project.total_price_cents,
      vatPercentage: 0,
      priceIncludesVat: false,
    });
    suggestedCents = breakdown.totalGrossCents;
    perHourCents = effectiveHours > 0
      ? Math.round(suggestedCents / effectiveHours)
      : 0;
  }

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
        0.0 ש בפועל · רווח: {formatMoney(perHourCents, currency)}/ש
      </p>
    </div>
  );
}

// ─── Stub blocks ────────────────────────────────────────────────────────────

function StatsBlock() {
  return (
    <BlockComingSoon
      icon={<BarChart3 className="w-4 h-4" />}
      title="סטטיסטיקות"
      hint="ביצוע זמן %, רווח שעתי, משימות הושלמו, שעות שנחסכו — מתחבר אחרי שטבלת המשימות תיכנס."
    />
  );
}

function CalendarBlock() {
  return (
    <BlockComingSoon
      icon={<CalendarIcon className="w-4 h-4" />}
      title="לוח זמנים"
      hint="יום / שבוע / חודש עם רשומות סטופר כבלוקים צבעוניים. מחכה לסטופר."
    />
  );
}

function TasksBlock() {
  return (
    <BlockComingSoon
      icon={<ListTodo className="w-4 h-4" />}
      title="טבלת משימות"
      hint="משימות, תת־משימות, סטופר, עמודות דינמיות, חיפוש. PR ייעודי."
    />
  );
}

function QuoteBlock() {
  return (
    <BlockComingSoon
      icon={<FileText className="w-4 h-4" />}
      title="הצעת מחיר"
      hint="יצירה ושיתוף הצעה (PDF / WhatsApp / מייל / קישור)."
    />
  );
}

function UploadBlock() {
  return (
    <BlockComingSoon
      icon={<Mic className="w-4 h-4" />}
      title="העלאת הקלטה"
      hint="גררי קובץ אודיו לכאן או לחצי לבחירה. מתחבר ל-Recordings."
    />
  );
}

function TemplatesBlock() {
  return (
    <BlockComingSoon
      icon={<LayoutTemplate className="w-4 h-4" />}
      title="תבניות פרויקט"
      hint="UX סטנדרטי / מיתוג בסיסי / פיתוח אג'יל. טעינה תיצור משימות בסיס."
    />
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

function BlockComingSoon({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-4 py-6">
      <div className="w-9 h-9 rounded-full bg-ink-100 text-ink-500 flex items-center justify-center mb-2">
        {icon}
      </div>
      <h4 className="text-sm font-semibold text-ink-800 mb-1">{title}</h4>
      <p className="text-[11px] text-ink-500 max-w-[28ch] leading-snug">{hint}</p>
      <span className="mt-2 chip-accent text-[10px]">בקרוב</span>
    </div>
  );
}

// ─── Widget registry ───────────────────────────────────────────────────────

export const PROJECT_WIDGETS: WidgetDefinition[] = [
  {
    key: "stats",
    title: "סטטיסטיקות",
    component: StatsBlock,
    defaultDesktop: { x: 6, y: 0, w: 6, h: 3, minW: 3, minH: 3 },
  },
  {
    key: "calendar",
    title: "לוח זמנים",
    component: CalendarBlock,
    defaultDesktop: { x: 0, y: 0, w: 6, h: 5, minW: 4, minH: 4 },
  },
  {
    key: "pricing",
    title: "פרמטרי תמחור",
    component: PricingBlock,
    defaultDesktop: { x: 6, y: 3, w: 6, h: 5, minW: 4, minH: 4 },
  },
  {
    key: "summary",
    title: "סיכום בזמן אמת",
    component: SummaryBlock,
    defaultDesktop: { x: 0, y: 5, w: 6, h: 4, minW: 4, minH: 3 },
  },
  {
    key: "tasks",
    title: "טבלת משימות",
    component: TasksBlock,
    defaultDesktop: { x: 0, y: 9, w: 12, h: 6, minW: 8, minH: 4 },
  },
  {
    key: "quote",
    title: "הצעת מחיר",
    component: QuoteBlock,
    defaultDesktop: { x: 4, y: 15, w: 8, h: 4, minW: 6, minH: 3 },
  },
  {
    key: "upload",
    title: "העלאת הקלטה",
    component: UploadBlock,
    defaultDesktop: { x: 0, y: 15, w: 4, h: 4, minW: 3, minH: 3 },
  },
  {
    key: "templates",
    title: "תבניות פרויקט",
    component: TemplatesBlock,
    defaultDesktop: { x: 0, y: 19, w: 12, h: 4, minW: 6, minH: 3 },
  },
];

