import { useMemo, useState } from "react";
import { X, Upload, FileDown, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useOrgScope, assertOrgScope } from "@/lib/hooks/useOrgScope";
import {
  useIngredients,
  useIngredientCategories,
  useMeals,
  useMealCategories,
} from "@/lib/hooks/useFood";
import * as foodService from "@/lib/services/food";
import {
  planIngredientsImport,
  executeIngredientsImport,
  planMealsImport,
  executeMealsImport,
  INGREDIENT_CSV_SAMPLE,
  MEAL_CSV_SAMPLE,
  type IngredientImportResult,
  type MealImportResult,
} from "@/lib/food/csv-import";
import { useQueryClient } from "@tanstack/react-query";
import { queryFamilies } from "@/lib/query-keys";

interface ImportFoodDataModalProps {
  open: boolean;
  onClose: () => void;
}

type Tab = "ingredients" | "meals";

/**
 * Two-tab importer for the food library. The same modal handles
 * ingredients and meals; each tab pastes a CSV in a documented
 * Hebrew-header format and previews what will happen before running.
 *
 * Rule: ADDITIVE ONLY. If a name (case-insensitive) already exists in
 * the org library, the import skips that row entirely — no merging of
 * units onto existing ingredients, no rewriting of meal recipes. Listed
 * in the preview as "skipped" so the user knows.
 */
