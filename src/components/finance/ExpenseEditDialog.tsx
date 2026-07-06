/**
 * Edit a single expense occurrence — fix a mistake, change the amount/dates,
 * move it to another budget, or change which account it comes out of.
 *
 * For a recurring expense (many occurrences) the user chooses the scope: just
 * this occurrence or all of them — same for delete. A timeline of the other
 * occurrences (past & future) is shown for context. Deletes are undoable.
 */
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Modal, LabeledField, Money } from "./finance-bits";
import {
  useUpdateExpense,
  useUpdateOccurrence,
  useDeleteOccurrence,
  useRecreateOccurrence,
} from "@/lib/hooks/useFinance";
import { pushUndo } from "@/lib/undo/store";
import { toast } from "@/components/ui/Toast";
import { toDateKey } from "@/lib/finance/calc";
import type {
  FinanceOccurrence,
  FinanceExpense,
  FinanceBudget,
  FinanceAccount,
} from "@/lib/types/finance";

type Scope = "one" | "all";

export function ExpenseEditDialog({
  occ,
  expense,
  siblings,
  budgets,
  accounts,
  onClose,
}: {
  occ: FinanceOccurrence;
  expense?: FinanceExpense;
  siblings: FinanceOccurrence[];
  budgets: FinanceBudget[];
  accounts: FinanceAccount[];
  onClose: () => void;
}) {
  const updateExpense = useUpdateExpense();
  const updateOcc = useUpdateOccurrence();
  const deleteOcc = useDeleteOccurrence();
  const recreateOcc = useRecreateOccurrence();

  const recurring = siblings.length > 1;

  const [title, setTitle] = useState(expense?.title ?? "");
  const [amount, setAmount] = useState<string>(String(occ.amount));
  const [budgetId, setBudgetId] = useState(occ.budget_id);
  const [accountId, setAccountId] = useState(occ.account_id ?? "");
  const [chargeDate, setChargeDate] = useState(occ.due_date);
  const [withdrawDate, setWithdrawDate] = useState(occ.withdrawal_date ?? occ.due_date);
  const [note, setNote] = useState(occ.note ?? "");
  const [scope, setScope] = useState<Scope>("one");
  const [error, setError] = useState<string | null>(null);

  const busy = updateExpense.isPending || updateOcc.isPending || deleteOcc.isPending;

  const ordered = [...siblings].sort((a, b) => (a.due_date < b.due_date ? -1 : 1));

  async function handleSave() {
    setError(null);
    const amt = Number(amount);
    if (!(amt > 0)) {
      setError("סכום חייב להיות חיובי");
      return;
    }
    try {
      // the expense record (shared name / defaults)
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

      if (recurring && scope === "all") {
        // amount / budget / account / note across every occurrence (keep each
        // occurrence's own dates)
        for (const s of ordered) {
          await updateOcc.mutateAsync({
            occ: s,
            patch: {
              amount: amt,
              budget_id: budgetId,
              account_id: accountId || null,
              note: note.trim() || null,
            },
          });
        }
      } else {
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
      }
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "שגיאה בשמירה");
    }
  }

  async function handleDelete() {
    setError(null);
    const targets = recurring && scope === "all" ? ordered : [occ];
    try {
      for (const t of targets) await deleteOcc.mutateAsync(t);
      pushUndo({
        description:
          targets.length > 1
            ? `מחיקת ${targets.length} מופעים של "${expense?.title ?? ""}"`
            : `מחיקת הוצאה "${expense?.title ?? ""}"`,
        undo: async () => {
          for (const t of targets) await recreateOcc.mutateAsync(t);
        },
        redo: async () => {
          for (const t of targets) await deleteOcc.mutateAsync(t);
        },
      });
      toast(
        targets.length > 1
          ? `${targets.length} מופעים נמחקו · Ctrl+Z לשחזור`
          : "ההוצאה נמחקה · Ctrl+Z לשחזור",
        "info"
      );
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "שגיאה במחיקה");
    }
  }

  const today = toDateKey(new Date());

  return (
    <Modal
      title={recurring ? "עריכת הוצאה חוזרת" : "עריכת הוצאה"}
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
            {recurring && scope === "all" ? "מחק את כולן" : "מחק הוצאה"}
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
        {recurring && (
          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink-600">
              החל על (הוצאה חוזרת)
            </span>
            <div className="flex gap-1.5">
              {(
                [
                  { id: "one", label: "רק המופע הזה" },
                  { id: "all", label: `כל המופעים (${siblings.length})` },
                ] as { id: Scope; label: string }[]
              ).map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setScope(o.id)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    scope === o.id
                      ? "border-primary-500 bg-primary-50 text-primary-700"
                      : "border-ink-300 text-ink-800 hover:bg-ink-50"
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {scope === "all" && (
              <span className="mt-1 block text-[11px] text-ink-400">
                הסכום / התקציב / החשבון / ההערה יחולו על כל המופעים (התאריכים נשמרים לכל מופע).
              </span>
            )}
          </div>
        )}

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

        {scope === "one" && (
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
        )}

        <LabeledField label="הערה">
          <input className="field" value={note} onChange={(e) => setNote(e.target.value)} />
        </LabeledField>

        {recurring && (
          <details className="rounded-lg border border-ink-200">
            <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-ink-600">
              מופעים אחורה וקדימה ({siblings.length})
            </summary>
            <div className="max-h-48 overflow-y-auto px-2 pb-2">
              {ordered.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    "flex items-center justify-between rounded px-2 py-1 text-sm",
                    s.id === occ.id ? "bg-primary-50" : "odd:bg-ink-50"
                  )}
                >
                  <span className="text-xs tabular-nums text-ink-500" dir="ltr">
                    {s.due_date}
                  </span>
                  <span className="flex items-center gap-2">
                    <Money value={Number(s.amount)} className="text-ink-700" />
                    <span className="text-[10px] text-ink-400">
                      {s.withdrawn ? "שולם" : s.due_date > today ? "עתידי" : "פתוח"}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}

        {error && <p className="text-sm text-danger-600">{error}</p>}
      </div>
    </Modal>
  );
}
