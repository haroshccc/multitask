/**
 * Create a "תקציב כולל" (umbrella budget): one required name + several
 * sub-budgets, all at once. Each sub-budget becomes a normal budget linked to
 * the group; the group's total is the sum of its sub-budgets.
 */
import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal, LabeledField, Money, BUDGET_COLORS } from "./finance-bits";
import { useCreateBudgetGroup } from "@/lib/hooks/useFinance";
import type { BudgetPeriod } from "@/lib/types/finance";

interface SubRow {
  key: number;
  name: string;
  amount: string;
  period: BudgetPeriod;
}

export function CreateBudgetGroupDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateBudgetGroup();
  const keyRef = useRef(3);

  const [name, setName] = useState("");
  const [subs, setSubs] = useState<SubRow[]>([
    { key: 1, name: "", amount: "", period: "monthly" },
    { key: 2, name: "", amount: "", period: "monthly" },
  ]);
  const [error, setError] = useState<string | null>(null);

  const total = subs.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const validSubs = subs.filter((r) => r.name.trim() && Number(r.amount) > 0);

  function update(key: number, patch: Partial<SubRow>) {
    setSubs((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setSubs((prev) => [
      ...prev,
      { key: keyRef.current++, name: "", amount: "", period: "monthly" },
    ]);
  }
  function removeRow(key: number) {
    setSubs((prev) => prev.filter((r) => r.key !== key));
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("יש לתת שם לתקציב הכולל");
      return;
    }
    if (!validSubs.length) {
      setError("הוסיפי לפחות תת-תקציב אחד עם שם וסכום");
      return;
    }
    try {
      await create.mutateAsync({
        name: name.trim(),
        subs: validSubs.map((r, i) => ({
          name: r.name.trim(),
          amount: Number(r.amount),
          period: r.period,
          color: BUDGET_COLORS[i % BUDGET_COLORS.length],
          remainder_views: ["month", "day"],
        })),
      });
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "שגיאה בשמירה");
    }
  }

  return (
    <Modal
      title="תקציב כולל חדש"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <span className="me-auto text-xs text-ink-500">
            סה״כ: <Money value={total} />
          </span>
          <button type="button" className="btn-ghost text-sm" onClick={onClose}>
            ביטול
          </button>
          <button
            type="button"
            className="btn-primary text-sm"
            onClick={handleSave}
            disabled={create.isPending}
          >
            {create.isPending ? "יוצר..." : `צור תקציב עם ${validSubs.length} תתי-תקציבים`}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <LabeledField label="שם התקציב הכולל" hint="למשל: תקציב 2026 / תקציב חודשי">
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="שם חובה"
            autoFocus
          />
        </LabeledField>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-600">
            תתי-תקציבים
          </span>
          <div className="space-y-2">
            {subs.map((r) => (
              <div key={r.key} className="flex items-center gap-2">
                <input
                  className="field flex-1"
                  value={r.name}
                  onChange={(e) => update(r.key, { name: e.target.value })}
                  placeholder="שם (אוכל, רכב...)"
                />
                <input
                  type="number"
                  className="field w-24"
                  value={r.amount}
                  onChange={(e) => update(r.key, { amount: e.target.value })}
                  placeholder="סכום"
                  min={0}
                />
                <select
                  className="field w-24"
                  value={r.period}
                  onChange={(e) => update(r.key, { period: e.target.value as BudgetPeriod })}
                >
                  <option value="monthly">חודשי</option>
                  <option value="yearly">שנתי</option>
                </select>
                <button
                  type="button"
                  onClick={() => removeRow(r.key)}
                  aria-label="הסר תת-תקציב"
                  className="shrink-0 rounded p-1.5 text-ink-300 hover:bg-danger-50 hover:text-danger-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="mt-2 flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700"
            onClick={addRow}
          >
            <Plus className="h-4 w-4" />
            הוסיפי תת-תקציב
          </button>
        </div>

        {error && <p className="text-sm text-danger-600">{error}</p>}
      </div>
    </Modal>
  );
}
