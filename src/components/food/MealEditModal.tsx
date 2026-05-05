import { useState, useEffect, useMemo } from "react";
import { X, Plus, Trash2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { CategoryPicker } from "./CategoryPicker";
import { IngredientPicker } from "./IngredientPicker";
import { IngredientEditModal } from "./IngredientEditModal";
import {
  useMealCategories,
  useCreateMealCategory,
  useUpdateMealCategory,
  useDeleteMealCategory,
  useIngredients,
  useCreateMeal,
  useUpdateMeal,
  useReplaceMealIngredients,
} from "@/lib/hooks/useFood";
import type { MealWithIngredients } from "@/lib/services/food";
import {
  MEAL_TIME_KEYS,
  MEAL_TIME_LABELS,
  type MealTimeKey,
} from "@/lib/types/domain";
import { computeMealNutrition, round1 } from "@/lib/food/nutrition";

interface MealEditModalProps {
  open: boolean;
  onClose: () => void;
  /** When provided, edit mode; otherwise create mode. */
  meal?: MealWithIngredients | null;
}

interface RowDraft {
  /** Existing meal_ingredient row id, if any. New rows leave this empty. */
  rowId: string;
  ingredientId: string | null;
  unitId: string | null;
  quantity: string;
}

const emptyRow = (): RowDraft => ({
  rowId: "",
  ingredientId: null,
  unitId: null,
  quantity: "1",
});

export function MealEditModal({ open, onClose, meal }: MealEditModalProps) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [mealTimes, setMealTimes] = useState<MealTimeKey[]>([]);
  const [notes, setNotes] = useState("");
  const [servings, setServings] = useState("1");
  const [rows, setRows] = useState<RowDraft[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);

  // Inline-create state — when the picker fires onCreateNew, we open the
  // ingredient editor pre-filled and remember which row triggered it so we
  // can wire the new id back when it returns.
  const [inlineNew, setInlineNew] = useState<{ rowIdx: number; name: string } | null>(
    null
  );

  const { data: categories = [] } = useMealCategories();
  const createCategory = useCreateMealCategory();
  const renameCategory = useUpdateMealCategory();
  const deleteCategory = useDeleteMealCategory();
  const { data: ingredients = [] } = useIngredients();
  const createMeal = useCreateMeal();
  const updateMeal = useUpdateMeal();
  const replaceRows = useReplaceMealIngredients();

  const ingredientsById = useMemo(
    () => new Map(ingredients.map((i) => [i.id, i])),
    [ingredients]
  );
  const unitsById = useMemo(() => {
    const m = new Map();
    for (const i of ingredients) for (const u of i.units) m.set(u.id, u);
    return m;
  }, [ingredients]);

  useEffect(() => {
    if (!open) return;
    if (meal) {
      setName(meal.name);
      setCategoryId(meal.category_id);
      setMealTimes(
        (meal.meal_times ?? []).filter((t): t is MealTimeKey =>
          (MEAL_TIME_KEYS as readonly string[]).includes(t)
        )
      );
      setNotes(meal.notes ?? "");
      setServings(String(meal.servings ?? 1));
      setRows(
        meal.ingredients.length > 0
          ? meal.ingredients.map((mi) => ({
              rowId: mi.id,
              ingredientId: mi.ingredient_id,
              unitId: mi.unit_id,
              quantity: String(mi.quantity ?? 1),
            }))
          : [emptyRow()]
      );
    } else {
      setName("");
      setCategoryId(null);
      setMealTimes([]);
      setNotes("");
      setServings("1");
      setRows([emptyRow()]);
    }
  }, [open, meal]);

  // Live nutrition preview — re-computed on every change. MUST stay above
  // the `if (!open)` early return so the hooks order is stable.
  const totals = useMemo(() => {
    return computeMealNutrition(
      rows
        .filter((r) => r.ingredientId)
        .map((r) => ({
          ingredient_id: r.ingredientId!,
          unit_id: r.unitId,
          quantity: Number(r.quantity) || 0,
        })),
      unitsById,
      (ingredientId) => {
        const i = ingredientsById.get(ingredientId);
        return i?.units.find((u) => u.is_default) ?? i?.units[0];
      }
    );
  }, [rows, unitsById, ingredientsById]);

  if (!open) return null;

  const toggleMealTime = (t: MealTimeKey) => {
    setMealTimes((arr) => (arr.includes(t) ? arr.filter((x) => x !== t) : [...arr, t]));
  };

  const setRowField = <K extends keyof RowDraft>(idx: number, key: K, val: RowDraft[K]) => {
    setRows((arr) => {
      const next = [...arr];
      next[idx] = { ...next[idx], [key]: val };
      return next;
    });
  };

  const setRowIngredient = (idx: number, ingredientId: string) => {
    const ing = ingredientsById.get(ingredientId);
    const defaultUnit = ing?.units.find((u) => u.is_default) ?? ing?.units[0];
    setRows((arr) => {
      const next = [...arr];
      next[idx] = {
        ...next[idx],
        ingredientId,
        unitId: defaultUnit?.id ?? null,
      };
      return next;
    });
  };

  const addRow = () => setRows((arr) => [...arr, emptyRow()]);

  const removeRow = (idx: number) => {
    setRows((arr) => (arr.length === 1 ? arr : arr.filter((_, i) => i !== idx)));
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const validRows = rows
        .filter((r) => r.ingredientId)
        .map((r, i) => ({
          ingredient_id: r.ingredientId!,
          unit_id: r.unitId,
          quantity: Number(r.quantity) || 0,
          sort_order: i,
        }));
      let mealId: string;
      if (meal) {
        await updateMeal.mutateAsync({
          id: meal.id,
          patch: {
            name: name.trim(),
            category_id: categoryId,
            meal_times: mealTimes,
            notes: notes.trim() || null,
            servings: Number(servings) || 1,
          },
        });
        mealId = meal.id;
      } else {
        const created = await createMeal.mutateAsync({
          name: name.trim(),
          category_id: categoryId,
          meal_times: mealTimes,
          notes: notes.trim() || null,
          servings: Number(servings) || 1,
        });
        mealId = created.id;
      }
      await replaceRows.mutateAsync({ mealId, rows: validRows });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
        dir="rtl"
      >
        <div
          className="bg-white rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-center justify-between gap-2 p-4 border-b border-ink-100">
            <h2 className="text-lg font-semibold text-ink-900">
              {meal ? "עריכת מנה" : "מנה חדשה"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-ink-500 mb-1 block">שם המנה</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field text-sm"
                  placeholder="לדוגמה: שקשוקה"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-ink-500 mb-1 block">קטגוריה</label>
                <CategoryPicker
                  value={categoryId}
                  onChange={setCategoryId}
                  options={categories}
                  onCreate={async (n) => {
                    const c = await createCategory.mutateAsync({ name: n });
                    return { id: c.id };
                  }}
                  onRename={async (id, n) => {
                    await renameCategory.mutateAsync({ id, patch: { name: n } });
                  }}
                  onDelete={async (id) => {
                    await deleteCategory.mutateAsync(id);
                  }}
                  noneLabel="ללא קטגוריה"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-ink-500 mb-1 block">שייך לזמני יום</label>
              <div className="inline-flex rounded-md border border-ink-200 overflow-hidden bg-white">
                {MEAL_TIME_KEYS.map((t) => {
                  const active = mealTimes.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleMealTime(t)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium border-e border-ink-200 last:border-e-0",
                        active ? "bg-ink-900 text-white" : "bg-white text-ink-700 hover:bg-ink-50"
                      )}
                    >
                      {MEAL_TIME_LABELS[t]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-ink-500">מצרכים</label>
                <button
                  type="button"
                  onClick={addRow}
                  className="inline-flex items-center gap-1 text-xs text-primary-700 hover:text-primary-900"
                >
                  <Plus className="w-3 h-3" />
                  הוסף מצרך
                </button>
              </div>
              <div className="space-y-2">
                {rows.map((r, idx) => {
                  const ing = r.ingredientId ? ingredientsById.get(r.ingredientId) : null;
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-2 border border-ink-200 rounded-md p-2 bg-white"
                    >
                      <div className="flex-1 min-w-0">
                        <IngredientPicker
                          value={r.ingredientId}
                          onChange={(id) => setRowIngredient(idx, id)}
                          ingredients={ingredients}
                          onCreateNew={(typedName) =>
                            setInlineNew({ rowIdx: idx, name: typedName })
                          }
                        />
                      </div>
                      <input
                        type="number"
                        step="any"
                        min={0}
                        value={r.quantity}
                        onChange={(e) => setRowField(idx, "quantity", e.target.value)}
                        className="field text-sm py-1.5 w-20"
                        placeholder="כמות"
                      />
                      <select
                        value={r.unitId ?? ""}
                        onChange={(e) =>
                          setRowField(idx, "unitId", e.target.value || null)
                        }
                        className="field text-sm py-1.5 w-28"
                        disabled={!ing || ing.units.length === 0}
                      >
                        {(!ing || ing.units.length === 0) && (
                          <option value="">— יחידה —</option>
                        )}
                        {ing?.units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.unit_name || "—"}
                          </option>
                        ))}
                      </select>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="p-1.5 rounded-md text-ink-400 hover:text-danger-600 hover:bg-danger-50"
                          title="הסר מצרך"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
              <div>
                <label className="text-xs text-ink-500 mb-1 block">מספר מנות</label>
                <input
                  type="number"
                  step="any"
                  min={0}
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  className="field text-sm"
                />
              </div>
              <div className="rounded-md border border-ink-200 bg-ink-50/40 p-3">
                <div className="text-[11px] text-ink-500 mb-1.5 flex items-center gap-1">
                  ערכים תזונתיים (סך הכל)
                  {totals.hasMissing && (
                    <span className="inline-flex items-center gap-0.5 text-amber-600">
                      <AlertCircle className="w-3 h-3" />
                      חלקי
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <Stat label="קל'" value={round1(totals.calories)} />
                  <Stat label="חלבון" value={round1(totals.protein_g)} />
                  <Stat label="שומן" value={round1(totals.fat_g)} />
                  <Stat label="פחמ'" value={round1(totals.carbs_g)} />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs text-ink-500 mb-1 block">הערות / אופן הכנה</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="field text-sm"
                placeholder="לא חובה"
              />
            </div>
          </div>

          <footer className="flex items-center justify-end gap-2 p-4 border-t border-ink-100">
            <button type="button" onClick={onClose} className="btn-ghost">
              ביטול
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!name.trim() || saving}
              className="btn-dark"
            >
              {saving ? "שומר..." : "שמור"}
            </button>
          </footer>
        </div>
      </div>

      {/* Inline ingredient creation. After creation, the new id is wired
          back into the row that triggered the flow. */}
      <IngredientEditModal
        open={!!inlineNew}
        onClose={() => setInlineNew(null)}
        initialName={inlineNew?.name}
        onCreated={(newId) => {
          if (inlineNew == null) return;
          // Defer to next tick so the ingredients list refresh completes.
          setTimeout(() => setRowIngredient(inlineNew.rowIdx, newId), 0);
        }}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-base font-semibold text-ink-900">{value}</div>
      <div className="text-[10px] text-ink-500">{label}</div>
    </div>
  );
}
