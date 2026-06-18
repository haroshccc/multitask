-- =============================================================================
-- Realtime publication — food, frameworks, plans, contacts
--
-- useRealtimeSync subscribes to these tables so the Food / Frameworks /
-- Plans / Contacts screens see live updates from other org members (the
-- shared family menu being the most painful gap). Tables that don't exist
-- in a given environment are skipped silently.
-- =============================================================================

do $$
declare
  t text;
  tbls text[] := array[
    'meals',
    'ingredients',
    'meal_categories',
    'ingredient_categories',
    'meal_plan_template',
    'meal_plan_days',
    'meal_plan_shares',
    'frameworks',
    'framework_blocks',
    'framework_day_labels',
    'framework_visibility',
    'framework_shares',
    'plan_decisions',
    'plan_decision_impacts',
    'plan_stage_impacts',
    'contacts'
  ];
begin
  foreach t in array tbls loop
    begin
      execute format('alter publication supabase_realtime add table public.%I;', t);
    exception
      when duplicate_object then null;
      when undefined_table then null;
    end;
  end loop;
end $$;
