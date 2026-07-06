/**
 * Create a budget, or edit one in "version mode" — editing the amount/period
 * forces a titled version (spec §3.2). Presentation fields update in place.
 */
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import {
  Modal,
  LabeledField,
  BudgetIcon,
  BUDGET_ICON_KEYS,
  BUDGET_COLORS,
} from "./finance-bits";
import {
  useCreateBudget,
  useUpdateBudget,
  useAddBudgetVersion,
} from "@/lib/hooks/useFinance";
import {
  ALL_REMAINDER_UNITS,
  REMAINDER_UNIT_META,
  ALL_SHARE_LEVELS,
  SHARE_LEVEL_META,
  type FinanceBudget,
  type FinanceBudgetVersion,
  type BudgetPeriod,
  type RemainderUnit,
  type BudgetShareLevel,
} from "@/lib/types/finance";

interface Props {
  existing?: { budget: FinanceBudget; version: FinanceBudgetVersion | null };
  onClose: () => void;
}

export function BudgetEditDialog({ existing, onClose }: Props) {
  const create = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const addVersion = useAddBudgetVersion();

  const b = existing?.budget;
  const v = existing?.version;

  const [name, setName] = useState(b?.name ?? "");
  const [icon, setIcon] = useState(b?.icon ?? "wallet");
  const [color, setColor] = useState(b?.color ?? BUDGET_COLORS[0]);
  const [category, setCategory] = useState(b?.category ?? "");
  const [views, setViews] = useState<RemainderUnit[]>(
    b?.remainder_views ?? ["month", "day"]
  );
  const [amount, setAmount] = useState<number>(v?.amount ?? 0);
  const [period, setPeriod] = useState<BudgetPeriod>(v?.period ?? "monthly");
  const [versionTitle, setVersionTitle] = useState("");
  const [shareLevel, setShareLevel] = useState<BudgetShareLevel>(b?.share_level ?? "transact");
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!b;
  const amountChanged = !!v && (amount !== v.amount || period !== v.period);
  const busy = create.isPending || updateBudget.isPending || addVersion.isPending;

  function toggleView(u: RemainderUnit) {
    setViews((prev) =>
      prev.includes(u) ? prev.filter((x) => x !== u) : [...prev, u]
    );
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("יש לתת שם לתקציב");
      return;
    }
    try {
      if (!isEdit) {
        if (!versionTitle.trim()) {
          setError("יש לתת כותרת לגרסת התקציב");
          return;
        }
        await create.mutateAsync({
          name: name.trim(),
          icon,
          color,
          category: category.trim() || null,
          share_level: shareLevel,
          remainder_views: views.length ? views : ["month"],
          title: versionTitle.trim(),
          amount,
          period,
        });
      } else {
        await updateBudget.mutateAsync({
          budgetId: b!.id,
          patch: {
            name: name.trim(),
            icon,
            color,
            category: category.trim() || null,
            share_level: shareLevel,
            remainder_views: views.length ? views : ["month"],
          },
        });
        if (amountChanged) {
          if (!versionTitle.trim()) {
            setError("שינוי הסכום/התקופה מחייב כותרת לגרסה החדשה");
            return;
          }
          await addVersion.mutateAsync({
            budget_id: b!.id,
            title: versionTitle.trim(),
            amount,
            period,
          });
        }
      }
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "שגיאה בשמירה");
    }
  }

  return (
    <Modal
      title={isEdit ? "עריכת תקציב" : "תקציב חדש"}
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
            disabled={busy}
          >
            {busy ? "שומר..." : "שמירה"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <LabeledField label="שם התקציב">
          <input
            className="field"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="למשל: אוכל, רכב, שיעורי גיטרה"
            autoFocus
          />
        </LabeledField>

        <div className="grid grid-cols-2 gap-3">
          <LabeledField label="סכום">
            <input
              type="number"
              className="field"
              value={Number.isFinite(amount) ? amount : 0}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={0}
            />
          </LabeledField>
          <LabeledField label="תקופה">
            <select
              className="field"
              value={period}
              onChange={(e) => setPeriod(e.target.value as BudgetPeriod)}
            >
              <option value="monthly">חודשי</option>
              <option value="yearly">שנתי (מתחלק ל-12)</option>
            </select>
          </LabeledField>
        </div>

        {(!isEdit || amountChanged) && (
          <LabeledField
            label="כותרת לגרסת התקציב"
            hint="כל שינוי סכום נשמר כגרסה עם כותרת — לשמירת היסטוריה"
          >
            <input
              className="field"
              value={versionTitle}
              onChange={(e) => setVersionTitle(e.target.value)}
              placeholder='למשל: "תקציב 2026" / "עדכון אחרי העלאה"'
            />
          </LabeledField>
        )}

        <LabeledField label="קטגוריה (לא חובה)">
          <input
            className="field"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="לסינון"
          />
        </LabeledField>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-600">תצוגת שארית</span>
          <div className="flex gap-2">
            {ALL_REMAINDER_UNITS.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => toggleView(u)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  views.includes(u)
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-ink-300 text-ink-600 hover:bg-ink-50"
                )}
              >
                {REMAINDER_UNIT_META[u].label}
              </button>
            ))}
          </div>
        </div>

        {/* Share level lives on the containing "תקציב כולל" for grouped
            budgets — only ungrouped single budgets configure it here. */}
        {!b?.group_id && (
          <div>
            <span className="mb-1.5 block text-xs font-medium text-ink-600">
              הרשאת שיתוף לחברים אחרים
            </span>
            <div className="flex flex-col gap-1.5 sm:flex-row">
              {ALL_SHARE_LEVELS.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setShareLevel(lvl)}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-start transition-colors",
                    shareLevel === lvl
                      ? "border-primary-500 bg-primary-50"
                      : "border-ink-300 hover:bg-ink-50"
                  )}
                >
                  <span
                    className={cn(
                      "block text-sm font-medium",
                      shareLevel === lvl ? "text-primary-700" : "text-ink-800"
                    )}
                  >
                    {SHARE_LEVEL_META[lvl].label}
                  </span>
                </button>
              ))}
            </div>
            <span className="mt-1 block text-[11px] text-ink-400">
              {SHARE_LEVEL_META[shareLevel].hint} · חל רק כששיתוף ההתנהלות הכלכלית פעיל בארגון.
            </span>
          </div>
        )}

        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-600">צבע ואייקון</span>
          <div className="flex flex-wrap gap-1.5">
            {BUDGET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  "h-7 w-7 rounded-full border-2",
                  color === c ? "border-ink-900" : "border-transparent"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {BUDGET_ICON_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setIcon(k)}
                className={cn(
                  "rounded-lg border p-2 transition-colors",
                  icon === k
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-ink-300 text-ink-500 hover:bg-ink-50"
                )}
              >
                <BudgetIcon name={k} className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-danger-600">{error}</p>}
      </div>
    </Modal>
  );
}
