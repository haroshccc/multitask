-- =============================================================================
-- Drop every remaining org-member-based policy that bypasses the owner policies
-- =============================================================================

-- task_lists (old policy names that were never dropped by the previous migration)
drop policy if exists "tl_read"  on public.task_lists;
drop policy if exists "tl_write" on public.task_lists;

-- tasks (same)
drop policy if exists "tasks_read"  on public.tasks;
drop policy if exists "tasks_write" on public.tasks;

-- task_custom_fields (via project org membership)
drop policy if exists "tcf_via_project" on public.task_custom_fields;

-- food planning tables
drop policy if exists "meals: org members"                 on public.meals;
drop policy if exists "ingredients: org members"           on public.ingredients;
drop policy if exists "meal_ingredients: org members"      on public.meal_ingredients;
drop policy if exists "meal_categories: org members"       on public.meal_categories;
drop policy if exists "ingredient_categories: org members" on public.ingredient_categories;
drop policy if exists "ingredient_units: org members"      on public.ingredient_units;

-- =============================================================================
-- task_custom_fields: via project owner or shared project
-- =============================================================================
create policy "task_custom_fields: via owned or shared project"
  on public.task_custom_fields for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = task_custom_fields.project_id
        and (
          p.owner_id = auth.uid()
          or user_is_super_admin(auth.uid())
          or user_has_share('project', p.id, auth.uid())
        )
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = task_custom_fields.project_id
        and (p.owner_id = auth.uid() or user_is_super_admin(auth.uid()))
    )
  );

-- =============================================================================
-- Food planning: add owner_id where missing, then owner-based policies
-- =============================================================================

alter table public.meal_categories
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

alter table public.ingredient_categories
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

-- Back-fill existing rows to the org owner
update public.meal_categories mc
set owner_id = (
  select om.user_id from public.organization_members om
  where om.organization_id = mc.organization_id and om.role = 'owner'
  order by om.joined_at limit 1
)
where owner_id is null;

update public.ingredient_categories ic
set owner_id = (
  select om.user_id from public.organization_members om
  where om.organization_id = ic.organization_id and om.role = 'owner'
  order by om.joined_at limit 1
)
where owner_id is null;

create policy "meals: owner only"
  on public.meals for all
  using (owner_id = auth.uid() or user_is_super_admin(auth.uid()))
  with check (owner_id = auth.uid() or user_is_super_admin(auth.uid()));

create policy "ingredients: owner only"
  on public.ingredients for all
  using (owner_id = auth.uid() or user_is_super_admin(auth.uid()))
  with check (owner_id = auth.uid() or user_is_super_admin(auth.uid()));

create policy "meal_ingredients: via meal owner"
  on public.meal_ingredients for all
  using (
    exists (
      select 1 from public.meals m
      where m.id = meal_ingredients.meal_id
        and (m.owner_id = auth.uid() or user_is_super_admin(auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.meals m
      where m.id = meal_ingredients.meal_id
        and (m.owner_id = auth.uid() or user_is_super_admin(auth.uid()))
    )
  );

create policy "meal_categories: owner only"
  on public.meal_categories for all
  using (owner_id = auth.uid() or user_is_super_admin(auth.uid()))
  with check (owner_id = auth.uid() or user_is_super_admin(auth.uid()));

create policy "ingredient_categories: owner only"
  on public.ingredient_categories for all
  using (owner_id = auth.uid() or user_is_super_admin(auth.uid()))
  with check (owner_id = auth.uid() or user_is_super_admin(auth.uid()));

create policy "ingredient_units: via ingredient owner"
  on public.ingredient_units for all
  using (
    exists (
      select 1 from public.ingredients i
      where i.id = ingredient_units.ingredient_id
        and (i.owner_id = auth.uid() or user_is_super_admin(auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from public.ingredients i
      where i.id = ingredient_units.ingredient_id
        and (i.owner_id = auth.uid() or user_is_super_admin(auth.uid()))
    )
  );
