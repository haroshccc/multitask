/**
 * Finance module domain types (התנהלות כלכלית).
 * See docs/finance-module-spec.md for the conceptual model. These rows are not
 * yet in the generated Supabase types, so they are declared standalone here.
 */

export type BudgetPeriod = "monthly" | "yearly";
export type RemainderUnit = "month" | "week" | "day";
export type AccountKind = "bank" | "credit" | "cash";
export type PaymentMethod = "credit" | "bank" | "cash";
export type ExpenseKind = "fixed" | "onetime" | "recurring_variable";
export type BudgetChargeMode = "auto" | "manual_check";
export type WithdrawalTiming = "immediate" | "future_date";
export type AccountTxKind =
  | "expense"
  | "transfer_in"
  | "transfer_out"
  | "adjustment"
  | "income";

export interface FinanceBudget {
  id: string;
  organization_id: string;
  owner_id: string | null;
  name: string;
  color: string;
  icon: string;
  category: string | null;
  is_shared: boolean;
  remainder_views: RemainderUnit[];
  sort_order: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinanceBudgetVersion {
  id: string;
  organization_id: string;
  budget_id: string;
  title: string;
  amount: number;
  period: BudgetPeriod;
  effective_from: string;
  effective_to: string | null;
  created_by: string | null;
  created_at: string;
}

export interface FinanceAccount {
  id: string;
  organization_id: string;
  owner_id: string | null;
  name: string;
  kind: AccountKind;
  color: string;
  opening_balance: number;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinanceAccountTransaction {
  id: string;
  organization_id: string;
  account_id: string;
  amount: number; // signed: negative = out, positive = in
  tx_date: string;
  kind: AccountTxKind;
  counterpart_account_id: string | null;
  expense_occurrence_id: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface FinanceExpenseTemplate {
  id: string;
  organization_id: string;
  owner_id: string | null;
  name: string;
  budget_id: string | null;
  account_id: string | null;
  payment_method: PaymentMethod | null;
  default_amount: number | null;
  budget_charge_mode: BudgetChargeMode | null;
  withdrawal_timing: WithdrawalTiming | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceExpense {
  id: string;
  organization_id: string;
  budget_id: string;
  account_id: string | null;
  payment_method: PaymentMethod | null;
  kind: ExpenseKind;
  title: string;
  default_amount: number;
  recurrence_rule: string | null;
  budget_charge_mode: BudgetChargeMode;
  withdrawal_timing: WithdrawalTiming;
  withdrawal_offset_days: number | null;
  template_id: string | null;
  created_by: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinanceOccurrence {
  id: string;
  organization_id: string;
  expense_id: string;
  budget_id: string;
  account_id: string | null;
  amount: number;
  due_date: string;
  budget_charged: boolean;
  budget_charged_at: string | null;
  withdrawal_date: string | null;
  withdrawn: boolean;
  withdrawn_at: string | null;
  account_transaction_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceClosingReason {
  expense_title: string;
  delta: number; // + saved / - overspent vs baseline share
}

export interface FinanceMonthlyClosing {
  id: string;
  organization_id: string;
  budget_id: string;
  period_month: string;
  allocated: number;
  charged: number;
  balance: number;
  auto_reason: FinanceClosingReason[];
  manual_note: string | null;
  closed_by: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceCarryoverTransfer {
  id: string;
  organization_id: string;
  from_budget_id: string | null;
  to_budget_id: string | null;
  period_month: string;
  amount: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface FinanceEvent {
  id: string;
  organization_id: string;
  entity_type: string;
  entity_id: string;
  user_id: string | null;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  note: string | null;
  occurred_at: string;
}

// ---- Display metadata --------------------------------------------------------

export const ACCOUNT_KIND_META: Record<
  AccountKind,
  { label: string; icon: string }
> = {
  bank: { label: "עו\"ש", icon: "landmark" },
  credit: { label: "אשראי", icon: "credit-card" },
  cash: { label: "מזומן", icon: "banknote" },
};

export const PAYMENT_METHOD_META: Record<PaymentMethod, { label: string }> = {
  credit: { label: "אשראי" },
  bank: { label: "העברה / חיוב בנקאי" },
  cash: { label: "מזומן" },
};

export const EXPENSE_KIND_META: Record<ExpenseKind, { label: string }> = {
  fixed: { label: "קבועה" },
  onetime: { label: "חד-פעמית" },
  recurring_variable: { label: "נשנית" },
};

export const REMAINDER_UNIT_META: Record<
  RemainderUnit,
  { label: string; suffix: string }
> = {
  month: { label: "לחודש", suffix: "" },
  week: { label: "לשבוע", suffix: "₪/שבוע" },
  day: { label: "ליום", suffix: "₪/יום" },
};

export const ALL_REMAINDER_UNITS: RemainderUnit[] = ["month", "week", "day"];
