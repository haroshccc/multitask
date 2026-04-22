-- =============================================================================
-- Multitask — 11. Triggers: updated_at, profile creation, cascades,
--   timer aggregation, storage tracking
-- =============================================================================

-- Generic updated_at trigger function ------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Attach to every table with an updated_at column ------------------------------
do $$
declare
  tbl text;
  tables text[] := array[
    'organizations', 'profiles', 'projects', 'project_expenses',
    'project_templates', 'task_lists', 'tasks', 'time_entries',
    'task_custom_fields', 'events', 'recordings', 'thoughts',
    'thought_lists', 'questions', 'user_saved_filters',
    'user_dashboard_layouts', 'user_list_visibility'
  ];
begin
  foreach tbl in array tables loop
    execute format(
      'drop trigger if exists set_updated_at on public.%I;
       create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at();',
      tbl, tbl
    );
  end loop;
end $$;

-- =============================================================================
-- Auto-create profile when auth.users row inserted
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  -- Default notification preferences
  insert into public.user_notification_preferences (user_id, type, in_app, push, email)
  select new.id, t.type, true,
    case when t.type in ('task_assigned','event_invited','thought_received','event_starting_soon') then true else false end,
    false
  from unnest(enum_range(null::notification_type)) as t(type)
  on conflict (user_id, type) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- Auto-create a task_list (kind='project') whenever a project is inserted
-- =============================================================================

create or replace function public.handle_new_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.task_lists (
    organization_id, owner_id, name, emoji, color, kind, project_id
  ) values (
    new.organization_id, new.owner_id, new.name, new.emoji, new.color,
    'project', new.id
  )
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_project_created on public.projects;
create trigger on_project_created
  after insert on public.projects
  for each row execute function public.handle_new_project();

-- =============================================================================
-- Cascade archival: archiving a project archives its list + its tasks
-- =============================================================================

create or replace function public.cascade_project_archive()
returns trigger
language plpgsql
as $$
begin
  if new.is_archived and not coalesce(old.is_archived, false) then
    update public.task_lists
      set is_archived = true,
          archived_at = coalesce(new.archived_at, now()),
          archive_expires_at = coalesce(new.archive_expires_at, now() + interval '60 days')
      where project_id = new.id and is_archived = false;
  elsif not new.is_archived and coalesce(old.is_archived, false) then
    update public.task_lists
      set is_archived = false, archived_at = null, archive_expires_at = null
      where project_id = new.id and is_archived = true;
  end if;
  return new;
end;
$$;

drop trigger if exists cascade_project_archive on public.projects;
create trigger cascade_project_archive
  after update on public.projects
  for each row execute function public.cascade_project_archive();

-- =============================================================================
-- Timer aggregation: keep tasks.actual_seconds in sync with time_entries
-- =============================================================================

create or replace function public.recalc_task_actual_seconds(p_task uuid)
returns void
language sql
as $$
  update public.tasks
    set actual_seconds = coalesce(
      (select sum(duration_seconds)::int
         from public.time_entries
         where task_id = p_task and duration_seconds is not null),
      0)
    where id = p_task;
$$;

create or replace function public.time_entries_after_write()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'DELETE') then
    perform public.recalc_task_actual_seconds(old.task_id);
    return old;
  else
    -- compute duration_seconds if missing
    if new.ended_at is not null and new.duration_seconds is null then
      new.duration_seconds := greatest(0, extract(epoch from (new.ended_at - new.started_at))::int);
    end if;
    if new.task_id is not null then
      perform public.recalc_task_actual_seconds(new.task_id);
    end if;
    return new;
  end if;
end;
$$;

drop trigger if exists time_entries_recalc on public.time_entries;
create trigger time_entries_recalc
  after insert or update or delete on public.time_entries
  for each row execute function public.time_entries_after_write();

-- =============================================================================
-- Storage tracking: update org + user storage_bytes_used when recordings change
-- =============================================================================

create or replace function public.recalc_storage_bytes()
returns trigger
language plpgsql
as $$
declare
  v_org uuid;
  v_owner uuid;
  v_delta bigint;
begin
  if (tg_op = 'DELETE') then
    v_org := old.organization_id;
    v_owner := old.owner_id;
    v_delta := -coalesce(old.size_bytes, 0);
  elsif (tg_op = 'INSERT') then
    v_org := new.organization_id;
    v_owner := new.owner_id;
    v_delta := coalesce(new.size_bytes, 0);
  else -- UPDATE
    v_org := new.organization_id;
    v_owner := new.owner_id;
    -- only count delta when not archived / archived state changes
    if old.audio_archived = false and new.audio_archived = true then
      v_delta := -coalesce(old.size_bytes, 0);
    elsif old.audio_archived = true and new.audio_archived = false then
      v_delta := coalesce(new.size_bytes, 0);
    else
      v_delta := coalesce(new.size_bytes, 0) - coalesce(old.size_bytes, 0);
    end if;
  end if;

  if v_delta <> 0 then
    update public.organizations
      set storage_bytes_used = greatest(0, storage_bytes_used + v_delta)
      where id = v_org;
    update public.profiles
      set storage_bytes_used = greatest(0, storage_bytes_used + v_delta)
      where id = v_owner;
  end if;

  if (tg_op = 'DELETE') then return old; else return new; end if;
end;
$$;

drop trigger if exists recordings_recalc_storage on public.recordings;
create trigger recordings_recalc_storage
  after insert or update or delete on public.recordings
  for each row execute function public.recalc_storage_bytes();

-- =============================================================================
-- Prevent dependency cycles in task_dependencies
-- =============================================================================

create or replace function public.check_no_dependency_cycle()
returns trigger
language plpgsql
as $$
declare
  v_cycle boolean;
begin
  with recursive deps as (
    select depends_on_task_id as visited
      from public.task_dependencies
      where task_id = new.depends_on_task_id
    union
    select d.depends_on_task_id
      from public.task_dependencies d
      join deps on d.task_id = deps.visited
  )
  select exists (select 1 from deps where visited = new.task_id) into v_cycle;

  if v_cycle then
    raise exception 'dependency cycle detected on task %', new.task_id;
  end if;
  return new;
end;
$$;

drop trigger if exists task_dependencies_no_cycle on public.task_dependencies;
create trigger task_dependencies_no_cycle
  before insert or update on public.task_dependencies
  for each row execute function public.check_no_dependency_cycle();

-- =============================================================================
-- Set archive_expires_at automatically when archiving
-- =============================================================================

create or replace function public.set_archive_expiry()
returns trigger
language plpgsql
as $$
begin
  if new.is_archived and not coalesce(old.is_archived, false) then
    if new.archived_at is null then new.archived_at := now(); end if;
    if new.archive_expires_at is null then
      new.archive_expires_at := new.archived_at + interval '60 days';
    end if;
  elsif not new.is_archived and coalesce(old.is_archived, false) then
    new.archived_at := null;
    new.archive_expires_at := null;
  end if;
  return new;
end;
$$;

do $$
declare
  tbl text;
  tables text[] := array['projects', 'task_lists', 'thought_lists', 'organizations'];
begin
  foreach tbl in array tables loop
    execute format(
      'drop trigger if exists set_archive_expiry on public.%I;
       create trigger set_archive_expiry before update on public.%I
       for each row execute function public.set_archive_expiry();',
      tbl, tbl
    );
  end loop;
end $$;
