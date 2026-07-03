-- =============================================================================
-- Fix: finance_budgets' own RLS policies used finance_budget_access(id, ...),
-- which re-queries finance_budgets. During INSERT ... RETURNING (the Supabase
-- client's .insert().select()), that self-referencing subquery cannot see the
-- just-inserted row, so the SELECT policy evaluates false and the whole insert
-- is rejected with "new row violates row-level security policy".
--
-- Inline the checks using the row's own columns instead. Child tables keep
-- using finance_budget_access() because they reference the PARENT budget, which
-- already exists at insert time.
-- =============================================================================

drop policy if exists "finance_budgets: read" on public.finance_budgets;
drop policy if exists "finance_budgets: update if edit" on public.finance_budgets;
drop policy if exists "finance_budgets: delete if edit" on public.finance_budgets;

create policy "finance_budgets: read" on public.finance_budgets for select
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or (user_is_org_member(organization_id, auth.uid()) and org_finance_is_shared(organization_id))
  );

create policy "finance_budgets: update if edit" on public.finance_budgets for update
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or (user_is_org_member(organization_id, auth.uid()) and org_finance_is_shared(organization_id) and share_level = 'full')
  )
  with check (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or (user_is_org_member(organization_id, auth.uid()) and org_finance_is_shared(organization_id) and share_level = 'full')
  );

create policy "finance_budgets: delete if edit" on public.finance_budgets for delete
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or (user_is_org_member(organization_id, auth.uid()) and org_finance_is_shared(organization_id) and share_level = 'full')
  );
