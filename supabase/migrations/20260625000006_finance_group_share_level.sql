-- =============================================================================
-- Move the share level to the "תקציב כולל" (group). Sharing is defined per full
-- budget; sub-budgets inherit their group's level. Ungrouped single budgets
-- keep their own budget-level share_level as a fallback.
--
-- Effective level = coalesce(group.share_level, budget.share_level).
-- =============================================================================

alter table public.finance_budget_groups
  add column if not exists share_level text not null default 'transact'
    check (share_level in ('view','transact','full'));

-- Access helper now resolves the level through the group when present.
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
        p_need = 'read'
        or (p_need = 'transact' and coalesce(g.share_level, b.share_level) in ('transact','full'))
        or (p_need = 'edit'     and coalesce(g.share_level, b.share_level) = 'full')
      )
    )
  from public.finance_budgets b
  left join public.finance_budget_groups g on g.id = b.group_id
  where b.id = p_budget_id;
$$;

-- finance_budgets' own update/delete policies must use the effective level too.
drop policy if exists "finance_budgets: update if edit" on public.finance_budgets;
drop policy if exists "finance_budgets: delete if edit" on public.finance_budgets;

create policy "finance_budgets: update if edit" on public.finance_budgets for update
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or (
      user_is_org_member(organization_id, auth.uid())
      and org_finance_is_shared(organization_id)
      and coalesce(
        (select g.share_level from public.finance_budget_groups g where g.id = finance_budgets.group_id),
        share_level
      ) = 'full'
    )
  )
  with check (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or (
      user_is_org_member(organization_id, auth.uid())
      and org_finance_is_shared(organization_id)
      and coalesce(
        (select g.share_level from public.finance_budget_groups g where g.id = finance_budgets.group_id),
        share_level
      ) = 'full'
    )
  );

create policy "finance_budgets: delete if edit" on public.finance_budgets for delete
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or (
      user_is_org_member(organization_id, auth.uid())
      and org_finance_is_shared(organization_id)
      and coalesce(
        (select g.share_level from public.finance_budget_groups g where g.id = finance_budgets.group_id),
        share_level
      ) = 'full'
    )
  );
