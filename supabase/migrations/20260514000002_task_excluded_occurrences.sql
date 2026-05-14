-- Per-occurrence exclusions ("moved away" instances) for recurring tasks.
--
-- A recurring task expands via `recurrence_rule` into a regular series.
-- When the user moves a SINGLE occurrence (rather than the whole series)
-- we need to suppress the original RRULE instance and add a replacement
-- standalone occurrence (see `extra_occurrences`). This column stores the
-- suppressed instances.
--
-- Storage mirrors `completed_occurrences` / `extra_occurrences`: a JSONB
-- array of ISO-8601 timestamps, each the `dtstart` of an RRULE-expanded
-- occurrence that should NOT be rendered. The calendar views filter these
-- out after expanding the rule.

alter table public.tasks
  add column if not exists excluded_occurrences jsonb not null default '[]'::jsonb;

comment on column public.tasks.excluded_occurrences is
  'JSONB array of ISO-8601 timestamps. Each entry suppresses one RRULE-expanded occurrence (e.g. because the user moved that single occurrence elsewhere via extra_occurrences).';
