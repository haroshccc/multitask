-- =============================================================================
-- Credit-import batches — a record of each "ייבוא הוצאות מאשראי" (import date +
-- source account) so the user has a memory of what was already imported and can
-- avoid duplicates. Imported expenses link back via credit_import_id.
-- =============================================================================

create table if not exists public.finance_credit_imports (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id        uuid references auth.users(id) on delete set null,
  account_id      uuid references public.finance_accounts(id) on delete set null,
  imported_on     date not null default current_date,
  note            text,
  created_at      timestamptz not null default now()
);
create index if not exists finance_credit_imports_org_idx
  on public.finance_credit_imports(organization_id, imported_on desc);

alter table public.finance_expenses
  add column if not exists credit_import_id uuid
    references public.finance_credit_imports(id) on delete set null;
create index if not exists finance_expenses_credit_import_idx
  on public.finance_expenses(credit_import_id);

-- RLS: owner or any member when finance is shared (mirrors accounts).
alter table public.finance_credit_imports enable row level security;

create policy "finance_credit_imports: owner or shared org"
  on public.finance_credit_imports for all
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or (user_is_org_member(organization_id, auth.uid()) and org_finance_is_shared(organization_id))
  )
  with check (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or (user_is_org_member(organization_id, auth.uid()) and org_finance_is_shared(organization_id))
  );
