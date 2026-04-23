-- =============================================================================
-- Multitask — 18. Tighten task_lists / tasks RLS: lists are private by default
-- -----------------------------------------------------------------------------
-- Earlier policies treated any org member as eligible to read & write every
-- list in the org. That was wrong: the user expects a new list to be visible
-- ONLY to its owner unless they explicitly share it. The shares table (entity
-- type 'task_list') already supports the invite model; this migration makes
-- RLS honour it.
-- =============================================================================

-- Task lists ------------------------------------------------------------------
drop policy if exists "task_lists: org members read" on public.task_lists;
drop policy if exists "task_lists: org members write" on public.task_lists;

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
  );

create policy "task_lists: org member insert as owner"
  on public.task_lists for insert
  with check (
    owner_id = auth.uid()
    and user_is_org_member(organization_id, auth.uid())
  );

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
  )
  with check (true);

create policy "task_lists: owner delete"
  on public.task_lists for delete
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
  );

-- Tasks -----------------------------------------------------------------------
drop policy if exists "tasks: org members read" on public.tasks;
drop policy if exists "tasks: org members write" on public.tasks;

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
  );

create policy "tasks: org member insert as owner"
  on public.tasks for insert
  with check (
    owner_id = auth.uid()
    and user_is_org_member(organization_id, auth.uid())
  );

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
  )
  with check (true);

create policy "tasks: owner delete"
  on public.tasks for delete
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
  );
