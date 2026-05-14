-- Multi-user task delegation.
--
-- A task previously supported a single delegate via `tasks.assignee_user_id`.
-- This migration adds `task_assignees` — a join table so a task can be
-- delegated to several users at once (and to the owner themselves).
--
-- `tasks.assignee_user_id` is kept in sync by the app as the "primary"
-- assignee (first one) so existing surfaces that read a single assignee
-- (TaskRow ownership badge, Gantt, services filter, approval flow) keep
-- working. `task_assignees` is the source of truth for the full set.
--
-- The "requires approval" flow stays global to the task (a single approval
-- gate), so no per-assignee approval columns are added here.

create table if not exists public.task_assignees (
  id                uuid primary key default gen_random_uuid(),
  task_id           uuid not null references public.tasks(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  delegation_status public.delegation_status not null default 'pending',
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (task_id, user_id)
);

create index if not exists task_assignees_task_id_idx on public.task_assignees(task_id);
create index if not exists task_assignees_user_id_idx on public.task_assignees(user_id);

alter table public.task_assignees enable row level security;

-- Read: task owner, the assignee themselves, super admins, or anyone the
-- task (or its list) is shared with. Write: task owner / super admin, or a
-- user managing their own row (accept/reject their delegation).
create policy "task_assignees: via owned or shared task"
  on public.task_assignees for all
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_assignees.task_id
        and (
          t.owner_id = auth.uid()
          or t.assignee_user_id = auth.uid()
          or task_assignees.user_id = auth.uid()
          or user_is_super_admin(auth.uid())
          or exists (
            select 1 from public.shares s
            where s.user_id = auth.uid()
              and (
                (s.entity_type = 'task'      and s.entity_id = t.id)
                or (s.entity_type = 'task_list' and s.entity_id = t.task_list_id)
              )
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_assignees.task_id
        and (
          t.owner_id = auth.uid()
          or task_assignees.user_id = auth.uid()
          or user_is_super_admin(auth.uid())
        )
    )
  );

-- Backfill from the existing single-assignee column. Done BEFORE the
-- notify trigger is created so it doesn't fire a wave of notifications
-- for already-delegated tasks.
insert into public.task_assignees (task_id, user_id, organization_id, delegation_status, created_by)
select id, assignee_user_id, organization_id, coalesce(delegation_status, 'pending'), owner_id
from public.tasks
where assignee_user_id is not null
on conflict (task_id, user_id) do nothing;

-- Notify a newly-added assignee — unless they added themselves (delegating
-- a task to yourself is not an event worth a notification).
create or replace function public.handle_task_assignee_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  task_row public.tasks%rowtype;
begin
  if new.user_id = new.created_by then
    return new;
  end if;

  select * into task_row from public.tasks where id = new.task_id;

  insert into public.notifications
    (user_id, organization_id, type, title, body, payload, action_url)
  values (
    new.user_id,
    new.organization_id,
    'task_assigned',
    'משימה הואצלה אליך',
    task_row.title,
    jsonb_build_object(
      'task_id',           new.task_id,
      'requires_approval', task_row.requires_approval
    ),
    '/app/tasks?edit=' || new.task_id
  );
  return new;
end;
$$;

drop trigger if exists task_assignee_added_trigger on public.task_assignees;
create trigger task_assignee_added_trigger
  after insert on public.task_assignees
  for each row execute function public.handle_task_assignee_added();

-- The legacy `assignee_user_id` trigger now only syncs `delegation_status`;
-- notifications are owned by the `task_assignees` trigger above, so the app
-- can keep `assignee_user_id` mirrored to the primary assignee without
-- double-notifying.
create or replace function public.handle_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.assignee_user_id is not null
      and new.assignee_user_id is distinct from old.assignee_user_id) then
    new.delegation_status := 'pending';
  end if;

  if (new.assignee_user_id is null and old.assignee_user_id is not null) then
    new.delegation_status := null;
  end if;

  return new;
end;
$$;
