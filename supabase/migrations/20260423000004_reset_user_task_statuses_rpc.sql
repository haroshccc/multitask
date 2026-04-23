-- =============================================================================
-- Multitask — 20. reset_user_task_statuses RPC
-- -----------------------------------------------------------------------------
-- Lets the user blow away their customised status palette and reinstall the
-- five factory defaults in one transaction. Called from the "איפוס לברירות
-- מחדל" button in the page-gear status editor.
-- =============================================================================

create or replace function public.reset_user_task_statuses()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  delete from public.user_task_statuses where user_id = v_user;
  perform public.seed_user_default_statuses(v_user);
end;
$$;

grant execute on function public.reset_user_task_statuses() to authenticated;
