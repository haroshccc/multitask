/**
 * Finance module shell + the five routed tab pages
 * (overview / budgets / accounts / history / templates).
 * See docs/finance-module-spec.md and docs/finance-module-design.md.
 */
import { useMemo, useState } from "react";
import {
  NavLink,
  Outlet,
  useOutletContext,
} from "react-router-dom";
import {
  Plus,
  Square,
  Columns3,
  Rows3,
  ArrowLeftRight,
  Upload,
  Layers,
  Pencil,
  Wallet,
  Landmark,
  History as HistoryIcon,
  LayoutList,
  FileStack,
} from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { cn } from "@/lib/utils/cn";
import { pushUndo } from "@/lib/undo/store";
import { toast } from "@/components/ui/Toast";
import { useOrgScope } from "@/lib/hooks/useOrgScope";
import {
  useBudgetGroups,
  useBudgets,
  useUpdateBudget,
  useBudgetVersions,
  useAccounts,
  useAccountTransactions,
  useExpenses,
  useOccurrences,
  useTemplates,
  useClosings,
  useCarryovers,
} from "@/lib/hooks/useFinance";
import {
  activeVersion,
  budgetMonthSnapshot,
  accountBalance,
  monthKey,
} from "@/lib/finance/calc";
import { Money } from "@/components/finance/finance-bits";
import { BudgetCard } from "@/components/finance/BudgetCard";
import { BudgetEditDialog } from "@/components/finance/BudgetEditDialog";
import { MonthlyClosingPanel } from "@/components/finance/MonthlyClosingPanel";
import { AccountCard } from "@/components/finance/AccountCard";
import { CreateAccountDialog, TransferDialog } from "@/components/finance/AccountDialogs";
import { CreditImportDialog } from "@/components/finance/CreditImportDialog";
import { CreateBudgetGroupDialog } from "@/components/finance/CreateBudgetGroupDialog";
import { GroupEditDialog } from "@/components/finance/GroupEditDialog";
import { ForecastTimeline } from "@/components/finance/ForecastTimeline";
import { TemplateList } from "@/components/finance/TemplateEditor";
import type {
  FinanceBudget,
  FinanceBudgetGroup,
  FinanceBudgetVersion,
  FinanceAccount,
  FinanceAccountTransaction,
  FinanceExpense,
  FinanceOccurrence,
  FinanceExpenseTemplate,
  FinanceMonthlyClosing,
  FinanceCarryoverTransfer,
} from "@/lib/types/finance";

// ---- Shell context -----------------------------------------------------------

export interface FinanceContext {
  budgets: FinanceBudget[];
  groups: FinanceBudgetGroup[];
  versions: FinanceBudgetVersion[];
  accounts: FinanceAccount[];
  transactions: FinanceAccountTransaction[];
  expenses: FinanceExpense[];
  occurrences: FinanceOccurrence[];
  templates: FinanceExpenseTemplate[];
  closings: FinanceMonthlyClosing[];
  carryovers: FinanceCarryoverTransfer[];
  loading: boolean;
  versionsFor: (budgetId: string) => FinanceBudgetVersion[];
  occurrencesFor: (budgetId: string) => FinanceOccurrence[];
  carryoverAdjustmentFor: (budgetId: string) => number;
}

export function useFinanceContext(): FinanceContext {
  return useOutletContext<FinanceContext>();
}

const TABS = [
  { to: "/app/finance", end: true, label: "סקירה", icon: LayoutList },
  { to: "/app/finance/budgets", end: false, label: "תקציבים", icon: Wallet },
  { to: "/app/finance/accounts", end: false, label: "חשבונות", icon: Landmark },
  { to: "/app/finance/history", end: false, label: "היסטוריה", icon: HistoryIcon },
  { to: "/app/finance/templates", end: false, label: "שבלונות", icon: FileStack },
];

