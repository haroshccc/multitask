import type {
  IngredientInsert,
  IngredientUnitInsert,
  MealInsert,
  MealTimeKey,
} from "@/lib/types/domain";
import { MEAL_TIME_KEYS } from "@/lib/types/domain";

// =============================================================================
// CSV parsing — small, dependency-free, RFC4180-ish.
//
// Handles: comma separator, quoted fields, escaped quotes (""), CRLF/LF line
// endings, and a leading BOM (Excel adds one when saving as UTF-8 CSV).
// =============================================================================

export function parseCsv(input: string): string[][] {
  if (input.charCodeAt(0) === 0xfeff) input = input.slice(1);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\r") {
      // Treat \r as part of \r\n; \r alone (rare) also ends the row.
      if (input[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }
  // Flush trailing cell/row, but skip an empty trailing row (common when
  // the file ends with a newline).
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter(
    (r) => !(r.length === 1 && r[0].trim() === "")
  );
}

const norm = (s: string | undefined | null) =>
  (s ?? "").trim();
const numOrNull = (s: string | undefined | null): number | null => {
  const t = norm(s);
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const truthy = (s: string | undefined | null): boolean => {
  const t = norm(s).toLowerCase();
  return t === "1" || t === "true" || t === "כן" || t === "yes" || t === "y";
};

// =============================================================================
// Ingredients import
// =============================================================================

/** Expected headers (Hebrew). Either order works — we look up by header
 *  name, not position, so users can rearrange columns or add extras. */
export const INGREDIENT_CSV_HEADERS = [
  "שם",
  "קטגוריה",
  "יחידה",
  "כמות_ליחידה",
  "קלוריות",
  "חלבון",
  "שומן",
  "פחמימות",
  "ברירת_מחדל",
  "הערות",
] as const;

export const INGREDIENT_CSV_SAMPLE = `שם,קטגוריה,יחידה,כמות_ליחידה,קלוריות,חלבון,שומן,פחמימות,ברירת_מחדל,הערות
מלפפון,ירקות,יחידה,1,15,0.7,0.1,3.6,כן,
מלפפון,ירקות,גרם,100,15,0.7,0.1,3.6,,
עגבנייה,ירקות,יחידה,1,22,1,0.2,4.8,כן,
ביצה,חלבונים,יחידה,1,72,6.3,4.8,0.4,כן,
שמן זית,שומנים,כפית,5,40,0,4.5,0,כן,
שמן זית,שומנים,כף,15,120,0,13.5,0,,`;

export interface ParsedIngredient {
  name: string;
  categoryName: string | null;
  notes: string | null;
  units: Array<{
    unit_name: string;
    amount: number;
    calories: number | null;
    protein_g: number | null;
    fat_g: number | null;
    carbs_g: number | null;
    is_default: boolean;
  }>;
}

export interface IngredientImportPlan {
  toCreate: ParsedIngredient[];
  /** Ingredient names already present in the org library. We don't merge
   *  units onto them — the rule is "additive only, never overwrite". */
  toSkip: string[];
  errors: string[];
}

interface CsvParseResult<T> {
  rows: T[];
  errors: string[];
}

function parseIngredientCsv(csv: string): CsvParseResult<{
  name: string;
  categoryName: string | null;
  unitName: string;
  amount: number;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  isDefault: boolean;
  notes: string | null;
}> {
  const rows = parseCsv(csv);
  const errors: string[] = [];
  if (rows.length === 0) {
    return { rows: [], errors: ["הטקסט ריק."] };
  }
  const header = rows[0].map((h) => norm(h));
  const idx = (key: string) => header.indexOf(key);

  const required = ["שם", "יחידה"];
  for (const r of required) {
    if (idx(r) === -1) {
      errors.push(`חסרה עמודת חובה: "${r}".`);
    }
  }
  if (errors.length > 0) return { rows: [], errors };

  const out: CsvParseResult<{
    name: string;
    categoryName: string | null;
    unitName: string;
    amount: number;
    calories: number | null;
    protein: number | null;
    fat: number | null;
    carbs: number | null;
    isDefault: boolean;
    notes: string | null;
  }>["rows"] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = norm(r[idx("שם")]);
    const unitName = norm(r[idx("יחידה")]);
    if (!name || !unitName) {
      errors.push(`שורה ${i + 1}: חסר שם מצרך או יחידה.`);
      continue;
    }
    const amount = numOrNull(r[idx("כמות_ליחידה")]);
    out.push({
      name,
      categoryName: idx("קטגוריה") !== -1 ? norm(r[idx("קטגוריה")]) || null : null,
      unitName,
      amount: amount ?? 1,
      calories: idx("קלוריות") !== -1 ? numOrNull(r[idx("קלוריות")]) : null,
      protein: idx("חלבון") !== -1 ? numOrNull(r[idx("חלבון")]) : null,
      fat: idx("שומן") !== -1 ? numOrNull(r[idx("שומן")]) : null,
      carbs: idx("פחמימות") !== -1 ? numOrNull(r[idx("פחמימות")]) : null,
      isDefault: idx("ברירת_מחדל") !== -1 ? truthy(r[idx("ברירת_מחדל")]) : false,
      notes: idx("הערות") !== -1 ? norm(r[idx("הערות")]) || null : null,
    });
  }
  return { rows: out, errors };
}

/** Build an IngredientImportPlan from CSV text + the existing ingredient
 *  names (for skip-detection). The plan is what the modal previews — the
 *  caller decides whether to actually execute it. */
export function planIngredientsImport(
  csvText: string,
  existingIngredientNames: string[]
): IngredientImportPlan {
  const parsed = parseIngredientCsv(csvText);
  if (parsed.errors.length > 0 && parsed.rows.length === 0) {
    return { toCreate: [], toSkip: [], errors: parsed.errors };
  }

  const existingSet = new Set(
    existingIngredientNames.map((n) => n.trim().toLowerCase())
  );
  const grouped = new Map<string, ParsedIngredient>();
  const skipSet = new Set<string>();

  for (const r of parsed.rows) {
    const key = r.name.trim().toLowerCase();
    if (existingSet.has(key)) {
      skipSet.add(r.name);
      continue;
    }
    let bucket = grouped.get(key);
    if (!bucket) {
      bucket = {
        name: r.name,
        categoryName: r.categoryName,
        notes: r.notes,
        units: [],
      };
      grouped.set(key, bucket);
    } else {
      // Use the first non-empty category/notes seen for the ingredient.
      if (!bucket.categoryName && r.categoryName) bucket.categoryName = r.categoryName;
      if (!bucket.notes && r.notes) bucket.notes = r.notes;
    }
    bucket.units.push({
      unit_name: r.unitName,
      amount: r.amount,
      calories: r.calories,
      protein_g: r.protein,
      fat_g: r.fat,
      carbs_g: r.carbs,
      is_default: r.isDefault,
    });
  }

  // If no unit is marked default for an ingredient, pick the first one.
  for (const ing of grouped.values()) {
    if (!ing.units.some((u) => u.is_default) && ing.units.length > 0) {
      ing.units[0].is_default = true;
    }
  }

  return {
    toCreate: Array.from(grouped.values()),
    toSkip: Array.from(skipSet),
    errors: parsed.errors,
  };
}

/** Result of executing an IngredientImportPlan. */
export interface IngredientImportResult {
  createdIngredients: number;
  createdUnits: number;
  createdCategories: number;
  skipped: string[];
  errors: string[];
}

/** Helper signature so the caller injects the supabase-bound writers. We
 *  keep this module pure-ish (no direct supabase import) so it stays
 *  unit-testable. */
export interface IngredientImportWriters {
  createCategory: (name: string) => Promise<{ id: string }>;
  createIngredient: (
    payload: Omit<IngredientInsert, "organization_id" | "owner_id">
  ) => Promise<{ id: string }>;
  createUnit: (
    payload: Omit<IngredientUnitInsert, "organization_id">
  ) => Promise<void>;
  /** Existing categories keyed by lowercased name, for reuse. */
  existingCategoriesByName: Map<string, { id: string }>;
}

export async function executeIngredientsImport(
  plan: IngredientImportPlan,
  writers: IngredientImportWriters
): Promise<IngredientImportResult> {
  const result: IngredientImportResult = {
    createdIngredients: 0,
    createdUnits: 0,
    createdCategories: 0,
    skipped: plan.toSkip.slice(),
    errors: plan.errors.slice(),
  };

  // Local copy so successive ingredients reuse just-created categories.
  const cats = new Map(writers.existingCategoriesByName);

  for (const ing of plan.toCreate) {
    let categoryId: string | null = null;
    if (ing.categoryName) {
      const k = ing.categoryName.trim().toLowerCase();
      const existing = cats.get(k);
      if (existing) {
        categoryId = existing.id;
      } else {
        try {
          const created = await writers.createCategory(ing.categoryName);
          cats.set(k, created);
          categoryId = created.id;
          result.createdCategories++;
        } catch (e) {
          result.errors.push(
            `יצירת הקטגוריה "${ing.categoryName}" נכשלה: ${(e as Error).message}`
          );
        }
      }
    }

    try {
      const isComplete = ing.units.some(
        (u) => u.unit_name && u.calories != null
      );
      const created = await writers.createIngredient({
        name: ing.name,
        category_id: categoryId,
        notes: ing.notes,
        is_complete: isComplete,
      });
      result.createdIngredients++;
      for (const u of ing.units) {
        try {
          await writers.createUnit({
            ingredient_id: created.id,
            unit_name: u.unit_name,
            amount: u.amount,
            calories: u.calories,
            protein_g: u.protein_g,
            fat_g: u.fat_g,
            carbs_g: u.carbs_g,
            is_default: u.is_default,
            sort_order: 0,
          });
          result.createdUnits++;
        } catch (e) {
          result.errors.push(
            `יחידה "${u.unit_name}" עבור "${ing.name}" נכשלה: ${(e as Error).message}`
          );
        }
      }
    } catch (e) {
      result.errors.push(
        `יצירת המצרך "${ing.name}" נכשלה: ${(e as Error).message}`
      );
    }
  }

  return result;
}

// =============================================================================
// Meals import
// =============================================================================

export const MEAL_CSV_HEADERS = [
  "שם_מנה",
  "קטגוריה",
  "זמני_ארוחה",
  "מנות",
  "מצרך",
  "יחידה",
  "כמות",
  "הערות",
] as const;

export const MEAL_CSV_SAMPLE = `שם_מנה,קטגוריה,זמני_ארוחה,מנות,מצרך,יחידה,כמות,הערות
שקשוקה,בשרי,"בוקר,צהריים",2,ביצה,יחידה,4,
שקשוקה,בשרי,"בוקר,צהריים",2,עגבנייה,יחידה,3,
שקשוקה,בשרי,"בוקר,צהריים",2,שמן זית,כפית,2,
חביתה,חלבי,בוקר,1,ביצה,יחידה,2,מטוגנת בשמן זית
חביתה,חלבי,בוקר,1,שמן זית,כפית,1,`;

const MEAL_TIME_LABEL_TO_KEY: Record<string, MealTimeKey> = {
  בוקר: "breakfast",
  ביניים: "between",
  צהריים: "lunch",
  נשנוש: "snack",
  ערב: "dinner",
};

function parseMealTimes(s: string | null | undefined): MealTimeKey[] {
  const t = norm(s);
  if (!t) return [];
  const validKeys = new Set<string>(MEAL_TIME_KEYS);
  return t
    .split(/[,;|/]/)
    .map((x) => x.trim())
    .map((x): MealTimeKey | null => {
      // Accept either Hebrew label ("בוקר") or canonical key ("breakfast").
      if (MEAL_TIME_LABEL_TO_KEY[x]) return MEAL_TIME_LABEL_TO_KEY[x];
      if (validKeys.has(x)) return x as MealTimeKey;
      return null;
    })
    .filter((x): x is MealTimeKey => x !== null);
}

export interface ParsedMealLine {
  ingredientName: string;
  unitName: string | null;
  quantity: number;
}

export interface ParsedMeal {
  name: string;
  categoryName: string | null;
  mealTimes: MealTimeKey[];
  servings: number;
  notes: string | null;
  lines: ParsedMealLine[];
}

export interface MealImportPlan {
  toCreate: ParsedMeal[];
  toSkip: string[];
  /** Ingredient names referenced by some meal but not present in the
   *  library (existing or freshly imported). The meal will still be
   *  created but those lines will be skipped — we don't auto-create
   *  ingredients to avoid creating empty/incomplete library entries
   *  silently. */
  missingIngredients: string[];
  errors: string[];
}

function parseMealCsv(csv: string): CsvParseResult<{
  mealName: string;
  categoryName: string | null;
  mealTimesRaw: string | null;
  servings: number;
  ingredientName: string;
  unitName: string | null;
  quantity: number;
  notes: string | null;
}> {
  const rows = parseCsv(csv);
  const errors: string[] = [];
  if (rows.length === 0) return { rows: [], errors: ["הטקסט ריק."] };
  const header = rows[0].map((h) => norm(h));
  const idx = (key: string) => header.indexOf(key);

  for (const r of ["שם_מנה", "מצרך"]) {
    if (idx(r) === -1) errors.push(`חסרה עמודת חובה: "${r}".`);
  }
  if (errors.length > 0) return { rows: [], errors };

  const out: CsvParseResult<{
    mealName: string;
    categoryName: string | null;
    mealTimesRaw: string | null;
    servings: number;
    ingredientName: string;
    unitName: string | null;
    quantity: number;
    notes: string | null;
  }>["rows"] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const mealName = norm(r[idx("שם_מנה")]);
    const ingredientName = norm(r[idx("מצרך")]);
    if (!mealName) {
      errors.push(`שורה ${i + 1}: חסר שם מנה.`);
      continue;
    }
    if (!ingredientName) {
      errors.push(`שורה ${i + 1}: חסר שם מצרך.`);
      continue;
    }
    const qty = idx("כמות") !== -1 ? numOrNull(r[idx("כמות")]) : null;
    out.push({
      mealName,
      categoryName: idx("קטגוריה") !== -1 ? norm(r[idx("קטגוריה")]) || null : null,
      mealTimesRaw:
        idx("זמני_ארוחה") !== -1 ? norm(r[idx("זמני_ארוחה")]) || null : null,
      servings:
        idx("מנות") !== -1 ? numOrNull(r[idx("מנות")]) ?? 1 : 1,
      ingredientName,
      unitName: idx("יחידה") !== -1 ? norm(r[idx("יחידה")]) || null : null,
      quantity: qty ?? 1,
      notes: idx("הערות") !== -1 ? norm(r[idx("הערות")]) || null : null,
    });
  }
  return { rows: out, errors };
}

