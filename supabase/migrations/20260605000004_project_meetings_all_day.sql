-- Add all_day to project_meetings: a meeting with a date but no specific time
-- syncs to an all-day calendar event (top of the calendar), mirroring how a
-- dated, time-less event behaves.
alter table public.project_meetings
  add column if not exists all_day boolean not null default false;
