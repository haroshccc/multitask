-- Per-occurrence completion tracking for recurring tasks.
--
-- Tasks already have `recurrence_rule`, `recurrence_ends_at`, and
-- `recurrence_original_id` columns (mirroring events), but until now no UI
-- expanded recurring tasks into per-day instances. With this migration we
-- start treating a recurring task as a SERIES whose occurrences each have
-- their own completion state — independent of the master `completed_at`.
--
-- Storage: `completed_occurrences` is a JSONB array of ISO-8601 timestamps.
-- Each entry is the `dtstart` of an occurrence the user has marked done.
-- Toggling an occurrence is array add/remove; the master row's
-- `completed_at` is left alone.
--
-- Why JSONB and not a side table? Each completion is a single timestamp
-- and we always need them together with the parent task — a separate
-- table would force a join on every task fetch. JSONB also gives us
-- containment queries (`?` / `@>`) for fast "is this occurrence done?".
-- We'll reconsider if usage grows beyond a few hundred completions per
-- task or if cross-task analytics need it.

alter table public.tasks
  add column if not exists completed_occurrences jsonb not null default '[]'::jsonb;

-- Containment index lets `completed_occurrences @> '["..."]'` queries hit
-- an index when filtering "is occurrence X done?". Sparse — most tasks
-- aren't recurring so the index stays small.
create index if not exists idx_tasks_completed_occurrences
  on public.tasks using gin (completed_occurrences);

comment on column public.tasks.completed_occurrences is
  'JSONB array of ISO-8601 timestamps. Each entry marks one occurrence of a recurring task as complete. Independent of the master completed_at, which represents the whole series being closed.';