export function FinanceShell() {
  const groupsQ = useBudgetGroups();
  const budgetsQ = useBudgets();
  const versionsQ = useBudgetVersions();
  const accountsQ = useAccounts();
  const txQ = useAccountTransactions();
  const expensesQ = useExpenses();
  const occQ = useOccurrences();
  const templatesQ = useTemplates();
  const closingsQ = useClosings();
  const carryQ = useCarryovers();

  const budgets = budgetsQ.data ?? [];
  const versions = versionsQ.data ?? [];
  const occurrences = occQ.data ?? [];
  const carryovers = carryQ.data ?? [];

  const versionsByBudget = useMemo(() => {
    const m = new Map<string, FinanceBudgetVersion[]>();
    for (const v of versions) {
      const arr = m.get(v.budget_id) ?? [];
      arr.push(v);
      m.set(v.budget_id, arr);
    }
    return m;
  }, [versions]);

  const occByBudget = useMemo(() => {
    const m = new Map<string, FinanceOccurrence[]>();
    for (const o of occurrences) {
      const arr = m.get(o.budget_id) ?? [];
      arr.push(o);
      m.set(o.budget_id, arr);
    }
    return m;
  }, [occurrences]);

  const carryAdjByBudget = useMemo(() => {
    const m = new Map<string, number>();
    const mk = monthKey();
    for (const c of carryovers) {
      if (c.period_month !== mk) continue;
      if (c.to_budget_id) m.set(c.to_budget_id, (m.get(c.to_budget_id) ?? 0) + Number(c.amount));
      if (c.from_budget_id) m.set(c.from_budget_id, (m.get(c.from_budget_id) ?? 0) - Number(c.amount));
    }
    return m;
  }, [carryovers]);

  const ctx: FinanceContext = {
    budgets,
    groups: groupsQ.data ?? [],
    versions,
    accounts: accountsQ.data ?? [],
    transactions: txQ.data ?? [],
    expenses: expensesQ.data ?? [],
    occurrences,
    templates: templatesQ.data ?? [],
    closings: closingsQ.data ?? [],
    carryovers,
    loading:
      budgetsQ.isLoading || versionsQ.isLoading || accountsQ.isLoading || occQ.isLoading,
    versionsFor: (id) => versionsByBudget.get(id) ?? [],
    occurrencesFor: (id) => occByBudget.get(id) ?? [],
    carryoverAdjustmentFor: (id) => carryAdjByBudget.get(id) ?? 0,
  };

  return (
    <ScreenScaffold title="התנהלות כלכלית" subtitle="ניהול תקציבים, חשבונות והוצאות">
      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-ink-200">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors -mb-px",
                isActive
                  ? "border-primary-500 text-primary-700 font-medium"
                  : "border-transparent text-ink-500 hover:text-ink-800"
              )
            }
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet context={ctx} />
    </ScreenScaffold>
  );
}

// ---- Overview ----------------------------------------------------------------

export function FinanceOverviewPage() {
  const ctx = useFinanceContext();
  const { budgets, versionsFor, occurrencesFor, accounts, transactions, occurrences, expenses } = ctx;
  const [importing, setImporting] = useState(false);

  const totals = useMemo(() => {
    let allocated = 0;
    let charged = 0;
    for (const b of budgets) {
      const snap = budgetMonthSnapshot(
        activeVersion(versionsFor(b.id)),
        occurrencesFor(b.id),
        new Date(),
        ctx.carryoverAdjustmentFor(b.id)
      );
      allocated += snap.allocation;
      charged += snap.charged;
    }
    const accountsTotal = accounts.reduce(
      (sum, a) =>
        sum +
        accountBalance(
          Number(a.opening_balance),
          transactions.filter((t) => t.account_id === a.id)
        ),
      0
    );
    return { allocated, charged, remaining: allocated - charged, accountsTotal };
  }, [budgets, accounts, transactions, versionsFor, occurrencesFor, ctx]);

  if (ctx.loading) return <LoadingGrid />;

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          type="button"
          className="btn-primary flex items-center gap-1.5 text-sm"
          onClick={() => setImporting(true)}
          disabled={accounts.length === 0}
          title={accounts.length === 0 ? "צריך חשבון אחד לפחות" : "הדבקת רשימת חיובים מדף האשראי"}
        >
          <Upload className="h-4 w-4" />
          הוספת הוצאות מאשראי
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="הוקצב החודש" value={totals.allocated} />
        <KpiCard label="חויב" value={totals.charged} />
        <KpiCard
          label="נשאר"
          value={totals.remaining}
          tone={totals.remaining < 0 ? "red" : "green"}
        />
        <KpiCard label="יתרת חשבונות" value={totals.accountsTotal} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card p-4">
          <h3 className="mb-3 font-semibold text-ink-900">תחזית — מה יוצא ומתי</h3>
          <ForecastTimeline occurrences={occurrences} expenses={expenses} />
        </section>
        <section className="card p-4">
          <h3 className="mb-3 font-semibold text-ink-900">חשבונות</h3>
          {accounts.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-400">אין חשבונות עדיין</p>
          ) : (
            <div className="space-y-1.5">
              {accounts.map((a) => {
                const bal = accountBalance(
                  Number(a.opening_balance),
                  transactions.filter((t) => t.account_id === a.id)
                );
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 odd:bg-ink-50"
                  >
                    <span className="flex items-center gap-2 text-sm text-ink-700">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: a.color }}
                      />
                      {a.name}
                    </span>
                    <Money
                      value={bal}
                      className={cn("font-medium", bal < 0 ? "text-danger-600" : "text-ink-900")}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {importing && (
        <CreditImportDialog
          accounts={accounts}
          budgets={budgets}
          onClose={() => setImporting(false)}
        />
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "red";
}) {
  return (
    <div className="card p-3.5">
      <div
        className={cn(
          "text-xl font-bold tabular-nums",
          tone === "green" ? "text-success-600" : tone === "red" ? "text-danger-600" : "text-ink-900"
        )}
      >
        <Money value={value} />
      </div>
      <div className="mt-0.5 text-xs text-ink-500">{label}</div>
    </div>
  );
}

// ---- Budgets -----------------------------------------------------------------

type ViewMode = "single" | "columns" | "rows";
const VIEW_KEY = "multitask:finance:viewMode";
function readViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "single" || v === "columns" || v === "rows") return v;
  } catch {
    /* ignore */
  }
  return "columns";
}

