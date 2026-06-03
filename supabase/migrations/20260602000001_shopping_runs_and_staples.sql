-- =============================================================================
-- Shopping runs + household staples — turns the computed (live) shopping list
-- into a trackable purchase workflow, and adds a persistent "household staples"
-- list (consumables that aren't part of any meal).
--
-- Design (approved with the user):
--   • The LIVE list ("what do I need") stays computed on the fly from the meal
--     plan (buildShoppingList) — NOT stored, always in sync with the menu.
--   • A SHOPPING RUN is a frozen snapshot taken when the user clicks "I'm
--     buying now". All tracking (in_cart / ordered / received / missing) lives
--     on the run, never on the live list — so editing the menu never wipes a
--     mark or loses purchase history.
--   • Items that didn't arrive stay 'missing' on their run and can be CARRIED
--     OVER (merged) into a later run.
--
-- Four tables (all org-scoped, RLS mirrors the food module's "owner OR org
-- member when food is shared" pattern from 20260508000001_food_sharing.sql):
--
--   household_staples    — fixed consumables (toilet paper, milk…) with a
--                          default qty/unit, reusing ingredient_categories
--   store_connections    — generic commerce layer (export / deeplink / cart_api)
--   shopping_runs        — frozen purchase snapshots with a status lifecycle
--   shopping_run_items   — the snapshot's lines + per-item tracking status
-- =============================================================================

-- 1. Household staples --------------------------------------------------------
-- Consumables suggested interactively ("need X too?") when building a run.
-- Reuses ingredient_categories so staples sit in the same category buckets as
-- pantry items (no new category table). last_added_at powers the "haven't
-- added X in a while" suggestion heuristic.
create table public.household_staples (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  category_id uuid references public.ingredient_categories(id) on delete set null,
  default_quantity numeric not null default 1,
  default_unit text,
  is_active boolean not null default true,
  last_added_at timestamptz,
  sort_order int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index household_staples_org_idx on public.household_staples(organization_id, sort_order);
create index household_staples_category_idx on public.household_staples(category_id);
create index household_staples_active_idx on public.household_staples(organization_id) where is_active = true;

-- 2. Store connections --------------------------------------------------------
-- A generic, store-agnostic commerce target. `kind` decides how a run is
-- handed off to the store:
--   'export'   — text export (WhatsApp / clipboard) — always available
--   'deeplink' — open the store's site/app with the list in a URL
--   'cart_api' — push items straight into a cart (PHASE B, behind a feature
--                flag; needs an Edge Function — not implemented in the MVP)
-- `config` holds per-kind settings (e.g. deeplink URL template, API hints).
create table public.store_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  kind text not null default 'export'
    check (kind in ('export', 'deeplink', 'cart_api')),
  base_url text,
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index store_connections_org_idx on public.store_connections(organization_id, sort_order);

-- 3. Shopping runs ------------------------------------------------------------
-- A frozen snapshot of the live list at the moment "I'm buying now" was
-- pressed. The chosen date range + included people are frozen into the row so
-- the run "remembers" exactly what menu window it covered, independent of any
-- later menu edits.
--
-- status lifecycle:
--   open        — just created, being assembled / before checkout
--   sent        — exported / handed off to the store
--   ordered     — order placed at the store
--   reconciling — order arrived, user is marking what came (PHASE B receipt)
--   closed      — done
--
-- receipt_storage_path is reserved for PHASE B (AI receipt matching); the
-- column + 'reconciling' status ship now so no later migration is needed.
create table public.shopping_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  title text not null,
  status text not null default 'open'
    check (status in ('open', 'sent', 'ordered', 'reconciling', 'closed')),
  frozen_from_date date not null,
  frozen_to_date date not null,
  included_user_ids uuid[] not null default '{}',
  store_connection_id uuid references public.store_connections(id) on delete set null,
  receipt_storage_path text,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  updated_at timestamptz not null default now()
);
create index shopping_runs_org_idx on public.shopping_runs(organization_id, created_at desc);
create index shopping_runs_status_idx on public.shopping_runs(organization_id, status);

-- 4. Shopping run items -------------------------------------------------------
-- The snapshot's lines + per-item tracking. ingredient_id / staple_id are
-- soft links back to the source (nullable; we keep `name` denormalized so the
-- run survives deletion of the source row). `source_meals` mirrors the live
-- list's "why is this here" tooltip.
--
-- status:  needed → in_cart → ordered → received   (happy path)
--          missing  — arrived but this item didn't; stays on the run
--          moved    — carried over into another run (kept for history, hidden
--                     from the active view to avoid duplicates)
--
-- carryover bookkeeping:
--   source='carryover' + carried_from_run_id → this line came from a merge.
--   matched_from_receipt → PHASE B (set when AI matched it to a receipt line).
create table public.shopping_run_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.shopping_runs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id) on delete set null,
  staple_id uuid references public.household_staples(id) on delete set null,
  name text not null,
  quantity numeric not null default 1,
  unit text,
  category_id uuid references public.ingredient_categories(id) on delete set null,
  source text not null default 'menu'
    check (source in ('menu', 'staple', 'manual', 'carryover')),
  status text not null default 'needed'
    check (status in ('needed', 'in_cart', 'ordered', 'received', 'missing', 'moved')),
  source_meals text[] not null default '{}',
  carried_from_run_id uuid references public.shopping_runs(id) on delete set null,
  matched_from_receipt boolean not null default false,
  sort_order int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shopping_run_items_run_idx on public.shopping_run_items(run_id, sort_order);
create index shopping_run_items_org_idx on public.shopping_run_items(organization_id);
create index shopping_run_items_status_idx on public.shopping_run_items(run_id, status);

-- =============================================================================
-- updated_at triggers (reuse public.set_updated_at from migration 11)
-- =============================================================================
drop trigger if exists set_updated_at on public.household_staples;
create trigger set_updated_at before update on public.household_staples
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.store_connections;
create trigger set_updated_at before update on public.store_connections
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.shopping_runs;
create trigger set_updated_at before update on public.shopping_runs
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.shopping_run_items;
create trigger set_updated_at before update on public.shopping_run_items
  for each row execute function public.set_updated_at();

-- =============================================================================
-- RLS — owner OR (org member when food is shared), mirroring the food module.
-- Uses the existing helpers public.user_is_org_member / user_is_super_admin /
-- org_food_is_shared (from 20260508000001_food_sharing.sql).
-- =============================================================================
alter table public.household_staples enable row level security;
alter table public.store_connections enable row level security;
alter table public.shopping_runs enable row level security;
alter table public.shopping_run_items enable row level security;

-- household_staples: owner or shared org
create policy "household_staples: owner or shared org"
  on public.household_staples for all
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or (user_is_org_member(organization_id, auth.uid()) and org_food_is_shared(organization_id))
  )
  with check (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or (user_is_org_member(organization_id, auth.uid()) and org_food_is_shared(organization_id))
  );

