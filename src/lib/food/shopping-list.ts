import type {
  MealPlanTemplate,
  MealPlanDay,
  IngredientCategory,
} from "@/lib/types/domain";
import type { MealWithIngredients, IngredientWithUnits } from "@/lib/services/food";

/**
 * Aggregate the ingredients needed to cook a set of (date, meal_time)
 * slots across multiple users. Quantities are summed per (ingredient,
 * unit) pair — we don't try to convert across units (e.g. 100g + 0.5kg)
 * because that needs a units table; instead each unit gets its own line.
 *
 * Result is grouped by ingredient_category for a tidier shopping list.
 */
export interface ShoppingLineItem {
  ingredientId: string;
  ingredientName: string;
  unitName: string | null;
  totalQuantity: number;
  /** Source meal names — included so the UI can offer a "why" tooltip
   *  when an ingredient looks unfamiliar. */
  sourceMeals: string[];
}

export interface ShoppingGroup {
  categoryId: string | null;
  categoryName: string;
  items: ShoppingLineItem[];
}

export interface ShoppingListInputs {
  /** People whose plans should be included. Plans for users not in this
   *  set are skipped. */
  userIds: string[];
  /** Inclusive ISO date strings "YYYY-MM-DD". The aggregator walks each
   *  date in the range and pulls effective slots (day-overrides if any,
   *  otherwise that day-of-week's template entries). */
  fromDate: string;
  toDate: string;
  template: MealPlanTemplate[];
  dayRows: MealPlanDay[];
  meals: MealWithIngredients[];
  ingredients: IngredientWithUnits[];
  ingredientCategories: IngredientCategory[];
}

export interface ShoppingListResult {
  groups: ShoppingGroup[];
  totalLines: number;
  /** Days walked × meal-time slots — useful for a "covered N meals"
   *  caption above the WhatsApp preview. */
  slotsCovered: number;
}

const UNCATEGORIZED_LABEL = "ללא קטגוריה";

/** Walks every date in [fromDate, toDate] inclusive and returns ISO
 *  strings in the same format. */
