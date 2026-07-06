/**
 * Finance service layer — all Supabase access for the finance module.
 * Org-scoped; mirrors the conventions in services/plans.ts.
 */
import { supabase } from "@/lib/supabase/client";
import { expandRrule } from "@/components/calendar/calendar-utils";
import { startOfMonth, endOfMonth, addMonths } from "date-fns";
import { toDateKey } from "@/lib/finance/calc";
import type {
  FinanceBudget,
  FinanceBudgetVersion,
  FinanceAccount,
  FinanceAccountTransaction,
  FinanceExpense,
  FinanceOccurrence,
  FinanceExpenseTemplate,
  FinanceMonthlyClosing,
  FinanceCarryoverTransfer,
  FinanceEvent,
  BudgetPeriod,
  BudgetShareLevel,
  RemainderUnit,
  AccountKind,
  PaymentMethod,
  ExpenseKind,
  BudgetChargeMode,
  WithdrawalTiming,
} from "@/lib/types/finance";

// Typed-lag escape hatch (see CLAUDE.md "Supabase type lag").
const db = supabase as any;

const SORT_STEP = 1000;

// ---- Budgets -----------------------------------------------------------------

export async function listBudgets(orgId: string): Promise<FinanceBudget[]> {
  const { data, error } = await db
    .from("finance_budgets")
    .select("*")
    .eq("organization_id", orgId)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FinanceBudget[];
}

