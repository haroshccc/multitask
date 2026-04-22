-- =============================================================================
-- Multitask — 10. Row Level Security helpers and policies
-- =============================================================================

-- Helper functions (security definer) ------------------------------------------

create or replace function public.user_is_org_member(org_id uuid, target_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id
      and user_id = target_user
  );
$$;

create or replace function public.user_is_super_admin(target_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_super_admin from public.profiles where id = target_user),
    false
  );
$$;

create or replace function public.user_has_share(
  p_entity_type share_entity_type,
  p_entity_id uuid,
  p_user uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.shares
    where entity_type = p_entity_type
      and entity_id = p_entity_id
      and user_id = p_user
  );
$$;

-- =============================================================================
-- Enable RLS on every table
-- =============================================================================

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_expenses enable row level security;
alter table public.project_templates enable row level security;
alter table public.task_lists enable row level security;
alter table public.tasks enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.time_entries enable row level security;
alter table public.task_attachments enable row level security;
alter table public.task_custom_fields enable row level security;
alter table public.events enable row level security;
alter table public.event_participants enable row level security;
alter table public.recordings enable row level security;
alter table public.recording_speakers enable row level security;
alter table public.recording_tasks enable row level security;
alter table public.thoughts enable row level security;
alter table public.thought_lists enable row level security;
alter table public.thought_list_assignments enable row level security;
alter table public.thought_processings enable row level security;
alter table public.questions enable row level security;
alter table public.shares enable row level security;
alter table public.whatsapp_inbound_log enable row level security;
alter table public.super_admin_audit_log enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;
alter table public.user_notification_preferences enable row level security;
alter table public.user_saved_filters enable row level security;
alter table public.user_dashboard_layouts enable row level security;
alter table public.user_list_visibility enable row level security;

-- =============================================================================
-- ORGANIZATIONS
-- =============================================================================

create policy "org: members read"
  on public.organizations for select
  using (user_is_org_member(id, auth.uid()) or user_is_super_admin(auth.uid()));

create policy "org: anyone authenticated can create"
  on public.organizations for insert
  with check (auth.uid() is not null and created_by = auth.uid());

create policy "org: owners/admins update"
  on public.organizations for update
  using (
    user_is_super_admin(auth.uid())
    or exists (
      select 1 from public.organization_members
      where organization_id = organizations.id
        and user_id = auth.uid()
        and role in ('owner', 'admin')
    )
  );

create policy "org: super admin deletes"
  on public.organizations for delete
  using (user_is_super_admin(auth.uid()));

-- =============================================================================
-- ORGANIZATION_MEMBERS
-- =============================================================================

create policy "org_members: read own org rows"
  on public.organization_members for select
  using (
    user_id = auth.uid()
    or user_is_org_member(organization_id, auth.uid())
    or user_is_super_admin(auth.uid())
  );

create policy "org_members: user joins self, or org admin adds"
  on public.organization_members for insert
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.organization_members m
      where m.organization_id = organization_members.organization_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
    or user_is_super_admin(auth.uid())
  );

create policy "org_members: admins update"
  on public.organization_members for update
  using (
    user_is_super_admin(auth.uid())
    or exists (
      select 1 from public.organization_members m
      where m.organization_id = organization_members.organization_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

create policy "org_members: admins or self delete"
  on public.organization_members for delete
  using (
    user_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or exists (
      select 1 from public.organization_members m
      where m.organization_id = organization_members.organization_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

-- =============================================================================
-- PROFILES
-- =============================================================================

create policy "profiles: self or same-org read"
  on public.profiles for select
  using (
    id = auth.uid()
    or user_is_super_admin(auth.uid())
    or exists (
      select 1
      from public.organization_members a
      join public.organization_members b
        on a.organization_id = b.organization_id
      where a.user_id = auth.uid()
        and b.user_id = profiles.id
    )
  );

create policy "profiles: self update"
  on public.profiles for update
  using (id = auth.uid() or user_is_super_admin(auth.uid()));

create policy "profiles: self insert"
  on public.profiles for insert
  with check (id = auth.uid() or user_is_super_admin(auth.uid()));

-- =============================================================================
-- Generic org-scoped read + write pattern
-- Applied to: projects, project_expenses, project_templates, task_lists,
--   tasks, time_entries, task_attachments, task_custom_fields,
--   events, event_participants, recordings, recording_speakers, recording_tasks,
--   thoughts, thought_lists, thought_list_assignments, thought_processings,
--   questions, task_dependencies
-- =============================================================================

-- Projects
create policy "projects: org members read"
  on public.projects for select
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));
create policy "projects: org members write"
  on public.projects for all
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
  with check (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));

-- Project expenses
create policy "project_expenses: via project"
  on public.project_expenses for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_expenses.project_id
        and (user_is_org_member(p.organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_expenses.project_id
        and (user_is_org_member(p.organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
    )
  );

-- Project templates (per-user)
create policy "project_templates: owner only"
  on public.project_templates for all
  using (owner_id = auth.uid() or user_is_super_admin(auth.uid()))
  with check (owner_id = auth.uid() or user_is_super_admin(auth.uid()));

-- Task lists
create policy "task_lists: org members read"
  on public.task_lists for select
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));
create policy "task_lists: org members write"
  on public.task_lists for all
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
  with check (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));

-- Tasks
create policy "tasks: org members read"
  on public.tasks for select
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));
create policy "tasks: org members write"
  on public.tasks for all
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
  with check (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));

