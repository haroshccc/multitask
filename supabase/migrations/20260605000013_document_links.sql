-- One source document (lives once in project_documents, e.g. in the project's
-- "תשלומים" folder) can be linked to multiple targets: a contact card and/or a
-- payment row. The folder placement is the document's own parent_id; these
-- links are the extra "shortcuts".
alter table public.project_documents
  add column if not exists category text;   -- דרישת תשלום / חשבונית / קבלה / חוזה / אחר

create table if not exists public.document_links (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.project_documents(id) on delete cascade,
  target_type text not null check (target_type in ('contact','payment')),
  target_id   uuid not null,
  created_at  timestamptz not null default now(),
  unique (document_id, target_type, target_id)
);
create index if not exists document_links_document_idx on public.document_links (document_id);
create index if not exists document_links_target_idx   on public.document_links (target_type, target_id);

-- Access to a link follows access to its document's project (SECURITY DEFINER
-- to avoid nested-RLS recursion).
create or replace function public.user_can_access_document(p_doc_id uuid, p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.project_documents d
    where d.id = p_doc_id
      and (d.owner_id = p_uid
           or public.user_has_share('project'::share_entity_type, d.project_id, p_uid))
  );
$$;

alter table public.document_links enable row level security;

create policy "document_links: read via document access"
  on public.document_links for select using (
    user_is_super_admin(auth.uid()) or user_can_access_document(document_id, auth.uid())
  );

create policy "document_links: insert via document access"
  on public.document_links for insert with check (
    user_is_super_admin(auth.uid()) or user_can_access_document(document_id, auth.uid())
  );

create policy "document_links: delete via document access"
  on public.document_links for delete using (
    user_is_super_admin(auth.uid()) or user_can_access_document(document_id, auth.uid())
  );
