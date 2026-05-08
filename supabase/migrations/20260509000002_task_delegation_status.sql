-- =============================================================================
-- Task delegation: delegation_status column + auto-notification trigger
-- =============================================================================

-- 1. Enum -----------------------------------------------------------------------
create type public.delegation_status as enum ('pending', 'accepted', 'rejected');

-- 2. Column on tasks ------------------------------------------------------------
alter table public.tasks
  add column if not exists delegation_status public.delegation_status;

-- 3. Trigger: when assignee_user_id is set/changed, mark pending + notify -------
create or replace function public.handle_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- A new (or changed) assignee was set
  if (new.assignee_user_id is not null
      and new.assignee_user_id is distinct from old.assignee_user_id) then
    new.delegation_status := 'pending';

    insert into public.notifications
      (user_id, organization_id, type, title, body, payload, action_url)
    values (
      new.assignee_user_id,
      new.organization_id,
      'task_assigned',
      'משימה הואצלה אליך',
      new.title,
      jsonb_build_object(
        'task_id',            new.id,
        'requires_approval',  new.requires_approval
      ),
      '/app/tasks?edit=' || new.id
    );
  end if;

  -- Assignee was removed → clear delegation
  if (new.assignee_user_id is null and old.assignee_user_id is not null) then
    new.delegation_status := null;
  end if;

  return new;
end;
$$;

drop trigger if exists task_assignment_trigger on public.tasks;
create trigger task_assignment_trigger
  before update of assignee_user_id on public.tasks
  for each row execute function public.handle_task_assignment();
