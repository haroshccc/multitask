-- Monthly / periodic framework items: repeat every N months on the anchor's
-- day-of-month (e.g. errands day once a month, vet every 4 months). Additive.
alter table public.framework_blocks
  add column if not exists month_interval int,
  add column if not exists month_anchor date;
alter table public.framework_day_labels
  add column if not exists month_interval int,
  add column if not exists month_anchor date;

-- allow scope='monthly'
alter table public.framework_blocks drop constraint if exists framework_blocks_scope_check;
alter table public.framework_blocks add constraint framework_blocks_scope_check
  check (scope = any (array['weekly','date','monthly']));
alter table public.framework_day_labels drop constraint if exists framework_day_labels_scope_check;
alter table public.framework_day_labels add constraint framework_day_labels_scope_check
  check (scope = any (array['weekly','date','monthly']));

-- per-scope required fields (monthly needs an anchor date)
alter table public.framework_blocks drop constraint if exists fw_blocks_scope_fields;
alter table public.framework_blocks add constraint fw_blocks_scope_fields
  check (
    (scope = 'weekly'  and day_of_week  is not null)
    or (scope = 'date'    and specific_date is not null)
    or (scope = 'monthly' and month_anchor  is not null)
  );
alter table public.framework_day_labels drop constraint if exists fw_day_labels_scope_fields;
alter table public.framework_day_labels add constraint fw_day_labels_scope_fields
  check (
    (scope = 'weekly'  and day_of_week  is not null)
    or (scope = 'date'    and specific_date is not null)
    or (scope = 'monthly' and month_anchor  is not null)
  );

-- interval must be >= 1 when present
alter table public.framework_blocks
  add constraint framework_blocks_month_interval_check
  check (month_interval is null or month_interval >= 1);
alter table public.framework_day_labels
  add constraint framework_day_labels_month_interval_check
  check (month_interval is null or month_interval >= 1);
