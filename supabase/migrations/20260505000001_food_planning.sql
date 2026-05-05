-- =============================================================================
-- Food planning — meals, ingredients, weekly menu, daily selections.
--
-- Six tables introducing a meal-planning module shared across an organization
-- (so two members can collaborate on tomorrow's menu in real-time):
--
--   meal_categories       — user-defined buckets ("בשרי", "צמחוני", "דיאטה")
--   ingredient_categories — user-defined buckets ("ירקות", "מוצרי חלב")
--   ingredients           — pantry items, may be flagged as "incomplete"
--                           when created on-the-fly while editing a meal
--   ingredient_units      — multiple units per ingredient (יחידה / 100 גרם /
--                           כוס) each with its own nutrition values per unit
--   meals                 — recipes with name, category, meal-time tags
--                           (breakfast/lunch/dinner/between/snack)
--   meal_ingredients      — junction: which ingredient + which unit + qty
--
-- Calorie/protein/fat math is a simple multiplication: the meal totals are
-- derived as Σ over rows in meal_ingredients of
--      (quantity / unit.amount) * unit.{calories,fat,protein}
-- so we never store the meal-level nutrition — it's always recomputed.
-- =============================================================================

-- 1. Meal categories ----------------------------------------------------------
create table public.meal_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  color text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meal_categories_org_idx on public.meal_categories(organization_id, sort_order);

-- 2. Ingredient categories ----------------------------------------------------
create table public.ingredient_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  color text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ingredient_categories_org_idx on public.ingredient_categories(organization_id, sort_order);

-- 3. Ingredients -------------------------------------------------------------
create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  category_id uuid references public.ingredient_categories(id) on delete set null,
  notes text,
  -- Flagged true when a unit + nutrition values are filled in. Defaults
  -- false so on-the-fly creations from the meal editor flag themselves
  -- for later editing.
  is_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ingredients_org_idx on public.ingredients(organization_id);
create index ingredients_category_idx on public.ingredients(category_id);
create index ingredients_incomplete_idx on public.ingredients(organization_id) where is_complete = false;

-- 4. Ingredient units --------------------------------------------------------
-- A single ingredient can be measured in multiple units. Each unit row
-- stores the nutrition values for `amount` of that unit (so "100 גרם = 15
-- קלוריות" stores amount=100, calories=15, and a meal using 200 גרם
-- computes 200/100 * 15 = 30 cal).
create table public.ingredient_units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  unit_name text not null,            -- "יחידה", "גרם", "כוס", "כפית"
  amount numeric not null default 1,  -- reference quantity for the values below
  calories numeric,
  fat_g numeric,
  protein_g numeric,
  carbs_g numeric,
  is_default boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ingredient_units_ingredient_idx on public.ingredient_units(ingredient_id, sort_order);
create index ingredient_units_org_idx on public.ingredient_units(organization_id);

-- 5. Meals -------------------------------------------------------------------
-- meal_times[] is a free text array — values are constrained at the app
-- level to {breakfast, lunch, dinner, between, snack}; storing as text[]
-- keeps it cheap to add new tags later without a migration.
create table public.meals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  category_id uuid references public.meal_categories(id) on delete set null,
  meal_times text[] not null default '{}',
  notes text,
  servings numeric not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meals_org_idx on public.meals(organization_id);
create index meals_category_idx on public.meals(category_id);
create index meals_meal_times_idx on public.meals using gin(meal_times);

-- 6. Meal ingredients (junction) ---------------------------------------------
create table public.meal_ingredients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  meal_id uuid not null references public.meals(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  unit_id uuid references public.ingredient_units(id) on delete set null,
  quantity numeric not null default 1,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meal_ingredients_meal_idx on public.meal_ingredients(meal_id, sort_order);
create index meal_ingredients_ingredient_idx on public.meal_ingredients(ingredient_id);
create index meal_ingredients_org_idx on public.meal_ingredients(organization_id);

-- =============================================================================
-- RLS — every table is org-scoped, every org member can read & write.
-- =============================================================================
alter table public.meal_categories enable row level security;
alter table public.ingredient_categories enable row level security;
alter table public.ingredients enable row level security;
alter table public.ingredient_units enable row level security;
alter table public.meals enable row level security;
alter table public.meal_ingredients enable row level security;

create policy "meal_categories: org members" on public.meal_categories
  for all
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
  with check (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));

create policy "ingredient_categories: org members" on public.ingredient_categories
  for all
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
  with check (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));

create policy "ingredients: org members" on public.ingredients
  for all
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
  with check (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));

create policy "ingredient_units: org members" on public.ingredient_units
  for all
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
  with check (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));

create policy "meals: org members" on public.meals
  for all
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
  with check (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));

create policy "meal_ingredients: org members" on public.meal_ingredients
  for all
  using (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()))
  with check (user_is_org_member(organization_id, auth.uid()) or user_is_super_admin(auth.uid()));
