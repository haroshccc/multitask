-- =============================================================================
-- Meeting ⇄ task links — many-to-many between project_meetings and tasks.
-- Access cascades from the parent meeting (read = any project share,
-- write = meeting owner / project write share / super admin).
-- =============================================================================

create table if not exists public.meeting_task_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meeting_id uuid not null references public.project_meetings(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (meeting_id, task_id)
);

create index if not exists meeting_task_links_meeting_idx
  on public.meeting_task_links(meeting_id);
create index if not exists meeting_task_links_task_idx
  on public.meeting_task_links(task_id);

alter table public.meeting_task_links enable row level security;

create policy "meeting_task_links: read via meeting"
  on public.meeting_task_links for select
  using (
    exists (
      select 1 from public.project_meetings m
      where m.id = meeting_task_links.meeting_id
        and (
          m.owner_id = auth.uid()
          or user_is_super_admin(auth.uid())
          or user_has_share('project', m.project_id, auth.uid())
        )
    )
  );

create policy "meeting_task_links: write via meeting owner/project-write"
  on public.meeting_task_links for all
  using (
    exists (
      select 1 from public.project_meetings m
      where m.id = meeting_task_links.meeting_id
        and (
          m.owner_id = auth.uid()
          or user_is_super_admin(auth.uid())
          or exists (
            select 1 from public.shares s
            where s.entity_type = 'project'
              and s.entity_id = m.project_id
              and s.user_id = auth.uid()
              and s.permission = 'write'
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.project_meetings m
      where m.id = meeting_task_links.meeting_id
        and (
          m.owner_id = auth.uid()
          or user_is_super_admin(auth.uid())
          or exists (
            select 1 from public.shares s
            where s.entity_type = 'project'
              and s.entity_id = m.project_id
              and s.user_id = auth.uid()
              and s.permission = 'write'
          )
        )
    )
  );