export async function listAllBudgetVersions(
  orgId: string
): Promise<FinanceBudgetVersion[]> {
  const { data, error } = await db
    .from("finance_budget_versions")
    .select("*")
    .eq("organization_id", orgId)
    .order("effective_from", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FinanceBudgetVersion[];
}

export interface CreateBudgetInput {
  organization_id: string;
  owner_id: string;
  name: string;
  color?: string;
  icon?: string;
  category?: string | null;
  is_shared?: boolean;
  share_level?: BudgetShareLevel;
  remainder_views?: RemainderUnit[];
  // initial version
  title: string;
  amount: number;
  period: BudgetPeriod;
}

export async function createBudget(
  input: CreateBudgetInput
): Promise<FinanceBudget> {
  const { data: last } = await db
    .from("finance_budgets")
    .select("sort_order")
    .eq("organization_id", input.organization_id)
    .order("sort_order", { ascending: false })
    .limit(1);
  const sortOrder = (last?.[0]?.sort_order ?? 0) + SORT_STEP;

  const { data: budget, error } = await db
    .from("finance_budgets")
    .insert({
      organization_id: input.organization_id,
      owner_id: input.owner_id,
      name: input.name,
      color: input.color ?? "#f59e0b",
      icon: input.icon ?? "wallet",
      category: input.category ?? null,
      is_shared: input.is_shared ?? false,
      share_level: input.share_level ?? "transact",
      remainder_views: input.remainder_views ?? ["month"],
      sort_order: sortOrder,
    })
    .select()
    .single();
  if (error) throw error;

  await db.from("finance_budget_versions").insert({
    organization_id: input.organization_id,
    budget_id: budget.id,
    title: input.title,
    amount: input.amount,
    period: input.period,
    effective_from: toDateKey(new Date()),
    created_by: input.owner_id,
  });

  return budget as FinanceBudget;
}

export async function updateBudgetPresentation(
  budgetId: string,
  patch: Partial<
    Pick<
      FinanceBudget,
      "name" | "color" | "icon" | "category" | "is_shared" | "share_level" | "remainder_views" | "sort_order" | "is_archived"
    >
  >
): Promise<FinanceBudget> {
  const { data, error } = await db
    .from("finance_budgets")
    .update(patch)
    .eq("id", budgetId)
    .select()
    .single();
  if (error) throw error;
  return data as FinanceBudget;
}

/** Edit mode: close the current version and append a new titled one. */
export async function addBudgetVersion(input: {
  organization_id: string;
  budget_id: string;
  title: string;
  amount: number;
  period: BudgetPeriod;
  created_by: string;
}): Promise<FinanceBudgetVersion> {
  const today = toDateKey(new Date());
  // close any still-open versions
  await db
    .from("finance_budget_versions")
    .update({ effective_to: today })
    .eq("budget_id", input.budget_id)
    .is("effective_to", null);

  const { data, error } = await db
    .from("finance_budget_versions")
    .insert({
      organization_id: input.organization_id,
      budget_id: input.budget_id,
      title: input.title,
      amount: input.amount,
      period: input.period,
      effective_from: today,
      created_by: input.created_by,
    })
    .select()
    .single();
  if (error) throw error;
  return data as FinanceBudgetVersion;
}

// ---- Accounts ----------------------------------------------------------------

export async function listAccounts(orgId: string): Promise<FinanceAccount[]> {
  const { data, error } = await db
    .from("finance_accounts")
    .select("*")
    .eq("organization_id", orgId)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FinanceAccount[];
}

export async function createAccount(input: {
  organization_id: string;
  owner_id: string;
  name: string;
  kind: AccountKind;
  color?: string;
  opening_balance?: number;
}): Promise<FinanceAccount> {
  const { data: last } = await db
    .from("finance_accounts")
    .select("sort_order")
    .eq("organization_id", input.organization_id)
    .order("sort_order", { ascending: false })
    .limit(1);
  const sortOrder = (last?.[0]?.sort_order ?? 0) + SORT_STEP;

  const { data, error } = await db
    .from("finance_accounts")
    .insert({
      organization_id: input.organization_id,
      owner_id: input.owner_id,
      name: input.name,
      kind: input.kind,
      color: input.color ?? "#6b6b80",
      opening_balance: input.opening_balance ?? 0,
      sort_order: sortOrder,
    })
    .select()
    .single();
  if (error) throw error;
  return data as FinanceAccount;
}

export async function updateAccount(
  accountId: string,
  patch: Partial<FinanceAccount>
): Promise<FinanceAccount> {
  const { data, error } = await db
    .from("finance_accounts")
    .update(patch)
    .eq("id", accountId)
    .select()
    .single();
  if (error) throw error;
  return data as FinanceAccount;
}

export async function listAllAccountTransactions(
  orgId: string
): Promise<FinanceAccountTransaction[]> {
  const { data, error } = await db
    .from("finance_account_transactions")
    .select("*")
    .eq("organization_id", orgId)
    .order("tx_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FinanceAccountTransaction[];
}

/** Transfer between accounts = a linked pair of signed transactions. */
export async function createTransfer(input: {
  organization_id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  tx_date: string;
  note?: string | null;
  created_by: string;
}): Promise<void> {
  const { error } = await db.from("finance_account_transactions").insert([
    {
      organization_id: input.organization_id,
      account_id: input.from_account_id,
      amount: -Math.abs(input.amount),
      tx_date: input.tx_date,
      kind: "transfer_out",
      counterpart_account_id: input.to_account_id,
      note: input.note ?? null,
      created_by: input.created_by,
    },
    {
      organization_id: input.organization_id,
      account_id: input.to_account_id,
      amount: Math.abs(input.amount),
      tx_date: input.tx_date,
      kind: "transfer_in",
      counterpart_account_id: input.from_account_id,
      note: input.note ?? null,
      created_by: input.created_by,
    },
  ]);
  if (error) throw error;
}

// ---- Expenses & occurrences --------------------------------------------------

export async function listExpenses(orgId: string): Promise<FinanceExpense[]> {
  const { data, error } = await db
    .from("finance_expenses")
    .select("*")
    .eq("organization_id", orgId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FinanceExpense[];
}

export async function listOccurrences(
  orgId: string
): Promise<FinanceOccurrence[]> {
  const { data, error } = await db
    .from("finance_expense_occurrences")
    .select("*")
    .eq("organization_id", orgId)
    .order("due_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FinanceOccurrence[];
}

export interface CreateExpenseInput {
  organization_id: string;
  created_by: string;
  budget_id: string;
  account_id?: string | null;
  payment_method?: PaymentMethod | null;
  kind: ExpenseKind;
  title: string;
  default_amount: number;
  recurrence_rule?: string | null;
  budget_charge_mode?: BudgetChargeMode;
  withdrawal_timing?: WithdrawalTiming;
  withdrawal_offset_days?: number | null;
  template_id?: string | null;
  /** For one-time / variable: the date of the single occurrence. */
  occurrence_date?: string;
}

/**
 * Create an expense + materialize its occurrences.
 * - fixed: expand the RRULE across the current month.
 * - onetime / recurring_variable: a single occurrence on occurrence_date.
 */
export async function createExpense(
  input: CreateExpenseInput
): Promise<FinanceExpense> {
  const chargeMode = input.budget_charge_mode ?? "auto";
  const timing = input.withdrawal_timing ?? "immediate";

  const { data: expense, error } = await db
    .from("finance_expenses")
    .insert({
      organization_id: input.organization_id,
      budget_id: input.budget_id,
      account_id: input.account_id ?? null,
      payment_method: input.payment_method ?? null,
      kind: input.kind,
      title: input.title,
      default_amount: input.default_amount,
      recurrence_rule: input.recurrence_rule ?? null,
      budget_charge_mode: chargeMode,
      withdrawal_timing: timing,
      withdrawal_offset_days: input.withdrawal_offset_days ?? null,
      template_id: input.template_id ?? null,
      created_by: input.created_by,
    })
    .select()
    .single();
  if (error) throw error;

  const dates: string[] =
    input.kind === "fixed" && input.recurrence_rule
      ? expandFixedOccurrences(input.recurrence_rule)
      : [input.occurrence_date ?? toDateKey(new Date())];

  const rows = dates.map((due) => ({
    organization_id: input.organization_id,
    expense_id: expense.id,
    budget_id: input.budget_id,
    account_id: input.account_id ?? null,
    amount: input.default_amount,
    due_date: due,
    // auto-charge mode marks the budget charge immediately for past/today dates
    budget_charged: chargeMode === "auto" && due <= toDateKey(new Date()),
    budget_charged_at:
      chargeMode === "auto" && due <= toDateKey(new Date())
        ? new Date().toISOString()
        : null,
    withdrawal_date: due,
  }));

  if (rows.length) {
    const { error: occErr } = await db
      .from("finance_expense_occurrences")
      .insert(rows);
    if (occErr) throw occErr;
  }

  return expense as FinanceExpense;
}

/**
 * Materialize a fixed expense's occurrences across a rolling 12-month horizon
 * (expandRrule caps daily rules at ~366 rows). This makes "fixed" expenses
 * actually recur beyond the current month. A future phase will add a monthly
 * rollover job + re-materialization on rule edits; for now editing the rule
 * does not retro-update already-generated future occurrences.
 */
function expandFixedOccurrences(rule: string): string[] {
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(addMonths(now, 11));
  const dates = expandRrule(rule, start, start, end);
  return dates.map(toDateKey);
}

export async function updateExpense(
  expenseId: string,
  patch: Partial<FinanceExpense>
): Promise<FinanceExpense> {
  const { data, error } = await db
    .from("finance_expenses")
    .update(patch)
    .eq("id", expenseId)
    .select()
    .single();
  if (error) throw error;
  return data as FinanceExpense;
}

export async function archiveExpense(expenseId: string): Promise<void> {
  const { error } = await db
    .from("finance_expenses")
    .update({ is_archived: true })
    .eq("id", expenseId);
  if (error) throw error;
}

/** Toggle the "charged to budget" flag on an occurrence (manual vee). */
export async function setOccurrenceCharged(
  occId: string,
  charged: boolean
): Promise<void> {
  const { error } = await db
    .from("finance_expense_occurrences")
    .update({
      budget_charged: charged,
      budget_charged_at: charged ? new Date().toISOString() : null,
    })
    .eq("id", occId);
  if (error) throw error;
}

/**
 * Toggle "paid in practice". When turning on, write an account transaction;
 * when turning off, remove the linked transaction.
 */
export async function setOccurrenceWithdrawn(
  occ: FinanceOccurrence,
  withdrawn: boolean,
  createdBy: string
): Promise<void> {
  if (withdrawn) {
    // Idempotency: if a transaction is already linked (e.g. a retry after a
    // partial failure), reuse it instead of creating a duplicate money row.
    let txId: string | null = occ.account_transaction_id;
    if (occ.account_id && !txId) {
      const { data: tx, error: txErr } = await db
        .from("finance_account_transactions")
        .insert({
          organization_id: occ.organization_id,
          account_id: occ.account_id,
          amount: -Math.abs(Number(occ.amount)),
          tx_date: occ.withdrawal_date ?? toDateKey(new Date()),
          kind: "expense",
          expense_occurrence_id: occ.id,
          created_by: createdBy,
        })
        .select()
        .single();
      if (txErr) throw txErr;
      txId = tx.id;
    }
    const { error } = await db
      .from("finance_expense_occurrences")
      .update({
        withdrawn: true,
        withdrawn_at: new Date().toISOString(),
        account_transaction_id: txId,
      })
      .eq("id", occ.id);
    if (error) throw error;
  } else {
    if (occ.account_transaction_id) {
      await db
        .from("finance_account_transactions")
        .delete()
        .eq("id", occ.account_transaction_id);
    }
    const { error } = await db
      .from("finance_expense_occurrences")
      .update({ withdrawn: false, withdrawn_at: null, account_transaction_id: null })
      .eq("id", occ.id);
    if (error) throw error;
  }
}

// ---- Credit-statement bulk import --------------------------------------------

export interface CreditImportRow {
  date: string; // yyyy-mm-dd, deduction date (past or future)
  title: string;
  amount: number;
  note: string; // credit-company expense type → occurrence note
  budget_id: string;
}

/**
 * Import a batch of credit-card charges against one source account. Each row →
 * an onetime expense + an occurrence charged to the chosen budget. Past-dated
 * rows are marked withdrawn and get an account transaction; future-dated rows
 * are left pending. Returns the number of rows imported.
 */
export async function importCreditRows(input: {
  organization_id: string;
  created_by: string;
  account_id: string;
  rows: CreditImportRow[];
}): Promise<number> {
  const today = toDateKey(new Date());
  const nowIso = new Date().toISOString();
  let count = 0;

  for (const row of input.rows) {
    if (!row.budget_id || !row.amount) continue;
    const past = row.date !== "" && row.date <= today;

    const { data: exp, error: e1 } = await db
      .from("finance_expenses")
      .insert({
        organization_id: input.organization_id,
        budget_id: row.budget_id,
        account_id: input.account_id,
        payment_method: "credit",
        kind: "onetime",
        title: row.title || "הוצאת אשראי",
        default_amount: row.amount,
        budget_charge_mode: "auto",
        withdrawal_timing: past ? "immediate" : "future_date",
        created_by: input.created_by,
      })
      .select()
      .single();
    if (e1) throw e1;

    const { data: occ, error: e2 } = await db
      .from("finance_expense_occurrences")
      .insert({
        organization_id: input.organization_id,
        expense_id: exp.id,
        budget_id: row.budget_id,
        account_id: input.account_id,
        amount: row.amount,
        due_date: row.date || today,
        budget_charged: true, // an actual charge → counts against the budget
        budget_charged_at: nowIso,
        withdrawal_date: row.date || today,
        withdrawn: past,
        withdrawn_at: past ? nowIso : null,
        note: row.note || null,
      })
      .select()
      .single();
    if (e2) throw e2;

    if (past) {
      const { data: tx, error: e3 } = await db
        .from("finance_account_transactions")
        .insert({
          organization_id: input.organization_id,
          account_id: input.account_id,
          amount: -Math.abs(row.amount),
          tx_date: row.date || today,
          kind: "expense",
          expense_occurrence_id: occ.id,
          created_by: input.created_by,
        })
        .select()
        .single();
      if (e3) throw e3;
      await db
        .from("finance_expense_occurrences")
        .update({ account_transaction_id: tx.id })
        .eq("id", occ.id);
    }
    count++;
  }
  return count;
}

// ---- Templates ---------------------------------------------------------------

export async function listTemplates(
  orgId: string
): Promise<FinanceExpenseTemplate[]> {
  const { data, error } = await db
    .from("finance_expense_templates")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FinanceExpenseTemplate[];
}

export async function createTemplate(
  input: Partial<FinanceExpenseTemplate> & {
    organization_id: string;
    owner_id: string;
    name: string;
  }
): Promise<FinanceExpenseTemplate> {
  const { data, error } = await db
    .from("finance_expense_templates")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as FinanceExpenseTemplate;
}

export async function updateTemplate(
  id: string,
  patch: Partial<FinanceExpenseTemplate>
): Promise<FinanceExpenseTemplate> {
  const { data, error } = await db
    .from("finance_expense_templates")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as FinanceExpenseTemplate;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await db.from("finance_expense_templates").delete().eq("id", id);
  if (error) throw error;
}

// ---- Closings & carryovers ---------------------------------------------------

export async function listClosings(
  orgId: string
): Promise<FinanceMonthlyClosing[]> {
  const { data, error } = await db
    .from("finance_monthly_closings")
    .select("*")
    .eq("organization_id", orgId)
    .order("period_month", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FinanceMonthlyClosing[];
}

export async function upsertClosing(
  input: Partial<FinanceMonthlyClosing> & {
    organization_id: string;
    budget_id: string;
    period_month: string;
  }
): Promise<FinanceMonthlyClosing> {
  const { data, error } = await db
    .from("finance_monthly_closings")
    .upsert(input, { onConflict: "budget_id,period_month" })
    .select()
    .single();
  if (error) throw error;
  return data as FinanceMonthlyClosing;
}

export async function listCarryovers(
  orgId: string
): Promise<FinanceCarryoverTransfer[]> {
  const { data, error } = await db
    .from("finance_carryover_transfers")
    .select("*")
    .eq("organization_id", orgId)
    .order("period_month", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FinanceCarryoverTransfer[];
}

export async function createCarryover(input: {
  organization_id: string;
  from_budget_id: string;
  to_budget_id: string;
  period_month: string;
  amount: number;
  note?: string | null;
  created_by: string;
}): Promise<void> {
  const { error } = await db.from("finance_carryover_transfers").insert(input);
  if (error) throw error;
}

// ---- Event log ---------------------------------------------------------------

export async function logEvent(input: {
  organization_id: string;
  entity_type: string;
  entity_id: string;
  user_id: string;
  action: string;
  field?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  note?: string | null;
}): Promise<void> {
  const { error } = await db.from("finance_event_log").insert(input);
  if (error) throw error;
}

export async function listEvents(
  entityType: string,
  entityId: string
): Promise<FinanceEvent[]> {
  const { data, error } = await db
    .from("finance_event_log")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FinanceEvent[];
}
