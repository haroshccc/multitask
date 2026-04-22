-- =============================================================================
-- Multitask — 13. RPC functions: onboarding, timer control, duplication,
--   canUseFeature, super admin actions
-- =============================================================================

-- =============================================================================
-- create_organization_with_password
--   Create a new organization with a hashed join password; caller becomes owner.
-- =============================================================================

create or replace function public.create_organization_with_password(
  p_name text,
  p_join_password text,
  p_suggested_email_domain text default null
)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations;
  v_slug text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_slug := lower(regexp_replace(p_name, '[^a-zA-Z0-9֐-׿]+', '-', 'g'));

  insert into public.organizations (name, slug, join_password_hash, suggested_email_domain, created_by)
  values (
    p_name,
    v_slug || '-' || substr(gen_random_uuid()::text, 1, 8),
    crypt(p_join_password, gen_salt('bf')),
    p_suggested_email_domain,
    auth.uid()
  )
  returning * into v_org;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org.id, auth.uid(), 'owner');

  return v_org;
end;
$$;

grant execute on function public.create_organization_with_password(text, text, text) to authenticated;

-- =============================================================================
-- join_organization_with_password
--   Verify password; if correct, add caller as member.
-- =============================================================================

create or replace function public.join_organization_with_password(
  p_organization_id uuid,
  p_join_password text
)
returns public.organization_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations;
  v_member public.organization_members;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_org from public.organizations where id = p_organization_id;
  if v_org.id is null then
    raise exception 'organization not found';
  end if;

  if v_org.join_password_hash is null or
     v_org.join_password_hash <> crypt(p_join_password, v_org.join_password_hash) then
    raise exception 'invalid join password';
  end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (p_organization_id, auth.uid(), 'member')
  on conflict (organization_id, user_id) do nothing
  returning * into v_member;

  return v_member;
end;
$$;

grant execute on function public.join_organization_with_password(uuid, text) to authenticated;

-- =============================================================================
-- find_organizations_by_email_domain
--   Return orgs whose suggested_email_domain matches the email part after @.
-- =============================================================================

create or replace function public.find_organizations_by_email_domain(p_email text)
returns table (id uuid, name text, suggested_email_domain text)
language sql
security definer
stable
set search_path = public
as $$
  select id, name, suggested_email_domain
    from public.organizations
    where suggested_email_domain is not null
      and lower(suggested_email_domain) = lower(split_part(p_email, '@', 2))
      and is_archived = false
    order by created_at
    limit 10;
$$;

grant execute on function public.find_organizations_by_email_domain(text) to authenticated;

-- =============================================================================
-- Timer control: start / stop (enforces single active per user)
-- =============================================================================

create or replace function public.start_timer(p_task_id uuid, p_note text default null)
returns public.time_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_task public.tasks;
  v_entry public.time_entries;
  v_now timestamptz := now();
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_task from public.tasks where id = p_task_id;
  if v_task.id is null then raise exception 'task not found'; end if;

  if not user_is_org_member(v_task.organization_id, auth.uid()) then
    raise exception 'not a member of task organization';
  end if;

  -- Stop any active timer first
  update public.time_entries
    set ended_at = v_now,
        duration_seconds = greatest(0, extract(epoch from (v_now - started_at))::int)
    where user_id = auth.uid() and ended_at is null;

  -- Start new
  insert into public.time_entries (
    organization_id, task_id, user_id, started_at, is_manual
  ) values (
    v_task.organization_id, p_task_id, auth.uid(), v_now, false
  )
  returning * into v_entry;

  update public.profiles set active_time_entry_id = v_entry.id where id = auth.uid();

  return v_entry;
end;
$$;

grant execute on function public.start_timer(uuid, text) to authenticated;

create or replace function public.stop_timer()
returns public.time_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.time_entries;
  v_now timestamptz := now();
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  update public.time_entries
    set ended_at = v_now,
        duration_seconds = greatest(0, extract(epoch from (v_now - started_at))::int)
    where user_id = auth.uid() and ended_at is null
    returning * into v_entry;

  update public.profiles set active_time_entry_id = null where id = auth.uid();

  return v_entry;
end;
$$;

grant execute on function public.stop_timer() to authenticated;

-- =============================================================================
-- duplicate_task_tree: recursive duplication preserving hierarchy
-- =============================================================================

create or replace function public.duplicate_task_tree(
  p_source_task_id uuid,
  p_target_list_id uuid default null,
  p_target_parent_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source public.tasks;
  v_new_id uuid;
  v_child uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_source from public.tasks where id = p_source_task_id;
  if v_source.id is null then raise exception 'source task not found'; end if;

  if not user_is_org_member(v_source.organization_id, auth.uid()) then
    raise exception 'not a member of task organization';
  end if;

  insert into public.tasks (
    organization_id, owner_id, task_list_id, parent_task_id,
    title, description, status, urgency,
    scheduled_at, duration_minutes, is_event,
    estimated_hours, spare_hours, sort_order,
    assignee_user_id, requires_approval, approver_user_id,
    recurrence_rule, recurrence_ends_at,
    custom_fields, location, external_url, notes, tags
  ) values (
    v_source.organization_id, auth.uid(),
    coalesce(p_target_list_id, v_source.task_list_id),
    p_target_parent_id,
    v_source.title || ' (העתק)', v_source.description, 'todo', v_source.urgency,
    v_source.scheduled_at, v_source.duration_minutes, v_source.is_event,
    v_source.estimated_hours, v_source.spare_hours, v_source.sort_order + 0.01,
    v_source.assignee_user_id, v_source.requires_approval, v_source.approver_user_id,
    v_source.recurrence_rule, v_source.recurrence_ends_at,
    v_source.custom_fields, v_source.location, v_source.external_url, v_source.notes, v_source.tags
  )
  returning id into v_new_id;

  -- Recursively duplicate children
  for v_child in select id from public.tasks where parent_task_id = p_source_task_id loop
    perform public.duplicate_task_tree(v_child, coalesce(p_target_list_id, v_source.task_list_id), v_new_id);
  end loop;

  return v_new_id;
end;
$$;

grant execute on function public.duplicate_task_tree(uuid, uuid, uuid) to authenticated;

-- =============================================================================
-- can_use_feature: abstraction for future plan gating
-- =============================================================================

create or replace function public.can_use_feature(
  p_organization_id uuid,
  p_feature text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select true;  -- always true for now; logic added when Stripe is wired up
$$;

grant execute on function public.can_use_feature(uuid, text) to authenticated;