const UNGROUPED = "__none__";

export function FinanceBudgetsPage() {
  const ctx = useFinanceContext();
  const { budgets, groups, accounts, templates, expenses } = ctx;
  const updateBudget = useUpdateBudget();

  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode());
  const [category, setCategory] = useState<string>("");
  const [shownGroups, setShownGroups] = useState<Set<string> | null>(null); // null = all
  const [editing, setEditing] = useState<FinanceBudget | "new" | null>(null);
  const [closing, setClosing] = useState<FinanceBudget | null>(null);
  const [groupCreating, setGroupCreating] = useState(false);
  const [editingGroup, setEditingGroup] = useState<FinanceBudgetGroup | null>(null);

  function persistView(v: ViewMode) {
    setViewMode(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  }

  const groupById = useMemo(() => {
    const m = new Map<string, FinanceBudgetGroup>();
    for (const g of groups) m.set(g.id, g);
    return m;
  }, [groups]);

  const shareLevelOf = (b: FinanceBudget) =>
    (b.group_id ? groupById.get(b.group_id)?.share_level : undefined) ?? b.share_level;

  const categories = useMemo(
    () => [...new Set(budgets.map((b) => b.category).filter(Boolean) as string[])],
    [budgets]
  );

  const hasUngrouped = budgets.some((b) => !b.group_id);

  const visible = useMemo(
    () =>
      budgets.filter((b) => {
        if (category && b.category !== category) return false;
        if (!shownGroups) return true;
        return shownGroups.has(b.group_id ?? UNGROUPED);
      }),
    [budgets, category, shownGroups]
  );

  const expensesFor = (budgetId: string) =>
    expenses.filter((e) => e.budget_id === budgetId);

  function deleteBudget(b: FinanceBudget) {
    updateBudget.mutate({ budgetId: b.id, patch: { is_archived: true } });
    pushUndo({
      description: `מחיקת תקציב "${b.name}"`,
      undo: async () => {
        await updateBudget.mutateAsync({ budgetId: b.id, patch: { is_archived: false } });
      },
      redo: async () => {
        await updateBudget.mutateAsync({ budgetId: b.id, patch: { is_archived: true } });
      },
    });
    toast(`התקציב "${b.name}" נמחק · Ctrl+Z לשחזור`, "info");
  }

  function toggleGroupFilter(key: string) {
    const allKeys = [...groups.map((g) => g.id), ...(hasUngrouped ? [UNGROUPED] : [])];
    setShownGroups((prev) => {
      const next = new Set(prev ?? allKeys);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const sections = useMemo(() => {
    const byGroup = new Map<string, FinanceBudget[]>();
    const ungrouped: FinanceBudget[] = [];
    for (const b of visible) {
      if (b.group_id) {
        const arr = byGroup.get(b.group_id) ?? [];
        arr.push(b);
        byGroup.set(b.group_id, arr);
      } else {
        ungrouped.push(b);
      }
    }
    const out: { group: FinanceBudgetGroup | null; budgets: FinanceBudget[] }[] = [];
    for (const g of groups) {
      if (shownGroups && !shownGroups.has(g.id)) continue;
      const gb = byGroup.get(g.id) ?? [];
      // keep empty groups visible (so they can be edited/deleted) — but hide
      // them while a category filter is narrowing the view.
      if (!gb.length && category) continue;
      out.push({ group: g, budgets: gb });
    }
    if (ungrouped.length) out.push({ group: null, budgets: ungrouped });
    return out;
  }, [visible, groups, shownGroups, category]);

  if (ctx.loading) return <LoadingGrid />;

  if (budgets.length === 0) {
    return (
      <>
        <EmptyState
          title="עדיין אין תקציבים"
          body="התחילי מ״תקציב כולל״ — שם אחד עם כמה תתי-תקציבים בבת אחת (אוכל, רכב, וכו׳)."
          cta="תקציב כולל חדש"
          onCta={() => setGroupCreating(true)}
          secondaryCta="תקציב בודד"
          onSecondaryCta={() => setEditing("new")}
        />
        {groupCreating && (
          <CreateBudgetGroupDialog onClose={() => setGroupCreating(false)} />
        )}
        {editing && <BudgetEditDialog onClose={() => setEditing(null)} />}
      </>
    );
  }

  const gridClass =
    viewMode === "single"
      ? "grid grid-cols-1 gap-4 max-w-xl"
      : viewMode === "rows"
      ? "grid grid-cols-1 gap-4"
      : "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";

  return (
    <div className="space-y-4">
      {/* control bar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="field max-w-[180px]"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">כל הקטגוריות</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <ViewModeToggle mode={viewMode} onChange={persistView} />

        <button
          type="button"
          className="btn-primary ms-auto flex items-center gap-1.5 text-sm"
          onClick={() => setGroupCreating(true)}
        >
          <Layers className="h-4 w-4" />
          תקציב כולל חדש
        </button>
        <button
          type="button"
          className="btn-outline flex items-center gap-1.5 text-sm"
          onClick={() => setEditing("new")}
        >
          <Plus className="h-4 w-4" />
          תקציב בודד
        </button>
      </div>

      {/* group filter chips (primary filter is by full budget) */}
      {(groups.length > 0 || hasUngrouped) && (
        <div className="flex flex-wrap gap-1.5">
          <FilterChip label="הכל" active={!shownGroups} onClick={() => setShownGroups(null)} />
          {groups.map((g) => {
            const key = g.id;
            const active = !shownGroups || shownGroups.has(key);
            return (
              <FilterChip
                key={key}
                label={g.name}
                active={active}
                onClick={() => toggleGroupFilter(key)}
              />
            );
          })}
          {hasUngrouped && (
            <FilterChip
              label="ללא קבוצה"
              active={!shownGroups || shownGroups.has(UNGROUPED)}
              onClick={() => toggleGroupFilter(UNGROUPED)}
            />
          )}
        </div>
      )}

      {sections.map((section) => {
        const cards = (
          <div className={gridClass}>
            {section.budgets.map((b) => (
              <BudgetCard
                key={b.id}
                budget={b}
                versions={ctx.versionsFor(b.id)}
                occurrences={ctx.occurrencesFor(b.id)}
                expenses={expensesFor(b.id)}
                accounts={accounts}
                templates={templates}
                allBudgets={budgets}
                carryoverAdjustment={ctx.carryoverAdjustmentFor(b.id)}
                shareLevel={shareLevelOf(b)}
                onEdit={() => setEditing(b)}
                onOpenClosing={() => setClosing(b)}
                onDelete={() => deleteBudget(b)}
              />
            ))}
          </div>
        );
        if (!section.group) {
          return sections.length > 1 ? (
            <section key="__ungrouped__" className="space-y-2">
              <h3 className="text-sm font-semibold text-ink-500">ללא קבוצה</h3>
              {cards}
            </section>
          ) : (
            <div key="__ungrouped__">{cards}</div>
          );
        }
        return (
          <section key={section.group.id} className="space-y-2">
            <GroupHeader
              group={section.group}
              budgets={section.budgets}
              ctx={ctx}
              onEdit={() => setEditingGroup(section.group!)}
            />
            {section.budgets.length ? (
              cards
            ) : (
              <p className="py-2 text-xs text-ink-400">
                אין תתי-תקציבים · הוסיפי דרך העריכה (✏️) או מחקי את התקציב הכולל.
              </p>
            )}
          </section>
        );
      })}

      {groupCreating && (
        <CreateBudgetGroupDialog onClose={() => setGroupCreating(false)} />
      )}
      {editingGroup && (
        <GroupEditDialog
          group={editingGroup}
          budgetIds={budgets.filter((b) => b.group_id === editingGroup.id).map((b) => b.id)}
          onClose={() => setEditingGroup(null)}
        />
      )}
      {editing && (
        <BudgetEditDialog
          existing={
            editing === "new"
              ? undefined
              : {
                  budget: editing,
                  version: activeVersion(ctx.versionsFor(editing.id)),
                }
          }
          onClose={() => setEditing(null)}
        />
      )}
      {closing && (
        <MonthlyClosingPanel
          budget={closing}
          versions={ctx.versionsFor(closing.id)}
          occurrences={ctx.occurrencesFor(closing.id)}
          expenses={expensesFor(closing.id)}
          allBudgets={budgets}
          onClose={() => setClosing(null)}
        />
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "chip",
        active ? "bg-primary-600 text-white" : "bg-ink-150 text-ink-500 hover:bg-ink-200"
      )}
    >
      {label}
    </button>
  );
}

function GroupHeader({
  group,
  budgets,
  ctx,
  onEdit,
}: {
  group: FinanceBudgetGroup;
  budgets: FinanceBudget[];
  ctx: FinanceContext;
  onEdit: () => void;
}) {
  const { userId } = useOrgScope();
  const canManage = !group.owner_id || group.owner_id === userId;
  const { allocation, remaining } = budgets.reduce(
    (acc, b) => {
      const snap = budgetMonthSnapshot(
        activeVersion(ctx.versionsFor(b.id)),
        ctx.occurrencesFor(b.id),
        new Date(),
        ctx.carryoverAdjustmentFor(b.id)
      );
      acc.allocation += snap.allocation;
      acc.remaining += snap.remaining;
      return acc;
    },
    { allocation: 0, remaining: 0 }
  );
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b border-ink-200 pb-1.5">
      <div className="flex items-baseline gap-2">
        <Layers className="h-4 w-4 self-center text-primary-500" />
        <h3 className="font-semibold text-ink-900">{group.name}</h3>
        <span className="text-xs text-ink-400">{budgets.length} תתי-תקציבים</span>
        {canManage && (
          <button
            type="button"
            onClick={onEdit}
            aria-label="עריכת תקציב כולל"
            title="עריכת תקציב כולל / שיתוף / מחיקה"
            className="self-center rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <span className="text-sm text-ink-500">
        נשאר{" "}
        <Money
          value={remaining}
          className={cn("font-semibold", remaining < 0 ? "text-danger-600" : "text-ink-900")}
        />{" "}
        · מתוך <Money value={allocation} />
      </span>
    </div>
  );
}

function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  const opts: { id: ViewMode; label: string; icon: typeof Square }[] = [
    { id: "single", label: "אחד", icon: Square },
    { id: "columns", label: "זה לצד זה", icon: Columns3 },
    { id: "rows", label: "מתחת", icon: Rows3 },
  ];
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-ink-200 text-sm">
      {opts.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          title={label}
          className={cn(
            "flex items-center gap-1.5 border-e border-ink-200 px-2.5 py-1.5 transition-colors last:border-e-0",
            mode === id ? "bg-primary-600 text-white" : "bg-white text-ink-500 hover:bg-ink-50"
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

// ---- Accounts ----------------------------------------------------------------

export function FinanceAccountsPage() {
  const ctx = useFinanceContext();
  const { accounts, transactions } = ctx;
  const [creating, setCreating] = useState(false);
  const [transferring, setTransferring] = useState(false);

  if (ctx.loading) return <LoadingGrid />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-primary flex items-center gap-1.5 text-sm"
          onClick={() => setCreating(true)}
        >
          <Plus className="h-4 w-4" />
          חשבון חדש
        </button>
        {accounts.length >= 2 && (
          <button
            type="button"
            className="btn-outline flex items-center gap-1.5 text-sm"
            onClick={() => setTransferring(true)}
          >
            <ArrowLeftRight className="h-4 w-4" />
            העברה בין חשבונות
          </button>
        )}
      </div>

      {accounts.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-400">
          אין חשבונות עדיין — צרי חשבון כדי לעקוב אחרי מה שיורד בפועל.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => (
            <AccountCard key={a.id} account={a} transactions={transactions} />
          ))}
        </div>
      )}

      {creating && <CreateAccountDialog onClose={() => setCreating(false)} />}
      {transferring && (
        <TransferDialog accounts={accounts} onClose={() => setTransferring(false)} />
      )}
    </div>
  );
}

// ---- History -----------------------------------------------------------------

export function FinanceHistoryPage() {
  const ctx = useFinanceContext();
  const { closings, budgets, carryovers } = ctx;
  const budgetName = (id: string) => budgets.find((b) => b.id === id)?.name ?? "—";

  if (ctx.loading) return <LoadingGrid />;

  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 font-semibold text-ink-900">סגירות חודשיות — עודף/גרעון</h3>
        {closings.length === 0 ? (
          <p className="py-4 text-sm text-ink-400">עדיין לא נשמרו סגירות חודשיות.</p>
        ) : (
          <div className="card divide-y divide-ink-100">
            {closings.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <span className="font-medium text-ink-900">{budgetName(c.budget_id)}</span>
                  <span className="ms-2 text-xs text-ink-400" dir="ltr">
                    {c.period_month.slice(0, 7)}
                  </span>
                  {c.manual_note && (
                    <p className="truncate text-xs text-ink-500">{c.manual_note}</p>
                  )}
                </div>
                <Money
                  value={Number(c.balance)}
                  className={cn(
                    "shrink-0 font-semibold",
                    Number(c.balance) >= 0 ? "text-success-600" : "text-danger-600"
                  )}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-2 font-semibold text-ink-900">העברות עודף/גרעון</h3>
        {carryovers.length === 0 ? (
          <p className="py-4 text-sm text-ink-400">אין העברות.</p>
        ) : (
          <div className="card divide-y divide-ink-100">
            {carryovers.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="text-ink-700">
                  {c.from_budget_id ? budgetName(c.from_budget_id) : "—"} ←{" "}
                  {c.to_budget_id ? budgetName(c.to_budget_id) : "—"}
                  <span className="ms-2 text-xs text-ink-400" dir="ltr">
                    {c.period_month.slice(0, 7)}
                  </span>
                </span>
                <Money value={Number(c.amount)} className="font-medium text-ink-900" />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ---- Templates ---------------------------------------------------------------

export function FinanceTemplatesPage() {
  const ctx = useFinanceContext();
  if (ctx.loading) return <LoadingGrid />;
  return <TemplateList templates={ctx.templates} budgets={ctx.budgets} accounts={ctx.accounts} />;
}

// ---- Shared bits -------------------------------------------------------------

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="card h-56 animate-pulse bg-ink-50" />
      ))}
    </div>
  );
}

function EmptyState({
  title,
  body,
  cta,
  onCta,
  secondaryCta,
  onSecondaryCta,
}: {
  title: string;
  body: string;
  cta: string;
  onCta: () => void;
  secondaryCta?: string;
  onSecondaryCta?: () => void;
}) {
  return (
    <div className="card p-8 text-center sm:p-12">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
        <Wallet className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">{body}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button type="button" className="btn-primary flex items-center gap-1.5 text-sm" onClick={onCta}>
          <Layers className="h-4 w-4" />
          {cta}
        </button>
        {secondaryCta && onSecondaryCta && (
          <button type="button" className="btn-outline flex items-center gap-1.5 text-sm" onClick={onSecondaryCta}>
            <Plus className="h-4 w-4" />
            {secondaryCta}
          </button>
        )}
      </div>
    </div>
  );
}
