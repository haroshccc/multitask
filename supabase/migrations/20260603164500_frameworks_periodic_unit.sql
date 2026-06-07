-- Generalize "monthly" periodic items to any unit: every N days / weeks /
-- months. Reuses month_interval (the N) and month_anchor (the anchor date);
-- period_unit selects how the interval is counted. Default 'month' keeps any
-- existing rows behaving exactly as before. Additive.
alter table public.framework_blocks
  add column if not exists period_unit text not null default 'month';
alter table public.framework_day_labels
  add column if not exists period_unit text not null default 'month';

alter table public.framework_blocks drop constraint if exists framework_blocks_period_unit_check;
alter table public.framework_blocks add constraint framework_blocks_period_unit_check
  check (period_unit = any (array['day','week','month']));
alter table public.framework_day_labels drop constraint if exists framework_day_labels_period_unit_check;
alter table public.framework_day_labels add constraint framework_day_labels_period_unit_check
  check (period_unit = any (array['day','week','month']));
