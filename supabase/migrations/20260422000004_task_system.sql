-- =============================================================================
-- Multitask — 04. Tasks, lists, dependencies, time entries, attachments
-- =============================================================================

-- Task lists -------------------------------------------------------------------
create table public.task_lists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,

  name text not null,
  emoji text,
  color text,
  kind task_list_kind not null default 'custom',
  project_id uuid references public.projects(id) on delete cascade,   -- only set when kind='project'

  sort_order integer not null default 0,

  is_archived boolean not null default false,
  archived_at timestamptz,
  archive_expires_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint task_list_project_kind_matches
    check ((kind = 'project') = (project_id is not null))
);

create index task_lists_org_idx on public.task_lists(organization_id);
create index task_lists_owner_idx on public.task_lists(owner_id);
create index task_lists_project_idx on public.task_lists(project_id) where project_id is not null;
create index task_lists_archived_idx on public.task_lists(is_archived) where is_archived = true;
create unique index task_lists_project_uniq on public.task_lists(project_id) where project_id is not null;

-- Tasks ------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,

  -- Hierarchy & list assignment
  task_list_id uuid references public.task_lists(id) on delete set null,    -- null = unassigned
  parent_task_id uuid references public.tasks(id) on delete cascade,

  -- Content
  title text not null,
  description text,
  status task_status not null default 'todo',
  urgency smallint not null default 3 check (urgency between 1 and 5),

  -- Scheduling
  scheduled_at timestamptz,
  duration_minutes integer,
  is_event boolean not null default false,         -- categorized as event for calendar display

  -- Pricing
  estimated_hours numeric(6,2),
  spare_hours numeric(6,2) default 0,

  -- Timer (denormalized sum, maintained via trigger)
  actual_seconds integer not null default 0,

  -- Ordering
  sort_order double precision not null default 0,
  completed_at timestamptz,                        -- non-null = sunk to bottom

  -- Responsibility
  assignee_user_id uuid references auth.users(id) on delete set null,

  -- Approval flow
  requires_approval boolean not null default false,
  approver_user_id uuid references auth.users(id) on delete set null,
  completion_submitted_at timestamptz,
  approved_at timestamptz,
  approved_by_user_id uuid references auth.users(id) on delete set null,

  -- Recurrence (iCalendar RRULE)
  recurrence_rule text,
  recurrence_ends_at timestamptz,
  recurrence_original_id uuid references public.tasks(id) on delete cascade,

  -- Provenance — where did this task come from?
  source_recording_id uuid,                        -- FK added after recordings table
  source_thought_id uuid,                          -- FK added after thoughts table
  source_question_id uuid,                         -- FK added after questions table

  -- Custom fields (project-defined extra columns)
  custom_fields jsonb not null default '{}'::jsonb,

  -- Quick attachments
  location text,
  external_url text,
  notes text,

  -- Tags (shared vocabulary, stored as array)
  tags text[] not null default '{}',

  -- Google Calendar mirror ids (serialized per-invitee via JSON map)
  google_event_ids jsonb default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tasks_org_idx on public.tasks(organization_id);
create index tasks_owner_idx on public.tasks(owner_id);
create index tasks_list_idx on public.tasks(task_list_id);
create index tasks_parent_idx on public.tasks(parent_task_id);
create index tasks_assignee_idx on public.tasks(assignee_user_id);
create index tasks_scheduled_idx on public.tasks(scheduled_at);
create index tasks_status_idx on public.tasks(status);
create index tasks_completed_idx on public.tasks(completed_at);
create index tasks_tags_idx on public.tasks using gin(tags);
create index tasks_title_trgm_idx on public.tasks using gin(title gin_trgm_ops);
create index tasks_source_recording_idx on public.tasks(source_recording_id) where source_recording_id is not null;
create index tasks_source_thought_idx on public.tasks(source_thought_id) where source_thought_id is not null;

-- Task dependencies ------------------------------------------------------------
create table public.task_dependencies (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  relation dependency_relation not null default 'finish_to_start',
  lag_days integer not null default 0,
  created_at timestamptz not null default now(),

  constraint task_dependencies_no_self check (task_id <> depends_on_task_id),
  unique (task_id, depends_on_task_id)
);

create index task_dependencies_task_idx on public.task_dependencies(task_id);
create index task_dependencies_depends_on_idx on public.task_dependencies(depends_on_task_id);

-- Time entries (timer sessions) ------------------------------------------------
create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  started_at timestamptz not null,
  ended_at timestamptz,
  duration_seconds integer,
  is_manual boolean not null default false,
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint time_entries_valid_range check (ended_at is null or ended_at >= started_at)
);

create index time_entries_task_idx on public.time_entries(task_id);
create index time_entries_user_idx on public.time_entries(user_id);
create index time_entries_range_idx on public.time_entries(started_at, ended_at);

-- Only one active (not-yet-ended) timer per user
create unique index time_entries_one_active_per_user
  on public.time_entries(user_id)
  where ended_at is null;

-- Task attachments -------------------------------------------------------------
create table public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,

  attachment_type attachment_type not null,
  recording_id uuid,                           -- FK added after recordings
  thought_id uuid,                             -- FK added after thoughts
  event_id uuid,                               -- FK added after events

  storage_path text,
  url text,
  filename text,
  mime_type text,
  size_bytes bigint,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index task_attachments_task_idx on public.task_attachments(task_id);
create index task_attachments_org_idx on public.task_attachments(organization_id);

-- Task custom field definitions (per project) ----------------------------------
create table public.task_custom_fields (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  field_key text not null,                         -- slug used in tasks.custom_fields jsonb
  field_label text not null,
  field_type custom_field_type not null,
  options jsonb,                                   -- for select/multiselect
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (project_id, field_key)
);

create index task_custom_fields_project_idx on public.task_custom_fields(project_id);
