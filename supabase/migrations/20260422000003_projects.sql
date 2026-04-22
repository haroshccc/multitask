-- =============================================================================
-- Multitask — 03. Projects, expenses, templates
-- =============================================================================

-- Projects ---------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,

  name text not null,
  description text,

  -- Pricing configuration
  pricing_mode project_pricing_mode not null default 'hourly',
  total_price_cents bigint,                         -- used when pricing_mode = 'fixed_price'
  hourly_rate_cents integer,                        -- used when pricing_mode = 'hourly'
  profit_percentage numeric(5,2) default 20,
  spare_mode project_spare_mode default 'percent',
  spare_value numeric(8,2) default 10,
  currency text not null default 'ILS',
  vat_percentage numeric(5,2) default 17,

  -- Status & tagging
  status text not null default 'active',            -- 'active' | 'paused' | 'completed'
  tags text[] not null default '{}',
  color text,
  emoji text,

  -- Archival
  is_archived boolean not null default false,
  archived_at timestamptz,
  archive_expires_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_org_idx on public.projects(organization_id);
create index projects_owner_idx on public.projects(owner_id);
create index projects_status_idx on public.projects(status);
create index projects_archived_idx on public.projects(is_archived) where is_archived = true;
create index projects_tags_idx on public.projects using gin(tags);

-- Project expenses (variable costs list per project) ---------------------------
create table public.project_expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  label text not null,
  amount_cents bigint not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_expenses_project_idx on public.project_expenses(project_id, sort_order);

-- Project templates (per-user reusable structures) ------------------------------
create table public.project_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,

  name text not null,
  description text,
  emoji text,
  is_favorite boolean not null default false,
  is_default boolean not null default false,

  -- Serialized template payload: tasks tree, pricing params, columns, widgets
  template_data jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index project_templates_owner_idx on public.project_templates(owner_id);
create index project_templates_org_idx on public.project_templates(organization_id);
