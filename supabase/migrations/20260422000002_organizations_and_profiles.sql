-- =============================================================================
-- Multitask — 02. Organizations, memberships, profiles
-- =============================================================================

-- Organizations ----------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  join_password_hash text,                    -- bcrypt-style crypt() digest
  suggested_email_domain text,                -- e.g. "acme.com" for UX hints
  created_by uuid references auth.users(id) on delete set null,

  -- Billing placeholders — implementation deferred
  plan billing_plan not null default 'free',
  subscription_status subscription_status not null default 'active',
  trial_ends_at timestamptz,
  billing_customer_id text,
  current_period_end timestamptz,

  -- Storage quotas (bytes)
  storage_bytes_used bigint not null default 0,
  storage_bytes_limit bigint not null default 5368709120,   -- 5 GB default

  -- Archival
  is_archived boolean not null default false,
  archived_at timestamptz,
  archive_expires_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organizations_created_by_idx on public.organizations(created_by);
create index organizations_slug_idx on public.organizations(slug);
create index organizations_archived_idx on public.organizations(is_archived) where is_archived = true;

-- Organization members ---------------------------------------------------------
create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role organization_member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_members_user_idx on public.organization_members(user_id);

-- Profiles (1:1 with auth.users) -----------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  display_color text,                          -- tint for mentions/chips

  -- Super admin flag (manually set via SQL, never via app)
  is_super_admin boolean not null default false,

  -- Billing placeholders (per-user add-ons)
  plan billing_plan not null default 'free',
  subscription_status subscription_status not null default 'active',
  trial_ends_at timestamptz,
  billing_customer_id text,
  current_period_end timestamptz,

  -- Storage quotas (per-user, default null = use org pool)
  storage_bytes_used bigint not null default 0,
  storage_bytes_limit bigint,

  -- User-level defaults (UX conveniences; overridable per project)
  default_hourly_rate_cents integer,
  default_profit_percentage numeric(5,2),
  default_spare_mode project_spare_mode default 'percent',
  default_spare_value numeric(8,2) default 10,

  -- Google Calendar mirror (on our service account's Workspace)
  google_mirror_calendar_id text,
  google_mirror_shared_at timestamptz,

  -- Google Meet (separate scope: meetings.space.created)
  google_meet_scope_granted boolean not null default false,
  google_refresh_token_encrypted text,         -- only for Meet scope

  -- WhatsApp linking
  whatsapp_phone_e164 text unique,
  whatsapp_verified_at timestamptz,
  whatsapp_verification_code text,
  whatsapp_verification_expires_at timestamptz,

  -- Active timer pointer — enforces single running timer per user
  active_time_entry_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_super_admin_idx on public.profiles(is_super_admin) where is_super_admin = true;
create index profiles_whatsapp_idx on public.profiles(whatsapp_phone_e164) where whatsapp_phone_e164 is not null;
