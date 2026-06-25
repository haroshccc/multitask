-- =============================================================================
-- Finance sharing: org-level toggle + family org auto-share (mirrors food).
--
-- Adds `finance_shared` to organizations. When true (or org_type='family'),
-- all org members can read & write each other's finance data. Otherwise each
-- member only sees their OWN budgets/accounts/expenses (private by default).
--
-- Child tables (versions, transactions, expenses, occurrences, closings) gate
-- through their parent budget/account's owner, exactly like meal_ingredients
-- gates through meals.
-- =============================================================================

-- 1. Column + helper ----------------------------------------------------------
alter table public.organizations
  add column if not exists finance_shared boolean not null default false;

create or replace function public.org_finance_is_shared(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select finance_shared or org_type::text = 'family'
       from public.organizations
      where id = p_org_id),
    false
  );
$$;

-- 2. Drop the initial org-member policies ------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'finance_budgets','finance_budget_versions','finance_accounts',
    'finance_account_transactions','finance_expense_templates','finance_expenses',
    'finance_expense_occurrences','finance_monthly_closings',
    'finance_carryover_transfers','finance_event_log'
  ] loop
    execute format('drop policy if exists "%1$s: org members read" on public.%1$s;', t);
    execute format('drop policy if exists "%1$s: org members write" on public.%1$s;', t);
  end loop;
end $$;

-- 3. New policies: owner OR (org member when finance is shared) ---------------

-- Owner tables (own owner_id) --------------------------------------------------
create policy "finance_budgets: owner or shared org" on public.finance_budgets for all
  using (
    owner_id = auth.uid() or user_is_super_admin(auth.uid())
    or (user_is_org_member(organization_id, auth.uid()) and org_finance_is_shared(organization_id))
  )
  with check (
    owner_id = auth.uid() or user_is_super_admin(auth.uid())
    or (user_is_org_member(organization_id, auth.uid()) and org_finance_is_shared(organization_id))
  );

create policy "finance_accounts: owner or shared org" on public.finance_accounts for all
  using (
    owner_id = auth.uid() or user_is_super_admin(auth.uid())
    or (user_is_org_member(organization_id, auth.uid()) and org_finance_is_shared(organization_id))
  )
  with check (
    owner_id = auth.uid() or user_is_super_admin(auth.uid())
    or (user_is_org_member(organization_id, auth.uid()) and org_finance_is_shared(organization_id))
  );

create policy "finance_expense_templates: owner or shared org" on public.finance_expense_templates for all
  using (
    owner_id = auth.uid() or user_is_super_admin(auth.uid())
    or (user_is_org_member(organization_id, auth.uid()) and org_finance_is_shared(organization_id))
  )
  with check (
    owner_id = auth.uid() or user_is_super_admin(auth.uid())
    or (user_is_org_member(organization_id, auth.uid()) and org_finance_is_shared(organization_id))
  );

-- Budget-child tables (gate via the parent budget's owner) --------------------
do $$
declare t text;
begin
  foreach t in array array[
    'finance_budget_versions','finance_expenses',
    'finance_expense_occurrences','finance_monthly_closings'
  ] loop
    execute format($f$
      create policy "%1$s: via budget owner or shared org" on public.%1$s for all
      using (
        exists (
          select 1 from public.finance_budgets b
          where b.id = %1$s.budget_id
            and (
              b.owner_id = auth.uid() or user_is_super_admin(auth.uid())
              or (user_is_org_member(b.organization_id, auth.uid()) and org_finance_is_shared(b.organization_id))
            )
        )
      )
      with check (
        exists (
          select 1 from public.finance_budgets b
          where b.id = %1$s.budget_id
            and (
              b.owner_id = auth.uid() or user_is_super_admin(auth.uid())
              or (user_is_org_member(b.organization_id, auth.uid()) and org_finance_is_shared(b.organization_id))
            )
        )
      );
    $f$, t);
  end loop;
end $$;

-- Account transactions (gate via the parent account's owner) ------------------
create policy "finance_account_transactions: via account owner or shared org"
  on public.finance_account_transactions for all
  using (
    exists (
      select 1 from public.finance_accounts a
      where a.id = finance_account_transactions.account_id
        and (
          a.owner_id = auth.uid() or user_is_super_admin(auth.uid())
          or (user_is_org_member(a.organization_id, auth.uid()) and org_finance_is_shared(a.organization_id))
        )
    )
  )
  with check (
    exists (
      select 1 from public.finance_accounts a
      where a.id = finance_account_transactions.account_id
        and (
          a.owner_id = auth.uid() or user_is_super_admin(auth.uid())
          or (user_is_org_member(a.organization_id, auth.uid()) and org_finance_is_shared(a.organization_id))
        )
    )
  );

-- Carryover transfers (creator, or any member when shared) --------------------
create policy "finance_carryover_transfers: creator or shared org"
  on public.finance_carryover_transfers for all
  using (
    created_by = auth.uid() or user_is_super_admin(auth.uid())
    or (user_is_org_member(organization_id, auth.uid()) and org_finance_is_shared(organization_id))
  )
  with check (
    created_by = auth.uid() or user_is_super_admin(auth.uid())
    or (user_is_org_member(organization_id, auth.uid()) and org_finance_is_shared(organization_id))
  );

-- Event log (actor, or any member when shared) --------------------------------
create policy "finance_event_log: actor or shared org"
  on public.finance_event_log for all
  using (
    user_id = auth.uid() or user_is_super_admin(auth.uid())
    or (user_is_org_member(organization_id, auth.uid()) and org_finance_is_shared(organization_id))
  )
  with check (
    user_id = auth.uid() or user_is_super_admin(auth.uid())
    or (user_is_org_member(organization_id, auth.uid()) and org_finance_is_shared(organization_id))
  );
