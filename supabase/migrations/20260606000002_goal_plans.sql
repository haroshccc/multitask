-- =============================================================================
-- Goal Plans (תוכניות עבודה) — strategic planning layer on top of lists/tasks.
--
-- A "plan" is a task_list with kind='plan'. It reuses the existing primitives:
--   • stage  (שלב)   = task with is_phase=true   (list-level, no parent)
--   • task   (משימה) = regular task under a stage (parent_task_id = stage)
-- and adds a conceptual layer on top:
--   • per-stage success-metric / quantitative-target / status / time-range
--   • decisions   (שאלות→החלטות→השפעות) — plan_decisions + plan_decision_impacts
--   • stage impact matrix (מטריצת השפעות בין שלבים) — plan_stage_impacts
--   • clone-to-shorter-plan with a parent link (parent_plan_id) via duplicate_plan()
--   • calendar visualization mode (off / list / framework)
--
-- The 'plan' value of task_list_kind is added in the companion migration
-- 20260606000001_goal_plans_kind.sql (separate tx — Postgres forbids using a
-- freshly-added enum value in the same transaction that adds it).
--
-- Deliberately does NOT touch the sensitive task-save path
-- (TaskRow/TaskColumn/useTasks). Access model mirrors tasks/task_lists:
-- org-member based (super_admin override).
-- =============================================================================

-- 2. Plan-level columns on task_lists ----------------------------------------
alter table public.task_lists
  add column if not exists plan_start_date      date,
  add column if not exists plan_end_date        date,
  add column if not exists plan_horizon         text,          -- '3y' | '1y' | 'quarter' | 'custom'
  add column if not exists parent_plan_id       uuid references public.task_lists(id) on delete set null,
  add column if not exists plan_general_goal    text,          -- "מטרה כללית"
  add column if not exists calendar_display_mode text not null default 'off'
    check (calendar_display_mode in ('off','list','framework'));

create index if not exists task_lists_parent_plan_idx on public.task_lists(parent_plan_id);

-- 3. Per-row plan fields on tasks (apply to both stages and tasks) -----------
-- Faithful to the Excel columns: יעד/שאיפה (=description), טווח זמן, מדד הצלחה,
-- יעד כמותי, סטטוס. תיעדוף reuses the existing `urgency` column.
alter table public.tasks
  add column if not exists plan_time_range     text,           -- "טווח זמן" (free text, e.g. "Q1" / "2026")
  add column if not exists plan_success_metric text,           -- "מדד הצלחה"
  add column if not exists plan_quant_target   text,           -- "יעד כמותי" (free text, e.g. "500 לידים")
  add column if not exists plan_status         text            -- "סטטוס" (decoupled from user task-statuses)
    check (plan_status is null or plan_status in ('notstarted','inprogress','done','dropped'));

-- 4. Decisions (שאלות → החלטות) ----------------------------------------------
create table if not exists public.plan_decisions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id         uuid not null references public.task_lists(id) on delete cascade,
  stage_task_id   uuid references public.tasks(id) on delete cascade,  -- null = plan-level decision
  question        text not null default '',
  decision        text not null default '',
  sort_order      int  not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists plan_decisions_plan_idx  on public.plan_decisions(plan_id);
create index if not exists plan_decisions_stage_idx on public.plan_decisions(stage_task_id);

-- 5. Decision impacts (🔗 השפעה) ---------------------------------------------
create table if not exists public.plan_decision_impacts (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations(id) on delete cascade,
  decision_id            uuid not null references public.plan_decisions(id) on delete cascade,
  affected_stage_task_id uuid references public.tasks(id) on delete set null,
  note                   text not null default '',
  sort_order             int  not null default 0,
  created_at             timestamptz not null default now()
);
create index if not exists plan_decision_impacts_decision_idx on public.plan_decision_impacts(decision_id);

-- 6. Stage impact matrix (מטריצת השפעות בין שלבים) ---------------------------
create table if not exists public.plan_stage_impacts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id         uuid not null references public.task_lists(id) on delete cascade,
  source_stage_id uuid not null references public.tasks(id) on delete cascade,
  target_stage_id uuid not null references public.tasks(id) on delete cascade,
  impact_level    smallint check (impact_level is null or impact_level between 0 and 3),
  note            text not null default '',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (source_stage_id, target_stage_id)
);
create index if not exists plan_stage_impacts_plan_idx on public.plan_stage_impacts(plan_id);

-- 7. updated_at triggers (reuse existing set_updated_at) ----------------------
drop trigger if exists trg_plan_decisions_updated_at on public.plan_decisions;
create trigger trg_plan_decisions_updated_at before update on public.plan_decisions
  for each row execute function public.set_updated_at();
drop trigger if exists trg_plan_stage_impacts_updated_at on public.plan_stage_impacts;
create trigger trg_plan_stage_impacts_updated_at before update on public.plan_stage_impacts
  for each row execute function public.set_updated_at();

-- 8. RLS (org-member based, mirrors tasks/task_lists) ------------------------
alter table public.plan_decisions        enable row level security;
alter table public.plan_decision_impacts enable row level security;
alter table public.plan_stage_impacts    enable row level security;

create policy "plan_decisions: org members read" on public.plan_decisions for select
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));
create policy "plan_decisions: org members write" on public.plan_decisions for all
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
  with check (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));

create policy "plan_decision_impacts: org members read" on public.plan_decision_impacts for select
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));
create policy "plan_decision_impacts: org members write" on public.plan_decision_impacts for all
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
  with check (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));

