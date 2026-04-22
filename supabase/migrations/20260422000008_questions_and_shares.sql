-- =============================================================================
-- Multitask — 08. Questions, polymorphic shares, whatsapp log, admin audit
-- =============================================================================

-- Questions (per-project panel) ------------------------------------------------
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,

  text text not null,
  answer text,
  tags text[] not null default '{}',

  source_recording_id uuid references public.recordings(id) on delete set null,

  answered_at timestamptz,
  answered_by_user_id uuid references auth.users(id) on delete set null,

  sort_order double precision not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index questions_project_idx on public.questions(project_id);
create index questions_task_idx on public.questions(task_id);
create index questions_answered_idx on public.questions(answered_at);

alter table public.tasks
  add constraint tasks_source_question_fk
    foreign key (source_question_id) references public.questions(id) on delete set null;

-- Polymorphic shares ----------------------------------------------------------
create table public.shares (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type share_entity_type not null,
  entity_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  permission share_permission not null default 'read',
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  unique (entity_type, entity_id, user_id)
);

create index shares_entity_idx on public.shares(entity_type, entity_id);
create index shares_user_idx on public.shares(user_id);

-- WhatsApp inbound log (debugging & replay) ------------------------------------
create table public.whatsapp_inbound_log (
  id uuid primary key default gen_random_uuid(),
  from_phone_e164 text,
  message_id text,
  message_type text,                                -- 'text'|'audio'|'image'|'video'|'document'
  raw_payload jsonb not null,
  matched_user_id uuid references auth.users(id) on delete set null,
  thought_id uuid references public.thoughts(id) on delete set null,
  processing_error text,
  received_at timestamptz not null default now()
);

create index whatsapp_inbound_log_from_idx on public.whatsapp_inbound_log(from_phone_e164);
create index whatsapp_inbound_log_message_idx on public.whatsapp_inbound_log(message_id);

-- Super admin audit log --------------------------------------------------------
create table public.super_admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index super_admin_audit_log_admin_idx on public.super_admin_audit_log(admin_user_id);
create index super_admin_audit_log_target_idx on public.super_admin_audit_log(target_type, target_id);
create index super_admin_audit_log_created_idx on public.super_admin_audit_log(created_at desc);
