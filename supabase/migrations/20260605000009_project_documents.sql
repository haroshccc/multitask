-- Project documents: a folder tree of notes / uploaded files / external links
-- (incl. links to Google Drive folders). RLS mirrors project_meetings so a
-- project share grants access.
create table if not exists public.project_documents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  parent_id       uuid references public.project_documents(id) on delete cascade,
  kind            text not null default 'note'
                    check (kind in ('folder','file','note','link')),
  name            text not null default '',
  content         text,                 -- note body
  url             text,                 -- external link / Drive folder URL
  file_key        text,                 -- storage key for uploaded files
  file_size       bigint,
  mime            text,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists project_documents_project_id_idx
  on public.project_documents (project_id);
create index if not exists project_documents_parent_id_idx
  on public.project_documents (parent_id);

alter table public.project_documents enable row level security;

create policy "project_documents: owner or project-shared read"
  on public.project_documents for select
  using (
    (owner_id = auth.uid())
    or user_is_super_admin(auth.uid())
    or user_has_share('project'::share_entity_type, project_id, auth.uid())
  );

create policy "project_documents: org member insert as owner"
  on public.project_documents for insert
  with check (
    (owner_id = auth.uid())
    and user_is_org_member(organization_id, auth.uid())
  );

create policy "project_documents: owner or project-write update"
  on public.project_documents for update
  using (
    (owner_id = auth.uid())
    or user_is_super_admin(auth.uid())
    or (exists (
      select 1 from shares s
      where s.entity_type = 'project'::share_entity_type
        and s.entity_id = project_documents.project_id
        and s.user_id = auth.uid()
        and s.permission = 'write'::share_permission
    ))
  )
  with check (true);

create policy "project_documents: owner delete"
  on public.project_documents for delete
  using ((owner_id = auth.uid()) or user_is_super_admin(auth.uid()));
