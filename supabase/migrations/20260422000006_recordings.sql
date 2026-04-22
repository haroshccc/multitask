-- =============================================================================
-- Multitask — 06. Recordings, speakers, recording→task links
-- =============================================================================

create table public.recordings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,

  title text,
  source recording_source not null default 'other',

  -- Storage
  storage_path text not null,
  mime_type text not null default 'audio/mpeg',
  size_bytes bigint not null default 0,
  duration_seconds integer,

  -- Language / processing
  language text not null default 'he',
  status recording_status not null default 'uploaded',
  provider text,                              -- 'gladia' | 'ivrit_ai' | ...
  provider_job_id text,
  error_message text,

  -- Results
  transcript_text text,
  transcript_json jsonb,                      -- full segments with speaker labels + timestamps
  summary text,
  speakers_count smallint,

  -- Retention policy
  retention_days integer,                     -- null = keep forever
  archive_audio_at timestamptz,
  audio_archived boolean not null default false,

  -- Tags & linkage
  tags text[] not null default '{}',
  project_id uuid references public.projects(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recordings_org_idx on public.recordings(organization_id);
create index recordings_owner_idx on public.recordings(owner_id);
create index recordings_status_idx on public.recordings(status);
create index recordings_source_idx on public.recordings(source);
create index recordings_tags_idx on public.recordings using gin(tags);
create index recordings_archive_idx on public.recordings(archive_audio_at)
  where audio_archived = false and archive_audio_at is not null;

-- Recording speakers -----------------------------------------------------------
create table public.recording_speakers (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings(id) on delete cascade,
  speaker_index smallint not null,
  label text,
  role speaker_role,
  user_id uuid references auth.users(id) on delete set null,         -- when role='owner' and matched

  created_at timestamptz not null default now(),
  unique (recording_id, speaker_index)
);

create index recording_speakers_recording_idx on public.recording_speakers(recording_id);

-- Recording → Task links (extracted tasks) -------------------------------------
create table public.recording_tasks (
  id uuid primary key default gen_random_uuid(),
  recording_id uuid not null references public.recordings(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  assigned_to_speaker_index smallint,
  extracted_text text,
  confidence numeric(3,2),
  created_at timestamptz not null default now(),

  unique (recording_id, task_id)
);

create index recording_tasks_recording_idx on public.recording_tasks(recording_id);
create index recording_tasks_task_idx on public.recording_tasks(task_id);

-- Complete the deferred FK references from tasks/events/task_attachments --------
alter table public.tasks
  add constraint tasks_source_recording_fk
    foreign key (source_recording_id) references public.recordings(id) on delete set null;

alter table public.events
  add constraint events_source_recording_fk
    foreign key (source_recording_id) references public.recordings(id) on delete set null;

alter table public.task_attachments
  add constraint task_attachments_recording_fk
    foreign key (recording_id) references public.recordings(id) on delete cascade;

alter table public.task_attachments
  add constraint task_attachments_event_fk
    foreign key (event_id) references public.events(id) on delete cascade;

alter table public.events
  add constraint events_source_task_fk
    foreign key (source_task_id) references public.tasks(id) on delete set null;
