/**
 * Monthly closing (spec §3.4 / §4.5): surplus/deficit for a budget this month,
 * an auto "why" breakdown from charged expenses + a manual note, and a one-time
 * carryover transfer of the balance to another budget.
 */
import { useMemo, useState } from "react";
import { Modal, LabeledField, Money } from "./finance-bits";
import {
  activeVersion,
  monthlyAllocation,
  chargedInMonth,
  monthKey,
} from "@/lib/finance/calc";
import { useUpsertClosing, useCreateCarryover } from "@/lib/hooks/useFinance";
import type {
  FinanceBudget,
  FinanceBudgetVersion,
  FinanceOccurrence,
  FinanceExpense,
} from "@/lib/types/finance";

export function MonthlyClosingPanel({
  budget,
  versions,
  occurrences,
  expenses,
  allBudgets,
  onClose,
}: {
  budget: FinanceBudget;
  versions: FinanceBudgetVersion[];
  occurrences: FinanceOccurrence[];
  expenses: FinanceExpense[];
  allBudgets: FinanceBudget[];
  onClose: () => void;
}) {
  const upsert = useUpsertClosing();
  const carryover = useCreateCarryover();

  const version = useMemo(() => activeVersion(versions), [versions]);
  const allocated = monthlyAllocation(version);
  const charged = chargedInMonth(occurrences);
  const balance = allocated - charged;

  const reasons = useMemo(() => {
    const byExpense = new Map<string, number>();
    const start = monthKey();
    for (const o of occurrences) {
      if (o.budget_charged && o.due_date >= start) {
        byExpense.set(o.expense_id, (byExpense.get(o.expense_id) ?? 0) + Number(o.amount));
      }
    }
    const titleOf = new Map(expenses.map((e) => [e.id, e.title]));
    return [...byExpense.entries()]
      .map(([id, sum]) => ({ title: titleOf.get(id) ?? "—", sum }))
      .sort((a, b) => b.sum - a.sum);
  }, [occurrences, expenses]);

  const [note, setNote] = useState("");
  const [targetBudget, setTargetBudget] = useState("");
  const [transferAmount, setTransferAmount] = useState<number>(
    Math.abs(Math.round(balance))
  );
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function saveClosing() {
    setError(null);
    try {
      await upsert.mutateAsync({
        budget_id: budget.id,
        period_month: monthKey(),
        allocated,
        charged,
        balance,
        auto_reason: reasons.map((r) => ({ expense_title: r.title, delta: -r.sum })),
        manual_note: note.trim() || null,
        closed_at: new Date().toISOString(),
      });
      setDone(true);
    } catch (e: any) {
      setError(e?.message ?? "שגיאה בשמירה");
    }
  }

  async function doTransfer() {
    setError(null);
    if (!targetBudget) {
      setError("בחרי תקציב יעד להעברה");
      return;
    }
    try {
      await carryover.mutateAsync({
        from_budget_id: budget.id,
        to_budget_id: targetBudget,
        period_month: monthKey(),
        amount: transferAmount,
        note: note.trim() || null,
      });
      setDone(true);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "שגיאה בהעברה");
    }
  }

  return (
    <Modal
      title={`סגירה חודשית · ${budget.name}`}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="btn-ghost text-sm" onClick={onClose}>
            סגירה
          </button>
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={saveClosing}
            disabled={upsert.isPending}
          >
            {done ? "נשמר ✓" : upsert.isPending ? "שומר..." : "שמירת סגירה"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="הוקצב" value={allocated} />
          <Stat label="חויב" value={charged} />
          <Stat
            label={balance >= 0 ? "עודף" : "גרעון"}
            value={balance}
            tone={balance >= 0 ? "green" : "red"}
          />
        </div>

        <div>
          <h4 className="mb-1.5 text-xs font-semibold text-ink-600">למה (אוטומטי)</h4>
          {reasons.length === 0 ? (
            <p className="text-xs text-ink-400">לא חויבו הוצאות החודש</p>
          ) : (
            <ul className="space-y-0.5">
              {reasons.map((r, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between rounded px-2 py-1 text-sm odd:bg-ink-50"
                >
                  <span className="truncate text-ink-700">{r.title}</span>
                  <Money value={-r.sum} className="text-danger-600" />
                </li>
              ))}
            </ul>
          )}
        </div>

        <LabeledField label="הערה (ידני)">
          <textarea
            className="field min-h-[60px]"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="הסבר על העודף/הגרעון החודש"
          />
        </LabeledField>

        <div className="rounded-lg border border-ink-200 p-3">
          <h4 className="mb-2 text-xs font-semibold text-ink-600">
            העברת היתרה לתקציב אחר (חד-פעמי)
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <LabeledField label="סכום">
              <input
                type="number"
                className="field"
                value={Number.isFinite(transferAmount) ? transferAmount : 0}
                onChange={(e) => setTransferAmount(Number(e.target.value))}
                min={0}
              />
            </LabeledField>
            <LabeledField label="לתקציב">
              <select
                className="field"
                value={targetBudget}
                onChange={(e) => setTargetBudget(e.target.value)}
              >
                <option value="">בחרי…</option>
                {allBudgets
                  .filter((x) => x.id !== budget.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </select>
            </LabeledField>
          </div>
          <button
            type="button"
            className="btn-outline mt-2 text-sm"
            onClick={doTransfer}
            disabled={carryover.isPending}
          >
            {carryover.isPending ? "מעביר..." : "בצעי העברה"}
          </button>
        </div>

        {error && <p className="text-sm text-danger-600">{error}</p>}
      </div>
    </Modal>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "red";
}) {
  return (
    <div className="rounded-lg bg-ink-50 px-2 py-2.5">
      <div
        className={
          tone === "green"
            ? "text-success-600 text-lg font-bold"
            : tone === "red"
            ? "text-danger-600 text-lg font-bold"
            : "text-ink-900 text-lg font-bold"
        }
      >
        <Money value={value} />
      </div>
      <div className="text-[11px] text-ink-500">{label}</div>
    </div>
  );
}
