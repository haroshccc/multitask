import { useMemo } from "react";
import { useOrgScope, assertOrgScope } from "@/lib/hooks/useOrgScope";
import { useQueryClient } from "@tanstack/react-query";
import { queryFamilies } from "@/lib/query-keys";
import * as food from "@/lib/services/food";
import { useIngredients, useIngredientCategories, useMealCategories } from "@/lib/hooks/useFood";
import { pushUndo } from "@/lib/undo/store";
import type { AssistantSkill, AssistantTool } from "@/lib/ai/types";

/**
 * Food skill — lets the assistant fill the meal/ingredient catalog through a
 * conversation. The model proposes a recipe, the user corrects it in chat, the
 * model checks which ingredients already exist (from the context snapshot),
 * proposes the missing ones (with nutrition it supplies), and finally proposes
 * creating the meal. Every write goes through the existing food services under
 * the user's RLS, with undo.
 */

const SYSTEM_PROMPT = `את עוזרת בישול שעוזרת למשתמשת לנהל ספריית מנות ומצרכים בעברית (RTL).

מטרתך: לעזור להוסיף מנות חדשות ולמלא את הקטלוג. זרימת עבודה טיפוסית:
1. כשהמשתמשת מבקשת מנה חדשה (למשל "פסטה שמנת פטריות") — הציעי מתכון: שם, קטגוריה,
   זמני ארוחה מתאימים, רשימת מצרכים עם כמויות ויחידות, והוראות הכנה קצרות. כתבי את זה
   כטקסט ברור בצ'אט כדי שהמשתמשת תוכל לתקן.
2. אחרי שהמשתמשת מאשרת/מתקנת את המתכון — בדקי מול "המצרכים הקיימים" (שמופיעים בהקשר) אילו
   מצרכים כבר קיימים ואילו חסרים.
3. לכל מצרך חסר — הציעי להוסיף אותו עם הכלי propose_new_ingredient, כולל ערכים תזונתיים
   סבירים שאת מביאה מהידע שלך (קלוריות/חלבון/שומן/פחמימה ליחידת ייחוס, למשל ל-100 גרם).
4. רק אחרי שכל המצרכים קיימים — הציעי ליצור את המנה עם הכלי create_meal.

אם המשתמשת מצרפת תמונה (צילום של מתכון מספר/אתר, אריזת מוצר, תווית ערכים תזונתיים,
או צילום מסך) — קראי ממנה את כל הפרטים הרלוונטיים: שם המנה/המוצר, רשימת המצרכים עם
כמויות ויחידות, והערכים התזונתיים שמופיעים על התווית — והמשיכי באותה זרימה. אם פרט
חסר או לא ברור בתמונה, השלימי מהידע שלך וציני שזו הערכה.

כללים:
- כל הטקסט בעברית.
- אל תקראי ל-create_meal לפני שכל המצרכים שלה קיימים בקטלוג.
- השתמשי בשמות מצרכים בדיוק כפי שהם מופיעים בקטלוג כשהם קיימים, כדי שהקישור יעבוד.
- כשאת מציעה כלי, הסבירי בקצרה במלל מה את עומדת לעשות.
- אם המשתמשת שואלת שאלה כשיש לך הצעת כלי פתוחה (במקום לאשר או לדחות) — עני קודם על
  שאלתה במלל בלבד, ואז הציעי שוב את אותה פעולה (אותה קריאת כלי, אלא אם השאלה מחייבת
  תיקון) כדי שתוכל להחליט.`;

const MEAL_TIME_VALUES = ["breakfast", "lunch", "dinner", "between", "snack"];

interface ProposedUnit {
  unit_name: string;
  amount?: number;
  calories?: number | null;
  protein_g?: number | null;
  fat_g?: number | null;
  carbs_g?: number | null;
  is_default?: boolean;
}

