-- =============================================================================
-- Budget groups ("תקציב כולל") — a named umbrella that holds many sub-budgets.
-- The user builds a whole budget at once: one required name + several
-- sub-budgets (each a normal finance_budgets row linked via group_id). The
-- group has no amount of its own; its total is the sum of its sub-budgets.
-- =============================================================================

create table if not exists public.finance_budget_groups (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id        uuid references auth.users(id) on delete set null,
  name            text not null,
  sort_order      int not null default 0,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists finance_budget_groups_org_idx
  on public.finance_budget_groups(organization_id);

alter table public.finance_budgets
  add column if not exists group_id uuid
    references public.finance_budget_groups(id) on delete set null;
create index if not exists finance_budgets_group_idx on public.finance_budgets(group_id);

drop trigger if exists trg_finance_budget_groups_updated_at on public.finance_budget_groups;
create trigger trg_finance_budget_groups_updated_at before update on public.finance_budget_groups
  for each row execute function public.set_updated_at();

-- RLS: readable by owner or any member when finance is shared; managed by owner.
alter table public.finance_budget_groups enable row level security;

create policy "finance_budget_groups: read" on public.finance_budget_groups for select
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or (user_is_org_member(organization_id, auth.uid()) and org_finance_is_shared(organization_id))
  );
create policy "finance_budget_groups: insert own" on public.finance_budget_groups for insert
  with check (owner_id = auth.uid() or user_is_super_admin(auth.uid()));
create policy "finance_budget_groups: update own" on public.finance_budget_groups for update
  using (owner_id = auth.uid() or user_is_super_admin(auth.uid()))
  with check (owner_id = auth.uid() or user_is_super_admin(auth.uid()));
create policy "finance_budget_groups: delete own" on public.finance_budget_groups for delete
  using (owner_id = auth.uid() or user_is_super_admin(auth.uid()));
