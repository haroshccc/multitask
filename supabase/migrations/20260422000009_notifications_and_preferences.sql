-- =============================================================================
-- Multitask — 09. Notifications, push tokens, user preferences
-- =============================================================================

-- Notifications ----------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,

  type notification_type not null,
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  action_url text,

  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx on public.notifications(user_id, created_at desc)
  where read_at is null;
create index notifications_user_all_idx on public.notifications(user_id, created_at desc);

-- Push tokens ------------------------------------------------------------------
create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform push_platform not null,
  onesignal_player_id text unique,
  device_info jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens(user_id);

-- User notification preferences ------------------------------------------------
create table public.user_notification_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  type notification_type not null,
  in_app boolean not null default true,
  push boolean not null default true,
  email boolean not null default false,
  primary key (user_id, type)
);

-- User saved filters (per screen) ----------------------------------------------
create table public.user_saved_filters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  screen_key dashboard_screen not null,
  name text not null,
  filter_config jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index user_saved_filters_user_screen_idx
  on public.user_saved_filters(user_id, screen_key);

-- User dashboard layouts (per user + screen + optional scope) ------------------
create table public.user_dashboard_layouts (
  user_id uuid not null references auth.users(id) on delete cascade,
  screen_key dashboard_screen not null,
  scope_id uuid,                                    -- e.g. project_id for pricing screen
  layout_desktop jsonb not null default '[]'::jsonb,
  layout_tablet jsonb not null default '[]'::jsonb,
  layout_mobile jsonb not null default '[]'::jsonb,
  widget_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, screen_key, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid))
);

-- User list visibility (per screen) --------------------------------------------
create table public.user_list_visibility (
  user_id uuid not null references auth.users(id) on delete cascade,
  screen_key dashboard_screen not null,
  hidden_list_ids uuid[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, screen_key)
);

-- Add active_time_entry FK now that time_entries exists ------------------------
alter table public.profiles
  add constraint profiles_active_time_entry_fk
    foreign key (active_time_entry_id) references public.time_entries(id) on delete set null;