create policy "plan_stage_impacts: org members read" on public.plan_stage_impacts for select
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));
create policy "plan_stage_impacts: org members write" on public.plan_stage_impacts for all
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
  with check (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));

-- 9. duplicate_plan: full copy + parent link, no live sync -------------------
-- Copies the plan list, the whole stage/task tree (preserving is_phase, goal_*,
-- plan_* fields and hierarchy), decisions, decision-impacts and the stage
-- impact matrix — remapping every task reference to the new copies.
create or replace function public.duplicate_plan(
  p_source_plan_id uuid,
  p_new_name       text default null,
  p_horizon        text default null,
  p_start          date default null,
  p_end            date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_src       public.task_lists;
  v_new_plan  uuid;
  v_found     boolean;
  r           record;
  v_new_id    uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select * into v_src from public.task_lists where id = p_source_plan_id;
  if v_src.id is null then raise exception 'source plan not found'; end if;
  if not user_is_org_member(v_src.organization_id, auth.uid()) then
    raise exception 'not a member of plan organization';
  end if;

  -- session-scoped old->new task id map
  create temp table if not exists _plan_dup_map(old uuid primary key, new uuid not null) on commit drop;
  delete from _plan_dup_map;

  -- 9a. new plan list (linked to source via parent_plan_id)
  insert into public.task_lists (
    organization_id, owner_id, name, color, emoji, kind,
    plan_start_date, plan_end_date, plan_horizon, parent_plan_id,
    plan_general_goal, calendar_display_mode, sort_order
  ) values (
    v_src.organization_id, auth.uid(),
    coalesce(p_new_name, v_src.name || ' — נגזרת'),
    v_src.color, v_src.emoji, v_src.kind,
    coalesce(p_start, v_src.plan_start_date),
    coalesce(p_end,   v_src.plan_end_date),
    coalesce(p_horizon, v_src.plan_horizon),
    v_src.id,                       -- parent link
    v_src.plan_general_goal, 'off', v_src.sort_order + 0.01
  )
  returning id into v_new_plan;

  -- 9b. copy task tree (arbitrary depth) — parents before children
  loop
    v_found := false;
    for r in
      select t.* from public.tasks t
      where t.task_list_id = p_source_plan_id
        and not exists (select 1 from _plan_dup_map m where m.old = t.id)
        and (t.parent_task_id is null
             or exists (select 1 from _plan_dup_map m where m.old = t.parent_task_id))
      order by t.sort_order
    loop
      insert into public.tasks (
        organization_id, owner_id, task_list_id, parent_task_id,
        title, description, status, urgency, is_phase, sort_order,
        scheduled_at, duration_minutes, deadline_at, recurrence_rule, recurrence_ends_at,
        goal_type, goal_period, goal_target, goal_min_streak_periods,
        goal_started_on, goal_track_time, goal_deadline,
        plan_time_range, plan_success_metric, plan_quant_target, plan_status,
        custom_fields, location, external_url, notes, tags
      ) values (
        r.organization_id, auth.uid(), v_new_plan,
        (select m.new from _plan_dup_map m where m.old = r.parent_task_id),
        r.title, r.description, 'todo', r.urgency, r.is_phase, r.sort_order,
        r.scheduled_at, r.duration_minutes, r.deadline_at, r.recurrence_rule, r.recurrence_ends_at,
        r.goal_type, r.goal_period, r.goal_target, r.goal_min_streak_periods,
        r.goal_started_on, r.goal_track_time, r.goal_deadline,
        r.plan_time_range, r.plan_success_metric, r.plan_quant_target, r.plan_status,
        r.custom_fields, r.location, r.external_url, r.notes, r.tags
      )
      returning id into v_new_id;
      insert into _plan_dup_map(old, new) values (r.id, v_new_id);
      v_found := true;
    end loop;
    exit when not v_found;
  end loop;

  -- 9c. copy decisions + their impacts (remap stage / affected-stage refs)
  for r in select * from public.plan_decisions where plan_id = p_source_plan_id loop
    insert into public.plan_decisions (
      organization_id, plan_id, stage_task_id, question, decision, sort_order
    ) values (
      r.organization_id, v_new_plan,
      (select m.new from _plan_dup_map m where m.old = r.stage_task_id),
      r.question, r.decision, r.sort_order
    )
    returning id into v_new_id;

    insert into public.plan_decision_impacts (
      organization_id, decision_id, affected_stage_task_id, note, sort_order
    )
    select i.organization_id, v_new_id,
           (select m.new from _plan_dup_map m where m.old = i.affected_stage_task_id),
           i.note, i.sort_order
    from public.plan_decision_impacts i
    where i.decision_id = r.id;
  end loop;

  -- 9d. copy stage impact matrix (remap both endpoints)
  insert into public.plan_stage_impacts (
    organization_id, plan_id, source_stage_id, target_stage_id, impact_level, note
  )
  select s.organization_id, v_new_plan,
         (select m.new from _plan_dup_map m where m.old = s.source_stage_id),
         (select m.new from _plan_dup_map m where m.old = s.target_stage_id),
         s.impact_level, s.note
  from public.plan_stage_impacts s
  where s.plan_id = p_source_plan_id
    and exists (select 1 from _plan_dup_map m where m.old = s.source_stage_id)
    and exists (select 1 from _plan_dup_map m where m.old = s.target_stage_id);

  return v_new_plan;
end;
$$;

grant execute on function public.duplicate_plan(uuid, text, text, date, date) to authenticated;
