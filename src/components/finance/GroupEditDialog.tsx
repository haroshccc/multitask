/**
 * Edit a "תקציב כולל": its name and the share level for the whole thing
 * (which every sub-budget inherits). Also deletes the full budget (archives the
 * group + all its sub-budgets) with undo.
 */
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Modal, LabeledField } from "./finance-bits";
import { SubBudgetRows, type SubRow } from "./SubBudgetRows";
import {
  useUpdateBudgetGroup,
  useSetBudgetsArchived,
  useCreateBudget,
} from "@/lib/hooks/useFinance";
import { pushUndo } from "@/lib/undo/store";
import { toast } from "@/components/ui/Toast";
import {
  ALL_SHARE_LEVELS,
  SHARE_LEVEL_META,
  type FinanceBudgetGroup,
  type BudgetShareLevel,
} from "@/lib/types/finance";

export function GroupEditDialog({
  group,
  budgetIds,
  onClose,
}: {
  group: FinanceBudgetGroup;
  budgetIds: string[];
  onClose: () => void;
}) {
  const updateGroup = useUpdateBudgetGroup();
  const setArchived = useSetBudgetsArchived();
  const createBudget = useCreateBudget();

  const [name, setName] = useState(group.name);
  const [shareLevel, setShareLevel] = useState<BudgetShareLevel>(group.share_level);
  const [newSubs, setNewSubs] = useState<SubRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const validNewSubs = newSubs.filter((r) => r.name.trim() && Number(r.amount) > 0);

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("יש לתת שם לתקציב הכולל");
      return;
    }
    const prev = { name: group.name, share_level: group.share_level };
    const next = { name: name.trim(), share_level: shareLevel };
    try {
      await updateGroup.mutateAsync({ groupId: group.id, patch: next });
      if (prev.name !== next.name || prev.share_level !== next.share_level) {
        pushUndo({
          description: `עריכת תקציב "${next.name}"`,
          undo: async () => {
            await updateGroup.mutateAsync({ groupId: group.id, patch: prev });
          },
          redo: async () => {
            await updateGroup.mutateAsync({ groupId: group.id, patch: next });
          },
        });
      }
      // create any newly-added sub-budgets into this group
      for (const r of validNewSubs) {
        await createBudget.mutateAsync({
          name: r.name.trim(),
          color: r.color,
          icon: r.icon,
          remainder_views: r.views.length ? r.views : ["month"],
          group_id: group.id,
          title: next.name,
          amount: Number(r.amount),
          period: r.period,
        });
      }
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "שגיאה בשמירה");
    }
  }

  async function handleDelete() {
    setError(null);
    try {
      await setArchived.mutateAsync({ budgetIds, archived: true });
      await updateGroup.mutateAsync({ groupId: group.id, patch: { is_archived: true } });
      pushUndo({
        description: `מחיקת תקציב "${group.name}"`,
        undo: async () => {
          await updateGroup.mutateAsync({ groupId: group.id, patch: { is_archived: false } });
          await setArchived.mutateAsync({ budgetIds, archived: false });
        },
        redo: async () => {
          await setArchived.mutateAsync({ budgetIds, archived: true });
          await updateGroup.mutateAsync({ groupId: group.id, patch: { is_archived: true } });
        },
      });
      toast(`התקציב "${group.name}" נמחק · Ctrl+Z לשחזור`, "info");
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "שגיאה במחיקה");
    }
  }

  const busy = updateGroup.isPending || setArchived.isPending || createBudget.isPending;

  return (
    <Modal
      title="עריכת תקציב כולל"
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
            מחק תקציב מלא
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
        <LabeledField label="שם התקציב הכולל">
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </LabeledField>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-600">
            הרשאת שיתוף (חלה על כל תתי-התקציבים)
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
            {SHARE_LEVEL_META[shareLevel].hint}
          </span>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-ink-600">
            הוספת תתי-תקציבים
          </span>
          {newSubs.length === 0 && (
            <p className="mb-1.5 text-[11px] text-ink-400">
              שכחת משהו? הוסיפי כאן תתי-תקציבים חדשים לתקציב הזה.
            </p>
          )}
          <SubBudgetRows rows={newSubs} setRows={setNewSubs} addLabel="הוסיפי תת-תקציב" />
        </div>

        {error && <p className="text-sm text-danger-600">{error}</p>}
      </div>
    </Modal>
  );
}
