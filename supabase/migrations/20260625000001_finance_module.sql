-- =============================================================================
-- Finance module (התנהלות כלכלית) — personal expense management.
--
-- Two separate entities (see docs/finance-module-spec.md §2):
--   • Budget (תקציב)  — an envelope. Holds what was *charged* (committed),
--                       whether or not it has actually left an account yet.
--   • Account (חשבון) — a real bank/credit/cash account. Holds what actually
--                       *left in practice*. Accounts can transfer between each
--                       other. A budget is NOT directly tied to an account.
--
-- An Expense links the two: it is charged to a budget and withdrawn from an
-- account, and those two events can happen on different dates.
--
-- All tables are org-scoped with the standard org-member RLS. Family sharing
-- (org_type='family') therefore works out of the box. Per-budget personal vs
-- shared refinement is a later phase; `is_shared` is reserved for it.
-- =============================================================================

-- 1. Budgets (תקציב) ----------------------------------------------------------
create table if not exists public.finance_budgets (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id        uuid references auth.users(id) on delete set null,
  name            text not null default '',
  color           text not null default '#f59e0b',
  icon            text not null default 'wallet',
  category        text,
  is_shared       boolean not null default false,
  -- which remainder breakdowns to show on the card: any of month/week/day
  remainder_views text[] not null default array['month']::text[],
  sort_order      int not null default 0,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists finance_budgets_org_idx on public.finance_budgets(organization_id);

-- 2. Budget versions (גרסאות תקציב) — every edit forces a titled version ------
create table if not exists public.finance_budget_versions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  budget_id       uuid not null references public.finance_budgets(id) on delete cascade,
  title           text not null,
  amount          numeric(14,2) not null default 0,
  period          text not null default 'monthly' check (period in ('monthly','yearly')),
  effective_from  date not null default current_date,
  effective_to    date,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists finance_budget_versions_budget_idx
  on public.finance_budget_versions(budget_id, effective_from desc);

-- 3. Accounts (חשבון) ---------------------------------------------------------
create table if not exists public.finance_accounts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id        uuid references auth.users(id) on delete set null,
  name            text not null default '',
  kind            text not null default 'bank' check (kind in ('bank','credit','cash')),
  color           text not null default '#6b6b80',
  opening_balance numeric(14,2) not null default 0,
  sort_order      int not null default 0,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists finance_accounts_org_idx on public.finance_accounts(organization_id);

-- 4. Account transactions (תנועות חשבון) — signed; transfers come in pairs ----
create table if not exists public.finance_account_transactions (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations(id) on delete cascade,
  account_id             uuid not null references public.finance_accounts(id) on delete cascade,
  amount                 numeric(14,2) not null,   -- negative = out, positive = in
  tx_date                date not null default current_date,
  kind                   text not null default 'expense'
                           check (kind in ('expense','transfer_in','transfer_out','adjustment','income')),
  counterpart_account_id uuid references public.finance_accounts(id) on delete set null,
  expense_occurrence_id  uuid,  -- soft link; FK added after occurrences table
  note                   text,
  created_by             uuid references auth.users(id) on delete set null,
  created_at             timestamptz not null default now()
);
create index if not exists finance_acct_tx_account_idx
  on public.finance_account_transactions(account_id, tx_date desc);

-- 5. Expense templates (שבלונות) — defaults for the "recurring-variable" flow -
create table if not exists public.finance_expense_templates (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  owner_id           uuid references auth.users(id) on delete set null,
  name               text not null default '',
  budget_id          uuid references public.finance_budgets(id) on delete set null,
  account_id         uuid references public.finance_accounts(id) on delete set null,
  payment_method     text check (payment_method in ('credit','bank','cash')),
  default_amount     numeric(14,2),
  budget_charge_mode text check (budget_charge_mode in ('auto','manual_check')),
  withdrawal_timing  text check (withdrawal_timing in ('immediate','future_date')),
  note               text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists finance_templates_org_idx on public.finance_expense_templates(organization_id);

-- 6. Expenses (הוצאה) — links a budget to an account ------------------------
create table if not exists public.finance_expenses (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations(id) on delete cascade,
  budget_id          uuid not null references public.finance_budgets(id) on delete cascade,
  account_id         uuid references public.finance_accounts(id) on delete set null,
  payment_method     text check (payment_method in ('credit','bank','cash')),
  kind               text not null default 'onetime'
                       check (kind in ('fixed','onetime','recurring_variable')),
  title              text not null default '',
  default_amount     numeric(14,2) not null default 0,
  recurrence_rule    text,  -- RFC5545 (no RRULE: prefix) for kind='fixed'
  budget_charge_mode text not null default 'auto'
                       check (budget_charge_mode in ('auto','manual_check')),
  withdrawal_timing  text not null default 'immediate'
                       check (withdrawal_timing in ('immediate','future_date')),
  withdrawal_offset_days int,  -- e.g. credit-card billing delay
  template_id        uuid references public.finance_expense_templates(id) on delete set null,
  created_by         uuid references auth.users(id) on delete set null,
  is_archived        boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists finance_expenses_budget_idx on public.finance_expenses(budget_id);

-- 7. Expense occurrences (מופע) — the chargeable unit -------------------------
create table if not exists public.finance_expense_occurrences (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid not null references public.organizations(id) on delete cascade,
  expense_id            uuid not null references public.finance_expenses(id) on delete cascade,
  budget_id             uuid not null references public.finance_budgets(id) on delete cascade,
  account_id            uuid references public.finance_accounts(id) on delete set null,
  amount                numeric(14,2) not null default 0,
  due_date              date not null default current_date,  -- budget charge date
  budget_charged        boolean not null default false,
  budget_charged_at     timestamptz,
  withdrawal_date       date,                                 -- planned account withdrawal
  withdrawn             boolean not null default false,        -- "paid in practice"
  withdrawn_at          timestamptz,
  account_transaction_id uuid references public.finance_account_transactions(id) on delete set null,
  note                  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists finance_occ_budget_idx
  on public.finance_expense_occurrences(budget_id, due_date);
create index if not exists finance_occ_expense_idx
  on public.finance_expense_occurrences(expense_id);

-- back-fill the soft link from transactions to occurrences
alter table public.finance_account_transactions
  drop constraint if exists finance_acct_tx_occurrence_fk;
alter table public.finance_account_transactions
  add constraint finance_acct_tx_occurrence_fk
  foreign key (expense_occurrence_id)
  references public.finance_expense_occurrences(id) on delete set null;

-- 8. Monthly closings (סגירה חודשית — עודף/גרעון) ----------------------------
create table if not exists public.finance_monthly_closings (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  budget_id       uuid not null references public.finance_budgets(id) on delete cascade,
  period_month    date not null,  -- first day of the closed month
  allocated       numeric(14,2) not null default 0,
  charged         numeric(14,2) not null default 0,
  balance         numeric(14,2) not null default 0,  -- + surplus / - deficit
  auto_reason     jsonb not null default '[]'::jsonb,
  manual_note     text,
  closed_by       uuid references auth.users(id) on delete set null,
  closed_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (budget_id, period_month)
);
create index if not exists finance_closings_budget_idx
  on public.finance_monthly_closings(budget_id, period_month desc);

-- 9. Carryover transfers (העברת עודף/גרעון בין תקציבים — חד-פעמי) -------------
create table if not exists public.finance_carryover_transfers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  from_budget_id  uuid references public.finance_budgets(id) on delete set null,
  to_budget_id    uuid references public.finance_budgets(id) on delete set null,
  period_month    date not null,
  amount          numeric(14,2) not null default 0,
  note            text,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);
create index if not exists finance_carryover_org_idx
  on public.finance_carryover_transfers(organization_id, period_month desc);

-- 10. Event log (היסטוריה חשופה — audit) -------------------------------------
create table if not exists public.finance_event_log (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type     text not null,  -- 'budget' | 'account' | 'expense' | 'closing'
  entity_id       uuid not null,
  user_id         uuid references auth.users(id) on delete set null,
  action          text not null,  -- 'create' | 'update' | 'delete' | 'transfer' | ...
  field           text,
  old_value       text,
  new_value       text,
  note            text,
  occurred_at     timestamptz not null default now()
);
create index if not exists finance_event_log_entity_idx
  on public.finance_event_log(entity_type, entity_id, occurred_at desc);
create index if not exists finance_event_log_org_idx
  on public.finance_event_log(organization_id, occurred_at desc);

-- =============================================================================
-- updated_at triggers
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'finance_budgets','finance_accounts','finance_expense_templates',
    'finance_expenses','finance_expense_occurrences','finance_monthly_closings'
  ] loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$s;', t);
    execute format(
      'create trigger trg_%1$s_updated_at before update on public.%1$s
         for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- =============================================================================
-- RLS — standard org-member read/write (mirrors plan_decisions etc.)
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'finance_budgets','finance_budget_versions','finance_accounts',
    'finance_account_transactions','finance_expense_templates','finance_expenses',
    'finance_expense_occurrences','finance_monthly_closings',
    'finance_carryover_transfers','finance_event_log'
  ] loop
    execute format('alter table public.%1$s enable row level security;', t);

    execute format($f$
      drop policy if exists "%1$s: org members read" on public.%1$s;
      create policy "%1$s: org members read" on public.%1$s for select
        using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));
    $f$, t);

    execute format($f$
      drop policy if exists "%1$s: org members write" on public.%1$s;
      create policy "%1$s: org members write" on public.%1$s for all
        using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
        with check (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));
    $f$, t);
  end loop;
end $$;