export function planMealsImport(
  csvText: string,
  existingMealNames: string[],
  /** Names of all available ingredients (existing + freshly created) for
   *  per-line resolution. */
  availableIngredientNames: string[]
): MealImportPlan {
  const parsed = parseMealCsv(csvText);
  if (parsed.errors.length > 0 && parsed.rows.length === 0) {
    return {
      toCreate: [],
      toSkip: [],
      missingIngredients: [],
      errors: parsed.errors,
    };
  }

  const existingSet = new Set(
    existingMealNames.map((n) => n.trim().toLowerCase())
  );
  const ingredientSet = new Set(
    availableIngredientNames.map((n) => n.trim().toLowerCase())
  );

  const grouped = new Map<string, ParsedMeal>();
  const skipSet = new Set<string>();
  const missing = new Set<string>();

  for (const r of parsed.rows) {
    const key = r.mealName.trim().toLowerCase();
    if (existingSet.has(key)) {
      skipSet.add(r.mealName);
      continue;
    }
    let bucket = grouped.get(key);
    if (!bucket) {
      bucket = {
        name: r.mealName,
        categoryName: r.categoryName,
        mealTimes: parseMealTimes(r.mealTimesRaw),
        servings: r.servings,
        notes: r.notes,
        lines: [],
      };
      grouped.set(key, bucket);
    } else {
      if (!bucket.categoryName && r.categoryName) bucket.categoryName = r.categoryName;
      if (bucket.mealTimes.length === 0 && r.mealTimesRaw) {
        bucket.mealTimes = parseMealTimes(r.mealTimesRaw);
      }
      if (!bucket.notes && r.notes) bucket.notes = r.notes;
    }
    if (!ingredientSet.has(r.ingredientName.trim().toLowerCase())) {
      missing.add(r.ingredientName);
      continue;
    }
    bucket.lines.push({
      ingredientName: r.ingredientName,
      unitName: r.unitName,
      quantity: r.quantity,
    });
  }

  return {
    toCreate: Array.from(grouped.values()),
    toSkip: Array.from(skipSet),
    missingIngredients: Array.from(missing),
    errors: parsed.errors,
  };
}

