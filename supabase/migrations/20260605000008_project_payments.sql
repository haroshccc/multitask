-- Project payments (income / expenses) — mirrors project_meetings' shape and
-- RLS so a project share grants access. Custom columns reuse the configurable
-- table via entity_type='payment'.
create table if not exists public.project_payments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  title           text not null default '',
  direction       text not null default 'in' check (direction in ('in','out')),
  amount_cents    bigint not null default 0,
  currency        text not null default 'ILS',
  status          text not null default 'pending'
                    check (status in ('pending','paid','overdue','cancelled')),
  due_date        date,
  paid_date       date,
  notes           text,
  custom_fields   jsonb not null default '{}'::jsonb,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists project_payments_project_id_idx
  on public.project_payments (project_id);

alter table public.project_payments enable row level security;

create policy "project_payments: owner or project-shared read"
  on public.project_payments for select
  using (
    (owner_id = auth.uid())
    or user_is_super_admin(auth.uid())
    or user_has_share('project'::share_entity_type, project_id, auth.uid())
  );

create policy "project_payments: org member insert as owner"
  on public.project_payments for insert
  with check (
    (owner_id = auth.uid())
    and user_is_org_member(organization_id, auth.uid())
  );

create policy "project_payments: owner or project-write update"
  on public.project_payments for update
  using (
    (owner_id = auth.uid())
    or user_is_super_admin(auth.uid())
    or (exists (
      select 1 from shares s
      where s.entity_type = 'project'::share_entity_type
        and s.entity_id = project_payments.project_id
        and s.user_id = auth.uid()
        and s.permission = 'write'::share_permission
    ))
  )
  with check (true);

create policy "project_payments: owner delete"
  on public.project_payments for delete
  using ((owner_id = auth.uid()) or user_is_super_admin(auth.uid()));
