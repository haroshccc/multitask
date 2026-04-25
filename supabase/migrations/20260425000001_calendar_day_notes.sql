-- =============================================================================
-- Per-day calendar notes. Each user gets one optional short note per date,
-- shown next to the date number in every calendar view (day / week / month /
-- agenda). Click on the date digit opens an editor — there is no separate
-- entity, no scheduling, no participants. Just a sticky-note for the day.
-- =============================================================================

create table if not exists public.calendar_day_notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Stored as DATE (no time, no timezone). The client passes the local
  -- yyyy-mm-dd it wants the note to live on; rendering uses the same
  -- string so the note attaches to "April 25 in your local view"
  -- regardless of where the user travels.
  date date not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, organization_id, date)
);

create index if not exists calendar_day_notes_org_user_date_idx
  on public.calendar_day_notes (user_id, organization_id, date);

-- RLS: owner can do everything to their own notes inside their org.
alter table public.calendar_day_notes enable row level security;

drop policy if exists calendar_day_notes_select on public.calendar_day_notes;
create policy calendar_day_notes_select
  on public.calendar_day_notes
  for select
  using (auth.uid() = user_id);

drop policy if exists calendar_day_notes_insert on public.calendar_day_notes;
create policy calendar_day_notes_insert
  on public.calendar_day_notes
  for insert
  with check (auth.uid() = user_id);

drop policy if exists calendar_day_notes_update on public.calendar_day_notes;
create policy calendar_day_notes_update
  on public.calendar_day_notes
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists calendar_day_notes_delete on public.calendar_day_notes;
create policy calendar_day_notes_delete
  on public.calendar_day_notes
  for delete
  using (auth.uid() = user_id);

-- updated_at trigger.
create or replace function public.calendar_day_notes_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists calendar_day_notes_updated_at on public.calendar_day_notes;
create trigger calendar_day_notes_updated_at
  before update on public.calendar_day_notes
  for each row execute function public.calendar_day_notes_set_updated_at();
