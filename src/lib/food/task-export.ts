import type { TaskInsert, MealTimeKey } from "@/lib/types/domain";
import type { MealPlanTemplate, MealPlanDay } from "@/lib/types/domain";
import type { MealWithIngredients, IngredientWithUnits } from "@/lib/services/food";
import {
  buildShoppingList,
  shoppingListToWhatsAppText,
  type ShoppingListInputs,
} from "./shopping-list";

/**
 * Meal-time → default scheduled hour (24h, local). Tasks created without
 * an explicit user-picked time use these so cooking tasks land on the
 * calendar at a sensible hour by default. Users can shift them manually
 * after creation.
 */
export const MEAL_TIME_DEFAULT_HOUR: Record<MealTimeKey, number> = {
  breakfast: 8,
  between: 11,
  lunch: 13,
  snack: 16,
  dinner: 19,
};

/** Default duration (minutes) per meal-time — also pulled in by cooking
 *  tasks. 30 min is reasonable for breakfast/snacks; lunch/dinner get a
 *  bit longer to account for prep + plate. */
export const MEAL_TIME_DEFAULT_DURATION: Record<MealTimeKey, number> = {
  breakfast: 30,
  between: 15,
  lunch: 45,
  snack: 15,
  dinner: 45,
};

const MEAL_TIME_LABEL: Record<MealTimeKey, string> = {
  breakfast: "ארוחת בוקר",
  between: "ארוחת ביניים",
  lunch: "ארוחת צהריים",
  snack: "נשנוש",
  dinner: "ארוחת ערב",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Combine "YYYY-MM-DD" + hour → ISO string in local time. The DB stores
 *  scheduled_at as timestamptz; supabase-js serializes our Date through
 *  toISOString(), which converts to UTC — so the calendar will render it
 *  at the user's local time. */
function localIsoFor(date: string, hour: number, minute = 0): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, hour, minute, 0, 0);
  return dt.toISOString();
}

