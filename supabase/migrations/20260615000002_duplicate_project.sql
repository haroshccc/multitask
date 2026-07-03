-- Duplicate a whole project with its single task list and full task tree, but
-- WITHOUT time worked (actual_seconds -> 0, time_entries not copied) and WITHOUT
-- completion (status -> 'todo', completed_at/occurrences/approval reset).
-- Mirrors duplicate_plan: security definer + org-member guard + temp old->new id
-- maps + a parents-before-children loop. Also copies custom-field definitions and
-- the task-dependency graph (both endpoints remapped). A trigger
-- (handle_new_project) already creates the new project's single empty task_list,
-- so we reuse it rather than inserting a second (task_lists has unique(project_id)).
create or replace function public.duplicate_project(
  p_source   uuid,
  p_new_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src      public.projects;
  v_new      uuid;
  v_new_list uuid;
  v_found    boolean;
  r          record;
  v_new_id   uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_src from public.projects where id = p_source;
  if v_src.id is null then raise exception 'source project not found'; end if;
  if not user_is_org_member(v_src.organization_id, auth.uid()) then
    raise exception 'not a member of project organization';
  end if;

  -- 1. the project itself (fresh copy: active, un-archived, owned by caller)
  insert into public.projects (
    organization_id, owner_id, name, description, pricing_mode,
    total_price_cents, hourly_rate_cents, profit_percentage, spare_mode, spare_value,
    currency, vat_percentage, status, tags, color, emoji, is_archived, is_active,
    column_labels, column_order, entity_column_order, entity_column_labels, entity_hidden_columns
  ) values (
    v_src.organization_id, auth.uid(),
    coalesce(p_new_name, v_src.name || ' (עותק)'),
    v_src.description, v_src.pricing_mode,
    v_src.total_price_cents, v_src.hourly_rate_cents, v_src.profit_percentage,
    v_src.spare_mode, v_src.spare_value, v_src.currency, v_src.vat_percentage,
    'active', v_src.tags, v_src.color, v_src.emoji, false, true,
    v_src.column_labels, v_src.column_order, v_src.entity_column_order,
    v_src.entity_column_labels, v_src.entity_hidden_columns
  )
  returning id into v_new;

  -- 2. custom-field definitions (same field_key so tasks.custom_fields resolve)
  insert into public.task_custom_fields (
    project_id, field_key, field_label, field_type, options, sort_order, is_visible, entity_type
  )
  select v_new, field_key, field_label, field_type, options, sort_order, is_visible, entity_type
  from public.task_custom_fields where project_id = p_source;

  -- 3. reuse the trigger-created list; map the source project's list onto it
  create temp table if not exists _proj_dup_lmap(old uuid primary key, new uuid not null) on commit drop;
  delete from _proj_dup_lmap;
  select id into v_new_list from public.task_lists where project_id = v_new limit 1;

  for r in
    select * from public.task_lists where project_id = p_source and is_archived = false
  loop
    if v_new_list is null then
      insert into public.task_lists (
        organization_id, owner_id, name, emoji, color, kind, project_id, sort_order, is_pinned,
        plan_start_date, plan_end_date, plan_horizon, plan_general_goal, calendar_display_mode
      ) values (
        r.organization_id, auth.uid(), r.name, r.emoji, r.color, r.kind, v_new, r.sort_order, r.is_pinned,
        r.plan_start_date, r.plan_end_date, r.plan_horizon, r.plan_general_goal, r.calendar_display_mode
      )
      returning id into v_new_list;
    else
      update public.task_lists set
        name = r.name, emoji = r.emoji, color = r.color, sort_order = r.sort_order,
        is_pinned = r.is_pinned, plan_start_date = r.plan_start_date, plan_end_date = r.plan_end_date,
        plan_horizon = r.plan_horizon, plan_general_goal = r.plan_general_goal,
        calendar_display_mode = r.calendar_display_mode
      where id = v_new_list;
    end if;
    insert into _proj_dup_lmap(old, new) values (r.id, v_new_list);
    exit; -- a project has exactly one list
  end loop;

  -- 4. tasks (parents before children); reset time worked + completion state
  create temp table if not exists _proj_dup_tmap(old uuid primary key, new uuid not null) on commit drop;
  delete from _proj_dup_tmap;
  loop
    v_found := false;
    for r in
      select t.* from public.tasks t
      join _proj_dup_lmap lm on lm.old = t.task_list_id
      where not exists (select 1 from _proj_dup_tmap m where m.old = t.id)
        and (t.parent_task_id is null
             or exists (select 1 from _proj_dup_tmap m where m.old = t.parent_task_id))
      order by t.sort_order
    loop
      insert into public.tasks (
        organization_id, owner_id, task_list_id, parent_task_id,
        title, description, status, urgency, sort_order,
        scheduled_at, duration_minutes, is_event, estimated_hours, spare_hours,
        deadline_at, recurrence_rule, recurrence_ends_at,
        assignee_user_id, requires_approval, approver_user_id,
        is_phase, accent_color, is_critical,
        goal_type, goal_period, goal_target, goal_min_streak_periods,
        goal_started_on, goal_track_time, goal_deadline,
        plan_time_range, plan_success_metric, plan_quant_target, plan_status,
        custom_fields, location, external_url, notes, tags
      ) values (
        r.organization_id, auth.uid(),
        (select lm.new from _proj_dup_lmap lm where lm.old = r.task_list_id),
        (select tm.new from _proj_dup_tmap tm where tm.old = r.parent_task_id),
        r.title, r.description, 'todo', r.urgency, r.sort_order,
        r.scheduled_at, r.duration_minutes, r.is_event, r.estimated_hours, r.spare_hours,
        r.deadline_at, r.recurrence_rule, r.recurrence_ends_at,
        r.assignee_user_id, r.requires_approval, r.approver_user_id,
        r.is_phase, r.accent_color, r.is_critical,
        r.goal_type, r.goal_period, r.goal_target, r.goal_min_streak_periods,
        r.goal_started_on, r.goal_track_time, r.goal_deadline,
        r.plan_time_range, r.plan_success_metric, r.plan_quant_target, r.plan_status,
        r.custom_fields, r.location, r.external_url, r.notes, r.tags
      )
      returning id into v_new_id;
      insert into _proj_dup_tmap(old, new) values (r.id, v_new_id);
      v_found := true;
    end loop;
    exit when not v_found;
  end loop;

  -- 5. task-dependency graph (only edges whose both endpoints were copied)
  insert into public.task_dependencies (task_id, depends_on_task_id, relation, lag_days)
  select tm1.new, tm2.new, d.relation, d.lag_days
  from public.task_dependencies d
  join _proj_dup_tmap tm1 on tm1.old = d.task_id
  join _proj_dup_tmap tm2 on tm2.old = d.depends_on_task_id;

  return v_new;
end;
$$;

grant execute on function public.duplicate_project(uuid, text) to authenticated;
