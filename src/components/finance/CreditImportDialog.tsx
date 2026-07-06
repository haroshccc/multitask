/**
 * Bulk credit-card import. Pick the source account, paste (or type) statement
 * rows, assign each to a budget, and import — one expense+occurrence per row.
 * The credit-company type becomes the occurrence note; the deduction date can
 * be past (already withdrawn) or future (pending).
 */
import { useRef, useState } from "react";
import { Plus, Trash2, Upload, Zap, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Modal, LabeledField } from "./finance-bits";
import { useImportCreditRows, useCreditImports } from "@/lib/hooks/useFinance";
import { parseCreditText } from "@/lib/finance/import";
import { toDateKey } from "@/lib/finance/calc";
import type { FinanceAccount, FinanceBudget } from "@/lib/types/finance";

interface EditRow {
  key: number;
  chargeDate: string; // budget charge date
  withdrawDate: string; // account deduction date
  title: string;
  amount: string;
  note: string;
  budgetId: string;
}

export function CreditImportDialog({
  accounts,
  budgets,
  onClose,
}: {
  accounts: FinanceAccount[];
  budgets: FinanceBudget[];
  onClose: () => void;
}) {
  const importRows = useImportCreditRows();
  const existingImports = useCreditImports();
  const keyRef = useRef(1);
  const today = toDateKey(new Date());

  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [importedOn, setImportedOn] = useState(today);
  const [paste, setPaste] = useState("");
  const [rows, setRows] = useState<EditRow[]>([]);
  const [defaultBudget, setDefaultBudget] = useState("");
  const [error, setError] = useState<string | null>(null);

  // duplicate guard: warn if an import from the same account on the same date exists
  const duplicate = (existingImports.data ?? []).some(
    (imp) => imp.account_id === accountId && imp.imported_on === importedOn
  );

  const newRow = (r?: Partial<EditRow>): EditRow => ({
    key: keyRef.current++,
    chargeDate: r?.chargeDate ?? today,
    withdrawDate: r?.withdrawDate ?? today,
    title: r?.title ?? "",
    amount: r?.amount ?? "",
    note: r?.note ?? "",
    budgetId: r?.budgetId ?? defaultBudget,
  });

  function handleParse() {
    const parsed = parseCreditText(paste);
    if (!parsed.length) {
      setError("לא זוהו שורות. אפשר להוסיף שורות ידנית.");
      return;
    }
    setRows((prev) => [
      ...prev,
      ...parsed.map((p) =>
        newRow({
          chargeDate: p.chargeDate || today,
          withdrawDate: p.withdrawDate || p.chargeDate || today,
          title: p.title,
          amount: p.amount != null ? String(p.amount) : "",
          note: p.note,
        })
      ),
    ]);
    setPaste("");
    setError(null);
  }

  function update(key: number, patch: Partial<EditRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function remove(key: number) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  const validRows = rows.filter((r) => r.budgetId && Number(r.amount) > 0);
  const missingBudget = rows.some((r) => Number(r.amount) > 0 && !r.budgetId);

  async function handleImport() {
    setError(null);
    if (!accountId) {
      setError("בחרי חשבון שממנו יורדות ההוצאות");
      return;
    }
    if (!validRows.length) {
      setError("אין שורות תקינות (צריך סכום ותקציב לכל שורה)");
      return;
    }
    try {
      const n = await importRows.mutateAsync({
        account_id: accountId,
        imported_on: importedOn,
        rows: validRows.map((r) => ({
          charge_date: r.chargeDate,
          withdrawal_date: r.withdrawDate,
          title: r.title.trim(),
          amount: Number(r.amount),
          note: r.note.trim(),
          budget_id: r.budgetId,
        })),
      });
      void n;
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "שגיאה בייבוא");
    }
  }

  return (
    <Modal
      title="ייבוא הוצאות מאשראי"
      onClose={onClose}
      size="xl"
      footer={
        <>
          <span className="me-auto text-xs text-ink-400">
            {validRows.length} מתוך {rows.length} שורות מוכנות לייבוא
          </span>
          <button type="button" className="btn-ghost text-sm" onClick={onClose}>
            ביטול
          </button>
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={handleImport}
            disabled={importRows.isPending || !validRows.length}
          >
            {importRows.isPending ? "מייבא..." : `ייבא ${validRows.length} הוצאות`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <LabeledField label="החשבון שממנו יורד (אשראי)">
            <select
              className="field"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              {accounts.length === 0 && <option value="">אין חשבונות</option>}
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </LabeledField>
          <LabeledField label="תאריך הייבוא">
            <input
              type="date"
              className="field"
              value={importedOn}
              onChange={(e) => setImportedOn(e.target.value)}
            />
          </LabeledField>
          <LabeledField label="תקציב ברירת מחדל (לא חובה)">
            <select
              className="field"
              value={defaultBudget}
              onChange={(e) => setDefaultBudget(e.target.value)}
            >
              <option value="">— בחירה ידנית —</option>
              {budgets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </LabeledField>
        </div>

        {duplicate && (
          <p className="rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">
            ⚠️ כבר יש ייבוא מהחשבון הזה בתאריך הזה — בדקי בהיסטוריה (טאב היסטוריה) כדי לא לייבא כפול.
          </p>
        )}

        <LabeledField
          label="הדבקת שורות מדף האשראי"
          hint="כל שורה: תאריך · שם בית עסק · סכום · (סוג). נזהה אוטומטית — ותמיד אפשר לתקן בטבלה."
        >
          <textarea
            className="field min-h-[70px] font-mono text-xs"
            dir="ltr"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={"01/07/2025\tסופר רמי לוי\t234.50\tמזון\n03/07/2025\tדלק פז\t180\tרכב"}
          />
          <button
            type="button"
            className="btn-outline mt-2 flex items-center gap-1.5 text-sm"
            onClick={handleParse}
          >
            <Upload className="h-4 w-4" />
            נתחי והוסיפי לטבלה
          </button>
        </LabeledField>

        {/* editable table */}
        <div className="overflow-x-auto rounded-lg border border-ink-200">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="bg-ink-50 text-xs text-ink-500">
                <th className="p-2 text-start font-medium">תאריך חיוב</th>
                <th className="p-2 text-start font-medium">תאריך הורדה</th>
                <th className="p-2 text-start font-medium">שם</th>
                <th className="p-2 text-start font-medium">סכום</th>
                <th className="p-2 text-start font-medium">הערה (סוג באשראי)</th>
                <th className="p-2 text-start font-medium">תקציב</th>
                <th className="w-8 p-2" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-xs text-ink-400">
                    הדביקי שורות למעלה או הוסיפי שורה ידנית
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const future = r.withdrawDate > today;
                  const rowInvalid = Number(r.amount) > 0 && !r.budgetId;
                  return (
                    <tr key={r.key} className="border-t border-ink-100">
                      <td className="p-1.5">
                        <input
                          type="date"
                          className="field !py-1 !px-1.5 text-xs"
                          value={r.chargeDate}
                          onChange={(e) => update(r.key, { chargeDate: e.target.value })}
                          title="התאריך שבו זה נזקף לתקציב"
                        />
                      </td>
                      <td className="p-1.5">
                        <div className="flex items-center gap-1">
                          {future ? (
                            <CalendarClock className="h-3 w-3 shrink-0 text-ink-400" />
                          ) : (
                            <Zap className="h-3 w-3 shrink-0 text-success-500" />
                          )}
                          <input
                            type="date"
                            className="field !py-1 !px-1.5 text-xs"
                            value={r.withdrawDate}
                            onChange={(e) => update(r.key, { withdrawDate: e.target.value })}
                            title="התאריך שבו הכסף יורד מהחשבון"
                          />
                        </div>
                      </td>
                      <td className="p-1.5">
                        <input
                          className="field !py-1 !px-1.5 text-xs"
                          value={r.title}
                          onChange={(e) => update(r.key, { title: e.target.value })}
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="number"
                          className="field !py-1 !px-1.5 w-24 text-xs"
                          value={r.amount}
                          onChange={(e) => update(r.key, { amount: e.target.value })}
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          className="field !py-1 !px-1.5 text-xs"
                          value={r.note}
                          onChange={(e) => update(r.key, { note: e.target.value })}
                        />
                      </td>
                      <td className="p-1.5">
                        <select
                          className={cn(
                            "field !py-1 !px-1.5 text-xs",
                            rowInvalid && "!border-danger-400"
                          )}
                          value={r.budgetId}
                          onChange={(e) => update(r.key, { budgetId: e.target.value })}
                        >
                          <option value="">— בחרי —</option>
                          {budgets.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => remove(r.key)}
                          aria-label="מחקי שורה"
                          className="rounded p-1 text-ink-300 hover:bg-danger-50 hover:text-danger-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700"
            onClick={() => setRows((prev) => [...prev, newRow()])}
          >
            <Plus className="h-4 w-4" />
            הוסיפי שורה
          </button>
          {future_hint(rows, today)}
        </div>

        {missingBudget && (
          <p className="text-xs text-danger-600">
            יש שורות עם סכום ללא תקציב — הן לא ייובאו עד שתבחרי תקציב.
          </p>
        )}
        {error && <p className="text-sm text-danger-600">{error}</p>}
      </div>
    </Modal>
  );
}

function future_hint(rows: EditRow[], today: string) {
  const future = rows.filter((r) => r.withdrawDate > today && Number(r.amount) > 0).length;
  if (!future) return null;
  return (
    <span className="text-xs text-ink-400">
      {future} שורות עם הורדה עתידית — יסומנו כטרם ירדו מהחשבון
    </span>
  );
}
