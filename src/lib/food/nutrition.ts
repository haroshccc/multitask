import type { MealIngredient, IngredientUnit } from "@/lib/types/domain";

/**
 * Total nutrition values for a meal, computed as
 *   Σ over rows: (quantity / unit.amount) * unit.{calories,fat,protein,carbs}
 *
 * Skips rows whose unit is missing or whose unit has no values entered yet
 * (incomplete ingredients) — they contribute nothing rather than zeroing out
 * the total or showing NaN.
 */
export interface NutritionTotals {
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  /** True when at least one row was skipped because its unit/values are
   *  missing — the UI can show a "ערכים חלקיים" hint accordingly. */
  hasMissing: boolean;
}

export function computeMealNutrition(
  rows: Array<Pick<MealIngredient, "ingredient_id" | "unit_id" | "quantity">>,
  unitsById: Map<string, IngredientUnit>,
  /** When a row's unit_id is null, fall back to the ingredient's default
   *  unit (the row was created when the ingredient still had no unit). */
  defaultUnitForIngredient?: (ingredientId: string) => IngredientUnit | undefined
): NutritionTotals {
  let calories = 0;
  let protein_g = 0;
  let fat_g = 0;
  let carbs_g = 0;
  let hasMissing = false;

  for (const r of rows) {
    let unit = r.unit_id ? unitsById.get(r.unit_id) : undefined;
    if (!unit && defaultUnitForIngredient) {
      unit = defaultUnitForIngredient(r.ingredient_id);
    }
    if (!unit || !unit.amount || unit.amount <= 0) {
      hasMissing = true;
      continue;
    }
    const factor = (Number(r.quantity) || 0) / Number(unit.amount);
    if (!Number.isFinite(factor)) {
      hasMissing = true;
      continue;
    }
    if (unit.calories != null) calories += factor * Number(unit.calories);
    else hasMissing = true;
    if (unit.protein_g != null) protein_g += factor * Number(unit.protein_g);
    if (unit.fat_g != null) fat_g += factor * Number(unit.fat_g);
    if (unit.carbs_g != null) carbs_g += factor * Number(unit.carbs_g);
  }

  return { calories, protein_g, fat_g, carbs_g, hasMissing };
}

export const round1 = (n: number): number => Math.round(n * 10) / 10;
