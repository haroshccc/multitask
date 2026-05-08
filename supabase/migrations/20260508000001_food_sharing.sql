-- =============================================================================
-- Food sharing: org-level toggle + family org auto-share
--
-- Adds a `food_shared` boolean to organizations. When true (or when the org
-- type is 'family'), all org members can read & write each other's:
--   • meals + meal_ingredients
--   • ingredients + ingredient_units
--   • meal_categories + ingredient_categories
--   • meal_plan_days + meal_plan_template
--
-- Individual plan sharing via meal_plan_shares still works alongside this.
-- =============================================================================

-- 1. Add food_shared column --------------------------------------------------
alter table public.organizations
  add column if not exists food_shared boolean not null default false;

-- Helper: returns true when the org has food sharing enabled (either
-- explicitly set or because it's a family org).
create or replace function public.org_food_is_shared(p_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select food_shared or org_type::text = 'family'
       from public.organizations
      where id = p_org_id),
    false
  );
$$;

-- 2. Drop current owner-only food policies -----------------------------------
drop policy if exists "meals: owner only"             on public.meals;
drop policy if exists "ingredients: owner only"       on public.ingredients;
drop policy if exists "meal_ingredients: via meal owner" on public.meal_ingredients;
drop policy if exists "meal_categories: owner only"   on public.meal_categories;
drop policy if exists "ingredient_categories: owner only" on public.ingredient_categories;
drop policy if exists "ingredient_units: via ingredient owner" on public.ingredient_units;

-- Also drop the old org-member policies in case they still exist from food_planning migration
drop policy if exists "meals: org members"                 on public.meals;
drop policy if exists "ingredients: org members"           on public.ingredients;
drop policy if exists "meal_ingredients: org members"      on public.meal_ingredients;
drop policy if exists "meal_categories: org members"       on public.meal_categories;
drop policy if exists "ingredient_categories: org members" on public.ingredient_categories;
drop policy if exists "ingredient_units: org members"      on public.ingredient_units;

-- 3. New policies: owner OR (org member when food is shared) -----------------

create policy "meals: owner or shared org"
  on public.meals for all
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or (
      user_is_org_member(organization_id, auth.uid())
      and org_food_is_shared(organization_id)
    )
  )
  with check (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or (
      user_is_org_member(organization_id, auth.uid())
      and org_food_is_shared(organization_id)
    )
  );

create policy "ingredients: owner or shared org"
  on public.ingredients for all
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or (
      user_is_org_member(organization_id, auth.uid())
      and org_food_is_shared(organization_id)
    )
  )
  with check (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or (
      user_is_org_member(organization_id, auth.uid())
      and org_food_is_shared(organization_id)
    )
  );

create policy "meal_ingredients: via meal owner or shared org"
  on public.meal_ingredients for all
  using (
    exists (
      select 1 from public.meals m
      where m.id = meal_ingredients.meal_id
        and (
          m.owner_id = auth.uid()
          or user_is_super_admin(auth.uid())
          or (
            user_is_org_member(m.organization_id, auth.uid())
            and org_food_is_shared(m.organization_id)
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.meals m
      where m.id = meal_ingredients.meal_id
        and (
          m.owner_id = auth.uid()
          or user_is_super_admin(auth.uid())
          or (
            user_is_org_member(m.organization_id, auth.uid())
            and org_food_is_shared(m.organization_id)
          )
        )
    )
  );

create policy "meal_categories: owner or shared org"
  on public.meal_categories for all
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or (
      user_is_org_member(organization_id, auth.uid())
      and org_food_is_shared(organization_id)
    )
  )
  with check (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or (
      user_is_org_member(organization_id, auth.uid())
      and org_food_is_shared(organization_id)
    )
  );

create policy "ingredient_categories: owner or shared org"
  on public.ingredient_categories for all
  using (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or (
      user_is_org_member(organization_id, auth.uid())
      and org_food_is_shared(organization_id)
    )
  )
  with check (
    owner_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or (
      user_is_org_member(organization_id, auth.uid())
      and org_food_is_shared(organization_id)
    )
  );

create policy "ingredient_units: via ingredient owner or shared org"
  on public.ingredient_units for all
  using (
    exists (
      select 1 from public.ingredients i
      where i.id = ingredient_units.ingredient_id
        and (
          i.owner_id = auth.uid()
          or user_is_super_admin(auth.uid())
          or (
            user_is_org_member(i.organization_id, auth.uid())
            and org_food_is_shared(i.organization_id)
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.ingredients i
      where i.id = ingredient_units.ingredient_id
        and (
          i.owner_id = auth.uid()
          or user_is_super_admin(auth.uid())
          or (
            user_is_org_member(i.organization_id, auth.uid())
            and org_food_is_shared(i.organization_id)
          )
        )
    )
  );

-- 4. meal_plan_days: own rows OR meal_plan_shares OR org food shared ----------
-- First drop the old policy if there was one (set up by food_planning migration
-- which used org-member access).
drop policy if exists "meal_plan_days: owner"         on public.meal_plan_days;
drop policy if exists "meal_plan_days: org members"   on public.meal_plan_days;
drop policy if exists "mpd: own or shared"            on public.meal_plan_days;

create policy "meal_plan_days: own or shared or org shared"
  on public.meal_plan_days for all
  using (
    user_id = auth.uid()
    or user_is_super_admin(auth.uid())
    -- individual meal_plan_shares grant
    or exists (
      select 1 from public.meal_plan_shares s
      where s.organization_id = meal_plan_days.organization_id
        and s.sharer_user_id  = meal_plan_days.user_id
        and s.shared_with_user_id = auth.uid()
    )
    -- org-level food sharing
    or (
      user_is_org_member(organization_id, auth.uid())
      and org_food_is_shared(organization_id)
    )
  )
  with check (
    user_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or (
      user_is_org_member(organization_id, auth.uid())
      and org_food_is_shared(organization_id)
    )
  );

-- 5. meal_plan_template: same logic ------------------------------------------
drop policy if exists "meal_plan_template: owner"       on public.meal_plan_template;
drop policy if exists "meal_plan_template: org members" on public.meal_plan_template;
drop policy if exists "mpt: own or shared"              on public.meal_plan_template;

create policy "meal_plan_template: own or shared or org shared"
  on public.meal_plan_template for all
  using (
    user_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or exists (
      select 1 from public.meal_plan_shares s
      where s.organization_id       = meal_plan_template.organization_id
        and s.sharer_user_id        = meal_plan_template.user_id
        and s.shared_with_user_id   = auth.uid()
    )
    or (
      user_is_org_member(organization_id, auth.uid())
      and org_food_is_shared(organization_id)
    )
  )
  with check (
    user_id = auth.uid()
    or user_is_super_admin(auth.uid())
    or (
      user_is_org_member(organization_id, auth.uid())
      and org_food_is_shared(organization_id)
    )
  );

-- 6. meal_plan_shares: existing policy should already work ------------------
-- (sharer or recipient can read; sharer can insert/delete)
