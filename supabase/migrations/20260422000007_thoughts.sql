-- =============================================================================
-- Multitask — 07. Thoughts, lists, assignments, processings
-- =============================================================================

create table public.thought_lists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,

  name text not null,
  emoji text,
  color text,
  sort_order integer not null default 0,

  is_archived boolean not null default false,
  archived_at timestamptz,
  archive_expires_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index thought_lists_owner_idx on public.thought_lists(owner_id);
create index thought_lists_org_idx on public.thought_lists(organization_id);

-- Thoughts ---------------------------------------------------------------------
create table public.thoughts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,

  source thought_source not null,
  text_content text,                                -- typed text or transcript
  ai_generated_title text,
  ai_summary text,

  recording_id uuid references public.recordings(id) on delete set null,

  status thought_status not null default 'unprocessed',
  processed_at timestamptz,
  archived_at timestamptz,
  archive_expires_at timestamptz,

  tags text[] not null default '{}',

  -- WhatsApp provenance (for inbound debugging)
  whatsapp_message_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index thoughts_org_idx on public.thoughts(organization_id);
create index thoughts_owner_idx on public.thoughts(owner_id);
create index thoughts_status_idx on public.thoughts(status);
create index thoughts_tags_idx on public.thoughts using gin(tags);
create index thoughts_text_trgm_idx on public.thoughts using gin(text_content gin_trgm_ops);
create index thoughts_whatsapp_msg_idx on public.thoughts(whatsapp_message_id)
  where whatsapp_message_id is not null;

-- Many-to-many thought ↔ list assignments --------------------------------------
create table public.thought_list_assignments (
  thought_id uuid not null references public.thoughts(id) on delete cascade,
  list_id uuid not null references public.thought_lists(id) on delete cascade,
  sort_order_in_list double precision not null default 0,
  assigned_at timestamptz not null default now(),
  primary key (thought_id, list_id)
);

create index thought_list_assignments_list_idx on public.thought_list_assignments(list_id);

-- Thought processings (audit trail of derived entities) ------------------------
create table public.thought_processings (
  id uuid primary key default gen_random_uuid(),
  thought_id uuid not null references public.thoughts(id) on delete cascade,
  target_type thought_processing_target not null,
  target_id uuid not null,
  ai_suggested boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index thought_processings_thought_idx on public.thought_processings(thought_id);
create index thought_processings_target_idx on public.thought_processings(target_type, target_id);

-- Complete deferred FK references --------------------------------------------
alter table public.tasks
  add constraint tasks_source_thought_fk
    foreign key (source_thought_id) references public.thoughts(id) on delete set null;

alter table public.events
  add constraint events_source_thought_fk
    foreign key (source_thought_id) references public.thoughts(id) on delete set null;

alter table public.task_attachments
  add constraint task_attachments_thought_fk
    foreign key (thought_id) references public.thoughts(id) on delete cascade;
