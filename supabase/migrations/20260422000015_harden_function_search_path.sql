-- =============================================================================
-- Multitask — 15. Security hardening: fix mutable search_path warnings
-- =============================================================================
-- Supabase advisor flagged these trigger functions as having a mutable
-- search_path. Pinning them to public closes the vector for schema-search
-- hijacking when someone else's schema shadows a function name.
-- =============================================================================

alter function public.set_updated_at() set search_path = public;
alter function public.cascade_project_archive() set search_path = public;
alter function public.recalc_task_actual_seconds(uuid) set search_path = public;
alter function public.time_entries_after_write() set search_path = public;
alter function public.recalc_storage_bytes() set search_path = public;
alter function public.check_no_dependency_cycle() set search_path = public;
alter function public.set_archive_expiry() set search_path = public;
