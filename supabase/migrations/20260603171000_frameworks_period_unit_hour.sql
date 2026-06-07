-- Allow 'hour' as a periodic unit (a block every N hours, multiple times a
-- day). Additive — extends the existing day/week/month check.
alter table public.framework_blocks drop constraint if exists framework_blocks_period_unit_check;
alter table public.framework_blocks add constraint framework_blocks_period_unit_check
  check (period_unit = any (array['hour','day','week','month']));
alter table public.framework_day_labels drop constraint if exists framework_day_labels_period_unit_check;
alter table public.framework_day_labels add constraint framework_day_labels_period_unit_check
  check (period_unit = any (array['hour','day','week','month']));
