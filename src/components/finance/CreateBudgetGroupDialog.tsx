/**
 * Create a "תקציב כולל" (umbrella budget): one required name + a shared share
 * level for the whole thing, plus several sub-budgets — each with amount,
 * period, remainder views, color and icon. All created at once.
 */
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Modal, LabeledField, Money } from "./finance-bits";
import { SubBudgetRows, blankSub, type SubRow } from "./SubBudgetRows";
import { useCreateBudgetGroup } from "@/lib/hooks/useFinance";
import {
  ALL_SHARE_LEVELS,
  SHARE_LEVEL_META,
  type BudgetShareLevel,
} from "@/lib/types/finance";

export function CreateBudgetGroupDialog({ onClose }: { onClose: () => void }) {
  const create = useCreateBudgetGroup();

  const [name, setName] = useState("");
  const [shareLevel, setShareLevel] = useState<BudgetShareLevel>("transact");
  const [subs, setSubs] = useState<SubRow[]>([blankSub(1, 0), blankSub(2, 1)]);
  const [error, setError] = useState<string | null>(null);

  const total = subs.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const validSubs = subs.filter((r) => r.name.trim() && Number(r.amount) > 0);

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
          <span className="mb-1.5 block text-xs font-medium text-ink-600">תתי-תקציבים</span>
          <SubBudgetRows rows={subs} setRows={setSubs} />
        </div>

        {error && <p className="text-sm text-danger-600">{error}</p>}
      </div>
    </Modal>
  );
}
