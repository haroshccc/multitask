import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Clock, Check, Wallet } from "lucide-react";
import { useProjectContext } from "@/pages/app/ProjectShell";
import { useTasksByProject } from "@/lib/hooks/useTasks";
import { useUpdateProject } from "@/lib/hooks/useProjects";
import {
  useProjectExpenses,
  useCreateProjectExpense,
  useUpdateProjectExpense,
  useDeleteProjectExpense,
} from "@/lib/hooks/useProjects";
import {
  useProjectPayments,
  useCreateProjectPayment,
  useUpdateProjectPayment,
  useDeleteProjectPayment,
} from "@/lib/hooks/useProjectPayments";
import {
  formatMoney,
  parseDecimalToCents,
  centsToDecimalString,
  type Currency,
} from "@/lib/utils/pricing";
import { cn } from "@/lib/utils/cn";

// Extra-expense impact: billed on top of the price, or taken out of the profit.
const ADD = "add_to_price";
const DEDUCT = "deduct_from_profit";

/**
 * Pricing / profit calculator for a project's payments tab. Lets you set the
 * work price and see the effective ₪/hour by *estimated* and by *actual* hours;
 * record extra expenses that either add to the final price or come out of the
 * profit; and log income in installments (built on project_payments).
 */
export function ProjectPricingPanel() {
  const { project, projectId } = useProjectContext();
  const currency = ((project.currency as Currency) ?? "ILS") as Currency;
  const { data: tasks = [] } = useTasksByProject(projectId);
  const { data: expenses = [] } = useProjectExpenses(projectId);
  const { data: payments = [] } = useProjectPayments(projectId);
  const updateProject = useUpdateProject();

  const createExpense = useCreateProjectExpense();
  const updateExpense = useUpdateProjectExpense();
  const deleteExpense = useDeleteProjectExpense();

  const createPayment = useCreateProjectPayment();
  const updatePayment = useUpdateProjectPayment();
  const deletePayment = useDeleteProjectPayment();

  // ── Derived figures ───────────────────────────────────────────────────────
  const estHours = useMemo(
    () => tasks.reduce((s, t) => s + (t.estimated_hours ?? 0), 0),
    [tasks]
  );
  const actualHours = useMemo(
    () => tasks.reduce((s, t) => s + (t.actual_seconds ?? 0), 0) / 3600,
    [tasks]
  );

  const workPriceCents = project.total_price_cents ?? 0;
  const addExpenses = expenses.filter((e) => e.impact === ADD);
  const deductExpenses = expenses.filter((e) => e.impact !== ADD);
  const addSum = addExpenses.reduce((s, e) => s + (e.amount_cents ?? 0), 0);
  const deductSum = deductExpenses.reduce((s, e) => s + (e.amount_cents ?? 0), 0);

  const finalNetCents = workPriceCents + addSum; // billed to the client
  const vatPct = project.vat_percentage ?? 0;
  const vatAddCents = Math.round((finalNetCents * vatPct) / 100);
  const finalGrossCents = finalNetCents + vatAddCents;

  // Profit basis = price minus the expenses that come out of the profit.
  const profitBasisCents = workPriceCents - deductSum;
  const perHourEst = estHours > 0 ? Math.round(profitBasisCents / estHours) : null;
  const perHourActual =
    actualHours > 0 ? Math.round(profitBasisCents / actualHours) : null;

  const receivedCents = payments
    .filter((p) => p.direction === "in" && p.status === "paid")
    .reduce((s, p) => s + (p.amount_cents ?? 0), 0);
  const remainingCents = finalGrossCents - receivedCents;

  // ── Work price input ──────────────────────────────────────────────────────
  const [priceDraft, setPriceDraft] = useState(
    centsToDecimalString(workPriceCents)
  );
  useEffect(() => {
    setPriceDraft(centsToDecimalString(project.total_price_cents ?? 0));
  }, [project.total_price_cents]);
  const commitPrice = () => {
    const cents = parseDecimalToCents(priceDraft);
    if (cents !== workPriceCents)
      updateProject.mutate({ projectId, patch: { total_price_cents: cents } });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {/* ── Work price + per-hour ─────────────────────────────────────────── */}
      <section className="card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-ink-900">מחיר העבודה</h3>
        <label className="block">
          <span className="text-xs text-ink-500">מחיר לעבודה (לפני מע״מ)</span>
          <div className="flex items-center gap-1 mt-1">
            <input
              value={priceDraft}
              onChange={(e) => setPriceDraft(e.target.value)}
              onBlur={commitPrice}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              inputMode="decimal"
              placeholder="0"
              className="field text-lg font-semibold w-full"
            />
            <span className="text-ink-400 text-sm">{currency}</span>
          </div>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <RateTile
            title="מחיר לשעה — לפי הערכה"
            hours={estHours}
            rateCents={perHourEst}
            currency={currency}
          />
          <RateTile
            title="מחיר לשעה — לפי בפועל"
            hours={actualHours}
            rateCents={perHourActual}
            currency={currency}
          />
        </div>
        {deductSum > 0 && (
          <p className="text-[11px] text-ink-500 leading-snug bg-ink-50 rounded-lg px-2.5 py-1.5">
            הרווח לחישוב: מחיר {formatMoney(workPriceCents, currency)} − הוצאות
            שיורדות מהרווח {formatMoney(deductSum, currency)} ={" "}
            <b>{formatMoney(profitBasisCents, currency)}</b>, מחולק במספר השעות.
          </p>
        )}
      </section>

      {/* ── Final price to client ─────────────────────────────────────────── */}
      <section className="card p-4 space-y-2">
        <h3 className="text-sm font-semibold text-ink-900">מחיר סופי ללקוח</h3>
        <BreakdownRow label="מחיר העבודה" cents={workPriceCents} currency={currency} />
        {addExpenses.map((e) => (
          <BreakdownRow
            key={e.id}
            label={`+ ${e.label || "הוצאה"} (נוסף למחיר)`}
            cents={e.amount_cents}
            currency={currency}
            muted
          />
        ))}
        <div className="h-px bg-ink-100 my-1" />
        <BreakdownRow
          label="מחיר סופי (לפני מע״מ)"
          cents={finalNetCents}
          currency={currency}
          strong
        />
        {vatPct > 0 && (
          <>
            <BreakdownRow
              label={`מע״מ ${vatPct}%`}
              cents={vatAddCents}
              currency={currency}
              muted
            />
            <BreakdownRow
              label="סה״כ כולל מע״מ"
              cents={finalGrossCents}
              currency={currency}
              strong
            />
          </>
        )}
      </section>

      {/* ── Extra expenses ────────────────────────────────────────────────── */}
      <section className="card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-900">הוצאות נוספות</h3>
          <button
            type="button"
            onClick={() =>
              createExpense.mutate({
                project_id: projectId,
                label: "",
                amount_cents: 0,
                impact: DEDUCT,
              })
            }
            className="btn-ghost text-xs inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> הוצאה
          </button>
        </div>
        {expenses.length === 0 ? (
          <p className="text-xs text-ink-400">
            אין הוצאות. הוסיפי הוצאה וסמני אם היא נוספת למחיר או יורדת מהרווח.
          </p>
        ) : (
          <div className="space-y-1.5">
            {expenses.map((e) => (
              <ExpenseRow
                key={e.id}
                expense={e}
                currency={currency}
                onSaveLabel={(label) =>
                  updateExpense.mutate({ expenseId: e.id, projectId, patch: { label } })
                }
                onSaveAmount={(amount_cents) =>
                  updateExpense.mutate({
                    expenseId: e.id,
                    projectId,
                    patch: { amount_cents },
                  })
                }
                onSaveImpact={(impact) =>
                  updateExpense.mutate({ expenseId: e.id, projectId, patch: { impact } })
                }
                onDelete={() => deleteExpense.mutate({ expenseId: e.id, projectId })}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Income installments ───────────────────────────────────────────── */}
      <section className="card p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink-900 inline-flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-ink-400" /> הכנסות (תשלומים)
          </h3>
          <button
            type="button"
            onClick={() =>
              createPayment.mutate({
                projectId,
                title: "תשלום",
                direction: "in",
                currency,
                status: "draft",
              })
            }
            className="btn-ghost text-xs inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> תשלום
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <MiniStat label="התקבל" cents={receivedCents} currency={currency} tone="ok" />
          <MiniStat label="נותר" cents={remainingCents} currency={currency} tone="warn" />
          <MiniStat label="סה״כ צפוי" cents={finalGrossCents} currency={currency} />
        </div>

        {payments.filter((p) => p.direction === "in").length === 0 ? (
          <p className="text-xs text-ink-400">
            אין תשלומים. אפשר להוסיף הכנסה במספר תשלומים לאורך הפרויקט.
          </p>
        ) : (
          <div className="space-y-1.5">
            {payments
              .filter((p) => p.direction === "in")
              .map((p) => (
                <PaymentRow
                  key={p.id}
                  payment={p}
                  currency={currency}
                  onSaveTitle={(title) =>
                    updatePayment.mutate({ id: p.id, projectId, patch: { title } })
                  }
                  onSaveAmount={(amount_cents) =>
                    updatePayment.mutate({ id: p.id, projectId, patch: { amount_cents } })
                  }
                  onTogglePaid={() =>
                    updatePayment.mutate({
                      id: p.id,
                      projectId,
                      patch:
                        p.status === "paid"
                          ? { status: "draft", paid_date: null }
                          : { status: "paid", paid_date: todayISO() },
                    })
                  }
                  onDelete={() => deletePayment.mutate({ id: p.id, projectId })}
                />
              ))}
          </div>
        )}
      </section>
    </div>
  );
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function RateTile({
  title,
  hours,
  rateCents,
  currency,
}: {
  title: string;
  hours: number;
  rateCents: number | null;
  currency: Currency;
}) {
  return (
    <div className="rounded-lg border border-ink-200 p-2.5 text-center">
      <div className="text-[11px] text-ink-500 leading-tight">{title}</div>
      <div className="text-lg font-bold text-ink-900 tabular-nums mt-0.5">
        {rateCents == null ? "—" : `${formatMoney(rateCents, currency)}`}
      </div>
      <div className="text-[10px] text-ink-400 inline-flex items-center gap-0.5">
        <Clock className="w-2.5 h-2.5" />
        {hours > 0 ? `${round1(hours)} ש׳` : "אין שעות"}
      </div>
    </div>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function BreakdownRow({
  label,
  cents,
  currency,
  strong,
  muted,
}: {
  label: string;
  cents: number;
  currency: Currency;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between text-sm",
        strong && "font-semibold text-ink-900",
        muted && "text-ink-500 text-xs"
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums">{formatMoney(cents, currency)}</span>
    </div>
  );
}

function MiniStat({
  label,
  cents,
  currency,
  tone,
}: {
  label: string;
  cents: number;
  currency: Currency;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="rounded-lg bg-ink-50 py-1.5">
      <div className="text-[10px] text-ink-500">{label}</div>
      <div
        className={cn(
          "text-sm font-semibold tabular-nums",
          tone === "ok" && "text-success-700",
          tone === "warn" && cents > 0 && "text-amber-600",
          !tone && "text-ink-900"
        )}
      >
        {formatMoney(cents, currency)}
      </div>
    </div>
  );
}

function ExpenseRow({
  expense,
  currency,
  onSaveLabel,
  onSaveAmount,
  onSaveImpact,
  onDelete,
}: {
  expense: { id: string; label: string; amount_cents: number; impact: string };
  currency: Currency;
  onSaveLabel: (label: string) => void;
  onSaveAmount: (cents: number) => void;
  onSaveImpact: (impact: string) => void;
  onDelete: () => void;
}) {
  const [label, setLabel] = useState(expense.label);
  const [amount, setAmount] = useState(centsToDecimalString(expense.amount_cents));
  useEffect(() => setLabel(expense.label), [expense.label]);
  useEffect(() => setAmount(centsToDecimalString(expense.amount_cents)), [expense.amount_cents]);
  return (
    <div className="flex items-center gap-1.5">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => label !== expense.label && onSaveLabel(label)}
        placeholder="תיאור ההוצאה"
        className="field text-xs flex-1 min-w-0 py-1"
      />
      <div className="flex items-center gap-0.5 shrink-0">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={() => {
            const c = parseDecimalToCents(amount);
            if (c !== expense.amount_cents) onSaveAmount(c);
          }}
          inputMode="decimal"
          placeholder="0"
          className="field text-xs w-20 py-1 text-end tabular-nums"
        />
        <span className="text-[10px] text-ink-400">{currency}</span>
      </div>
      <div className="inline-flex rounded-md border border-ink-200 overflow-hidden text-[10px] shrink-0">
        <button
          type="button"
          onClick={() => onSaveImpact(ADD)}
          className={cn(
            "px-1.5 py-1",
            expense.impact === ADD
              ? "bg-primary-600 text-white"
              : "text-ink-500 hover:bg-ink-50"
          )}
          title="נוסף למחיר הסופי"
        >
          למחיר
        </button>
        <button
          type="button"
          onClick={() => onSaveImpact(DEDUCT)}
          className={cn(
            "px-1.5 py-1",
            expense.impact !== ADD
              ? "bg-primary-600 text-white"
              : "text-ink-500 hover:bg-ink-50"
          )}
          title="יורד מהרווח"
        >
          מהרווח
        </button>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 p-1 text-ink-400 hover:text-danger-500"
        aria-label="מחק הוצאה"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function PaymentRow({
  payment,
  currency,
  onSaveTitle,
  onSaveAmount,
  onTogglePaid,
  onDelete,
}: {
  payment: {
    id: string;
    title: string;
    amount_cents: number;
    status: string;
    paid_date: string | null;
  };
  currency: Currency;
  onSaveTitle: (title: string) => void;
  onSaveAmount: (cents: number) => void;
  onTogglePaid: () => void;
  onDelete: () => void;
}) {
  const paid = payment.status === "paid";
  const [title, setTitle] = useState(payment.title);
  const [amount, setAmount] = useState(centsToDecimalString(payment.amount_cents));
  useEffect(() => setTitle(payment.title), [payment.title]);
  useEffect(() => setAmount(centsToDecimalString(payment.amount_cents)), [payment.amount_cents]);
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onTogglePaid}
        className={cn(
          "shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
          paid
            ? "bg-success-500 border-success-500 text-white"
            : "border-ink-300 hover:border-success-500"
        )}
        title={paid ? `שולם ${payment.paid_date ?? ""}` : "סמני כשולם"}
      >
        {paid && <Check className="w-3 h-3" strokeWidth={3} />}
      </button>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => title !== payment.title && onSaveTitle(title)}
        placeholder="תשלום"
        className="field text-xs flex-1 min-w-0 py-1"
      />
      <div className="flex items-center gap-0.5 shrink-0">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={() => {
            const c = parseDecimalToCents(amount);
            if (c !== payment.amount_cents) onSaveAmount(c);
          }}
          inputMode="decimal"
          placeholder="0"
          className="field text-xs w-24 py-1 text-end tabular-nums"
        />
        <span className="text-[10px] text-ink-400">{currency}</span>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 p-1 text-ink-400 hover:text-danger-500"
        aria-label="מחק תשלום"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