function eachDateInRange(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return out;
  const cursor = new Date(start);
  while (cursor <= end) {
    out.push(`${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

const QTY_FMT = (n: number) =>
  Number.isInteger(n) ? String(n) : (Math.round(n * 100) / 100).toString();

// =============================================================================
// Cooking-tasks export — one task per (date, meal_time, meal)
// =============================================================================

export interface CookingExportInputs {
  /** Owners of the plans to be walked. */
  userIds: string[];
  fromDate: string;
  toDate: string;
  template: MealPlanTemplate[];
  dayRows: MealPlanDay[];
  meals: MealWithIngredients[];
  ingredients: IngredientWithUnits[];
  /** Where to file the new tasks. null = inbox / no list. */
  taskListId: string | null;
}

/** Builds an array of TaskInsert payloads — one per scheduled meal — from
 *  the (overlay-aware) meal plan. Caller mutates each through
 *  useCreateTask().mutate() (organization_id + owner_id auto-injected). */
export function buildCookingTaskPayloads(
  inputs: CookingExportInputs
): Array<Omit<TaskInsert, "organization_id" | "owner_id">> {
  const userSet = new Set(inputs.userIds);
  const mealsById = new Map(inputs.meals.map((m) => [m.id, m]));
  const ingredientsById = new Map(inputs.ingredients.map((i) => [i.id, i]));

  // Index template + day-rows by user for fast lookup. Same logic as the
  // shopping-list aggregator but we keep meals separate per (date, slot,
  // meal) so each meal becomes its own task.
  const tplByUserDowMt = new Map<string, string[]>();
  for (const r of inputs.template) {
    if (!userSet.has(r.user_id)) continue;
    const k = `${r.user_id}:${r.day_of_week}:${r.meal_time}`;
    const list = tplByUserDowMt.get(k) ?? [];
    list.push(r.meal_id);
    tplByUserDowMt.set(k, list);
  }

  const dayByUserDateMt = new Map<string, string[]>();
  const overrideExists = new Set<string>();
  for (const r of inputs.dayRows) {
    if (!userSet.has(r.user_id)) continue;
    const k = `${r.user_id}:${r.date}:${r.meal_time}`;
    const list = dayByUserDateMt.get(k) ?? [];
    list.push(r.meal_id);
    dayByUserDateMt.set(k, list);
    overrideExists.add(k);
  }

  const out: Array<Omit<TaskInsert, "organization_id" | "owner_id">> = [];
  const dates = eachDateInRange(inputs.fromDate, inputs.toDate);

  for (const date of dates) {
    const d = new Date(date + "T00:00:00");
    const dow = d.getDay();
    for (const userId of userSet) {
      // Walk every meal_time we have data for, in the canonical order.
      const candidateMealTimes: MealTimeKey[] = [
        "breakfast",
        "between",
        "lunch",
        "snack",
        "dinner",
      ];

      for (const mt of candidateMealTimes) {
        const overrideKey = `${userId}:${date}:${mt}`;
        let mealIds: string[] = [];
        if (overrideExists.has(overrideKey)) {
          mealIds = dayByUserDateMt.get(overrideKey) ?? [];
        } else {
          mealIds = tplByUserDowMt.get(`${userId}:${dow}:${mt}`) ?? [];
        }
        if (mealIds.length === 0) continue;

        const hour = MEAL_TIME_DEFAULT_HOUR[mt];
        const duration = MEAL_TIME_DEFAULT_DURATION[mt];
        const scheduledAt = localIsoFor(date, hour);

        for (const mealId of mealIds) {
          const meal = mealsById.get(mealId);
          if (!meal) continue;

          // Build a Hebrew description listing the ingredients with
          // resolved unit names — handy when cooking from the task itself.
          const ingredientLines = meal.ingredients
            .map((mi) => {
              const ing = ingredientsById.get(mi.ingredient_id);
              if (!ing) return null;
              const unit =
                ing.units.find((u) => u.id === mi.unit_id)?.unit_name ??
                ing.units.find((u) => u.is_default)?.unit_name ??
                ing.units[0]?.unit_name ??
                "";
              return `• ${ing.name} — ${QTY_FMT(Number(mi.quantity) || 0)}${unit ? " " + unit : ""}`;
            })
            .filter((l): l is string => !!l);
          const description = [
            `${MEAL_TIME_LABEL[mt]} · ${date}`,
            "",
            ingredientLines.length > 0
              ? `*מצרכים:*\n${ingredientLines.join("\n")}`
              : "(אין מצרכים מוגדרים)",
            meal.notes ? `\n*אופן הכנה / הערות:*\n${meal.notes}` : "",
          ]
            .filter((s) => s.length > 0)
            .join("\n");

          out.push({
            title: `להכין: ${meal.name}`,
            description,
            scheduled_at: scheduledAt,
            duration_minutes: duration,
            task_list_id: inputs.taskListId,
            tags: ["אוכל"],
          });
        }
      }
    }
  }

  return out;
}

// =============================================================================
// Shopping-list-as-task export — a single task with the WA-formatted body
// =============================================================================

export interface ShoppingTaskInputs extends ShoppingListInputs {
  /** When the user wants to do the shopping — defaults to now. */
  scheduledAt?: string;
  taskListId: string | null;
}

export function buildShoppingTaskPayload(
  inputs: ShoppingTaskInputs
): Omit<TaskInsert, "organization_id" | "owner_id"> {
  const result = buildShoppingList(inputs);
  const text = shoppingListToWhatsAppText(result, inputs.fromDate, inputs.toDate);
  const sameDay = inputs.fromDate === inputs.toDate;
  const title = sameDay
    ? `קניות סופר ל-${inputs.fromDate}`
    : `קניות סופר ל-${inputs.fromDate} – ${inputs.toDate}`;
  return {
    title,
    description: text,
    scheduled_at: inputs.scheduledAt ?? null,
    task_list_id: inputs.taskListId,
    tags: ["אוכל", "קניות"],
  };
}
