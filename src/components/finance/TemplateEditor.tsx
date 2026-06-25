/**
 * Template manager (spec §6): create / edit / delete expense templates with
 * pre-filled defaults to speed up "recurring-variable" entry.
 */
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Modal, LabeledField } from "./finance-bits";
import {
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
} from "@/lib/hooks/useFinance";
import type {
  FinanceExpenseTemplate,
  FinanceBudget,
  FinanceAccount,
  PaymentMethod,
  BudgetChargeMode,
  WithdrawalTiming,
} from "@/lib/types/finance";

export function TemplateList({
  templates,
  budgets,
  accounts,
}: {
  templates: FinanceExpenseTemplate[];
  budgets: FinanceBudget[];
  accounts: FinanceAccount[];
}) {
  const del = useDeleteTemplate();
  const [editing, setEditing] = useState<FinanceExpenseTemplate | "new" | null>(null);

  const budgetName = (id: string | null) => budgets.find((b) => b.id === id)?.name;
  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name;

  return (
    <div className="space-y-3">
      <button
        type="button"
        className="btn-primary flex items-center gap-1.5 text-sm"
        onClick={() => setEditing("new")}
      >
        <Plus className="h-4 w-4" />
        שבלונה חדשה
      </button>

      {templates.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-400">אין שבלונות עדיין</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <div key={t.id} className="card p-3">
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-medium text-ink-900">{t.name}</h4>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(t)}
                    className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => del.mutate(t.id)}
                    className="rounded p-1 text-ink-400 hover:bg-danger-50 hover:text-danger-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <ul className="mt-1.5 space-y-0.5 text-[11px] text-ink-500">
                {budgetName(t.budget_id) && <li>תקציב: {budgetName(t.budget_id)}</li>}
                {accountName(t.account_id) && <li>חשבון: {accountName(t.account_id)}</li>}
                {t.default_amount != null && <li>סכום ברירת מחדל: {t.default_amount} ₪</li>}
              </ul>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <TemplateDialog
          template={editing === "new" ? null : editing}
          budgets={budgets}
          accounts={accounts}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function TemplateDialog({
  template,
  budgets,
  accounts,
  onClose,
}: {
  template: FinanceExpenseTemplate | null;
  budgets: FinanceBudget[];
  accounts: FinanceAccount[];
  onClose: () => void;
}) {
  const create = useCreateTemplate();
  const update = useUpdateTemplate();

  const [name, setName] = useState(template?.name ?? "");
  const [budgetId, setBudgetId] = useState(template?.budget_id ?? "");
  const [accountId, setAccountId] = useState(template?.account_id ?? "");
  const [payment, setPayment] = useState<PaymentMethod | "">(template?.payment_method ?? "");
  const [amount, setAmount] = useState<number | "">(template?.default_amount ?? "");
  const [chargeMode, setChargeMode] = useState<BudgetChargeMode | "">(
    template?.budget_charge_mode ?? ""
  );
  const [timing, setTiming] = useState<WithdrawalTiming | "">(
    template?.withdrawal_timing ?? ""
  );
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!name.trim()) {
      setError("יש לתת שם לשבלונה");
      return;
    }
    const patch = {
      name: name.trim(),
      budget_id: budgetId || null,
      account_id: accountId || null,
      payment_method: (payment || null) as PaymentMethod | null,
      default_amount: amount === "" ? null : Number(amount),
      budget_charge_mode: (chargeMode || null) as BudgetChargeMode | null,
      withdrawal_timing: (timing || null) as WithdrawalTiming | null,
    };
    try {
      if (template) await update.mutateAsync({ id: template.id, patch });
      else await create.mutateAsync(patch);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "שגיאה");
    }
  }

  return (
    <Modal
      title={template ? "עריכת שבלונה" : "שבלונה חדשה"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-ghost text-sm" onClick={onClose}>
            ביטול
          </button>
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={save}
            disabled={create.isPending || update.isPending}
          >
            שמירה
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <LabeledField label="שם השבלונה">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </LabeledField>
        <div className="grid grid-cols-2 gap-3">
          <LabeledField label="תקציב ברירת מחדל">
            <select className="field" value={budgetId} onChange={(e) => setBudgetId(e.target.value)}>
              <option value="">—</option>
              {budgets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </LabeledField>
          <LabeledField label="חשבון ברירת מחדל">
            <select className="field" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">—</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </LabeledField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <LabeledField label="אמצעי תשלום">
            <select className="field" value={payment} onChange={(e) => setPayment(e.target.value as PaymentMethod | "")}>
              <option value="">—</option>
              <option value="credit">אשראי</option>
              <option value="bank">חיוב בנקאי</option>
              <option value="cash">מזומן</option>
            </select>
          </LabeledField>
          <LabeledField label="סכום משוער">
            <input
              type="number"
              className="field"
              value={amount}
              onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </LabeledField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <LabeledField label="חיוב לתקציב">
            <select className="field" value={chargeMode} onChange={(e) => setChargeMode(e.target.value as BudgetChargeMode | "")}>
              <option value="">—</option>
              <option value="auto">אוטומטי</option>
              <option value="manual_check">ידני</option>
            </select>
          </LabeledField>
          <LabeledField label="ירידה מהחשבון">
            <select className="field" value={timing} onChange={(e) => setTiming(e.target.value as WithdrawalTiming | "")}>
              <option value="">—</option>
              <option value="immediate">מיידי</option>
              <option value="future_date">עתידי</option>
            </select>
          </LabeledField>
        </div>
        {error && <p className="text-sm text-danger-600">{error}</p>}
      </div>
    </Modal>
  );
}
