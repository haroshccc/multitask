import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ChevronRight,
  Archive,
  ArchiveRestore,
  Save,
  Loader2,
  Calculator,
} from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import {
  useProject,
  useUpdateProject,
  useArchiveProject,
  useRestoreProject,
} from "@/lib/hooks/useProjects";
import type {
  Project,
  ProjectPricingMode,
  ProjectUpdate,
} from "@/lib/types/domain";
import {
  centsToDecimalString,
  computeFixedBreakdown,
  computeHourlyBreakdown,
  formatMoney,
  parseDecimalToCents,
  type Currency,
} from "@/lib/utils/pricing";

const PRICING_OPTIONS: { value: ProjectPricingMode; label: string; hint: string }[] = [
  { value: "hourly", label: "תעריף שעתי", hint: "בסיס לשעה + רווח + רזרבה." },
  { value: "fixed_price", label: "מחיר סופי", hint: "סכום קבוע מהלקוח." },
  { value: "quote", label: "הצעת מחיר", hint: "מחקר/תכנון — בלי תמחור פעיל." },
];

const STATUS_LABEL: Record<string, string> = {
  active: "פעיל",
  on_hold: "מושהה",
  completed: "הושלם",
};

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

export function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { data: project, isLoading, isError } = useProject(projectId);

  if (isLoading) {
    return (
      <ScreenScaffold title="פרויקט">
        <div className="card p-10 text-center text-ink-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          טוענת פרטי פרויקט…
        </div>
      </ScreenScaffold>
    );
  }

  if (isError || !project) {
    return (
      <ScreenScaffold title="פרויקט לא נמצא">
        <div className="card p-8 text-center">
          <p className="text-sm text-ink-600 mb-3">
            הפרויקט לא נמצא או שאין לך גישה אליו.
          </p>
          <button
            type="button"
            onClick={() => navigate("/app/projects")}
            className="btn-primary text-sm"
          >
            חזרה לפרויקטים
          </button>
        </div>
      </ScreenScaffold>
    );
  }

  return <ProjectDetailLoaded project={project} />;
}

