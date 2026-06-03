-- =============================================================================
-- Frameworks ("מסגרת") as a display layer over regular tasks/lists.
--
-- A framework is NOT a new entity. It is a regular task_list (or an individual
-- task/event) that carries an `is_framework` flag. All recurrence, scheduling,
-- calendar rendering and sharing reuse the existing tasks/task_lists/shares
-- infrastructure. The flag only drives a distinct display layer + a dedicated
-- editing page.
--
-- Additive only — does not touch the task save path.
-- =============================================================================

alter table public.task_lists
  add column if not exists is_framework boolean not null default false;

-- Optional framework run horizon ("how long this framework runs"). Null = open.
alter table public.task_lists
  add column if not exists framework_starts_on date;
alter table public.task_lists
  add column if not exists framework_ends_on   date;

-- An individual task/event can also be flagged as a framework item so it gets
-- the framework display layer even outside a framework list.
alter table public.tasks
  add column if not exists is_framework boolean not null default false;

create index if not exists task_lists_is_framework_idx
  on public.task_lists(organization_id) where is_framework;
create index if not exists tasks_is_framework_idx
  on public.tasks(organization_id) where is_framework;
