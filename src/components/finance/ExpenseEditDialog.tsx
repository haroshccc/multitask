/**
 * Edit a single expense occurrence — fix a mistake, change the amount/dates,
 * move it to another budget, or change which account it comes out of. Also
 * deletes the expense (with undo).
 */
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Modal, LabeledField } from "./finance-bits";
import {
  useUpdateExpense,
  useUpdateOccurrence,
  useDeleteOccurrence,
  useRecreateOccurrence,
} from "@/lib/hooks/useFinance";
import { pushUndo } from "@/lib/undo/store";
import { toast } from "@/components/ui/Toast";
import type {
  FinanceOccurrence,
  FinanceExpense,
  FinanceBudget,
  FinanceAccount,
} from "@/lib/types/finance";

export function ExpenseEditDialog({
  occ,
  expense,
  budgets,
  accounts,
  onClose,
}: {
  occ: FinanceOccurrence;
  expense?: FinanceExpense;
  budgets: FinanceBudget[];
  accounts: FinanceAccount[];
  onClose: () => void;
}) {
  const updateExpense = useUpdateExpense();
  const updateOcc = useUpdateOccurrence();
  const deleteOcc = useDeleteOccurrence();
  const recreateOcc = useRecreateOccurrence();

  const [title, setTitle] = useState(expense?.title ?? "");
  const [amount, setAmount] = useState<string>(String(occ.amount));
  const [budgetId, setBudgetId] = useState(occ.budget_id);
  const [accountId, setAccountId] = useState(occ.account_id ?? "");
  const [chargeDate, setChargeDate] = useState(occ.due_date);
  const [withdrawDate, setWithdrawDate] = useState(occ.withdrawal_date ?? occ.due_date);
  const [note, setNote] = useState(occ.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const busy = updateExpense.isPending || updateOcc.isPending || deleteOcc.isPending;

  async function handleSave() {
    setError(null);
    const amt = Number(amount);
    if (!(amt > 0)) {
      setError("סכום חייב להיות חיובי");
      return;
    }
    try {
      if (expense) {
        await updateExpense.mutateAsync({
          expenseId: expense.id,
          patch: {
            title: title.trim() || expense.title,
            budget_id: budgetId,
            account_id: accountId || null,
            default_amount: amt,
          },
        });
      }
      await updateOcc.mutateAsync({
        occ,
        patch: {
          amount: amt,
          budget_id: budgetId,
          account_id: accountId || null,
          due_date: chargeDate,
          withdrawal_date: withdrawDate,
          note: note.trim() || null,
        },
      });
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "שגיאה בשמירה");
    }
  }

  async function handleDelete() {
    setError(null);
    const snapshot = occ;
    try {
      await deleteOcc.mutateAsync(occ);
      pushUndo({
        description: `מחיקת הוצאה "${expense?.title ?? ""}"`,
        undo: async () => {
          await recreateOcc.mutateAsync(snapshot);
        },
        redo: async () => {
          await deleteOcc.mutateAsync(snapshot);
        },
      });
      toast(`ההוצאה נמחקה · Ctrl+Z לשחזור`, "info");
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "שגיאה במחיקה");
    }
  }

  return (
    <Modal
      title="עריכת הוצאה"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="me-auto flex items-center gap-1.5 text-sm text-danger-600 hover:text-danger-700"
            onClick={handleDelete}
            disabled={busy}
          >
            <Trash2 className="h-4 w-4" />
            מחק הוצאה
          </button>
          <button type="button" className="btn-ghost text-sm" onClick={onClose}>
            ביטול
          </button>
          <button type="button" className="btn-primary text-sm" onClick={handleSave} disabled={busy}>
            שמירה
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <LabeledField label="שם ההוצאה">
            <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </LabeledField>
          <LabeledField label="סכום">
            <input
              type="number"
              className="field"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min={0}
            />
          </LabeledField>
        </div>

        <LabeledField label="תקציב (אפשר להעביר לתקציב אחר)">
          <select className="field" value={budgetId} onChange={(e) => setBudgetId(e.target.value)}>
            {budgets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </LabeledField>

        <LabeledField label="מאיזה חשבון יורד">
          <select className="field" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">ללא</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </LabeledField>

        <div className="grid grid-cols-2 gap-3">
          <LabeledField label="תאריך חיוב (לתקציב)">
            <input
              type="date"
              className="field"
              value={chargeDate}
              onChange={(e) => setChargeDate(e.target.value)}
            />
          </LabeledField>
          <LabeledField label="תאריך הורדה (מהחשבון)">
            <input
              type="date"
              className="field"
              value={withdrawDate}
              onChange={(e) => setWithdrawDate(e.target.value)}
            />
          </LabeledField>
        </div>

        <LabeledField label="הערה">
          <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
        </LabeledField>

        {error && <p className="text-sm text-danger-600">{error}</p>}
      </div>
    </Modal>
  );
}