-- Task dependencies
create policy "task_dependencies: via task"
  on public.task_dependencies for all
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_dependencies.task_id
        and (user_is_org_member(t.organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.tasks t
      where t.id = task_dependencies.task_id
        and (user_is_org_member(t.organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
    )
  );

-- Time entries
create policy "time_entries: org read"
  on public.time_entries for select
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));
create policy "time_entries: self write"
  on public.time_entries for insert
  with check (user_id = auth.uid() and user_is_org_member(organization_id, auth.uid()));
create policy "time_entries: self update"
  on public.time_entries for update
  using (user_id = auth.uid() or user_is_super_admin(auth.uid()));
create policy "time_entries: self delete"
  on public.time_entries for delete
  using (user_id = auth.uid() or user_is_super_admin(auth.uid()));

-- Task attachments
create policy "task_attachments: via org"
  on public.task_attachments for all
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
  with check (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));

-- Task custom fields
create policy "task_custom_fields: via project"
  on public.task_custom_fields for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = task_custom_fields.project_id
        and (user_is_org_member(p.organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = task_custom_fields.project_id
        and (user_is_org_member(p.organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
    )
  );

-- Events
create policy "events: org members read"
  on public.events for select
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));
create policy "events: org members write"
  on public.events for all
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
  with check (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));

-- Event participants
create policy "event_participants: via event"
  on public.event_participants for all
  using (
    exists (
      select 1 from public.events e
      where e.id = event_participants.event_id
        and (user_is_org_member(e.organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_participants.event_id
        and (user_is_org_member(e.organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
    )
  );

-- Recordings
create policy "recordings: org read"
  on public.recordings for select
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));
create policy "recordings: org write"
  on public.recordings for all
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
  with check (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));

-- Recording speakers
create policy "recording_speakers: via recording"
  on public.recording_speakers for all
  using (
    exists (
      select 1 from public.recordings r
      where r.id = recording_speakers.recording_id
        and (user_is_org_member(r.organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.recordings r
      where r.id = recording_speakers.recording_id
        and (user_is_org_member(r.organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
    )
  );

-- Recording tasks link
create policy "recording_tasks: via recording"
  on public.recording_tasks for all
  using (
    exists (
      select 1 from public.recordings r
      where r.id = recording_tasks.recording_id
        and (user_is_org_member(r.organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.recordings r
      where r.id = recording_tasks.recording_id
        and (user_is_org_member(r.organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
    )
  );

-- Thoughts
create policy "thoughts: org read"
  on public.thoughts for select
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));
create policy "thoughts: org write"
  on public.thoughts for all
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
  with check (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));

-- Thought lists (per-user)
create policy "thought_lists: owner or same-org"
  on public.thought_lists for all
  using (owner_id = auth.uid() or user_is_super_admin(auth.uid()))
  with check (owner_id = auth.uid() or user_is_super_admin(auth.uid()));

-- Thought list assignments (via thought ownership)
create policy "thought_list_assignments: via thought"
  on public.thought_list_assignments for all
  using (
    exists (
      select 1 from public.thoughts t
      where t.id = thought_list_assignments.thought_id
        and (t.owner_id = auth.uid() or user_is_super_admin(auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.thoughts t
      where t.id = thought_list_assignments.thought_id
        and (t.owner_id = auth.uid() or user_is_super_admin(auth.uid()))
    )
  );

-- Thought processings (via thought)
create policy "thought_processings: via thought"
  on public.thought_processings for all
  using (
    exists (
      select 1 from public.thoughts t
      where t.id = thought_processings.thought_id
        and (user_is_org_member(t.organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.thoughts t
      where t.id = thought_processings.thought_id
        and (user_is_org_member(t.organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
    )
  );

-- Questions
create policy "questions: org read"
  on public.questions for select
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));
create policy "questions: org write"
  on public.questions for all
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
  with check (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));

-- Shares
create policy "shares: org read"
  on public.shares for select
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));
create policy "shares: org write"
  on public.shares for all
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
  with check (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));

-- WhatsApp inbound log (super admin only, or matched user reads their own)
create policy "whatsapp_inbound_log: self or super admin"
  on public.whatsapp_inbound_log for select
  using (matched_user_id = auth.uid() or user_is_super_admin(auth.uid()));

create policy "whatsapp_inbound_log: super admin write"
  on public.whatsapp_inbound_log for all
  using (user_is_super_admin(auth.uid()))
  with check (user_is_super_admin(auth.uid()));

-- Super admin audit log (super admins only)
create policy "super_admin_audit_log: super admin only"
  on public.super_admin_audit_log for select
  using (user_is_super_admin(auth.uid()));

create policy "super_admin_audit_log: super admin insert"
  on public.super_admin_audit_log for insert
  with check (user_is_super_admin(auth.uid()));

-- Notifications (self)
create policy "notifications: self read"
  on public.notifications for select
  using (user_id = auth.uid() or user_is_super_admin(auth.uid()));
create policy "notifications: self update (mark read)"
  on public.notifications for update
  using (user_id = auth.uid());
create policy "notifications: self delete"
  on public.notifications for delete
  using (user_id = auth.uid());

-- Push tokens (self)
create policy "push_tokens: self"
  on public.push_tokens for all
  using (user_id = auth.uid() or user_is_super_admin(auth.uid()))
  with check (user_id = auth.uid() or user_is_super_admin(auth.uid()));

-- User notification preferences (self)
create policy "user_notification_preferences: self"
  on public.user_notification_preferences for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- User saved filters (self)
create policy "user_saved_filters: self"
  on public.user_saved_filters for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- User dashboard layouts (self)
create policy "user_dashboard_layouts: self"
  on public.user_dashboard_layouts for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- User list visibility (self)
create policy "user_list_visibility: self"
  on public.user_list_visibility for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
