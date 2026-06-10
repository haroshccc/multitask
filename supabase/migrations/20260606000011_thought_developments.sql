-- =============================================================================
-- Thought-developments (פיתוח מחשבה) — a developed idea with attached files.
--
-- Independent of `thoughts`. Each row has a name + short description, a free-text
-- summary, an editable written_at (the user may upload with a delay), and an
-- optional link to EXACTLY ONE of: a project OR a task-list (never both).
-- Files (source + summary) live in R2 and are tracked in
-- thought_development_files. Sharing is user→user via the generic `shares`
-- table (entity_type='thought_development'); RLS mirrors projects:
--   read  = owner OR any share OR super_admin
--   write = owner OR 'write' share OR super_admin
--
-- A generic "summarize" task can be spawned from a development; the back-link
-- lives in tasks.source_thought_development_id (additive, nullable — does NOT
-- touch the sensitive task-save path).
-- =============================================================================

-- 1. Main table --------------------------------------------------------------
create table if not exists public.thought_developments (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id        uuid not null references auth.users(id) on delete cascade,
  name            text not null default '',
  description     text not null default '',
  summary_text    text not null default '',
  -- The moment the idea was actually written/created. Defaults to now() but is
  -- user-editable (uploads may happen with a delay). created_at stays immutable.
  written_at      timestamptz not null default now(),
  -- Link to AT MOST one of project / task-list (mutually exclusive).
  project_id      uuid references public.projects(id)   on delete set null,
  task_list_id    uuid references public.task_lists(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint thought_dev_single_link
    check (project_id is null or task_list_id is null)
);

create index if not exists thought_developments_org_idx       on public.thought_developments(organization_id);
create index if not exists thought_developments_owner_idx     on public.thought_developments(owner_id);
create index if not exists thought_developments_project_idx   on public.thought_developments(project_id);
create index if not exists thought_developments_task_list_idx on public.thought_developments(task_list_id);

-- 2. Files (source + summary) ------------------------------------------------
create table if not exists public.thought_development_files (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations(id) on delete cascade,
  thought_development_id uuid not null references public.thought_developments(id) on delete cascade,
  -- 'source'  = the medium the idea was developed on (image/pdf/xlsx/audio/…)
  -- 'summary' = the polished write-up file(s)
  role             text not null check (role in ('source','summary')),
  file_name        text not null default '',
  mime_type        text not null default 'application/octet-stream',
  size_bytes       bigint,
  storage_key      text not null,
  storage_provider text not null default 'r2' check (storage_provider in ('r2','supabase')),
  -- Upload + edit timestamps so the UI can show the "story" of each file.
  uploaded_at      timestamptz not null default now(),
  edited_at        timestamptz,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);

create index if not exists thought_dev_files_dev_idx on public.thought_development_files(thought_development_id);

-- 3. tasks back-link (additive, nullable) ------------------------------------
alter table public.tasks
  add column if not exists source_thought_development_id uuid
    references public.thought_developments(id) on delete set null;
create index if not exists tasks_source_thought_dev_idx on public.tasks(source_thought_development_id);

-- 4. updated_at trigger ------------------------------------------------------
drop trigger if exists trg_thought_developments_updated_at on public.thought_developments;
create trigger trg_thought_developments_updated_at before update on public.thought_developments
  for each row execute function public.set_updated_at();

-- 5. RLS ---------------------------------------------------------------------
alter table public.thought_developments      enable row level security;
alter table public.thought_development_files enable row level security;

-- thought_developments: owner / share / super_admin
create policy "thought_developments: read"
  on public.thought_developments for select
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or user_has_share('thought_development'::share_entity_type, id, auth.uid())
  );

create policy "thought_developments: owner insert"
  on public.thought_developments for insert
  with check (owner_id = auth.uid() or user_is_super_admin(auth.uid()));

create policy "thought_developments: write"
  on public.thought_developments for update
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or exists (
      select 1 from public.shares s
      where s.entity_type = 'thought_development'::share_entity_type
        and s.entity_id = thought_developments.id
        and s.user_id = auth.uid()
        and s.permission = 'write'
    )
  )
  with check (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or exists (
      select 1 from public.shares s
      where s.entity_type = 'thought_development'::share_entity_type
        and s.entity_id = thought_developments.id
        and s.user_id = auth.uid()
        and s.permission = 'write'
    )
  );

create policy "thought_developments: owner delete"
  on public.thought_developments for delete
  using (owner_id = auth.uid() or user_is_super_admin(auth.uid()));

-- files: gated through the parent development's access
create policy "thought_development_files: read"
  on public.thought_development_files for select
  using (
    exists (
      select 1 from public.thought_developments d
      where d.id = thought_development_files.thought_development_id
        and (
          d.owner_id = auth.uid()
          or user_is_super_admin(auth.uid())
          or user_has_share('thought_development'::share_entity_type, d.id, auth.uid())
        )
    )
  );

create policy "thought_development_files: write"
  on public.thought_development_files for all
  using (
    exists (
      select 1 from public.thought_developments d
      where d.id = thought_development_files.thought_development_id
        and (
          d.owner_id = auth.uid()
          or user_is_super_admin(auth.uid())
          or exists (
            select 1 from public.shares s
            where s.entity_type = 'thought_development'::share_entity_type
              and s.entity_id = d.id
              and s.user_id = auth.uid()
              and s.permission = 'write'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.thought_developments d
      where d.id = thought_development_files.thought_development_id
        and (
          d.owner_id = auth.uid()
          or user_is_super_admin(auth.uid())
          or exists (
            select 1 from public.shares s
            where s.entity_type = 'thought_development'::share_entity_type
              and s.entity_id = d.id
              and s.user_id = auth.uid()
              and s.permission = 'write'
          )
        )
    )
  );
