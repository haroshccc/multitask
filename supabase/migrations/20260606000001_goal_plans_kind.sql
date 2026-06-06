-- =============================================================================
-- Goal Plans — add the 'plan' value to task_list_kind.
-- Kept in its own migration so the value is committed before the companion
-- migration (20260606000002_goal_plans.sql) uses it.
-- =============================================================================

alter type public.task_list_kind add value if not exists 'plan';
