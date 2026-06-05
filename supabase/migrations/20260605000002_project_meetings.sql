-- =============================================================================
-- Project meetings (פגישות) — one row per meeting inside a project.
-- A meeting can link to a recording (its page + AI summary) and to a calendar
-- event. Notes + summary are free text. Access cascades from the project:
--   • any project share  → read
--   • project write share → insert/update (as an org member)
-- =============================================================================

create table if not exists public.project_meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,
  project_id uuid not null references public.projects(id) on delete cascade,

  title text not null default '',
  meeting_at timestamptz,
  location text,
  notes text,
  summary text,
  status text not null default 'scheduled',

  recording_id uuid references public.recordings(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,

  sort_order double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_meetings_project_idx
  on public.project_meetings(project_id);
create index if not exists project_meetings_recording_idx
  on public.project_meetings(recording_id) where recording_id is not null;

alter table public.project_meetings enable row level security;

create policy "project_meetings: owner or project-shared read"
  on public.project_meetings for select
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or user_has_share('project', project_id, auth.uid())
  );

create policy "project_meetings: org member insert as owner"
  on public.project_meetings for insert
  with check (
    owner_id = auth.uid()
    and user_is_org_member(organization_id, auth.uid())
  );

create policy "project_meetings: owner or project-write update"
  on public.project_meetings for update
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or exists (
      select 1 from public.shares s
      where s.entity_type = 'project'
        and s.entity_id = project_meetings.project_id
        and s.user_id = auth.uid()
        and s.permission = 'write'
    )
  )
  with check (true);

create policy "project_meetings: owner delete"
  on public.project_meetings for delete
  using (owner_id = auth.uid() or user_is_super_admin(auth.uid()));
