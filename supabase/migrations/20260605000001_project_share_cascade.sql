-- =============================================================================
-- Project share cascade
-- -----------------------------------------------------------------------------
-- A share on a project (shares.entity_type='project') should grant access to
-- everything inside the project. This migration extends the task_lists / tasks
-- RLS policies so that a project share cascades to the project's single task
-- list and its tasks:
--   • any project share  → read
--   • project write share → update
-- The per-list and per-task share branches are preserved unchanged.
-- `user_has_share` is SECURITY DEFINER, so it reads `shares` without recursion.
-- =============================================================================

-- Task lists ------------------------------------------------------------------
drop policy if exists "task_lists: owner or shared read" on public.task_lists;
create policy "task_lists: owner or shared read"
  on public.task_lists for select
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or exists (
      select 1 from public.shares s
      where s.entity_type = 'task_list'
        and s.entity_id = task_lists.id
        and s.user_id = auth.uid()
    )
    or (
      task_lists.project_id is not null
      and user_has_share('project', task_lists.project_id, auth.uid())
    )
  );

drop policy if exists "task_lists: owner or write-shared update" on public.task_lists;
create policy "task_lists: owner or write-shared update"
  on public.task_lists for update
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or exists (
      select 1 from public.shares s
      where s.entity_type = 'task_list'
        and s.entity_id = task_lists.id
        and s.user_id = auth.uid()
        and s.permission = 'write'
    )
    or (
      task_lists.project_id is not null
      and exists (
        select 1 from public.shares s
        where s.entity_type = 'project'
          and s.entity_id = task_lists.project_id
          and s.user_id = auth.uid()
          and s.permission = 'write'
      )
    )
  )
  with check (true);

-- Tasks -----------------------------------------------------------------------
drop policy if exists "tasks: owner / assignee / shared-list read" on public.tasks;
create policy "tasks: owner / assignee / shared-list read"
  on public.tasks for select
  using (
    owner_id = auth.uid()
    or assignee_user_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or exists (
      select 1 from public.shares s
      where s.entity_type = 'task_list'
        and s.entity_id = tasks.task_list_id
        and s.user_id = auth.uid()
    )
    or exists (
      select 1 from public.shares s
      where s.entity_type = 'task'
        and s.entity_id = tasks.id
        and s.user_id = auth.uid()
    )
    or exists (
      select 1 from public.task_lists tl
      where tl.id = tasks.task_list_id
        and tl.project_id is not null
        and user_has_share('project', tl.project_id, auth.uid())
    )
  );

drop policy if exists "tasks: owner / assignee / write-shared update" on public.tasks;
create policy "tasks: owner / assignee / write-shared update"
  on public.tasks for update
  using (
    owner_id = auth.uid()
    or assignee_user_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or exists (
      select 1 from public.shares s
      where s.entity_type = 'task_list'
        and s.entity_id = tasks.task_list_id
        and s.user_id = auth.uid()
        and s.permission = 'write'
    )
    or exists (
      select 1 from public.shares s
      where s.entity_type = 'task'
        and s.entity_id = tasks.id
        and s.user_id = auth.uid()
        and s.permission = 'write'
    )
    or exists (
      select 1 from public.task_lists tl
      where tl.id = tasks.task_list_id
        and tl.project_id is not null
        and exists (
          select 1 from public.shares s
          where s.entity_type = 'project'
            and s.entity_id = tl.project_id
            and s.user_id = auth.uid()
            and s.permission = 'write'
        )
    )
  )
  with check (true);
