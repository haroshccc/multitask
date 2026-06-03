-- =============================================================================
-- Frameworks ("מסגרת") — own entity that reuses task-like UX.
--
-- A framework is a named, colored, share-able recurring routine that owns:
--   • day labels  (per-day header titles: "יום לימודים")
--   • time blocks (faded recurring background events; the goal-tracked unit)
-- Plus per-occurrence check/skip state, per-user calendar on/off, view-only
-- sharing, and a change-history log.
--
-- Isolated from the tasks/task_lists save path on purpose. Supersedes the
-- interim "is_framework flag" approach (20260603000001), which is dropped here.
-- =============================================================================

-- 0. Remove the interim "flag on tasks/lists" approach -----------------------
drop index if exists public.task_lists_is_framework_idx;
drop index if exists public.tasks_is_framework_idx;
alter table public.task_lists drop column if exists is_framework;
alter table public.task_lists drop column if exists framework_starts_on;
alter table public.task_lists drop column if exists framework_ends_on;
alter table public.tasks      drop column if exists is_framework;

-- 1. frameworks --------------------------------------------------------------
create table if not exists public.frameworks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name            text not null,
  color           text,
  emoji           text,
  run_start       date,
  run_end         date,
  sort_order      int  not null default 0,
  is_archived     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists frameworks_org_idx   on public.frameworks(organization_id);
create index if not exists frameworks_owner_idx on public.frameworks(owner_id);

