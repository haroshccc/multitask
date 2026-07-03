-- Per-project extra expense impact: whether the expense is billed on top of the
-- final price (add_to_price) or comes out of the profit (deduct_from_profit).
alter table public.project_expenses
  add column if not exists impact text not null default 'deduct_from_profit';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'project_expenses_impact_chk'
  ) then
    alter table public.project_expenses
      add constraint project_expenses_impact_chk
      check (impact in ('add_to_price','deduct_from_profit'));
  end if;
end $$;
