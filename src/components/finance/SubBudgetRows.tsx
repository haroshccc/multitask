/**
 * Editable list of sub-budget rows (name / amount / period / remainder views /
 * color / icon). Shared by the create-group dialog and the group-edit dialog.
 */
import { useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  BudgetIcon,
  BUDGET_ICON_KEYS,
  BUDGET_COLORS,
  budgetIconLabel,
} from "./finance-bits";
import {
  ALL_REMAINDER_UNITS,
  REMAINDER_UNIT_META,
  type BudgetPeriod,
  type RemainderUnit,
} from "@/lib/types/finance";

export interface SubRow {
  key: number;
  name: string;
  amount: string;
  period: BudgetPeriod;
  color: string;
  icon: string;
  views: RemainderUnit[];
}

export function blankSub(key: number, idx: number): SubRow {
  return {
    key,
    name: "",
    amount: "",
    period: "monthly",
    color: BUDGET_COLORS[idx % BUDGET_COLORS.length],
    icon: BUDGET_ICON_KEYS[idx % BUDGET_ICON_KEYS.length],
    views: ["month", "day"],
  };
}

export function SubBudgetRows({
  rows,
  setRows,
  addLabel = "הוסיפי תת-תקציב",
}: {
  rows: SubRow[];
  setRows: React.Dispatch<React.SetStateAction<SubRow[]>>;
  addLabel?: string;
}) {
  const keyRef = useRef(1000 + Math.floor(rows.length));

  function update(key: number, patch: Partial<SubRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function toggleView(key: number, u: RemainderUnit) {
    setRows((prev) =>
      prev.map((r) =>
        r.key === key
          ? { ...r, views: r.views.includes(u) ? r.views.filter((x) => x !== u) : [...r.views, u] }
          : r
      )
    );
  }
  function removeRow(key: number) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  return (
    <div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.key} className="rounded-lg border border-ink-200 p-2.5">
            <div className="flex items-center gap-2">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
                style={{ backgroundColor: r.color }}
              >
                <BudgetIcon name={r.icon} className="h-4 w-4" />
              </span>
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

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 ps-10">
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-ink-400">שארית:</span>
                {ALL_REMAINDER_UNITS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => toggleView(r.key, u)}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[11px] transition-colors",
                      r.views.includes(u)
                        ? "bg-primary-100 text-primary-700"
                        : "bg-ink-100 text-ink-500 hover:bg-ink-200"
                    )}
                  >
                    {REMAINDER_UNIT_META[u].label}
                  </button>
                ))}
              </div>
              <div className="flex max-w-[220px] flex-wrap items-center gap-1">
                {BUDGET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => update(r.key, { color: c })}
                    aria-label="צבע"
                    className={cn(
                      "h-4 w-4 rounded-full border",
                      r.color === c ? "border-ink-900" : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <select
                className="field !w-auto !py-1 !px-2 text-xs"
                value={r.icon}
                onChange={(e) => update(r.key, { icon: e.target.value })}
                aria-label="אייקון"
              >
                {BUDGET_ICON_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {budgetIconLabel(k)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mt-2 flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700"
        onClick={() => setRows((prev) => [...prev, blankSub(keyRef.current++, prev.length)])}
      >
        <Plus className="h-4 w-4" />
        {addLabel}
      </button>
    </div>
  );
}
