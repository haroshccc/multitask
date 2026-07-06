/**
 * Create a "תקציב כולל" (umbrella budget): one required name + a shared share
 * level for the whole thing, plus several sub-budgets — each with amount,
 * period, remainder views, color and icon. All created at once.
 */
import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  Modal,
  LabeledField,
  Money,
  BudgetIcon,
  BUDGET_ICON_KEYS,
  BUDGET_COLORS,
} from "./finance-bits";
import { useCreateBudgetGroup } from "@/lib/hooks/useFinance";
import {
  ALL_REMAINDER_UNITS,
  REMAINDER_UNIT_META,
  ALL_SHARE_LEVELS,
  SHARE_LEVEL_META,
  type BudgetPeriod,
  type BudgetShareLevel,
  type RemainderUnit,
} from "@/lib/types/finance";

interface SubRow {
  key: number;
  name: string;
  amount: string;
  period: BudgetPeriod;
  color: string;
  icon: string;
  views: RemainderUnit[];
}

export function CreateBudgetGroupDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateBudgetGroup();
  const keyRef = useRef(3);

  const [name, setName] = useState("");
  const [shareLevel, setShareLevel] = useState<BudgetShareLevel>("transact");
  const [subs, setSubs] = useState<SubRow[]>([
    blankSub(1, 0),
    blankSub(2, 1),
  ]);
  const [error, setError] = useState<string | null>(null);

  function blankSubNext(): SubRow {
    return blankSub(keyRef.current++, subs.length);
  }

  const total = subs.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const validSubs = subs.filter((r) => r.name.trim() && Number(r.amount) > 0);

  function update(key: number, patch: Partial<SubRow>) {
    setSubs((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function toggleView(key: number, u: RemainderUnit) {
    setSubs((prev) =>
      prev.map((r) =>
        r.key === key
          ? { ...r, views: r.views.includes(u) ? r.views.filter((x) => x !== u) : [...r.views, u] }
          : r
      )
    );
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
        share_level: shareLevel,
        subs: validSubs.map((r) => ({
          name: r.name.trim(),
          amount: Number(r.amount),
          period: r.period,
          color: r.color,
          icon: r.icon,
          remainder_views: r.views.length ? r.views : ["month"],
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
            {create.isPending ? "יוצר..." : `צור עם ${validSubs.length} תתי-תקציבים`}
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
            הרשאת שיתוף (לכל התקציב הכולל)
          </span>
          <div className="flex flex-col gap-1.5 sm:flex-row">
            {ALL_SHARE_LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setShareLevel(lvl)}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-2 text-start text-sm font-medium transition-colors",
                  shareLevel === lvl
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-ink-300 text-ink-800 hover:bg-ink-50"
                )}
              >
                {SHARE_LEVEL_META[lvl].label}
              </button>
            ))}
          </div>
          <span className="mt-1 block text-[11px] text-ink-400">
            {SHARE_LEVEL_META[shareLevel].hint} · חל רק כששיתוף ההתנהלות הכלכלית פעיל בארגון.
          </span>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-600">
            תתי-תקציבים
          </span>
          <div className="space-y-3">
            {subs.map((r) => (
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
                  {/* remainder views */}
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
                  {/* color */}
                  <div className="flex items-center gap-1">
                    {BUDGET_COLORS.slice(0, 6).map((c) => (
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
                  {/* icon */}
                  <select
                    className="field !w-auto !py-1 !px-2 text-xs"
                    value={r.icon}
                    onChange={(e) => update(r.key, { icon: e.target.value })}
                    aria-label="אייקון"
                  >
                    {BUDGET_ICON_KEYS.map((k) => (
                      <option key={k} value={k}>
                        {k}
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
            onClick={() => setSubs((prev) => [...prev, blankSubNext()])}
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

function blankSub(key: number, idx: number): SubRow {
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