export function ImportFoodDataModal({ open, onClose }: ImportFoodDataModalProps) {
  const [tab, setTab] = useState<Tab>("ingredients");
  const [csv, setCsv] = useState("");
  const [running, setRunning] = useState(false);
  const [ingredientResult, setIngredientResult] =
    useState<IngredientImportResult | null>(null);
  const [mealResult, setMealResult] = useState<MealImportResult | null>(null);

  const scope = useOrgScope();
  const qc = useQueryClient();
  const { data: existingIngredients = [] } = useIngredients();
  const { data: existingIngredientCategories = [] } = useIngredientCategories();
  const { data: existingMeals = [] } = useMeals();
  const { data: existingMealCategories = [] } = useMealCategories();

  // Derived plan for the current tab — recomputes on csv change.
  const plan = useMemo(() => {
    if (!csv.trim()) return null;
    if (tab === "ingredients") {
      return planIngredientsImport(
        csv,
        existingIngredients.map((i) => i.name)
      );
    }
    // For meals, we resolve ingredient references against existing
    // ingredients only. A two-step flow ("first import ingredients,
    // then meals") is the supported path — meal lines that reference
    // unknown ingredients are flagged and skipped.
    return planMealsImport(
      csv,
      existingMeals.map((m) => m.name),
      existingIngredients.map((i) => i.name)
    );
  }, [csv, tab, existingIngredients, existingMeals]);

  if (!open) return null;

  const switchTab = (next: Tab) => {
    setTab(next);
    setCsv("");
    setIngredientResult(null);
    setMealResult(null);
  };

  const fillSample = () => {
    setCsv(tab === "ingredients" ? INGREDIENT_CSV_SAMPLE : MEAL_CSV_SAMPLE);
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    setCsv(text);
  };

  const handleRun = async () => {
    if (!plan || running) return;
    setRunning(true);
    try {
      const { organizationId, userId } = assertOrgScope(scope);
      if (tab === "ingredients") {
        const ingPlan = plan as ReturnType<typeof planIngredientsImport>;
        const catMap = new Map(
          existingIngredientCategories.map((c) => [
            c.name.trim().toLowerCase(),
            { id: c.id },
          ])
        );
        const result = await executeIngredientsImport(ingPlan, {
          existingCategoriesByName: catMap,
          createCategory: async (name) =>
            foodService.createIngredientCategory({
              organization_id: organizationId,
              name,
            }),
          createIngredient: async (payload) =>
            foodService.createIngredient({
              ...payload,
              organization_id: organizationId,
              owner_id: userId,
            }),
          createUnit: async (payload) => {
            await foodService.createIngredientUnit({
              ...payload,
              organization_id: organizationId,
            });
          },
        });
        setIngredientResult(result);
        // Refresh caches so subsequent meal-import previews see the new
        // ingredients without a manual reload.
        qc.invalidateQueries({
          queryKey: queryFamilies.allIngredients(organizationId),
        });
        qc.invalidateQueries({
          queryKey: queryFamilies.allIngredientCategories(organizationId),
        });
      } else {
        const mealPlan = plan as ReturnType<typeof planMealsImport>;
        const catMap = new Map(
          existingMealCategories.map((c) => [
            c.name.trim().toLowerCase(),
            { id: c.id },
          ])
        );
        const ingResolver = new Map(
          existingIngredients.map((i) => [
            i.name.trim().toLowerCase(),
            {
              id: i.id,
              units: i.units.map((u) => ({
                id: u.id,
                unit_name: u.unit_name,
                is_default: u.is_default,
              })),
            },
          ])
        );
        const result = await executeMealsImport(mealPlan, {
          existingCategoriesByName: catMap,
          ingredientResolver: ingResolver,
          createCategory: async (name) =>
            foodService.createMealCategory({
              organization_id: organizationId,
              name,
            }),
          createMeal: async (payload) =>
            foodService.createMeal({
              ...payload,
              organization_id: organizationId,
              owner_id: userId,
            }),
          createMealIngredient: async (payload) => {
            await foodService.createMealIngredient({
              ...payload,
              organization_id: organizationId,
            });
          },
        });
        setMealResult(result);
        qc.invalidateQueries({
          queryKey: queryFamilies.allMeals(organizationId),
        });
        qc.invalidateQueries({
          queryKey: queryFamilies.allMealCategories(organizationId),
        });
      }
    } finally {
      setRunning(false);
    }
  };

  const ingPlan =
    tab === "ingredients"
      ? (plan as ReturnType<typeof planIngredientsImport> | null)
      : null;
  const mealPlan =
    tab === "meals"
      ? (plan as ReturnType<typeof planMealsImport> | null)
      : null;

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 p-4 border-b border-ink-100">
          <h2 className="text-lg font-semibold text-ink-900 flex items-center gap-2">
            <Upload className="w-5 h-5" />
            ייבוא נתונים
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="px-4 pt-3">
          <nav className="flex items-center gap-1">
            {(
              [
                { id: "ingredients", label: "מצרכים" },
                { id: "meals", label: "מאכלים" },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => switchTab(t.id)}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-md transition-colors",
                  tab === t.id
                    ? "bg-ink-900 text-white"
                    : "text-ink-700 hover:bg-ink-100"
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <div className="flex items-center gap-2 flex-wrap text-xs text-ink-600">
            <span>פורמט מצופה (כותרת בעברית; מפריד: פסיק / נקודה-פסיק / Tab — מזוהה אוטומטית):</span>
            <button
              type="button"
              onClick={fillSample}
              className="inline-flex items-center gap-1 text-primary-700 hover:text-primary-900"
            >
              <FileDown className="w-3 h-3" />
              השתמש בדוגמה
            </button>
            <label className="inline-flex items-center gap-1 text-primary-700 hover:text-primary-900 cursor-pointer">
              <Upload className="w-3 h-3" />
              טען קובץ CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <textarea
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setIngredientResult(null);
              setMealResult(null);
            }}
            rows={8}
            placeholder={
              tab === "ingredients"
                ? INGREDIENT_CSV_SAMPLE.split("\n").slice(0, 2).join("\n")
                : MEAL_CSV_SAMPLE.split("\n").slice(0, 2).join("\n")
            }
            className="field text-xs font-mono whitespace-pre"
          />

          {plan && (
            <PlanPreview
              tab={tab}
              ingPlan={ingPlan}
              mealPlan={mealPlan}
            />
          )}

          {ingredientResult && (
            <ResultBlock>
              נוצרו <strong>{ingredientResult.createdIngredients}</strong> מצרכים
              {", "}
              <strong>{ingredientResult.createdUnits}</strong> יחידות
              {ingredientResult.createdCategories > 0 && (
                <>
                  {" "}, <strong>{ingredientResult.createdCategories}</strong> קטגוריות
                </>
              )}
              {ingredientResult.skipped.length > 0 && (
                <>
                  {" "}· דולגו <strong>{ingredientResult.skipped.length}</strong> שכבר קיימים
                </>
              )}
              .
              {ingredientResult.errors.length > 0 && (
                <ErrorList errors={ingredientResult.errors} />
              )}
            </ResultBlock>
          )}
          {mealResult && (
            <ResultBlock>
              נוצרו <strong>{mealResult.createdMeals}</strong> מאכלים
              {", "}
              <strong>{mealResult.createdLines}</strong> שורות מצרכים
              {mealResult.createdCategories > 0 && (
                <>
                  {" "}, <strong>{mealResult.createdCategories}</strong> קטגוריות
                </>
              )}
              {mealResult.skipped.length > 0 && (
                <>
                  {" "}· דולגו <strong>{mealResult.skipped.length}</strong> מאכלים שכבר קיימים
                </>
              )}
              {mealResult.missingIngredients.length > 0 && (
                <>
                  {" "}· <strong>{mealResult.missingIngredients.length}</strong> מצרכים לא נמצאו
                </>
              )}
              .
              {mealResult.errors.length > 0 && (
                <ErrorList errors={mealResult.errors} />
              )}
            </ResultBlock>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 p-4 border-t border-ink-100">
          <button type="button" onClick={onClose} className="btn-ghost">
            סגור
          </button>
          <button
            type="button"
            onClick={handleRun}
            disabled={
              !plan ||
              running ||
              (ingPlan && ingPlan.toCreate.length === 0) ||
              (mealPlan && mealPlan.toCreate.length === 0)
                ? true
                : false
            }
            className="btn-dark gap-1.5"
          >
            <Check className="w-4 h-4" />
            {running ? "מייבא..." : "אישור וייבוא"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function PlanPreview({
  tab,
  ingPlan,
  mealPlan,
}: {
  tab: Tab;
  ingPlan: ReturnType<typeof planIngredientsImport> | null;
  mealPlan: ReturnType<typeof planMealsImport> | null;
}) {
  if (tab === "ingredients" && ingPlan) {
    return (
      <div className="rounded-md border border-ink-200 bg-ink-50/40 p-3 text-xs space-y-1.5">
        <div className="font-medium text-ink-900">תצוגה מקדימה:</div>
        <div>
          ייווצרו: <strong>{ingPlan.toCreate.length}</strong> מצרכים חדשים
          {ingPlan.toCreate.length > 0 && (
            <span className="text-ink-500">
              {" "}({ingPlan.toCreate.reduce((s, x) => s + x.units.length, 0)} יחידות)
            </span>
          )}
        </div>
        {ingPlan.toSkip.length > 0 && (
          <div className="text-amber-700">
            דולגים (כבר קיימים): <strong>{ingPlan.toSkip.length}</strong>
            <span className="text-ink-500"> — {ingPlan.toSkip.slice(0, 5).join(", ")}{ingPlan.toSkip.length > 5 ? "…" : ""}</span>
          </div>
        )}
        {ingPlan.errors.length > 0 && <ErrorList errors={ingPlan.errors} />}
      </div>
    );
  }
  if (tab === "meals" && mealPlan) {
    return (
      <div className="rounded-md border border-ink-200 bg-ink-50/40 p-3 text-xs space-y-1.5">
        <div className="font-medium text-ink-900">תצוגה מקדימה:</div>
        <div>
          ייווצרו: <strong>{mealPlan.toCreate.length}</strong> מאכלים חדשים
        </div>
        {mealPlan.toSkip.length > 0 && (
          <div className="text-amber-700">
            דולגים (כבר קיימים): <strong>{mealPlan.toSkip.length}</strong>
            <span className="text-ink-500"> — {mealPlan.toSkip.slice(0, 5).join(", ")}{mealPlan.toSkip.length > 5 ? "…" : ""}</span>
          </div>
        )}
        {mealPlan.missingIngredients.length > 0 && (
          <div className="text-amber-700 flex items-start gap-1">
            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
            <span>
              לא נמצאו במצרכים: <strong>{mealPlan.missingIngredients.length}</strong> —{" "}
              {mealPlan.missingIngredients.slice(0, 5).join(", ")}
              {mealPlan.missingIngredients.length > 5 ? "…" : ""}
              <br />
              ייבאי קודם את המצרכים בלשונית "מצרכים", אז את המאכלים יחולקו אליהם.
            </span>
          </div>
        )}
        {mealPlan.errors.length > 0 && <ErrorList errors={mealPlan.errors} />}
      </div>
    );
  }
  return null;
}

function ResultBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 text-emerald-900 px-3 py-2 text-sm">
      {children}
    </div>
  );
}

function ErrorList({ errors }: { errors: string[] }) {
  return (
    <ul className="mt-1 text-[11px] text-danger-600 list-disc list-inside space-y-0.5">
      {errors.slice(0, 5).map((e, i) => (
        <li key={i}>{e}</li>
      ))}
      {errors.length > 5 && <li>...ועוד {errors.length - 5}</li>}
    </ul>
  );
}
