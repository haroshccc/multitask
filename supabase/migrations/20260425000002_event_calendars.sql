-- =============================================================================
-- Event calendars — a per-event grouping like task_lists for tasks. Each
-- calendar carries a color; events inherit that color unless they have a
-- per-event override (`events.color`). Optional bidirectional link to a
-- task_list so the two share a color (and may share more behaviors later).
-- =============================================================================

create table if not exists public.event_calendars (
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

create index if not exists event_calendars_owner_idx on public.event_calendars(owner_id);
create index if not exists event_calendars_org_idx on public.event_calendars(organization_id);

-- events: optional calendar membership + per-event color override.
alter table public.events
  add column if not exists calendar_id uuid references public.event_calendars(id) on delete set null;
alter table public.events
  add column if not exists color text;

create index if not exists events_calendar_idx on public.events(calendar_id);

-- Bidirectional link between a task_list and an event_calendar. When set,
-- the two are considered "twinned" — UI keeps their colors in sync and
-- future cross-cuts (shared filters, etc.) can lean on the link.
alter table public.task_lists
  add column if not exists linked_event_calendar_id uuid references public.event_calendars(id) on delete set null;

alter table public.event_calendars
  add column if not exists linked_task_list_id uuid references public.task_lists(id) on delete set null;

-- RLS — owner-only inside their org (matching task_lists' policy shape).
alter table public.event_calendars enable row level security;

drop policy if exists event_calendars_select on public.event_calendars;
create policy event_calendars_select
  on public.event_calendars
  for select
  using (auth.uid() = owner_id);

drop policy if exists event_calendars_insert on public.event_calendars;
create policy event_calendars_insert
  on public.event_calendars
  for insert
  with check (auth.uid() = owner_id);

drop policy if exists event_calendars_update on public.event_calendars;
create policy event_calendars_update
  on public.event_calendars
  for update
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists event_calendars_delete on public.event_calendars;
create policy event_calendars_delete
  on public.event_calendars
  for delete
  using (auth.uid() = owner_id);

-- updated_at trigger.
create or replace function public.event_calendars_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists event_calendars_updated_at on public.event_calendars;
create trigger event_calendars_updated_at
  before update on public.event_calendars
  for each row execute function public.event_calendars_set_updated_at();
