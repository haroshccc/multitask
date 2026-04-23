-- =============================================================================
-- Multitask — 17. Per-user customisable task statuses
-- -----------------------------------------------------------------------------
-- Each user owns a palette of statuses. The built-in five (todo, in_progress,
-- pending_approval, done, cancelled) are seeded on profile creation but the
-- user is free to rename, recolour, reorder, delete, or add new ones.
--
-- The `task_status_kind` enum tells the backend what a status *means*
-- semantically (for triggers & sort fallbacks). tasks.status is converted from
-- the old enum to free text and points to user_task_statuses by (owner_id, key).
-- =============================================================================

-- Semantic kind: drives backend behavior regardless of label ------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_status_kind') then
    create type public.task_status_kind as enum (
      'backlog',
      'active',
      'waiting_approval',
      'done',
      'cancelled'
    );
  end if;
end$$;

-- User-owned status palette ---------------------------------------------------
create table if not exists public.user_task_statuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,                             -- slug, unique per user
  label text not null,                           -- user-facing display name
  color text,                                    -- hex; null = neutral ink chip
  kind public.task_status_kind not null,
  sort_order int not null default 0,
  is_builtin boolean not null default false,    -- true for the seeded five
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

create index if not exists user_task_statuses_user_idx
  on public.user_task_statuses(user_id);
create index if not exists user_task_statuses_kind_idx
  on public.user_task_statuses(user_id, kind);

-- updated_at trigger (reuses public.set_updated_at from migration 11)
drop trigger if exists set_updated_at on public.user_task_statuses;
create trigger set_updated_at
  before update on public.user_task_statuses
  for each row execute function public.set_updated_at();

-- RLS — owner writes, whole org can read so status chips render on shared tasks
alter table public.user_task_statuses enable row level security;

drop policy if exists "user_task_statuses: org members read" on public.user_task_statuses;
create policy "user_task_statuses: org members read"
  on public.user_task_statuses for select
  using (
    user_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or exists (
      select 1
      from public.organization_members m1
      join public.organization_members m2
        on m1.organization_id = m2.organization_id
      where m1.user_id = auth.uid()
        and m2.user_id = user_task_statuses.user_id
    )
  );

drop policy if exists "user_task_statuses: owner insert" on public.user_task_statuses;
create policy "user_task_statuses: owner insert"
  on public.user_task_statuses for insert
  with check (user_id = auth.uid());

drop policy if exists "user_task_statuses: owner update" on public.user_task_statuses;
create policy "user_task_statuses: owner update"
  on public.user_task_statuses for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "user_task_statuses: owner delete" on public.user_task_statuses;
create policy "user_task_statuses: owner delete"
  on public.user_task_statuses for delete
  using (user_id = auth.uid() and is_builtin = false);
  -- built-ins cannot be deleted, only renamed/recoloured/hidden via sort_order.

-- Seed function: install the five defaults for a user -------------------------
create or replace function public.seed_user_default_statuses(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_task_statuses
    (user_id, key, label, color, kind, sort_order, is_builtin)
  values
    (p_user_id, 'todo',             'לעשות',          '#a8a8bc', 'backlog',          0,   true),
    (p_user_id, 'in_progress',      'בעבודה',         '#f59e0b', 'active',           100, true),
    (p_user_id, 'pending_approval', 'ממתין לאישור',   '#8b5cf6', 'waiting_approval', 200, true),
    (p_user_id, 'done',             'בוצע',           '#10b981', 'done',             300, true),
    (p_user_id, 'cancelled',        'בוטל',           '#6b6b80', 'cancelled',        400, true)
  on conflict (user_id, key) do nothing;
end;
$$;

-- Trigger: seed defaults on profile insert (profiles.id = auth.users.id) -----
create or replace function public.seed_user_statuses_on_profile_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.seed_user_default_statuses(new.id);
  return new;
end;
$$;

drop trigger if exists profiles_seed_statuses on public.profiles;
create trigger profiles_seed_statuses
  after insert on public.profiles
  for each row execute function public.seed_user_statuses_on_profile_insert();

-- Backfill existing profiles so every active user has a palette --------------
do $$
declare u uuid;
begin
  for u in select id from public.profiles loop
    perform public.seed_user_default_statuses(u);
  end loop;
end$$;

-- Convert tasks.status from enum to text -------------------------------------
-- Preserves all existing values (they remain 'todo' / 'in_progress' / ...)
-- and keeps the enum type around for any future readers; nothing else
-- references it after this migration.
alter table public.tasks alter column status drop default;
alter table public.tasks alter column status type text using status::text;
alter table public.tasks alter column status set default 'todo';

-- Existing index tasks_status_idx was on the enum; dropping & recreating on text
drop index if exists public.tasks_status_idx;
create index tasks_status_idx on public.tasks(status);

-- =============================================================================
-- task_lists.is_pinned — a user-pinnable list sticks to the leading edge of the
-- Tasks screen (same treatment as "לא משויכות"). Nullable boolean semantics via
-- default false keeps backwards compat.
-- =============================================================================

alter table public.task_lists
  add column if not exists is_pinned boolean not null default false;

create index if not exists task_lists_pinned_idx
  on public.task_lists(is_pinned) where is_pinned = true;
