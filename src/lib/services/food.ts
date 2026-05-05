import { supabase } from "@/lib/supabase/client";
import type {
  Meal,
  MealInsert,
  MealUpdate,
  MealCategory,
  MealCategoryInsert,
  MealCategoryUpdate,
  Ingredient,
  IngredientInsert,
  IngredientUpdate,
  IngredientCategory,
  IngredientCategoryInsert,
  IngredientCategoryUpdate,
  IngredientUnit,
  IngredientUnitInsert,
  IngredientUnitUpdate,
  MealIngredient,
  MealIngredientInsert,
  MealIngredientUpdate,
  MealPlanTemplate,
  MealPlanDay,
  MealPlanDayUpdate,
  MealPlanShare,
} from "@/lib/types/domain";

// =============================================================================
// Meal categories
// =============================================================================

export async function listMealCategories(orgId: string): Promise<MealCategory[]> {
  const { data, error } = await supabase
    .from("meal_categories")
    .select("*")
    .eq("organization_id", orgId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createMealCategory(payload: MealCategoryInsert): Promise<MealCategory> {
  const { data, error } = await supabase
    .from("meal_categories")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMealCategory(
  id: string,
  patch: MealCategoryUpdate
): Promise<MealCategory> {
  const { data, error } = await supabase
    .from("meal_categories")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMealCategory(id: string): Promise<void> {
  const { error } = await supabase.from("meal_categories").delete().eq("id", id);
  if (error) throw error;
}

// =============================================================================
// Ingredient categories
// =============================================================================

export async function listIngredientCategories(orgId: string): Promise<IngredientCategory[]> {
  const { data, error } = await supabase
    .from("ingredient_categories")
    .select("*")
    .eq("organization_id", orgId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createIngredientCategory(
  payload: IngredientCategoryInsert
): Promise<IngredientCategory> {
  const { data, error } = await supabase
    .from("ingredient_categories")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateIngredientCategory(
  id: string,
  patch: IngredientCategoryUpdate
): Promise<IngredientCategory> {
  const { data, error } = await supabase
    .from("ingredient_categories")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteIngredientCategory(id: string): Promise<void> {
  const { error } = await supabase.from("ingredient_categories").delete().eq("id", id);
  if (error) throw error;
}

// =============================================================================
// Ingredients (with their units)
// =============================================================================

/** A single ingredient with its measurement units bundled — what the UI
 *  consumes everywhere (the meal editor's dropdowns, the ingredients tab,
 *  the nutrition computation). */
export interface IngredientWithUnits extends Ingredient {
  units: IngredientUnit[];
}

export async function listIngredients(orgId: string): Promise<IngredientWithUnits[]> {
  const { data, error } = await supabase
    .from("ingredients")
    .select("*, units:ingredient_units(*)")
    .eq("organization_id", orgId)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    units: ((row as unknown as { units: IngredientUnit[] }).units ?? []).sort(
      (a, b) => a.sort_order - b.sort_order
    ),
  })) as IngredientWithUnits[];
}

export async function createIngredient(payload: IngredientInsert): Promise<Ingredient> {
  const { data, error } = await supabase
    .from("ingredients")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateIngredient(
  id: string,
  patch: IngredientUpdate
): Promise<Ingredient> {
  const { data, error } = await supabase
    .from("ingredients")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteIngredient(id: string): Promise<void> {
  const { error } = await supabase.from("ingredients").delete().eq("id", id);
  if (error) throw error;
}

// =============================================================================
// Ingredient units
// =============================================================================

export async function createIngredientUnit(
  payload: IngredientUnitInsert
): Promise<IngredientUnit> {
  const { data, error } = await supabase
    .from("ingredient_units")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateIngredientUnit(
  id: string,
  patch: IngredientUnitUpdate
): Promise<IngredientUnit> {
  const { data, error } = await supabase
    .from("ingredient_units")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteIngredientUnit(id: string): Promise<void> {
  const { error } = await supabase.from("ingredient_units").delete().eq("id", id);
  if (error) throw error;
}

// =============================================================================
// Meals (with their ingredients)
// =============================================================================

/** Meal with its ingredient lines bundled — what the meal table & editor
 *  display. The nutrition totals are computed at render time from each
 *  line's quantity × unit values, never persisted. */
export interface MealWithIngredients extends Meal {
  ingredients: MealIngredient[];
}

export async function listMeals(orgId: string): Promise<MealWithIngredients[]> {
  const { data, error } = await supabase
    .from("meals")
    .select("*, ingredients:meal_ingredients(*)")
    .eq("organization_id", orgId)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    ...row,
    ingredients: (
      (row as unknown as { ingredients: MealIngredient[] }).ingredients ?? []
    ).sort((a, b) => a.sort_order - b.sort_order),
  })) as MealWithIngredients[];
}

export async function createMeal(payload: MealInsert): Promise<Meal> {
  const { data, error } = await supabase
    .from("meals")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMeal(id: string, patch: MealUpdate): Promise<Meal> {
  const { data, error } = await supabase
    .from("meals")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMeal(id: string): Promise<void> {
  const { error } = await supabase.from("meals").delete().eq("id", id);
  if (error) throw error;
}

// =============================================================================
// Meal ingredients (junction)
// =============================================================================

export async function createMealIngredient(
  payload: MealIngredientInsert
): Promise<MealIngredient> {
  const { data, error } = await supabase
    .from("meal_ingredients")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateMealIngredient(
  id: string,
  patch: MealIngredientUpdate
): Promise<MealIngredient> {
  const { data, error } = await supabase
    .from("meal_ingredients")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMealIngredient(id: string): Promise<void> {
  const { error } = await supabase.from("meal_ingredients").delete().eq("id", id);
  if (error) throw error;
}

/** Replace all rows for a meal in a single batch — used by the meal editor
 *  on save so we don't have to track per-row create/update/delete diffs. */
export async function replaceMealIngredients(
  mealId: string,
  organizationId: string,
  rows: Array<Pick<MealIngredient, "ingredient_id" | "unit_id" | "quantity" | "sort_order">>
): Promise<void> {
  const { error: delErr } = await supabase
    .from("meal_ingredients")
    .delete()
    .eq("meal_id", mealId);
  if (delErr) throw delErr;
  if (rows.length === 0) return;
  const { error: insErr } = await supabase.from("meal_ingredients").insert(
    rows.map((r) => ({
      meal_id: mealId,
      organization_id: organizationId,
      ingredient_id: r.ingredient_id,
      unit_id: r.unit_id,
      quantity: r.quantity,
      sort_order: r.sort_order,
    }))
  );
  if (insErr) throw insErr;
}

// =============================================================================
// Meal plan template (weekly recurring) — per-user
// =============================================================================

/** All templates the caller can read, across owners. RLS already filters
 *  to (mine OR shared-with-me); the UI groups the result by user_id. */
export async function listMealPlanTemplate(
  orgId: string
): Promise<MealPlanTemplate[]> {
  const { data, error } = await supabase
    .from("meal_plan_template")
    .select("*")
    .eq("organization_id", orgId)
    .order("user_id", { ascending: true })
    .order("day_of_week", { ascending: true })
    .order("meal_time", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Replace one (day_of_week, meal_time) cell for a specific user's template.
 *  Caller is responsible for ensuring the auth context has write access
 *  to userId's plan (via ownership or a meal_plan_shares grant) — RLS
 *  enforces this server-side. */
export async function replaceMealPlanTemplateCell(
  organizationId: string,
  userId: string,
  dayOfWeek: number,
  mealTime: string,
  mealIds: string[]
): Promise<void> {
  const { error: delErr } = await supabase
    .from("meal_plan_template")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("day_of_week", dayOfWeek)
    .eq("meal_time", mealTime);
  if (delErr) throw delErr;
  if (mealIds.length === 0) return;
  const { error: insErr } = await supabase.from("meal_plan_template").insert(
    mealIds.map((meal_id, i) => ({
      organization_id: organizationId,
      user_id: userId,
      day_of_week: dayOfWeek,
      meal_time: mealTime,
      meal_id,
      sort_order: i,
    }))
  );
  if (insErr) throw insErr;
}

// =============================================================================
// Meal plan days (per-date plan / history) — per-user
// =============================================================================

export async function listMealPlanDays(
  orgId: string,
  fromDate: string,
  toDate: string
): Promise<MealPlanDay[]> {
  const { data, error } = await supabase
    .from("meal_plan_days")
    .select("*")
    .eq("organization_id", orgId)
    .gte("date", fromDate)
    .lte("date", toDate)
    .order("user_id", { ascending: true })
    .order("date", { ascending: true })
    .order("meal_time", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateMealPlanDay(
  id: string,
  patch: MealPlanDayUpdate
): Promise<MealPlanDay> {
  const { data, error } = await supabase
    .from("meal_plan_days")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function replaceMealPlanDayCell(
  organizationId: string,
  userId: string,
  date: string,
  mealTime: string,
  mealIds: string[]
): Promise<void> {
  const { error: delErr } = await supabase
    .from("meal_plan_days")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("date", date)
    .eq("meal_time", mealTime);
  if (delErr) throw delErr;
  if (mealIds.length === 0) return;
  const { error: insErr } = await supabase.from("meal_plan_days").insert(
    mealIds.map((meal_id, i) => ({
      organization_id: organizationId,
      user_id: userId,
      date,
      meal_time: mealTime,
      meal_id,
      sort_order: i,
    }))
  );
  if (insErr) throw insErr;
}

// =============================================================================
// Meal plan shares
// =============================================================================

/** All share rows the caller can see — both outgoing (where they're the
 *  sharer) and incoming (where they're the recipient). The UI splits
 *  the list into the two directions for display. */
export async function listMealPlanShares(orgId: string): Promise<MealPlanShare[]> {
  const { data, error } = await supabase
    .from("meal_plan_shares")
    .select("*")
    .eq("organization_id", orgId);
  if (error) throw error;
  return data ?? [];
}

export async function createMealPlanShare(payload: {
  organization_id: string;
  sharer_user_id: string;
  shared_with_user_id: string;
}): Promise<MealPlanShare> {
  const { data, error } = await supabase
    .from("meal_plan_shares")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMealPlanShare(payload: {
  organization_id: string;
  sharer_user_id: string;
  shared_with_user_id: string;
}): Promise<void> {
  const { error } = await supabase
    .from("meal_plan_shares")
    .delete()
    .eq("organization_id", payload.organization_id)
    .eq("sharer_user_id", payload.sharer_user_id)
    .eq("shared_with_user_id", payload.shared_with_user_id);
  if (error) throw error;
}
