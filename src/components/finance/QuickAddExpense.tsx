/**
 * Add an expense to a budget — free-form or pre-filled from a template.
 * Handles the three kinds (fixed / onetime / recurring_variable) and both
 * event configs (budget-charge mode + account-withdrawal timing).
 */
import { useState } from "react";
import { Modal, LabeledField } from "./finance-bits";
import { useCreateExpense } from "@/lib/hooks/useFinance";
import { toDateKey } from "@/lib/finance/calc";
import type {
  FinanceAccount,
  FinanceExpenseTemplate,
  ExpenseKind,
  PaymentMethod,
  BudgetChargeMode,
  WithdrawalTiming,
} from "@/lib/types/finance";

const WEEKDAYS: { code: string; label: string }[] = [
  { code: "SU", label: "א׳" },
  { code: "MO", label: "ב׳" },
  { code: "TU", label: "ג׳" },
  { code: "WE", label: "ד׳" },
  { code: "TH", label: "ה׳" },
  { code: "FR", label: "ו׳" },
  { code: "SA", label: "ש׳" },
];

export function QuickAddExpense({
  budgetId,
  accounts,
  templates,
  onClose,
}: {
  budgetId: string;
  accounts: FinanceAccount[];
  templates: FinanceExpenseTemplate[];
  onClose: () => void;
}) {
  const create = useCreateExpense();

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [kind, setKind] = useState<ExpenseKind>("onetime");
  const [date, setDate] = useState(toDateKey(new Date()));
  const [freq, setFreq] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("WEEKLY");
  const [weekday, setWeekday] = useState("MO");
  const [accountId, setAccountId] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [chargeMode, setChargeMode] = useState<BudgetChargeMode>("auto");
  const [timing, setTiming] = useState<WithdrawalTiming>("immediate");
  const [error, setError] = useState<string | null>(null);

  function applyTemplate(t: FinanceExpenseTemplate) {
    if (t.account_id) setAccountId(t.account_id);
    if (t.payment_method) setPaymentMethod(t.payment_method);
    if (t.default_amount != null) setAmount(t.default_amount);
    if (t.budget_charge_mode) setChargeMode(t.budget_charge_mode);
    if (t.withdrawal_timing) setTiming(t.withdrawal_timing);
    if (!title) setTitle(t.name);
    setKind("recurring_variable");
  }

  function buildRule(): string {
    if (freq === "WEEKLY") return `FREQ=WEEKLY;BYDAY=${weekday}`;
    return `FREQ=${freq}`;
  }

  async function handleSave() {
    setError(null);
    if (!title.trim()) {
      setError("יש לתת שם להוצאה");
      return;
    }
    try {
      await create.mutateAsync({
        budget_id: budgetId,
        account_id: accountId || null,
        payment_method: (paymentMethod || null) as PaymentMethod | null,
        kind,
        title: title.trim(),
        default_amount: amount,
        recurrence_rule: kind === "fixed" ? buildRule() : null,
        budget_charge_mode: chargeMode,
        withdrawal_timing: timing,
        occurrence_date: date,
      });
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "שגיאה בהוספה");
    }
  }

  return (
    <Modal
      title="הוספת הוצאה"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-ghost text-sm" onClick={onClose}>
            ביטול
          </button>
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={handleSave}
            disabled={create.isPending}
          >
            {create.isPending ? "מוסיף..." : "הוספה"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {templates.length > 0 && (
          <LabeledField label="מילוי משבלונה (לא חובה)">
            <div className="flex flex-wrap gap-1.5">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className="chip bg-ink-150 hover:bg-ink-200"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </LabeledField>
        )}

        <div className="grid grid-cols-2 gap-3">
          <LabeledField label="שם ההוצאה">
            <input
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </LabeledField>
          <LabeledField label="סכום">
            <input
              type="number"
              className="field"
              value={Number.isFinite(amount) ? amount : 0}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={0}
            />
          </LabeledField>
        </div>

        <LabeledField label="סוג">
          <select
            className="field"
            value={kind}
            onChange={(e) => setKind(e.target.value as ExpenseKind)}
          >
            <option value="onetime">חד-פעמית</option>
            <option value="fixed">קבועה (חוזרת)</option>
            <option value="recurring_variable">נשנית (שבלונה)</option>
          </select>
        </LabeledField>

        {kind === "fixed" ? (
          <div className="grid grid-cols-2 gap-3">
            <LabeledField label="תדירות">
              <select
                className="field"
                value={freq}
                onChange={(e) => setFreq(e.target.value as typeof freq)}
              >
                <option value="DAILY">כל יום</option>
                <option value="WEEKLY">כל שבוע</option>
                <option value="MONTHLY">כל חודש</option>
              </select>
            </LabeledField>
            {freq === "WEEKLY" && (
              <LabeledField label="יום בשבוע">
                <select
                  className="field"
                  value={weekday}
                  onChange={(e) => setWeekday(e.target.value)}
                >
                  {WEEKDAYS.map((w) => (
                    <option key={w.code} value={w.code}>
                      {w.label}
                    </option>
                  ))}
                </select>
              </LabeledField>
            )}
          </div>
        ) : (
          <LabeledField label="תאריך">
            <input
              type="date"
              className="field"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </LabeledField>
        )}

        <div className="grid grid-cols-2 gap-3">
          <LabeledField label="חיוב לתקציב">
            <select
              className="field"
              value={chargeMode}
              onChange={(e) => setChargeMode(e.target.value as BudgetChargeMode)}
            >
              <option value="auto">אוטומטי בתאריך</option>
              <option value="manual_check">ידני (סימון וי)</option>
            </select>
          </LabeledField>
          <LabeledField label="ירידה מהחשבון">
            <select
              className="field"
              value={timing}
              onChange={(e) => setTiming(e.target.value as WithdrawalTiming)}
            >
              <option value="immediate">מיידי</option>
              <option value="future_date">עתידי (בתאריך)</option>
            </select>
          </LabeledField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <LabeledField label="חשבון">
            <select
              className="field"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">ללא</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </LabeledField>
          <LabeledField label="אמצעי תשלום">
            <select
              className="field"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | "")}
            >
              <option value="">—</option>
              <option value="credit">אשראי</option>
              <option value="bank">חיוב בנקאי</option>
              <option value="cash">מזומן</option>
            </select>
          </LabeledField>
        </div>

        {error && <p className="text-sm text-danger-600">{error}</p>}
      </div>
    </Modal>
  );
}