function eachDateInRange(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return out;
  const cursor = new Date(start);
  while (cursor <= end) {
    const yyyy = cursor.getFullYear();
    const mm = String(cursor.getMonth() + 1).padStart(2, "0");
    const dd = String(cursor.getDate()).padStart(2, "0");
    out.push(`${yyyy}-${mm}-${dd}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export function buildShoppingList(inputs: ShoppingListInputs): ShoppingListResult {
  const userSet = new Set(inputs.userIds);
  const mealsById = new Map(inputs.meals.map((m) => [m.id, m]));
  const ingredientsById = new Map(inputs.ingredients.map((i) => [i.id, i]));
  const categoryById = new Map(
    inputs.ingredientCategories.map((c) => [c.id, c])
  );

  // Index template by (user_id, day_of_week, meal_time) -> meal_ids[].
  const tplBy = new Map<string, string[]>();
  for (const r of inputs.template) {
    if (!userSet.has(r.user_id)) continue;
    const k = `${r.user_id}:${r.day_of_week}:${r.meal_time}`;
    const list = tplBy.get(k) ?? [];
    list.push(r.meal_id);
    tplBy.set(k, list);
  }

  // Index day rows by (user_id, date, meal_time) -> meal_ids[].
  const dayBy = new Map<string, string[]>();
  // Track which (user, date, meal_time) cells have ANY override (even empty)
  // so we don't fall back to the template for them.
  const dayHasOverride = new Set<string>();
  for (const r of inputs.dayRows) {
    if (!userSet.has(r.user_id)) continue;
    const k = `${r.user_id}:${r.date}:${r.meal_time}`;
    const list = dayBy.get(k) ?? [];
    list.push(r.meal_id);
    dayBy.set(k, list);
    dayHasOverride.add(k);
  }

  // Collect (ingredient_id, unit_id) -> { totalQty, sourceMeals[] }.
  type Bucket = {
    ingredientId: string;
    unitId: string | null;
    totalQty: number;
    sourceMeals: Set<string>;
  };
  const buckets = new Map<string, Bucket>();
  let slotsCovered = 0;

  const dates = eachDateInRange(inputs.fromDate, inputs.toDate);
  for (const date of dates) {
    const d = new Date(date + "T00:00:00");
    const dow = d.getDay();
    for (const userId of userSet) {
      // For each meal_time we need to look at: day-override if any, else
      // template for that day-of-week. We don't know meal_times up front
      // here — walk the keys we have.
      const candidateMealTimes = new Set<string>();
      for (const k of dayBy.keys()) {
        const [u, dt, mt] = k.split(":");
        if (u === userId && dt === date) candidateMealTimes.add(mt);
      }
      for (const k of tplBy.keys()) {
        const [u, dw, mt] = k.split(":");
        if (u === userId && dw === String(dow)) candidateMealTimes.add(mt);
      }

      for (const mt of candidateMealTimes) {
        const overrideKey = `${userId}:${date}:${mt}`;
        let mealIds: string[] = [];
        if (dayHasOverride.has(overrideKey)) {
          mealIds = dayBy.get(overrideKey) ?? [];
        } else {
          mealIds = tplBy.get(`${userId}:${dow}:${mt}`) ?? [];
        }
        if (mealIds.length === 0) continue;
        slotsCovered++;

        for (const mealId of mealIds) {
          const meal = mealsById.get(mealId);
          if (!meal) continue;
          for (const mi of meal.ingredients) {
            const bk = `${mi.ingredient_id}:${mi.unit_id ?? "_"}`;
            const existing = buckets.get(bk);
            if (existing) {
              existing.totalQty += Number(mi.quantity) || 0;
              existing.sourceMeals.add(meal.name);
            } else {
              buckets.set(bk, {
                ingredientId: mi.ingredient_id,
                unitId: mi.unit_id,
                totalQty: Number(mi.quantity) || 0,
                sourceMeals: new Set([meal.name]),
              });
            }
          }
        }
      }
    }
  }

  // Resolve unit display name via the ingredient's units array.
  const groupsByCat = new Map<string | null, ShoppingLineItem[]>();
  for (const b of buckets.values()) {
    const ing = ingredientsById.get(b.ingredientId);
    const unitName =
      ing?.units.find((u) => u.id === b.unitId)?.unit_name ??
      ing?.units.find((u) => u.is_default)?.unit_name ??
      ing?.units[0]?.unit_name ??
      null;
    const catId = ing?.category_id ?? null;
    const item: ShoppingLineItem = {
      ingredientId: b.ingredientId,
      ingredientName: ing?.name ?? "(נמחק)",
      unitName,
      totalQuantity: b.totalQty,
      sourceMeals: Array.from(b.sourceMeals),
    };
    const list = groupsByCat.get(catId) ?? [];
    list.push(item);
    groupsByCat.set(catId, list);
  }

  // Sort within each group by ingredient name, and produce a deterministic
  // group order (categories first by sort_order then name; uncategorized last).
  const orderedCategories = [...inputs.ingredientCategories].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name, "he");
  });

  const groups: ShoppingGroup[] = [];
  for (const c of orderedCategories) {
    const items = groupsByCat.get(c.id);
    if (!items || items.length === 0) continue;
    groups.push({
      categoryId: c.id,
      categoryName: c.name,
      items: items.sort((a, b) =>
        a.ingredientName.localeCompare(b.ingredientName, "he")
      ),
    });
  }
  const uncategorized = groupsByCat.get(null);
  if (uncategorized && uncategorized.length > 0) {
    groups.push({
      categoryId: null,
      categoryName: UNCATEGORIZED_LABEL,
      items: uncategorized.sort((a, b) =>
        a.ingredientName.localeCompare(b.ingredientName, "he")
      ),
    });
  }

  // Reference to silence "unused" if categoryById ends up unused — it's
  // currently not needed since we walk inputs.ingredientCategories
  // directly, but keeping a no-op makes the import explicit.
  void categoryById;

  return {
    groups,
    totalLines: groups.reduce((sum, g) => sum + g.items.length, 0),
    slotsCovered,
  };
}

const QTY_FMT = (n: number) => {
  if (Number.isInteger(n)) return String(n);
  return (Math.round(n * 100) / 100).toString();
};

/** Builds a Hebrew WhatsApp-friendly text from a shopping list result.
 *  Categories are bold (single asterisk-pairs render as bold in WA), each
 *  ingredient on its own line. Slot count and date range live in the
 *  header so the recipient knows what the list covers. */
export function shoppingListToWhatsAppText(
  result: ShoppingListResult,
  fromDate: string,
  toDate: string
): string {
  const sameDay = fromDate === toDate;
  const header = sameDay
    ? `🛒 רשימת קניות ל-${fromDate}`
    : `🛒 רשימת קניות ל-${fromDate} – ${toDate}`;

  if (result.groups.length === 0) {
    return `${header}\n\n(אין מצרכים — לא נמצאו ארוחות מתוכננות לטווח שנבחר.)`;
  }

  const sections = result.groups
    .map((g) => {
      const lines = g.items
        .map((it) => {
          const qty = QTY_FMT(it.totalQuantity);
          const unit = it.unitName ? ` ${it.unitName}` : "";
          return `• ${it.ingredientName} — ${qty}${unit}`;
        })
        .join("\n");
      return `*${g.categoryName}*\n${lines}`;
    })
    .join("\n\n");

  return `${header}\n\n${sections}`;
}

/** wa.me URL with the message pre-filled. Recipient is left to the user
 *  via WhatsApp's contact picker. */
export function whatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