-- store_connections: owner OR (org member when food is shared) — mirrors the
-- rest of the food module so a non-food-shared org's store config (base_url /
-- config jsonb) isn't visible to co-members.
create policy "store_connections: owner or shared org"
  on public.store_connections for all
  using (
    created_by = auth.uid()
    or user_is_super_admin(auth.uid())
    or (user_is_org_member(organization_id, auth.uid()) and org_food_is_shared(organization_id))
  )
  with check (
    created_by = auth.uid()
    or user_is_super_admin(auth.uid())
    or (user_is_org_member(organization_id, auth.uid()) and org_food_is_shared(organization_id))
  );

-- shopping_runs: creator or (org member when food is shared)
create policy "shopping_runs: creator or shared org"
  on public.shopping_runs for all
  using (
    created_by = auth.uid()
    or user_is_super_admin(auth.uid())
    or (user_is_org_member(organization_id, auth.uid()) and org_food_is_shared(organization_id))
  )
  with check (
    created_by = auth.uid()
    or user_is_super_admin(auth.uid())
    or (user_is_org_member(organization_id, auth.uid()) and org_food_is_shared(organization_id))
  );

-- shopping_run_items: access follows the parent run
create policy "shopping_run_items: via run"
  on public.shopping_run_items for all
  using (
    exists (
      select 1 from public.shopping_runs r
      where r.id = shopping_run_items.run_id
        and (
          r.created_by = auth.uid()
          or user_is_super_admin(auth.uid())
          or (user_is_org_member(r.organization_id, auth.uid()) and org_food_is_shared(r.organization_id))
        )
    )
  )
  with check (
    exists (
      select 1 from public.shopping_runs r
      where r.id = shopping_run_items.run_id
        and (
          r.created_by = auth.uid()
          or user_is_super_admin(auth.uid())
          or (user_is_org_member(r.organization_id, auth.uid()) and org_food_is_shared(r.organization_id))
        )
    )
  );

-- =============================================================================
-- Realtime — add the new tables to the supabase_realtime publication so the
-- household sees changes live (matches the food tables' behavior).
-- =============================================================================
do $$ begin
  alter publication supabase_realtime add table public.household_staples;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.store_connections;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.shopping_runs;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.shopping_run_items;
exception when duplicate_object then null; end $$;

-- shopping_run_items realtime handler keys off run_id (not the PK). With the
-- default REPLICA IDENTITY a DELETE event's `old` row carries only the PK, so
-- run_id would be missing and the per-run cache wouldn't refresh for other
-- household members. FULL makes the old row complete on UPDATE/DELETE.
alter table public.shopping_run_items replica identity full;
