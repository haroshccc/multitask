-- ── CRM: org-level contacts (customers / suppliers) ─────────────────────────
create table if not exists public.contacts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type            text not null default 'customer' check (type in ('customer','supplier')),
  name            text not null default '',
  company         text,
  tax_id          text,                 -- ע.מ / ח.פ
  email           text,
  phone           text,
  address         text,
  notes           text,
  shared_with_org boolean not null default false,
  custom_fields   jsonb not null default '{}'::jsonb,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists contacts_org_idx on public.contacts (organization_id);

-- ── Link contacts to projects (many-to-many) ────────────────────────────────
create table if not exists public.project_contacts (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (project_id, contact_id)
);
create index if not exists project_contacts_project_idx on public.project_contacts (project_id);
create index if not exists project_contacts_contact_idx on public.project_contacts (contact_id);

-- ── Helper: can the user see a contact via an accessible linked project? ─────
-- SECURITY DEFINER so the contacts policy doesn't recurse through RLS.
create or replace function public.user_sees_contact_via_project(p_contact_id uuid, p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.project_contacts pc
    join public.projects p on p.id = pc.project_id
    where pc.contact_id = p_contact_id
      and (p.owner_id = p_uid
           or public.user_has_share('project'::share_entity_type, pc.project_id, p_uid))
  );
$$;

-- ── Forced org-share: linking a contact to a SHARED project shares it ────────
create or replace function public.enforce_contact_org_share()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.shares s
    where s.entity_type = 'project'::share_entity_type and s.entity_id = new.project_id
  ) then
    update public.contacts
       set shared_with_org = true, updated_at = now()
     where id = new.contact_id and shared_with_org = false;
  end if;
  return new;
end $$;

drop trigger if exists project_contacts_force_share on public.project_contacts;
create trigger project_contacts_force_share
  after insert on public.project_contacts
  for each row execute function public.enforce_contact_org_share();

-- ── RLS: contacts ───────────────────────────────────────────────────────────
alter table public.contacts enable row level security;

create policy "contacts: read (owner / org-shared / via project)"
  on public.contacts for select using (
    (owner_id = auth.uid())
    or user_is_super_admin(auth.uid())
    or (shared_with_org and user_is_org_member(organization_id, auth.uid()))
    or user_sees_contact_via_project(id, auth.uid())
  );

create policy "contacts: org member insert as owner"
  on public.contacts for insert with check (
    (owner_id = auth.uid()) and user_is_org_member(organization_id, auth.uid())
  );

create policy "contacts: owner or org-shared update"
  on public.contacts for update using (
    (owner_id = auth.uid())
    or user_is_super_admin(auth.uid())
    or (shared_with_org and user_is_org_member(organization_id, auth.uid()))
  ) with check (true);

create policy "contacts: owner delete"
  on public.contacts for delete using (
    (owner_id = auth.uid()) or user_is_super_admin(auth.uid())
  );

-- ── RLS: project_contacts (gated by project access) ─────────────────────────
alter table public.project_contacts enable row level security;

create policy "project_contacts: read via project access"
  on public.project_contacts for select using (
    user_is_super_admin(auth.uid())
    or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
    or user_has_share('project'::share_entity_type, project_id, auth.uid())
  );

create policy "project_contacts: write via project owner/write-share"
  on public.project_contacts for insert with check (
    user_is_super_admin(auth.uid())
    or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
    or exists (
      select 1 from public.shares s
      where s.entity_type = 'project'::share_entity_type
        and s.entity_id = project_id and s.user_id = auth.uid()
        and s.permission = 'write'::share_permission
    )
  );

create policy "project_contacts: delete via project owner/write-share"
  on public.project_contacts for delete using (
    user_is_super_admin(auth.uid())
    or exists (select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid())
    or exists (
      select 1 from public.shares s
      where s.entity_type = 'project'::share_entity_type
        and s.entity_id = project_id and s.user_id = auth.uid()
        and s.permission = 'write'::share_permission
    )
  );
