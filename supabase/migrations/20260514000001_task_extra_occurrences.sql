-- Independent (ad-hoc) extra occurrences for any task.
--
-- A task already supports a single `scheduled_at` plus an optional
-- `recurrence_rule` (RRULE) that expands into a regular series. This
-- migration adds `extra_occurrences` — a JSONB array of ISO-8601
-- timestamps, each an additional standalone date/time the task should
-- appear on, on top of (and independent of) the RRULE.
--
-- Use case: "this task repeats weekly, but also once on the 3rd at 18:00",
-- or a non-recurring task the user wants to show on a few specific extra
-- dates without committing to a recurrence pattern.
--
-- Storage mirrors `completed_occurrences`: each entry is the `dtstart` of
-- an extra instance. The calendar views merge these with RRULE-expanded
-- occurrences and render them uniformly (a per-occurrence id, completion
-- state from `completed_occurrences`).

alter table public.tasks
  add column if not exists extra_occurrences jsonb not null default '[]'::jsonb;

comment on column public.tasks.extra_occurrences is
  'JSONB array of ISO-8601 timestamps. Each entry is an additional standalone occurrence of the task, independent of recurrence_rule. Merged with RRULE-expanded occurrences by the calendar views.';
