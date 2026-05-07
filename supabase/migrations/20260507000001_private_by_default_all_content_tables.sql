-- =============================================================================
-- Fix: private-by-default for all content tables
-- Everything is owner-only unless explicitly shared via the shares table.
-- Org membership alone no longer grants access to another user's data.
-- =============================================================================

-- ── Drop wrong org-member policies ──────────────────────────────────────────

drop policy if exists "projects_read"   on public.projects;
drop policy if exists "projects_write"  on public.projects;

drop policy if exists "events_read"     on public.events;
drop policy if exists "events_write"    on public.events;

drop policy if exists "rec_read"        on public.recordings;
drop policy if exists "rec_write"       on public.recordings;

drop policy if exists "th_read"         on public.thoughts;
drop policy if exists "th_write"        on public.thoughts;

drop policy if exists "q_read"          on public.questions;
drop policy if exists "q_write"         on public.questions;

drop policy if exists "shares_read"     on public.shares;
drop policy if exists "shares_write"    on public.shares;

drop policy if exists "pe_via_project"  on public.project_expenses;
drop policy if exists "ta_org"          on public.task_attachments;
drop policy if exists "td_via_task"     on public.task_dependencies;
drop policy if exists "te_read"         on public.time_entries;

drop policy if exists "ep_via_event"    on public.event_participants;
drop policy if exists "rsp_via_rec"     on public.recording_speakers;
drop policy if exists "rt_via_rec"      on public.recording_tasks;
drop policy if exists "tp_via_thought"  on public.thought_processings;

-- ── PROJECTS ─────────────────────────────────────────────────────────────────

create policy "projects: owner or shared read"
  on public.projects for select
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or user_has_share('project', id, auth.uid())
  );

create policy "projects: owner insert"
  on public.projects for insert
  with check (owner_id = auth.uid() or user_is_super_admin(auth.uid()));

create policy "projects: owner or write-shared update"
  on public.projects for update
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or exists (
      select 1 from public.shares s
      where s.entity_type = 'project'
        and s.entity_id = projects.id
        and s.user_id = auth.uid()
        and s.permission = 'write'
    )
  )
  with check (true);

create policy "projects: owner delete"
  on public.projects for delete
  using (owner_id = auth.uid() or user_is_super_admin(auth.uid()));

-- ── EVENTS ───────────────────────────────────────────────────────────────────

create policy "events: owner or shared or participant read"
  on public.events for select
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or user_has_share('event', id, auth.uid())
    or exists (
      select 1 from public.event_participants ep
      where ep.event_id = events.id and ep.user_id = auth.uid()
    )
  );

create policy "events: owner insert"
  on public.events for insert
  with check (owner_id = auth.uid() or user_is_super_admin(auth.uid()));

create policy "events: owner or write-shared update"
  on public.events for update
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or exists (
      select 1 from public.shares s
      where s.entity_type = 'event'
        and s.entity_id = events.id
        and s.user_id = auth.uid()
        and s.permission = 'write'
    )
  )
  with check (true);

create policy "events: owner delete"
  on public.events for delete
  using (owner_id = auth.uid() or user_is_super_admin(auth.uid()));

-- ── RECORDINGS ───────────────────────────────────────────────────────────────

create policy "recordings: owner or shared read"
  on public.recordings for select
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or user_has_share('recording', id, auth.uid())
  );

create policy "recordings: owner insert"
  on public.recordings for insert
  with check (owner_id = auth.uid() or user_is_super_admin(auth.uid()));

create policy "recordings: owner or write-shared update"
  on public.recordings for update
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or exists (
      select 1 from public.shares s
      where s.entity_type = 'recording'
        and s.entity_id = recordings.id
        and s.user_id = auth.uid()
        and s.permission = 'write'
    )
  )
  with check (true);

create policy "recordings: owner delete"
  on public.recordings for delete
  using (owner_id = auth.uid() or user_is_super_admin(auth.uid()));

-- ── THOUGHTS ─────────────────────────────────────────────────────────────────

create policy "thoughts: owner or shared read"
  on public.thoughts for select
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or user_has_share('thought', id, auth.uid())
  );

create policy "thoughts: owner insert"
  on public.thoughts for insert
  with check (owner_id = auth.uid() or user_is_super_admin(auth.uid()));

create policy "thoughts: owner or write-shared update"
  on public.thoughts for update
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or exists (
      select 1 from public.shares s
      where s.entity_type = 'thought'
        and s.entity_id = thoughts.id
        and s.user_id = auth.uid()
        and s.permission = 'write'
    )
  )
  with check (true);

create policy "thoughts: owner delete"
  on public.thoughts for delete
  using (owner_id = auth.uid() or user_is_super_admin(auth.uid()));

-- ── QUESTIONS ────────────────────────────────────────────────────────────────

create policy "questions: owner or shared-project read"
  on public.questions for select
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or user_has_share('project', project_id, auth.uid())
    or (task_id is not null and user_has_share('task', task_id, auth.uid()))
  );

