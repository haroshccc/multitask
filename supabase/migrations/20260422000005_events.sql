-- =============================================================================
-- Multitask — 05. Events and participants
-- =============================================================================

create table public.events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,

  title text not null,
  description text,

  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  location text,

  -- Video call
  video_call_url text,
  video_call_provider video_call_provider,

  -- Recurrence
  recurrence_rule text,
  recurrence_ends_at timestamptz,
  recurrence_original_id uuid references public.events(id) on delete cascade,

  -- Linked task (when event is derived from a task's scheduled slot)
  source_task_id uuid,                             -- FK added after tasks exists
  source_recording_id uuid,                        -- FK added after recordings
  source_thought_id uuid,                          -- FK added after thoughts

  -- Google Calendar mirror ids (per-invitee map: user_id -> google_event_id)
  google_event_ids jsonb default '{}'::jsonb,

  tags text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint events_valid_range check (ends_at >= starts_at)
);

create index events_org_idx on public.events(organization_id);
create index events_owner_idx on public.events(owner_id);
create index events_range_idx on public.events(starts_at, ends_at);
create index events_tags_idx on public.events using gin(tags);

-- Event participants (all internal — external invites deferred) ----------------
create table public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rsvp_status event_rsvp_status not null default 'pending',
  added_at timestamptz not null default now(),
  responded_at timestamptz,

  unique (event_id, user_id)
);

create index event_participants_user_idx on public.event_participants(user_id);
create index event_participants_event_idx on public.event_participants(event_id);
