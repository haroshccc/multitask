-- =============================================================================
-- Per-budget share level (view / transact / full).
--
-- Builds on org-level finance sharing: when the org has finance sharing on
-- (finance_shared OR family), each budget's owner picks what OTHER members may
-- do with THAT budget:
--   • view     — read only
--   • transact — read + add/remove expenses & mark charged/paid, but NOT edit
--                the budget itself (no amount/version/closing/transfer changes)
--   • full     — everything
-- The owner always has full control. Accounts keep the org-level shared model.
-- =============================================================================

alter table public.finance_budgets
  add column if not exists share_level text not null default 'transact'
    check (share_level in ('view','transact','full'));

-- Central access check used by all budget-scoped policies.
create or replace function public.finance_budget_access(p_budget_id uuid, p_need text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    b.owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or (
      user_is_org_member(b.organization_id, auth.uid())
      and org_finance_is_shared(b.organization_id)
      and (
        (p_need = 'read'     and b.share_level in ('view','transact','full'))
        or (p_need = 'transact' and b.share_level in ('transact','full'))
        or (p_need = 'edit'     and b.share_level = 'full')
      )
    )
  from public.finance_budgets b
  where b.id = p_budget_id;
$$;

-- Drop the org-level finance-sharing policies for budget-scoped tables --------
drop policy if exists "finance_budgets: owner or shared org" on public.finance_budgets;
drop policy if exists "finance_budget_versions: via budget owner or shared org" on public.finance_budget_versions;
drop policy if exists "finance_expenses: via budget owner or shared org" on public.finance_expenses;
drop policy if exists "finance_expense_occurrences: via budget owner or shared org" on public.finance_expense_occurrences;
drop policy if exists "finance_monthly_closings: via budget owner or shared org" on public.finance_monthly_closings;
drop policy if exists "finance_carryover_transfers: creator or shared org" on public.finance_carryover_transfers;

-- finance_budgets -------------------------------------------------------------
create policy "finance_budgets: read" on public.finance_budgets for select
  using (finance_budget_access(id, 'read'));
create policy "finance_budgets: insert own" on public.finance_budgets for insert
  with check (owner_id = auth.uid() or user_is_super_admin(auth.uid()));
create policy "finance_budgets: update if edit" on public.finance_budgets for update
  using (finance_budget_access(id, 'edit')) with check (finance_budget_access(id, 'edit'));
create policy "finance_budgets: delete if edit" on public.finance_budgets for delete
  using (finance_budget_access(id, 'edit'));

-- Budget definition: versions require EDIT -----------------------------------
create policy "finance_budget_versions: read" on public.finance_budget_versions for select
  using (finance_budget_access(budget_id, 'read'));
create policy "finance_budget_versions: write if edit" on public.finance_budget_versions for insert
  with check (finance_budget_access(budget_id, 'edit'));
create policy "finance_budget_versions: update if edit" on public.finance_budget_versions for update
  using (finance_budget_access(budget_id, 'edit')) with check (finance_budget_access(budget_id, 'edit'));
create policy "finance_budget_versions: delete if edit" on public.finance_budget_versions for delete
  using (finance_budget_access(budget_id, 'edit'));

-- Expenses + occurrences: require TRANSACT -----------------------------------
create policy "finance_expenses: read" on public.finance_expenses for select
  using (finance_budget_access(budget_id, 'read'));
create policy "finance_expenses: write if transact" on public.finance_expenses for insert
  with check (finance_budget_access(budget_id, 'transact'));
create policy "finance_expenses: update if transact" on public.finance_expenses for update
  using (finance_budget_access(budget_id, 'transact')) with check (finance_budget_access(budget_id, 'transact'));
create policy "finance_expenses: delete if transact" on public.finance_expenses for delete
  using (finance_budget_access(budget_id, 'transact'));

create policy "finance_expense_occurrences: read" on public.finance_expense_occurrences for select
  using (finance_budget_access(budget_id, 'read'));
create policy "finance_expense_occurrences: write if transact" on public.finance_expense_occurrences for insert
  with check (finance_budget_access(budget_id, 'transact'));
create policy "finance_expense_occurrences: update if transact" on public.finance_expense_occurrences for update
  using (finance_budget_access(budget_id, 'transact')) with check (finance_budget_access(budget_id, 'transact'));
create policy "finance_expense_occurrences: delete if transact" on public.finance_expense_occurrences for delete
  using (finance_budget_access(budget_id, 'transact'));

-- Monthly closings: management → require EDIT --------------------------------
create policy "finance_monthly_closings: read" on public.finance_monthly_closings for select
  using (finance_budget_access(budget_id, 'read'));
create policy "finance_monthly_closings: write if edit" on public.finance_monthly_closings for insert
  with check (finance_budget_access(budget_id, 'edit'));
create policy "finance_monthly_closings: update if edit" on public.finance_monthly_closings for update
  using (finance_budget_access(budget_id, 'edit')) with check (finance_budget_access(budget_id, 'edit'));
create policy "finance_monthly_closings: delete if edit" on public.finance_monthly_closings for delete
  using (finance_budget_access(budget_id, 'edit'));

-- Carryover transfers: move a budget's surplus → require EDIT on source -------
create policy "finance_carryover_transfers: read" on public.finance_carryover_transfers for select
  using (
    user_is_super_admin(auth.uid())
    or created_by = auth.uid()
    or (user_is_org_member(organization_id, auth.uid()) and org_finance_is_shared(organization_id))
  );
create policy "finance_carryover_transfers: write if edit source" on public.finance_carryover_transfers for insert
  with check (finance_budget_access(from_budget_id, 'edit'));
create policy "finance_carryover_transfers: delete if edit source" on public.finance_carryover_transfers for delete
  using (finance_budget_access(from_budget_id, 'edit'));
