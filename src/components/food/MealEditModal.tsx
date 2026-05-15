import { useState, useEffect, useMemo, useRef } from "react";
import { X, Plus, Trash2, AlertCircle, ImagePlus, Sparkles, Link2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { CategoryPicker } from "./CategoryPicker";
import { IngredientPicker } from "./IngredientPicker";
import { IngredientEditModal } from "./IngredientEditModal";
import { useOrgScope, assertOrgScope } from "@/lib/hooks/useOrgScope";
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
import { uploadMealImage, type MealWithIngredients } from "@/lib/services/food";
import {
  MEAL_TIME_KEYS,
  MEAL_TIME_LABELS,
  type MealTimeKey,
} from "@/lib/types/domain";
import { computeMealNutrition, round1 } from "@/lib/food/nutrition";
import { useDeleteMeal } from "@/lib/hooks/useFood";
import { pushUndo } from "@/lib/undo/store";

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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [rows, setRows] = useState<RowDraft[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scope = useOrgScope();

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
  const deleteMeal = useDeleteMeal();
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
    setImageError(null);
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
      setImageUrl(meal.image_url ?? null);
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
      setImageUrl(null);
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

  const handleFilePick = async (file: File) => {
    setImageError(null);
    if (!file.type.startsWith("image/")) {
      setImageError("בחרי קובץ תמונה (JPG / PNG / WEBP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError("קובץ גדול מדי (עד 5MB).");
      return;
    }
    setImageUploading(true);
    try {
      const { organizationId } = assertOrgScope(scope);
      const url = await uploadMealImage(organizationId, file);
      setImageUrl(url);
    } catch (e) {
      setImageError(`העלאה נכשלה: ${(e as Error).message}`);
    } finally {
      setImageUploading(false);
    }
  };

  const handlePasteUrl = () => {
    const v = window.prompt("הדביקי קישור (URL) לתמונה:", imageUrl ?? "");
    if (v == null) return;
    const trimmed = v.trim();
    setImageUrl(trimmed || null);
    setImageError(null);
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
      const mealPayload = {
        name: name.trim(),
        category_id: categoryId,
        meal_times: mealTimes,
        notes: notes.trim() || null,
        servings: Number(servings) || 1,
        image_url: imageUrl,
      };
      let mealId: string;
      if (meal) {
        const prevPatch = {
          name: meal.name,
          category_id: meal.category_id,
          meal_times: meal.meal_times,
          notes: meal.notes,
          servings: meal.servings,
          image_url: meal.image_url,
        };
        const prevRows = meal.ingredients.map((mi, i) => ({
          ingredient_id: mi.ingredient_id,
          unit_id: mi.unit_id,
          quantity: mi.quantity,
          sort_order: mi.sort_order ?? i,
        }));
        await updateMeal.mutateAsync({ id: meal.id, patch: mealPayload });
        mealId = meal.id;
        await replaceRows.mutateAsync({ mealId, rows: validRows });
        pushUndo({
          description: `עריכת מנה: ${mealPayload.name}`,
          undo: async () => {
            await updateMeal.mutateAsync({ id: meal.id, patch: prevPatch });
            await replaceRows.mutateAsync({ mealId: meal.id, rows: prevRows });
          },
          redo: async () => {
            await updateMeal.mutateAsync({ id: meal.id, patch: mealPayload });
            await replaceRows.mutateAsync({ mealId: meal.id, rows: validRows });
          },
        });
      } else {
        const created = await createMeal.mutateAsync(mealPayload);
        mealId = created.id;
        await replaceRows.mutateAsync({ mealId, rows: validRows });
        let currentId = created.id;
        pushUndo({
          description: `יצירת מנה: ${mealPayload.name}`,
          undo: () => deleteMeal.mutate(currentId),
          redo: async () => {
            const again = await createMeal.mutateAsync(mealPayload);
            currentId = again.id;
            await replaceRows.mutateAsync({
              mealId: again.id,
              rows: validRows,
            });
          },
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
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
            {/* Image picker — drives the meal photo shown in the meals
                table and (later) the interactive menu cards. */}
            <div>
              <label className="text-xs text-ink-500 mb-1 block">תמונה</label>
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "shrink-0 rounded-md border border-dashed border-ink-300 bg-ink-50 overflow-hidden flex items-center justify-center",
                    "w-28 h-28"
                  )}
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={name || "תמונה"}
                      className="w-full h-full object-cover"
                      onError={() => setImageError("הקישור לא נטען — בדקי שהוא תקין.")}
                    />
                  ) : (
                    <ImagePlus className="w-7 h-7 text-ink-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFilePick(f);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={imageUploading}
                      className="btn-ghost text-xs gap-1"
                    >
                      <ImagePlus className="w-3.5 h-3.5" />
                      {imageUploading ? "מעלה…" : "העלי תמונה"}
                    </button>
                    <button
                      type="button"
                      onClick={handlePasteUrl}
                      disabled={imageUploading}
                      className="btn-ghost text-xs gap-1"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      הדביקי קישור
                    </button>
                    <button
                      type="button"
                      disabled
                      title="בקרוב — הצעת תמונה אוטומטית לפי שם המנה"
                      className="btn-ghost text-xs gap-1 opacity-60 cursor-not-allowed"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      הצע תמונה (בקרוב)
                    </button>
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setImageUrl(null);
                          setImageError(null);
                        }}
                        className="btn-ghost text-xs gap-1 text-danger-600 hover:text-danger-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        הסירי
                      </button>
                    )}
                  </div>
                  {imageError && (
                    <div className="text-[11px] text-danger-600">{imageError}</div>
                  )}
                  <div className="text-[11px] text-ink-500">
                    JPG / PNG / WEBP, עד 5MB. הקובץ נשמר בענן ומוצג בכרטיסיית המנה.
                  </div>
                </div>
              </div>
            </div>

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
              <div className="flex flex-wrap gap-1.5">
                {MEAL_TIME_KEYS.map((t) => {
                  const active = mealTimes.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleMealTime(t)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-medium rounded-md border transition-colors",
                        active
                          ? "bg-ink-900 text-white border-ink-900"
                          : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
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
                      className="border border-ink-200 rounded-md p-2 bg-white space-y-2"
                    >
                      {/* Ingredient picker — full width on all sizes */}
                      <IngredientPicker
                        value={r.ingredientId}
                        onChange={(id) => setRowIngredient(idx, id)}
                        ingredients={ingredients}
                        onCreateNew={(typedName) =>
                          setInlineNew({ rowIdx: idx, name: typedName })
                        }
                      />
                      {/* Quantity + unit + delete in one row */}
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          step="any"
                          min={0}
                          value={r.quantity}
                          onChange={(e) => setRowField(idx, "quantity", e.target.value)}
                          className="field text-sm py-1.5 w-20 shrink-0"
                          placeholder="כמות"
                        />
                        <select
                          value={r.unitId ?? ""}
                          onChange={(e) =>
                            setRowField(idx, "unitId", e.target.value || null)
                          }
                          className="field text-sm py-1.5 flex-1 min-w-0"
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
                            className="p-1.5 rounded-md text-ink-400 hover:text-danger-600 hover:bg-danger-50 shrink-0"
                            title="הסר מצרך"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
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
