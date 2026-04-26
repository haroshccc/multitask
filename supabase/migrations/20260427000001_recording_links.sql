-- =============================================================================
-- Phase 6ב.2 — Recording linkage: task_lists, event_calendars, recording_lists.
-- =============================================================================
-- Lets each recording be associated with:
--   * one project          (already exists: recordings.project_id)
--   * one task list        (NEW: recordings.task_list_id)
--   * one event calendar   (NEW: recordings.event_calendar_id)
--   * many recording lists (NEW: recording_lists + recording_list_assignments)
--
-- Recording lists mirror thought_lists / event_calendars: per-user curated
-- buckets ("client X calls", "weekly meetings"...) with the same archive
-- columns and the same many-to-many junction-table shape used for thoughts.
--
-- All linkage columns/tables are nullable / optional so existing rows from
-- phase 6ב keep working unchanged.
-- =============================================================================

-- 1. Single FK columns on recordings ------------------------------------------

alter table public.recordings
  add column if not exists task_list_id uuid
    references public.task_lists(id) on delete set null;

alter table public.recordings
  add column if not exists event_calendar_id uuid
    references public.event_calendars(id) on delete set null;

create index if not exists recordings_task_list_idx
  on public.recordings(task_list_id);
create index if not exists recordings_event_calendar_idx
  on public.recordings(event_calendar_id);

-- 2. Recording lists (mirror of thought_lists / event_calendars) -------------

create table if not exists public.recording_lists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,

  name text not null,
  emoji text,
  color text,
  sort_order integer not null default 0,

  is_archived boolean not null default false,
  archived_at timestamptz,
  archive_expires_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recording_lists_owner_idx
  on public.recording_lists(owner_id);
create index if not exists recording_lists_org_idx
  on public.recording_lists(organization_id);

-- 3. Many-to-many recording ↔ list assignments ------------------------------

create table if not exists public.recording_list_assignments (
  recording_id uuid not null references public.recordings(id) on delete cascade,
  list_id uuid not null references public.recording_lists(id) on delete cascade,
  sort_order_in_list double precision not null default 0,
  assigned_at timestamptz not null default now(),
  primary key (recording_id, list_id)
);

create index if not exists recording_list_assignments_list_idx
  on public.recording_list_assignments(list_id);

-- 4. RLS — owner-only inside their org (matches event_calendars / thought_lists)
alter table public.recording_lists enable row level security;
alter table public.recording_list_assignments enable row level security;

drop policy if exists recording_lists_owner_all on public.recording_lists;
create policy recording_lists_owner_all
  on public.recording_lists for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Assignments inherit access from the underlying recording (membership check
-- happens in the recordings policy already).
drop policy if exists recording_list_assignments_via_recording on public.recording_list_assignments;
create policy recording_list_assignments_via_recording
  on public.recording_list_assignments for all
  using (
    exists (
      select 1 from public.recordings r
      where r.id = recording_list_assignments.recording_id
        and r.organization_id in (
          select organization_id from public.organization_members
          where user_id = auth.uid()
        )
    )
  )
  with check (
    exists (
      select 1 from public.recordings r
      where r.id = recording_list_assignments.recording_id
        and r.organization_id in (
          select organization_id from public.organization_members
          where user_id = auth.uid()
        )
    )
  );

-- 5. Realtime publication so the UI gets list/assignment changes live -------
do $$
declare
  t text;
  tbls text[] := array['recording_lists', 'recording_list_assignments'];
begin
  foreach t in array tbls loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when duplicate_object then null;
    end;
  end loop;
exception when others then null;
end $$;
