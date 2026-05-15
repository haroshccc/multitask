import { useState, useMemo, useRef } from "react";
import { Plus, Pencil, Trash2, AlertCircle, PanelRightOpen, PanelRightClose, Camera } from "lucide-react";
import {
  useMeals,
  useDeleteMeal,
  useMealCategories,
  useIngredients,
  useUpdateMeal,
  useCreateMeal,
  useReplaceMealIngredients,
} from "@/lib/hooks/useFood";
import { pushUndo } from "@/lib/undo/store";
import { MealEditModal } from "./MealEditModal";
import { IngredientsTab } from "./IngredientsTab";
import { uploadMealImage, type MealWithIngredients } from "@/lib/services/food";
import { useOrgScope } from "@/lib/hooks/useOrgScope";
import {
  MEAL_TIME_KEYS,
  MEAL_TIME_LABELS,
  type MealTimeKey,
} from "@/lib/types/domain";
import { computeMealNutrition, round1 } from "@/lib/food/nutrition";

interface MealsTabProps {
  ingredientsPanelOpen: boolean;
  onToggleIngredientsPanel: () => void;
}

export function MealsTab({
  ingredientsPanelOpen,
  onToggleIngredientsPanel,
}: MealsTabProps) {
  const { data: meals = [], isLoading } = useMeals();
  const { data: categories = [] } = useMealCategories();
  const { data: ingredients = [] } = useIngredients();
  const deleteMeal = useDeleteMeal();
  const createMeal = useCreateMeal();
  const replaceIngredients = useReplaceMealIngredients();

  const updateMeal = useUpdateMeal();
  const scope = useOrgScope();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingMealId, setUploadingMealId] = useState<string | null>(null);

  const handleImageClick = (mealId: string) => {
    setUploadingMealId(mealId);
    fileInputRef.current?.click();
  };

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingMealId || !scope.organizationId) return;
    e.target.value = "";
    const mealId = uploadingMealId;
    const prevUrl = meals.find((m) => m.id === mealId)?.image_url ?? null;
    try {
      const url = await uploadMealImage(scope.organizationId, file);
      await updateMeal.mutateAsync({ id: mealId, patch: { image_url: url } });
      pushUndo({
        description: "החלפת תמונת מנה",
        undo: () =>
          updateMeal.mutate({ id: mealId, patch: { image_url: prevUrl } }),
        redo: () =>
          updateMeal.mutate({ id: mealId, patch: { image_url: url } }),
      });
    } catch {
      // silent
    } finally {
      setUploadingMealId(null);
    }
  };

  const [editing, setEditing] = useState<MealWithIngredients | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | "all">("all");
  const [filterMealTime, setFilterMealTime] = useState<MealTimeKey | "all">("all");
  const [search, setSearch] = useState("");

  const ingredientsById = useMemo(
    () => new Map(ingredients.map((i) => [i.id, i])),
    [ingredients]
  );
  const unitsById = useMemo(() => {
    const m = new Map();
    for (const i of ingredients) for (const u of i.units) m.set(u.id, u);
    return m;
  }, [ingredients]);
  const categoriesById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return meals.filter((m) => {
      if (filterCategory !== "all" && m.category_id !== filterCategory) return false;
      if (filterMealTime !== "all" && !m.meal_times.includes(filterMealTime)) return false;
      if (q && !m.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [meals, filterCategory, filterMealTime, search]);

  const openEdit = (m: MealWithIngredients) => {
    setEditing(m);
    setModalOpen(true);
  };

  const confirmDelete = async (m: MealWithIngredients) => {
    if (!confirm(`למחוק את "${m.name}"?`)) return;
    const snapshot = {
      name: m.name,
      category_id: m.category_id,
      meal_times: m.meal_times,
      image_url: m.image_url,
      notes: m.notes,
    };
    const ingredientRows = m.ingredients.map((mi, i) => ({
      ingredient_id: mi.ingredient_id,
      unit_id: mi.unit_id,
      quantity: mi.quantity,
      sort_order: mi.sort_order ?? i,
    }));
    let currentId = m.id;
    await deleteMeal.mutateAsync(currentId);
    pushUndo({
      description: `מחיקת מנה: ${m.name}`,
      undo: async () => {
        const recreated = await createMeal.mutateAsync(snapshot);
        currentId = recreated.id;
        if (ingredientRows.length > 0) {
          await replaceIngredients.mutateAsync({
            mealId: recreated.id,
            rows: ingredientRows,
          });
        }
      },
      redo: () => deleteMeal.mutate(currentId),
    });
  };

  return (
    <div className="flex gap-4">
      <div className="flex-1 min-w-0 space-y-3">
        {/* ── Toolbar ── */}
        <div className="card p-2">
          {/* Row 1: search + action buttons */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חיפוש מנה..."
              className="field text-sm py-1.5 flex-1 min-w-0"
            />
            {/* Filters inline on sm+ */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="hidden sm:block field text-sm py-1.5 w-36"
            >
              <option value="all">כל הקטגוריות</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={filterMealTime}
              onChange={(e) => setFilterMealTime(e.target.value as MealTimeKey | "all")}
              className="hidden sm:block field text-sm py-1.5 w-32"
            >
              <option value="all">כל הזמנים</option>
              {MEAL_TIME_KEYS.map((t) => (
                <option key={t} value={t}>{MEAL_TIME_LABELS[t]}</option>
              ))}
            </select>
            <div className="flex items-center gap-1.5 ms-auto sm:ms-0">
              <button
                type="button"
                onClick={onToggleIngredientsPanel}
                className="btn-ghost text-xs gap-1.5 hidden sm:inline-flex"
                title={ingredientsPanelOpen ? "סגור פאנל מצרכים" : "פתח פאנל מצרכים"}
              >
                {ingredientsPanelOpen ? (
                  <PanelRightClose className="w-4 h-4" />
                ) : (
                  <PanelRightOpen className="w-4 h-4" />
                )}
                <span className="hidden md:inline">מצרכים</span>
              </button>
              <button
                type="button"
                onClick={() => { setEditing(null); setModalOpen(true); }}
                className="btn-dark text-sm gap-1.5 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden xs:inline">מנה חדשה</span>
                <span className="xs:hidden">חדשה</span>
              </button>
            </div>
          </div>
          {/* Row 2 mobile-only: filters */}
          <div className="flex items-center gap-2 mt-1.5 sm:hidden">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="field text-sm py-1.5 flex-1"
            >
              <option value="all">כל הקטגוריות</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={filterMealTime}
              onChange={(e) => setFilterMealTime(e.target.value as MealTimeKey | "all")}
              className="field text-sm py-1.5 flex-1"
            >
              <option value="all">כל הזמנים</option>
              {MEAL_TIME_KEYS.map((t) => (
                <option key={t} value={t}>{MEAL_TIME_LABELS[t]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Mobile: card list ── */}
        <div className="sm:hidden space-y-2">
          {isLoading ? (
            <div className="card p-6 text-center text-ink-400">טוען...</div>
          ) : filtered.length === 0 ? (
            <div className="card p-8 text-center text-ink-400">
              {meals.length === 0
                ? "עוד אין מנות. לחץ + מנה חדשה כדי להוסיף את הראשונה."
                : "אין מנות שתואמות לסינון."}
            </div>
          ) : (
            filtered.map((m) => {
              const cat = m.category_id ? categoriesById.get(m.category_id) : null;
              const totals = computeMealNutrition(
                m.ingredients.map((mi) => ({
                  ingredient_id: mi.ingredient_id,
                  unit_id: mi.unit_id,
                  quantity: Number(mi.quantity) || 0,
                })),
                unitsById,
                (id) => {
                  const i = ingredientsById.get(id);
                  return i?.units.find((u) => u.is_default) ?? i?.units[0];
                }
              );
              return (
                <div key={m.id} className="card p-3">
                  <div className="flex items-start gap-3">
                    {/* Thumbnail */}
                    <button
                      type="button"
                      onClick={() => handleImageClick(m.id)}
                      title="לחץ להוספה/החלפה של תמונה"
                      className="relative w-14 h-14 rounded-md shrink-0 overflow-hidden border border-ink-200 group"
                    >
                      {uploadingMealId === m.id ? (
                        <div className="w-full h-full bg-ink-100 flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : m.image_url ? (
                        <>
                          <img src={m.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Camera className="w-4 h-4 text-white" />
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full bg-ink-100 flex items-center justify-center text-ink-400 group-hover:bg-ink-200 transition-colors">
                          <Camera className="w-4 h-4" />
                        </div>
                      )}
                    </button>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="font-medium text-ink-900 leading-snug">{m.name}</span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEdit(m)}
                            className="p-1.5 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100"
                            title="ערוך"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => confirmDelete(m)}
                            className="p-1.5 rounded-md text-ink-400 hover:text-danger-600 hover:bg-danger-50"
                            title="מחק"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 mb-1.5">
                        {cat && (
                          <span className="inline-flex items-center gap-1 text-[11px] bg-ink-100 text-ink-700 rounded-md px-1.5 py-0.5">
                            {cat.color && (
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                            )}
                            {cat.name}
                          </span>
                        )}
                        {(m.meal_times as MealTimeKey[]).map((t) => (
                          <span key={t} className="text-[10px] bg-primary-50 text-primary-700 rounded-md px-1.5 py-0.5">
                            {MEAL_TIME_LABELS[t] ?? t}
                          </span>
                        ))}
                      </div>
                      {/* Nutrition mini row */}
                      <div className="flex items-center gap-3 text-xs text-ink-600">
                        <MiniStat label="קל'" value={round1(totals.calories)} />
                        <MiniStat label="חלבון" value={round1(totals.protein_g)} />
                        <MiniStat label="שומן" value={round1(totals.fat_g)} />
                        <span className="flex items-center gap-0.5">
                          <MiniStat label="פחמ'" value={round1(totals.carbs_g)} />
                          {totals.hasMissing && <AlertCircle className="w-3 h-3 text-amber-500 ms-0.5" />}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Desktop: table ── */}
        <div className="hidden sm:block card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-ink-50/60 text-xs text-ink-500">
              <tr>
                <th className="text-start p-2 font-medium">שם</th>
                <th className="text-start p-2 font-medium">קטגוריה</th>
                <th className="text-start p-2 font-medium">זמני יום</th>
                <th className="text-start p-2 font-medium">מצרכים</th>
                <th className="text-start p-2 font-medium">קל'</th>
                <th className="text-start p-2 font-medium">חלבון</th>
                <th className="text-start p-2 font-medium">שומן</th>
                <th className="text-start p-2 font-medium">פחמ'</th>
                <th className="text-start p-2 font-medium w-px" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-ink-400">טוען...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-ink-400">
                    {meals.length === 0
                      ? "עוד אין מנות. לחץ + מנה חדשה כדי להוסיף את הראשונה."
                      : "אין מנות שתואמות לסינון."}
                  </td>
                </tr>
              ) : (
                filtered.map((m) => {
                  const cat = m.category_id ? categoriesById.get(m.category_id) : null;
                  const totals = computeMealNutrition(
                    m.ingredients.map((mi) => ({
                      ingredient_id: mi.ingredient_id,
                      unit_id: mi.unit_id,
                      quantity: Number(mi.quantity) || 0,
                    })),
                    unitsById,
                    (id) => {
                      const i = ingredientsById.get(id);
                      return i?.units.find((u) => u.is_default) ?? i?.units[0];
                    }
                  );
                  return (
                    <tr key={m.id} className="border-t border-ink-100 hover:bg-ink-50/40">
                      <td className="p-2 font-medium text-ink-900">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleImageClick(m.id)}
                            title="לחץ להוספה/החלפה של תמונה"
                            className="relative w-10 h-10 rounded-md shrink-0 overflow-hidden border border-ink-200 group"
                          >
                            {uploadingMealId === m.id ? (
                              <div className="w-full h-full bg-ink-100 flex items-center justify-center">
                                <div className="w-4 h-4 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                              </div>
                            ) : m.image_url ? (
                              <>
                                <img src={m.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <Camera className="w-4 h-4 text-white" />
                                </div>
                              </>
                            ) : (
                              <div className="w-full h-full bg-ink-100 flex items-center justify-center text-ink-400 group-hover:bg-ink-200 transition-colors">
                                <Camera className="w-4 h-4" />
                              </div>
                            )}
                          </button>
                          <span className="truncate">{m.name}</span>
                        </div>
                      </td>
                      <td className="p-2">
                        {cat ? (
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            {cat.color && (
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                            )}
                            {cat.name}
                          </span>
                        ) : (
                          <span className="text-ink-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {m.meal_times.length === 0 && (
                            <span className="text-ink-400 text-xs">—</span>
                          )}
                          {(m.meal_times as MealTimeKey[]).map((t) => (
                            <span key={t} className="text-[10px] bg-ink-100 text-ink-700 rounded-md px-1.5 py-0.5">
                              {MEAL_TIME_LABELS[t] ?? t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-2 text-xs text-ink-600">
                        {m.ingredients.length === 0 ? (
                          <span className="text-ink-400">—</span>
                        ) : (
                          <span className="line-clamp-1 max-w-xs inline-block">
                            {m.ingredients
                              .map((mi) => ingredientsById.get(mi.ingredient_id)?.name)
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        )}
                      </td>
                      <td className="p-2 tabular-nums">{round1(totals.calories)}</td>
                      <td className="p-2 tabular-nums">{round1(totals.protein_g)}</td>
                      <td className="p-2 tabular-nums">{round1(totals.fat_g)}</td>
                      <td className="p-2 tabular-nums">
                        <span className="flex items-center gap-1">
                          {round1(totals.carbs_g)}
                          {totals.hasMissing && <AlertCircle className="w-3 h-3 text-amber-500" />}
                        </span>
                      </td>
                      <td className="p-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEdit(m)}
                          className="p-1.5 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100"
                          title="ערוך"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmDelete(m)}
                          className="p-1.5 rounded-md text-ink-400 hover:text-danger-600 hover:bg-danger-50"
                          title="מחק"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {ingredientsPanelOpen && (
        <aside className="shrink-0 w-full max-w-sm lg:max-w-md xl:max-w-lg hidden sm:block">
          <div className="card p-3 sticky top-2 max-h-[calc(100vh-7rem)] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-ink-900">פאנל מצרכים</h3>
              <button
                type="button"
                onClick={onToggleIngredientsPanel}
                className="p-1 rounded text-ink-400 hover:text-ink-900 hover:bg-ink-100"
                title="סגור"
              >
                <PanelRightClose className="w-4 h-4" />
              </button>
            </div>
            <IngredientsTab compact />
          </div>
        </aside>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFile}
      />

      <MealEditModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        meal={editing}
      />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <span className="tabular-nums">
      <span className="font-medium text-ink-900">{value}</span>
      <span className="text-ink-400 text-[10px] ms-0.5">{label}</span>
    </span>
  );
}
