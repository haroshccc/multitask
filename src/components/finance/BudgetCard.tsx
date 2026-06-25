/**
 * Budget card (spec §4.2): the remaining figure is the hero, with the
 * dynamic day/week division pills (🔴/🟢), a quick-add, and the expense list.
 */
import { useMemo, useRef, useState, useEffect } from "react";
import { MoreVertical, Pencil, Scale, Plus, Eye, Users } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useOrgScope } from "@/lib/hooks/useOrgScope";
import { SHARE_LEVEL_META } from "@/lib/types/finance";
import { Money, BudgetIcon, DivisionPill, TEXT_COLOR } from "./finance-bits";
import { ExpenseRow } from "./ExpenseRow";
import { QuickAddExpense } from "./QuickAddExpense";
import {
  budgetMonthSnapshot,
  divisionView,
  activeVersion,
} from "@/lib/finance/calc";
import {
  useSetOccurrenceCharged,
  useSetOccurrenceWithdrawn,
  useArchiveExpense,
} from "@/lib/hooks/useFinance";
import type {
  FinanceBudget,
  FinanceBudgetVersion,
  FinanceOccurrence,
  FinanceExpense,
  FinanceAccount,
  FinanceExpenseTemplate,
} from "@/lib/types/finance";

export function BudgetCard({
  budget,
  versions,
  occurrences,
  expenses,
  accounts,
  templates,
  carryoverAdjustment = 0,
  onEdit,
  onOpenClosing,
}: {
  budget: FinanceBudget;
  versions: FinanceBudgetVersion[];
  occurrences: FinanceOccurrence[];
  expenses: FinanceExpense[];
  accounts: FinanceAccount[];
  templates: FinanceExpenseTemplate[];
  carryoverAdjustment?: number;
  onEdit: () => void;
  onOpenClosing: () => void;
}) {
  const setCharged = useSetOccurrenceCharged();
  const setWithdrawn = useSetOccurrenceWithdrawn();
  const archive = useArchiveExpense();
  const { userId } = useOrgScope();

  // Capability for the current viewer. A non-owner only ever sees this budget
  // because org finance sharing is on, so the budget's share_level applies.
  const isOwner = !budget.owner_id || budget.owner_id === userId;
  const canEdit = isOwner || budget.share_level === "full";
  const canTransact = isOwner || budget.share_level !== "view";

  const [adding, setAdding] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const version = useMemo(() => activeVersion(versions), [versions]);
  const snap = useMemo(
    () => budgetMonthSnapshot(version, occurrences, new Date(), carryoverAdjustment),
    [version, occurrences, carryoverAdjustment]
  );

  const expenseById = useMemo(() => {
    const m = new Map<string, FinanceExpense>();
    for (const e of expenses) m.set(e.id, e);
    return m;
  }, [expenses]);
  const accountById = useMemo(() => {
    const m = new Map<string, FinanceAccount>();
    for (const a of accounts) m.set(a.id, a);
    return m;
  }, [accounts]);

  const sortedOccs = useMemo(
    () => occurrences.slice().sort((a, b) => (a.due_date < b.due_date ? -1 : 1)),
    [occurrences]
  );

  const pct =
    snap.allocation > 0
      ? Math.min(100, Math.max(0, (snap.charged / snap.allocation) * 100))
      : 0;

  const monthColor = snap.remaining < 0 ? TEXT_COLOR.red : "text-ink-900";

  return (
    <div className="card flex flex-col overflow-hidden">
      {/* header */}
      <div className="flex items-center gap-2 px-4 pt-3.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: budget.color }}
        >
          <BudgetIcon name={budget.icon} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-semibold text-ink-900">{budget.name}</h3>
            {!isOwner ? (
              <span
                className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-500"
                title={SHARE_LEVEL_META[budget.share_level].hint}
              >
                {budget.share_level === "view" ? (
                  <Eye className="h-2.5 w-2.5" />
                ) : (
                  <Users className="h-2.5 w-2.5" />
                )}
                {SHARE_LEVEL_META[budget.share_level].short}
              </span>
            ) : (
              budget.share_level !== "view" && (
                <Users className="h-3.5 w-3.5 shrink-0 text-ink-400" />
              )
            )}
          </div>
          {version && (
            <p className="truncate text-[11px] text-ink-400">{version.title}</p>
          )}
        </div>
        <span className="chip shrink-0 bg-ink-150 text-ink-600">
          {version?.period === "yearly" ? "שנתי" : "חודשי"}
        </span>
        {canEdit && (
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute end-0 top-8 z-20 w-44 overflow-hidden rounded-lg border border-ink-200 bg-white py-1 shadow-lift">
              <MenuItem icon={Pencil} label="עריכה (גרסה)" onClick={() => { setMenuOpen(false); onEdit(); }} />
              <MenuItem icon={Scale} label="סגירה חודשית" onClick={() => { setMenuOpen(false); onOpenClosing(); }} />
            </div>
          )}
        </div>
        )}
      </div>

      {/* hero remaining */}
      <div className="px-4 pt-3">
        <div className={cn("text-3xl font-bold tabular-nums", monthColor)}>
          <Money value={snap.remaining} />
        </div>
        <p className="text-xs text-ink-500">
          נשאר החודש · מתוך <Money value={snap.allocation} />
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              snap.remaining < 0 ? "bg-danger-500" : "bg-primary-500"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* division pills */}
      <div className="flex flex-wrap gap-1.5 px-4 pt-3">
        {budget.remainder_views
          .filter((u) => u !== "month")
          .map((u) => {
            const dv = divisionView(u, snap);
            return <DivisionPill key={u} unit={u} value={dv.value} color={dv.color} />;
          })}
      </div>

      {/* quick add */}
      {canTransact && (
        <div className="px-4 pt-3">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-ink-300 py-1.5 text-sm text-ink-500 hover:border-primary-400 hover:text-primary-600"
          >
            <Plus className="h-4 w-4" />
            הוסף הוצאה
          </button>
        </div>
      )}

      {/* expenses */}
      <div className="mt-2 max-h-72 space-y-0.5 overflow-y-auto px-2 pb-3">
        {sortedOccs.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-ink-400">אין הוצאות עדיין</p>
        ) : (
          sortedOccs.map((occ) => {
            const expense = expenseById.get(occ.expense_id);
            return (
              <ExpenseRow
                key={occ.id}
                occ={occ}
                expense={expense}
                account={occ.account_id ? accountById.get(occ.account_id) : undefined}
                readOnly={!canTransact}
                onToggleCharged={(c) => setCharged.mutate({ occId: occ.id, charged: c })}
                onToggleWithdrawn={(w) => setWithdrawn.mutate({ occ, withdrawn: w })}
                onArchive={
                  expense ? () => archive.mutate(occ.expense_id) : undefined
                }
              />
            );
          })
        )}
      </div>

      {adding && (
        <QuickAddExpense
          budgetId={budget.id}
          accounts={accounts}
          templates={templates}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Pencil;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
    >
      <Icon className="h-4 w-4 text-ink-400" />
      {label}
    </button>
  );
}