create policy "questions: owner insert"
  on public.questions for insert
  with check (owner_id = auth.uid() or user_is_super_admin(auth.uid()));

create policy "questions: owner update"
  on public.questions for update
  using (owner_id = auth.uid() or user_is_super_admin(auth.uid()))
  with check (true);

create policy "questions: owner delete"
  on public.questions for delete
  using (owner_id = auth.uid() or user_is_super_admin(auth.uid()));

-- ── SHARES ───────────────────────────────────────────────────────────────────

create policy "shares: self read"
  on public.shares for select
  using (
    user_id = auth.uid()
    or granted_by = auth.uid()
    or user_is_super_admin(auth.uid())
  );

create policy "shares: owner grant"
  on public.shares for insert
  with check (granted_by = auth.uid() or user_is_super_admin(auth.uid()));

create policy "shares: owner update"
  on public.shares for update
  using (granted_by = auth.uid() or user_is_super_admin(auth.uid()))
  with check (true);

create policy "shares: owner revoke"
  on public.shares for delete
  using (granted_by = auth.uid() or user_is_super_admin(auth.uid()));

-- ── PROJECT EXPENSES ─────────────────────────────────────────────────────────

create policy "project_expenses: via owned or shared project"
  on public.project_expenses for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_expenses.project_id
        and (
          p.owner_id = auth.uid()
          or user_is_super_admin(auth.uid())
          or user_has_share('project', p.id, auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_expenses.project_id
        and (p.owner_id = auth.uid() or user_is_super_admin(auth.uid()))
    )
  );

-- ── TASK ATTACHMENTS ─────────────────────────────────────────────────────────

create policy "task_attachments: via owned or shared task"
  on public.task_attachments for all
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_attachments.task_id
        and (
          t.owner_id = auth.uid()
          or t.assignee_user_id = auth.uid()
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
      where t.id = task_attachments.task_id
        and (t.owner_id = auth.uid() or user_is_super_admin(auth.uid()))
    )
  );

-- ── TASK DEPENDENCIES ────────────────────────────────────────────────────────

create policy "task_dependencies: via owned or shared task"
  on public.task_dependencies for all
  using (
    exists (
      select 1 from public.tasks t
      where t.id = task_dependencies.task_id
        and (
          t.owner_id = auth.uid()
          or t.assignee_user_id = auth.uid()
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
      where t.id = task_dependencies.task_id
        and (t.owner_id = auth.uid() or user_is_super_admin(auth.uid()))
    )
  );

-- ── TIME ENTRIES ─────────────────────────────────────────────────────────────

create policy "time_entries: own read"
  on public.time_entries for select
  using (user_id = auth.uid() or user_is_super_admin(auth.uid()));

-- ── EVENT PARTICIPANTS ───────────────────────────────────────────────────────

create policy "event_participants: via owned or shared event"
  on public.event_participants for all
  using (
    user_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or exists (
      select 1 from public.events e
      where e.id = event_participants.event_id
        and (
          e.owner_id = auth.uid()
          or user_has_share('event', e.id, auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_participants.event_id
        and (e.owner_id = auth.uid() or user_is_super_admin(auth.uid()))
    )
  );

-- ── RECORDING SPEAKERS ───────────────────────────────────────────────────────

create policy "recording_speakers: via owned or shared recording"
  on public.recording_speakers for all
  using (
    exists (
      select 1 from public.recordings r
      where r.id = recording_speakers.recording_id
        and (
          r.owner_id = auth.uid()
          or user_is_super_admin(auth.uid())
          or user_has_share('recording', r.id, auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.recordings r
      where r.id = recording_speakers.recording_id
        and (r.owner_id = auth.uid() or user_is_super_admin(auth.uid()))
    )
  );

-- ── RECORDING TASKS ──────────────────────────────────────────────────────────

create policy "recording_tasks: via owned or shared recording"
  on public.recording_tasks for all
  using (
    exists (
      select 1 from public.recordings r
      where r.id = recording_tasks.recording_id
        and (
          r.owner_id = auth.uid()
          or user_is_super_admin(auth.uid())
          or user_has_share('recording', r.id, auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.recordings r
      where r.id = recording_tasks.recording_id
        and (r.owner_id = auth.uid() or user_is_super_admin(auth.uid()))
    )
  );

-- ── THOUGHT PROCESSINGS ──────────────────────────────────────────────────────

create policy "thought_processings: via owned or shared thought"
  on public.thought_processings for all
  using (
    exists (
      select 1 from public.thoughts t
      where t.id = thought_processings.thought_id
        and (
          t.owner_id = auth.uid()
          or user_is_super_admin(auth.uid())
          or user_has_share('thought', t.id, auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.thoughts t
      where t.id = thought_processings.thought_id
        and (t.owner_id = auth.uid() or user_is_super_admin(auth.uid()))
    )
  );