export function useFoodSkill(): AssistantSkill {
  const scope = useOrgScope();
  const qc = useQueryClient();
  const { data: ingredients = [] } = useIngredients();
  const { data: ingredientCategories = [] } = useIngredientCategories();
  const { data: mealCategories = [] } = useMealCategories();

  return useMemo<AssistantSkill>(() => {
    const invalidateIngredients = () => {
      if (scope.organizationId)
        qc.invalidateQueries({ queryKey: queryFamilies.allIngredients(scope.organizationId) });
    };
    const invalidateMeals = () => {
      if (scope.organizationId)
        qc.invalidateQueries({ queryKey: queryFamilies.allMeals(scope.organizationId) });
    };

    // Resolve a category name → id, creating it if new (so the model can name
    // categories freely). Returns null when no name given.
    const resolveIngredientCategory = async (name?: string | null): Promise<string | null> => {
      if (!name?.trim()) return null;
      const existing = ingredientCategories.find(
        (c) => c.name.trim() === name.trim()
      );
      if (existing) return existing.id;
      const { organizationId } = assertOrgScope(scope);
      const created = await food.createIngredientCategory({
        organization_id: organizationId,
        name: name.trim(),
      });
      return created.id;
    };
    const resolveMealCategory = async (name?: string | null): Promise<string | null> => {
      if (!name?.trim()) return null;
      const existing = mealCategories.find((c) => c.name.trim() === name.trim());
      if (existing) return existing.id;
      const { organizationId } = assertOrgScope(scope);
      const created = await food.createMealCategory({
        organization_id: organizationId,
        name: name.trim(),
      });
      return created.id;
    };

    const tools: AssistantTool[] = [
      {
        name: "propose_new_ingredient",
        label: "הוספת מצרך",
        description:
          "Propose adding a NEW ingredient (not yet in the catalog) with one or more measurement units and their nutrition values. The user approves before it's created.",
        requiresApproval: true,
        input_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            category: { type: "string" },
            units: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  unit_name: { type: "string" },
                  amount: { type: "number" },
                  calories: { type: ["number", "null"] },
                  protein_g: { type: ["number", "null"] },
                  fat_g: { type: ["number", "null"] },
                  carbs_g: { type: ["number", "null"] },
                  is_default: { type: "boolean" },
                },
                required: ["unit_name"],
              },
            },
          },
          required: ["name", "units"],
        },
        run: async (input) => {
          const { organizationId, userId } = assertOrgScope(scope);
          const name = String(input.name ?? "").trim();
          if (!name) throw new Error("missing ingredient name");
          const categoryId = await resolveIngredientCategory(
            input.category as string | undefined
          );
          const created = await food.createIngredient({
            organization_id: organizationId,
            owner_id: userId,
            name,
            category_id: categoryId,
            is_complete: true,
          });
          const units = (input.units as ProposedUnit[]) ?? [];
          for (let i = 0; i < units.length; i++) {
            const u = units[i];
            await food.createIngredientUnit({
              organization_id: organizationId,
              ingredient_id: created.id,
              unit_name: u.unit_name,
              amount: u.amount ?? 1,
              calories: u.calories ?? null,
              protein_g: u.protein_g ?? null,
              fat_g: u.fat_g ?? null,
              carbs_g: u.carbs_g ?? null,
              is_default: u.is_default ?? i === 0,
              sort_order: i,
            });
          }
          invalidateIngredients();
          pushUndo({
            description: `הוספת מצרך (AI): ${name}`,
            undo: async () => {
              await food.deleteIngredient(created.id);
              invalidateIngredients();
            },
            redo: () => {},
          });
          return `נוסף מצרך "${name}" עם ${units.length} יחידות.`;
        },
      },
      {
        name: "create_meal",
        label: "יצירת מנה",
        description:
          "Create the final meal once all its ingredients exist in the catalog. Links each ingredient by name to its catalog id. The user approves before it's created.",
        requiresApproval: true,
        input_schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            category: { type: "string" },
            meal_times: { type: "array", items: { type: "string", enum: MEAL_TIME_VALUES } },
            notes: { type: "string" },
            servings: { type: "number" },
            ingredients: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  ingredient_name: { type: "string" },
                  quantity: { type: "number" },
                  unit: { type: "string" },
                },
                required: ["ingredient_name"],
              },
            },
          },
          required: ["name", "ingredients"],
        },
        run: async (input) => {
          const { organizationId, userId } = assertOrgScope(scope);
          const name = String(input.name ?? "").trim();
          if (!name) throw new Error("missing meal name");

          // Re-read the freshest catalog (an ingredient may have just been
          // added in this same conversation).
          const catalog = await food.listIngredients(organizationId);
          const byName = new Map(
            catalog.map((ing) => [ing.name.trim(), ing])
          );

          const reqRows = (input.ingredients as Array<{
            ingredient_name: string;
            quantity?: number;
            unit?: string;
          }>) ?? [];
          const missing: string[] = [];
          const rows = reqRows
            .map((r, i) => {
              const ing = byName.get(String(r.ingredient_name ?? "").trim());
              if (!ing) {
                missing.push(r.ingredient_name);
                return null;
              }
              // Match the requested unit name, else the default/first unit.
              const unit =
                ing.units.find((u) => u.unit_name === r.unit) ??
                ing.units.find((u) => u.is_default) ??
                ing.units[0] ??
                null;
              return {
                ingredient_id: ing.id,
                unit_id: unit?.id ?? null,
                quantity: r.quantity ?? 1,
                sort_order: i,
              };
            })
            .filter((r): r is NonNullable<typeof r> => r !== null);

          if (missing.length > 0) {
            // Refuse rather than silently dropping — the model should add the
            // missing ingredients first.
            return `לא ניתן ליצור את המנה: המצרכים הבאים עדיין לא קיימים בקטלוג — ${missing.join(", ")}. הוסיפי אותם קודם.`;
          }

          const categoryId = await resolveMealCategory(input.category as string | undefined);
          const mealTimes = Array.isArray(input.meal_times)
            ? (input.meal_times as string[]).filter((t) => MEAL_TIME_VALUES.includes(t))
            : [];

          const meal = await food.createMeal({
            organization_id: organizationId,
            owner_id: userId,
            name,
            category_id: categoryId,
            meal_times: mealTimes,
            notes: (input.notes as string) ?? null,
            servings: typeof input.servings === "number" ? input.servings : 1,
          });
          await food.replaceMealIngredients(meal.id, organizationId, rows);
          invalidateMeals();
          pushUndo({
            description: `יצירת מנה (AI): ${name}`,
            undo: async () => {
              await food.deleteMeal(meal.id);
              invalidateMeals();
            },
            redo: () => {},
          });
          return `נוצרה המנה "${name}" עם ${rows.length} מצרכים.`;
        },
      },
    ];

    return {
      id: "food",
      label: "עוזר בישול",
      systemPrompt: SYSTEM_PROMPT,
      buildContext: () => {
        const lines = ingredients.map((ing) => {
          const units = ing.units.map((u) => u.unit_name).filter(Boolean).join(" / ");
          const cat = ing.category_id
            ? ingredientCategories.find((c) => c.id === ing.category_id)?.name
            : null;
          return `- ${ing.name}${units ? ` (${units})` : ""}${cat ? ` [${cat}]` : ""}`;
        });
        return [
          `מצרכים קיימים בקטלוג (${ingredients.length}):`,
          lines.length ? lines.join("\n") : "(הקטלוג ריק)",
        ].join("\n");
      },
      tools,
      starters: [
        "הוסיפי מנה: פסטה שמנת פטריות",
        "הוסיפי מנה: שקשוקה",
        "מה חסר לי כדי להכין סלט יווני?",
      ],
    };
  }, [scope, qc, ingredients, ingredientCategories, mealCategories]);
}