function ProjectDetailLoaded({ project }: { project: Project }) {
  const update = useUpdateProject();
  const archive = useArchiveProject();
  const restore = useRestoreProject();

  // ─── Identity (name / description / emoji / color) ────────────────────────
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [emoji, setEmoji] = useState(project.emoji ?? "");
  const [color, setColor] = useState<string>(project.color ?? COLOR_PALETTE[7]);

  // ─── Pricing fields ───────────────────────────────────────────────────────
  const [pricingMode, setPricingMode] = useState<ProjectPricingMode>(
    project.pricing_mode
  );
  const [hourlyRateInput, setHourlyRateInput] = useState(
    centsToDecimalString(project.hourly_rate_cents)
  );
  const [totalPriceInput, setTotalPriceInput] = useState(
    centsToDecimalString(project.total_price_cents)
  );
  const [profitPct, setProfitPct] = useState<string>(
    project.profit_percentage?.toString() ?? "20"
  );
  const [spareValue, setSpareValue] = useState<string>(
    project.spare_value?.toString() ?? "10"
  );
  const [vatPct, setVatPct] = useState<string>(
    project.vat_percentage?.toString() ?? "18"
  );
  const [includeVatInDisplay, setIncludeVatInDisplay] = useState(true);
  const [fixedPriceIncludesVat, setFixedPriceIncludesVat] = useState(false);

  useEffect(() => {
    setName(project.name);
    setDescription(project.description ?? "");
    setEmoji(project.emoji ?? "");
    setColor(project.color ?? COLOR_PALETTE[7]);
    setPricingMode(project.pricing_mode);
    setHourlyRateInput(centsToDecimalString(project.hourly_rate_cents));
    setTotalPriceInput(centsToDecimalString(project.total_price_cents));
    setProfitPct(project.profit_percentage?.toString() ?? "20");
    setSpareValue(project.spare_value?.toString() ?? "10");
    setVatPct(project.vat_percentage?.toString() ?? "18");
  }, [project]);

  const currency = (project.currency ?? "ILS") as Currency;

  const hourlyBreakdown = useMemo(
    () =>
      computeHourlyBreakdown({
        hourlyRateCents: parseDecimalToCents(hourlyRateInput),
        profitPercentage: parseFloat(profitPct) || 0,
        spareMode: project.spare_mode ?? "percent",
        spareValue: parseFloat(spareValue) || 0,
        vatPercentage: parseFloat(vatPct) || 0,
      }),
    [hourlyRateInput, profitPct, spareValue, vatPct, project.spare_mode]
  );

  const fixedBreakdown = useMemo(
    () =>
      computeFixedBreakdown({
        totalPriceCents: parseDecimalToCents(totalPriceInput),
        vatPercentage: parseFloat(vatPct) || 0,
        priceIncludesVat: fixedPriceIncludesVat,
      }),
    [totalPriceInput, vatPct, fixedPriceIncludesVat]
  );

  const isDirty =
    name.trim() !== project.name ||
    (description.trim() || null) !== (project.description ?? null) ||
    (emoji.trim() || null) !== (project.emoji ?? null) ||
    color !== (project.color ?? COLOR_PALETTE[7]) ||
    pricingMode !== project.pricing_mode ||
    parseDecimalToCents(hourlyRateInput) !== (project.hourly_rate_cents ?? 0) ||
    parseDecimalToCents(totalPriceInput) !== (project.total_price_cents ?? 0) ||
    (parseFloat(profitPct) || 0) !== (project.profit_percentage ?? 0) ||
    (parseFloat(spareValue) || 0) !== (project.spare_value ?? 0) ||
    (parseFloat(vatPct) || 0) !== (project.vat_percentage ?? 0);

  const onSave = () => {
    if (!name.trim() || !isDirty) return;
    const patch: ProjectUpdate = {
      name: name.trim(),
      description: description.trim() || null,
      emoji: emoji.trim() || null,
      color,
      pricing_mode: pricingMode,
      hourly_rate_cents:
        pricingMode === "quote" ? null : parseDecimalToCents(hourlyRateInput) || null,
      total_price_cents:
        pricingMode === "quote" ? null : parseDecimalToCents(totalPriceInput) || null,
      profit_percentage: parseFloat(profitPct) || 0,
      spare_value: parseFloat(spareValue) || 0,
      vat_percentage: parseFloat(vatPct) || 0,
    };
    update.mutate({ projectId: project.id, patch });
  };

  return (
    <ScreenScaffold
      title={project.name}
      actions={
        <>
          {project.is_archived ? (
            <button
              type="button"
              onClick={() => restore.mutate(project.id)}
              disabled={restore.isPending}
              className="btn-ghost text-sm flex items-center gap-1.5"
            >
              <ArchiveRestore className="w-4 h-4" />
              שחזרי
            </button>
          ) : (
            <button
              type="button"
              onClick={() => archive.mutate(project.id)}
              disabled={archive.isPending}
              className="btn-ghost text-sm flex items-center gap-1.5"
            >
              <Archive className="w-4 h-4" />
              ארכבי
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={!isDirty || !name.trim() || update.isPending}
            className="btn-accent text-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            {update.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {update.isPending ? "שומרת…" : "שמרי שינויים"}
          </button>
        </>
      }
    >
      <Link
        to="/app/projects"
        className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-800 transition-colors mb-3"
      >
        <ChevronRight className="w-3.5 h-3.5" />
        חזרה לפרויקטים
      </Link>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-1 space-y-4">
          <IdentityPanel
            color={color}
            setColor={setColor}
            emoji={emoji}
            setEmoji={setEmoji}
            name={name}
            setName={setName}
            description={description}
            setDescription={setDescription}
            statusLabel={STATUS_LABEL[project.status] ?? project.status}
          />
        </div>

        <div className="md:col-span-2">
          <div className="card p-4 sm:p-5">
            <header className="flex items-center gap-2 mb-4">
              <Calculator className="w-4 h-4 text-primary-600" />
              <h2 className="text-sm font-semibold text-ink-900">מחשבון תמחור</h2>
            </header>

            <ModeSelector value={pricingMode} onChange={setPricingMode} />

            <div className="mt-4">
              {pricingMode === "hourly" && (
                <HourlyForm
                  hourlyRateInput={hourlyRateInput}
                  setHourlyRateInput={setHourlyRateInput}
                  profitPct={profitPct}
                  setProfitPct={setProfitPct}
                  spareValue={spareValue}
                  setSpareValue={setSpareValue}
                  vatPct={vatPct}
                  setVatPct={setVatPct}
                  includeVat={includeVatInDisplay}
                  setIncludeVat={setIncludeVatInDisplay}
                  breakdown={hourlyBreakdown}
                  currency={currency}
                />
              )}

              {pricingMode === "fixed_price" && (
                <FixedForm
                  totalPriceInput={totalPriceInput}
                  setTotalPriceInput={setTotalPriceInput}
                  vatPct={vatPct}
                  setVatPct={setVatPct}
                  priceIncludesVat={fixedPriceIncludesVat}
                  setPriceIncludesVat={setFixedPriceIncludesVat}
                  breakdown={fixedBreakdown}
                  currency={currency}
                />
              )}

              {pricingMode === "quote" && (
                <div className="rounded-lg border border-dashed border-ink-300 p-6 text-center text-sm text-ink-600">
                  שלב הצעת מחיר — בלי תמחור פעיל. מעבר ל"שעתי" או "מחיר סופי" יפעיל את
                  המחשבון.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ScreenScaffold>
  );
}

// ─── Identity Panel ─────────────────────────────────────────────────────────

function IdentityPanel({
  color,
  setColor,
  emoji,
  setEmoji,
  name,
  setName,
  description,
  setDescription,
  statusLabel,
}: {
  color: string;
  setColor: (v: string) => void;
  emoji: string;
  setEmoji: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  statusLabel: string;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="h-2" style={{ backgroundColor: color }} />
      <div className="p-4 sm:p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="text-2xl shrink-0 w-9 h-9 rounded-lg bg-ink-50 flex items-center justify-center"
          >
            {emoji || "📁"}
          </span>
          <span className="chip">{statusLabel}</span>
        </div>

        <div>
          <label className="eyebrow mb-1.5 block">שם פרויקט</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field"
          />
        </div>

        <div>
          <label className="eyebrow mb-1.5 block">תיאור</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="field resize-none"
            placeholder="תיאור קצר, מטרות, הערות ללקוח…"
          />
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
    </div>
  );
}

// ─── Mode selector ──────────────────────────────────────────────────────────

function ModeSelector({
  value,
  onChange,
}: {
  value: ProjectPricingMode;
  onChange: (v: ProjectPricingMode) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {PRICING_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={
              "rounded-lg border px-2.5 py-2 text-start transition-colors " +
              (active
                ? "border-primary-500 bg-primary-50"
                : "border-ink-200 hover:bg-ink-50")
            }
          >
            <div className="text-xs font-semibold text-ink-900">{opt.label}</div>
            <div className="text-[10px] text-ink-500 mt-0.5 leading-tight">
              {opt.hint}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Hourly form ────────────────────────────────────────────────────────────

function HourlyForm({
  hourlyRateInput,
  setHourlyRateInput,
  profitPct,
  setProfitPct,
  spareValue,
  setSpareValue,
  vatPct,
  setVatPct,
  includeVat,
  setIncludeVat,
  breakdown,
  currency,
}: {
  hourlyRateInput: string;
  setHourlyRateInput: (v: string) => void;
  profitPct: string;
  setProfitPct: (v: string) => void;
  spareValue: string;
  setSpareValue: (v: string) => void;
  vatPct: string;
  setVatPct: (v: string) => void;
  includeVat: boolean;
  setIncludeVat: (v: boolean) => void;
  breakdown: ReturnType<typeof computeHourlyBreakdown>;
  currency: Currency;
}) {
  const displayCents = includeVat ? breakdown.totalCents : breakdown.subtotalCents;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="תעריף בסיס לשעה"
          suffix={currency === "ILS" ? "₪" : currency}
          value={hourlyRateInput}
          onChange={setHourlyRateInput}
        />
        <NumberField
          label="רווח (%)"
          suffix="%"
          value={profitPct}
          onChange={setProfitPct}
        />
        <NumberField
          label="רזרבה (%)"
          suffix="%"
          value={spareValue}
          onChange={setSpareValue}
        />
        <NumberField label="מע״מ (%)" suffix="%" value={vatPct} onChange={setVatPct} />
      </div>

      <BreakdownPanel>
        <Row label="בסיס" value={formatMoney(breakdown.baseCents, currency)} />
        <Row
          label={`+ רווח (${breakdown.profitPct}%)`}
          value={`+${formatMoney(breakdown.profitAddCents, currency)}`}
          muted
        />
        <Row
          label={`+ רזרבה`}
          value={`+${formatMoney(breakdown.spareAddCents, currency)}`}
          muted
        />
        <Divider />
        <Row
          label="סה״כ נטו לשעה"
          value={formatMoney(breakdown.subtotalCents, currency)}
          bold={!includeVat}
        />
        <Row
          label={`+ מע״מ (${breakdown.vatPct}%)`}
          value={`+${formatMoney(breakdown.vatAddCents, currency)}`}
          muted
        />
        <Divider />
        <Row
          label={includeVat ? "מחיר ללקוח לשעה" : "ללא מע״מ — לשעה"}
          value={formatMoney(displayCents, currency)}
          bold
        />
      </BreakdownPanel>

      <VatToggle includeVat={includeVat} setIncludeVat={setIncludeVat} />
    </div>
  );
}

// ─── Fixed form ─────────────────────────────────────────────────────────────

function FixedForm({
  totalPriceInput,
  setTotalPriceInput,
  vatPct,
  setVatPct,
  priceIncludesVat,
  setPriceIncludesVat,
  breakdown,
  currency,
}: {
  totalPriceInput: string;
  setTotalPriceInput: (v: string) => void;
  vatPct: string;
  setVatPct: (v: string) => void;
  priceIncludesVat: boolean;
  setPriceIncludesVat: (v: boolean) => void;
  breakdown: ReturnType<typeof computeFixedBreakdown>;
  currency: Currency;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label={priceIncludesVat ? "מחיר כולל מע״מ" : "מחיר ללא מע״מ"}
          suffix={currency === "ILS" ? "₪" : currency}
          value={totalPriceInput}
          onChange={setTotalPriceInput}
        />
        <NumberField label="מע״מ (%)" suffix="%" value={vatPct} onChange={setVatPct} />
      </div>

      <label className="flex items-center gap-2 text-xs text-ink-700">
        <input
          type="checkbox"
          checked={priceIncludesVat}
          onChange={(e) => setPriceIncludesVat(e.target.checked)}
          className="w-3.5 h-3.5 rounded text-primary-600 focus:ring-primary-500"
        />
        המחיר כבר כולל מע״מ (חשב לאחור)
      </label>

      <BreakdownPanel>
        <Row label="נטו" value={formatMoney(breakdown.totalNetCents, currency)} />
        <Row
          label={`+ מע״מ (${breakdown.vatPct}%)`}
          value={`+${formatMoney(breakdown.vatAddCents, currency)}`}
          muted
        />
        <Divider />
        <Row
          label="סה״כ ללקוח"
          value={formatMoney(breakdown.totalGrossCents, currency)}
          bold
        />
      </BreakdownPanel>
    </div>
  );
}

// ─── Building blocks ────────────────────────────────────────────────────────

function NumberField({
  label,
  suffix,
  value,
  onChange,
}: {
  label: string;
  suffix?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="eyebrow mb-1.5 block">{label}</label>
      <div className="relative">
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="field pe-9"
        />
        {suffix && (
          <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-ink-400 pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function BreakdownPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-3 sm:p-4 space-y-1.5">
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  bold,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      className={
        "flex items-center justify-between text-sm " +
        (muted ? "text-ink-500" : "text-ink-800") +
        (bold ? " font-semibold text-ink-900" : "")
      }
    >
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-ink-200/70" />;
}

function VatToggle({
  includeVat,
  setIncludeVat,
}: {
  includeVat: boolean;
  setIncludeVat: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setIncludeVat(!includeVat)}
        role="switch"
        aria-checked={includeVat}
        className={
          "relative w-9 h-5 rounded-full transition-colors " +
          (includeVat ? "bg-primary-600" : "bg-ink-300")
        }
      >
        <span
          className={
            "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all " +
            (includeVat ? "start-[18px]" : "start-0.5")
          }
        />
      </button>
      <span className="text-xs text-ink-700">הצגת מחיר כולל מע״מ</span>
    </div>
  );
}
