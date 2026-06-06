-- Tracks when a project's "download & backup" was last run, so the dashboard
-- can show "last backed up X" and nudge a weekly reminder. Additive, nullable.
alter table public.projects
  add column if not exists last_backup_at timestamptz;