-- 2. day labels --------------------------------------------------------------
create table if not exists public.framework_day_labels (
  id              uuid primary key default gen_random_uuid(),
  framework_id    uuid not null references public.frameworks(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  scope           text not null default 'weekly' check (scope in ('weekly','date')),
  day_of_week     smallint check (day_of_week between 0 and 6),
  specific_date   date,
  label           text not null default '',
  color           text,
  effective_from  date,
  effective_to    date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint fw_day_labels_scope_fields check (
    (scope = 'weekly' and day_of_week is not null)
    or (scope = 'date' and specific_date is not null)
  )
);
create index if not exists fw_day_labels_framework_idx on public.framework_day_labels(framework_id);

-- 3. time blocks -------------------------------------------------------------
create table if not exists public.framework_blocks (
  id                     uuid primary key default gen_random_uuid(),
  framework_id           uuid not null references public.frameworks(id) on delete cascade,
  organization_id        uuid not null references public.organizations(id) on delete cascade,
  title                  text not null default '',
  color                  text,
  scope                  text not null default 'weekly' check (scope in ('weekly','date')),
  day_of_week            smallint check (day_of_week between 0 and 6),
  specific_date          date,
  start_minute           int not null default 540 check (start_minute between 0 and 1439),
  end_minute             int not null default 600 check (end_minute   between 1 and 1440),
  effective_from         date,
  effective_to           date,
  override_kind          text check (override_kind in ('add','remove','modify')),
  source_block_id        uuid references public.framework_blocks(id) on delete cascade,
  goal_period            text check (goal_period in ('day','week','month')),
  goal_target            int,
  goal_started_on        date,
  goal_min_streak_periods int,
  sort_order             int not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint fw_blocks_scope_fields check (
    (scope = 'weekly' and day_of_week is not null)
    or (scope = 'date' and specific_date is not null)
  )
);
create index if not exists fw_blocks_framework_idx on public.framework_blocks(framework_id);
create index if not exists fw_blocks_source_idx    on public.framework_blocks(source_block_id);

-- 4. per-occurrence check/skip state -----------------------------------------
create table if not exists public.framework_block_occurrences (
  id              uuid primary key default gen_random_uuid(),
  block_id        uuid not null references public.framework_blocks(id) on delete cascade,
  framework_id    uuid not null references public.frameworks(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  occ_date        date not null,
  status          text not null check (status in ('done','skipped')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (block_id, occ_date)
);
create index if not exists fw_block_occ_block_idx on public.framework_block_occurrences(block_id);
create index if not exists fw_block_occ_fw_idx    on public.framework_block_occurrences(framework_id);

-- 5. per-user calendar on/off ------------------------------------------------
create table if not exists public.framework_visibility (
  user_id      uuid not null references auth.users(id) on delete cascade,
  framework_id uuid not null references public.frameworks(id) on delete cascade,
  is_active    boolean not null default true,
  primary key (user_id, framework_id)
);

-- 6. view-only sharing -------------------------------------------------------
create table if not exists public.framework_shares (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  framework_id    uuid not null references public.frameworks(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  granted_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (framework_id, user_id)
);
create index if not exists fw_shares_framework_idx on public.framework_shares(framework_id);
create index if not exists fw_shares_user_idx      on public.framework_shares(user_id);

-- 7. change history ----------------------------------------------------------
create table if not exists public.framework_history (
  id              uuid primary key default gen_random_uuid(),
  framework_id    uuid not null references public.frameworks(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_id        uuid default auth.uid(),
  entity_type     text not null check (entity_type in ('framework','day_label','block','occurrence','share')),
  entity_id       uuid,
  action          text not null check (action in ('create','update','delete')),
  summary         text,
  details         jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists fw_history_framework_idx on public.framework_history(framework_id, created_at desc);

-- 8. updated_at trigger ------------------------------------------------------
create or replace function public.frameworks_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_frameworks_updated_at on public.frameworks;
create trigger trg_frameworks_updated_at before update on public.frameworks
  for each row execute function public.frameworks_set_updated_at();
drop trigger if exists trg_fw_day_labels_updated_at on public.framework_day_labels;
create trigger trg_fw_day_labels_updated_at before update on public.framework_day_labels
  for each row execute function public.frameworks_set_updated_at();
drop trigger if exists trg_fw_blocks_updated_at on public.framework_blocks;
create trigger trg_fw_blocks_updated_at before update on public.framework_blocks
  for each row execute function public.frameworks_set_updated_at();
drop trigger if exists trg_fw_block_occ_updated_at on public.framework_block_occurrences;
create trigger trg_fw_block_occ_updated_at before update on public.framework_block_occurrences
  for each row execute function public.frameworks_set_updated_at();

-- 9. access helpers ----------------------------------------------------------
create or replace function public.user_can_read_framework(p_framework_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.frameworks f
    where f.id = p_framework_id
      and (
        f.owner_id = auth.uid()
        or user_is_super_admin(auth.uid())
        or exists (
          select 1 from public.framework_shares s
          where s.framework_id = f.id and s.user_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.user_owns_framework(p_framework_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.frameworks f
    where f.id = p_framework_id
      and (f.owner_id = auth.uid() or user_is_super_admin(auth.uid()))
  );
$$;

-- 10. RLS --------------------------------------------------------------------
alter table public.frameworks                  enable row level security;
alter table public.framework_day_labels        enable row level security;
alter table public.framework_blocks            enable row level security;
alter table public.framework_block_occurrences enable row level security;
alter table public.framework_visibility        enable row level security;
alter table public.framework_shares            enable row level security;
alter table public.framework_history           enable row level security;

-- frameworks
create policy "frameworks: read" on public.frameworks for select
  using (user_can_read_framework(id));
create policy "frameworks: insert" on public.frameworks for insert
  with check (owner_id = auth.uid() and user_is_org_member(organization_id, auth.uid()));
create policy "frameworks: update" on public.frameworks for update
  using (owner_id = auth.uid() or user_is_super_admin(auth.uid()))
  with check (owner_id = auth.uid() or user_is_super_admin(auth.uid()));
create policy "frameworks: delete" on public.frameworks for delete
  using (owner_id = auth.uid() or user_is_super_admin(auth.uid()));

-- day labels (read = framework read; write = framework owner)
create policy "fw_day_labels: read" on public.framework_day_labels for select
  using (user_can_read_framework(framework_id));
create policy "fw_day_labels: write" on public.framework_day_labels for all
  using (user_owns_framework(framework_id))
  with check (user_owns_framework(framework_id));

-- blocks
create policy "fw_blocks: read" on public.framework_blocks for select
  using (user_can_read_framework(framework_id));
create policy "fw_blocks: write" on public.framework_blocks for all
  using (user_owns_framework(framework_id))
  with check (user_owns_framework(framework_id));

-- occurrences
create policy "fw_block_occ: read" on public.framework_block_occurrences for select
  using (user_can_read_framework(framework_id));
create policy "fw_block_occ: write" on public.framework_block_occurrences for all
  using (user_owns_framework(framework_id))
  with check (user_owns_framework(framework_id));

-- visibility (each user manages their own rows, for frameworks they can read)
create policy "fw_visibility: read" on public.framework_visibility for select
  using (user_id = auth.uid());
create policy "fw_visibility: write" on public.framework_visibility for all
  using (user_id = auth.uid() and user_can_read_framework(framework_id))
  with check (user_id = auth.uid() and user_can_read_framework(framework_id));

-- shares (owner manages; recipient can read own row)
create policy "fw_shares: read" on public.framework_shares for select
  using (user_id = auth.uid() or user_owns_framework(framework_id));
create policy "fw_shares: write" on public.framework_shares for all
  using (user_owns_framework(framework_id))
  with check (user_owns_framework(framework_id));

-- history (read = framework read; insert = framework owner)
create policy "fw_history: read" on public.framework_history for select
  using (user_can_read_framework(framework_id));
create policy "fw_history: insert" on public.framework_history for insert
  with check (user_owns_framework(framework_id));