export interface MealImportResult {
  createdMeals: number;
  createdLines: number;
  createdCategories: number;
  skipped: string[];
  missingIngredients: string[];
  errors: string[];
}

export interface MealImportWriters {
  createCategory: (name: string) => Promise<{ id: string }>;
  createMeal: (
    payload: Omit<MealInsert, "organization_id" | "owner_id">
  ) => Promise<{ id: string }>;
  /** Insert a single meal_ingredient line. */
  createMealIngredient: (payload: {
    meal_id: string;
    ingredient_id: string;
    unit_id: string | null;
    quantity: number;
    sort_order: number;
  }) => Promise<void>;
  existingCategoriesByName: Map<string, { id: string }>;
  /** Resolve ingredient name → { id, units: { id, name }[] } for line wiring. */
  ingredientResolver: Map<
    string,
    { id: string; units: Array<{ id: string; unit_name: string; is_default: boolean }> }
  >;
}

export async function executeMealsImport(
  plan: MealImportPlan,
  writers: MealImportWriters
): Promise<MealImportResult> {
  const result: MealImportResult = {
    createdMeals: 0,
    createdLines: 0,
    createdCategories: 0,
    skipped: plan.toSkip.slice(),
    missingIngredients: plan.missingIngredients.slice(),
    errors: plan.errors.slice(),
  };

  const cats = new Map(writers.existingCategoriesByName);

  for (const meal of plan.toCreate) {
    let categoryId: string | null = null;
    if (meal.categoryName) {
      const k = meal.categoryName.trim().toLowerCase();
      const existing = cats.get(k);
      if (existing) {
        categoryId = existing.id;
      } else {
        try {
          const created = await writers.createCategory(meal.categoryName);
          cats.set(k, created);
          categoryId = created.id;
          result.createdCategories++;
        } catch (e) {
          result.errors.push(
            `יצירת הקטגוריה "${meal.categoryName}" נכשלה: ${(e as Error).message}`
          );
        }
      }
    }

    try {
      const created = await writers.createMeal({
        name: meal.name,
        category_id: categoryId,
        meal_times: meal.mealTimes,
        servings: meal.servings,
        notes: meal.notes,
      });
      result.createdMeals++;

      let order = 0;
      for (const line of meal.lines) {
        const ing = writers.ingredientResolver.get(
          line.ingredientName.trim().toLowerCase()
        );
        if (!ing) {
          // Shouldn't happen — planMealsImport already filtered missing —
          // but safe-guard anyway.
          continue;
        }
        let unitId: string | null = null;
        if (line.unitName) {
          unitId =
            ing.units.find((u) => u.unit_name === line.unitName)?.id ??
            ing.units.find((u) => u.is_default)?.id ??
            ing.units[0]?.id ??
            null;
        } else {
          unitId = ing.units.find((u) => u.is_default)?.id ?? ing.units[0]?.id ?? null;
        }
        try {
          await writers.createMealIngredient({
            meal_id: created.id,
            ingredient_id: ing.id,
            unit_id: unitId,
            quantity: line.quantity,
            sort_order: order++,
          });
          result.createdLines++;
        } catch (e) {
          result.errors.push(
            `שורה במנה "${meal.name}" נכשלה: ${(e as Error).message}`
          );
        }
      }
    } catch (e) {
      result.errors.push(
        `יצירת המנה "${meal.name}" נכשלה: ${(e as Error).message}`
      );
    }
  }

  return result;
}
