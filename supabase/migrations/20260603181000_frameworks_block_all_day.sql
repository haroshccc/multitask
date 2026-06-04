-- All-day framework occurrences (no specific time). Render in the all-day /
-- month / agenda areas rather than the timed grid. Additive.
alter table public.framework_blocks
  add column if not exists all_day boolean not null default false;
