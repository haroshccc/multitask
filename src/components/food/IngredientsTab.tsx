import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useIngredients,
  useIngredientCategories,
  useDeleteIngredient,
  useCreateIngredient,
  useCreateIngredientUnit,
} from "@/lib/hooks/useFood";
import { IngredientEditModal } from "./IngredientEditModal";
import type { IngredientWithUnits } from "@/lib/services/food";
import { pushUndo } from "@/lib/undo/store";

interface IngredientsTabProps {
  /** Compact mode trims the toolbar / column count for use as a side panel. */
  compact?: boolean;
}

export function IngredientsTab({ compact = false }: IngredientsTabProps) {
  const { data: ingredients = [], isLoading } = useIngredients();
  const { data: categories = [] } = useIngredientCategories();
  const deleteIngredient = useDeleteIngredient();
  const createIngredient = useCreateIngredient();
  const createUnit = useCreateIngredientUnit();

  const [editing, setEditing] = useState<IngredientWithUnits | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string | "all">("all");
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [search, setSearch] = useState("");

  const categoriesById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ingredients.filter((i) => {
      if (filterCategory !== "all" && i.category_id !== filterCategory) return false;
      if (showIncompleteOnly && i.is_complete) return false;
      if (q && !i.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ingredients, filterCategory, showIncompleteOnly, search]);

  const incompleteCount = useMemo(
    () => ingredients.filter((i) => !i.is_complete).length,
    [ingredients]
  );

  const openEdit = (i: IngredientWithUnits) => {
    setEditing(i);
    setModalOpen(true);
  };

  const confirmDelete = async (i: IngredientWithUnits) => {
    if (!confirm(`למחוק את "${i.name}"?`)) return;
    const ingredientSnapshot = {
      name: i.name,
      category_id: i.category_id,
      calories: i.calories,
      protein_g: i.protein_g,
      fat_g: i.fat_g,
      carbs_g: i.carbs_g,
      base_quantity: i.base_quantity,
      base_unit: i.base_unit,
      notes: i.notes,
      is_complete: i.is_complete,
    };
    const unitSnapshots = i.units.map((u) => ({
      name: u.name,
      grams_per_unit: u.grams_per_unit,
      is_default: u.is_default,
      sort_order: u.sort_order,
    }));
    let currentId = i.id;
    await deleteIngredient.mutateAsync(currentId);
    pushUndo({
      description: `מחיקת מצרך: ${i.name}`,
      undo: async () => {
        const recreated = await createIngredient.mutateAsync(ingredientSnapshot);
        currentId = recreated.id;
        for (const u of unitSnapshots) {
          await createUnit.mutateAsync({ ingredient_id: recreated.id, ...u });
        }
      },
      redo: () => deleteIngredient.mutate(currentId),
    });
  };

  return (
    <div className="space-y-3">
      {/* ── Toolbar ── */}
      <div className={cn(!compact && "card p-2")}>
        {/* Row 1: search + add button */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש מצרך..."
            className={cn("field text-sm py-1.5 flex-1 min-w-0", compact ? "" : "")}
          />
          {/* Category filter inline on sm+ (non-compact) */}
          {!compact && (
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
          )}
          <label className="hidden sm:inline-flex items-center gap-1.5 text-xs text-ink-700 select-none cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={showIncompleteOnly}
              onChange={(e) => setShowIncompleteOnly(e.target.checked)}
              className="w-3.5 h-3.5"
            />
            רק לא שלם
            {incompleteCount > 0 && (
              <span className="bg-amber-100 text-amber-800 text-[10px] rounded-md px-1.5 py-0.5">
                {incompleteCount}
              </span>
            )}
          </label>
          <button
            type="button"
            onClick={() => { setEditing(null); setModalOpen(true); }}
            className={cn(
              "text-sm gap-1.5 whitespace-nowrap",
              compact ? "btn-ghost text-xs" : "btn-dark ms-auto sm:ms-0"
            )}
          >
            <Plus className="w-4 h-4" />
            {compact ? "מצרך" : "מצרך חדש"}
          </button>
        </div>

        {/* Row 2 mobile-only (non-compact): category filter + incomplete toggle */}
        {!compact && (
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
            <label className="inline-flex items-center gap-1.5 text-xs text-ink-700 select-none cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={showIncompleteOnly}
                onChange={(e) => setShowIncompleteOnly(e.target.checked)}
                className="w-3.5 h-3.5"
              />
              לא שלם
              {incompleteCount > 0 && (
                <span className="bg-amber-100 text-amber-800 text-[10px] rounded-md px-1.5 py-0.5">
                  {incompleteCount}
                </span>
              )}
            </label>
          </div>
        )}
      </div>

      {/* ── Mobile card list (non-compact full view) ── */}
      {!compact && (
        <div className="sm:hidden space-y-2">
          {isLoading ? (
            <div className="card p-6 text-center text-ink-400">טוען...</div>
          ) : filtered.length === 0 ? (
            <div className="card p-6 text-center text-ink-400">
              {ingredients.length === 0
                ? "עוד אין מצרכים. לחץ + מצרך חדש."
                : "אין מצרכים שתואמים לסינון."}
            </div>
          ) : (
            filtered.map((i) => {
              const cat = i.category_id ? categoriesById.get(i.category_id) : null;
              const defaultUnit = i.units.find((u) => u.is_default) ?? i.units[0];
              return (
                <div key={i.id} className="card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-1.5 min-w-0">
                      {!i.is_complete && (
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="font-medium text-ink-900 truncate">{i.name}</div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-ink-500">
                          {cat && (
                            <span className="inline-flex items-center gap-1">
                              {cat.color && (
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                              )}
                              {cat.name}
                            </span>
                          )}
                          {i.units.length > 0 && (
                            <span>{i.units.map((u) => u.unit_name).filter(Boolean).join(" / ")}</span>
                          )}
                          {defaultUnit?.calories != null && (
                            <span>{defaultUnit.calories} קל' / {defaultUnit.amount} {defaultUnit.unit_name ?? ""}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(i)}
                        className="p-1.5 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100"
                        title="ערוך"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmDelete(i)}
                        className="p-1.5 rounded-md text-ink-400 hover:text-danger-600 hover:bg-danger-50"
                        title="מחק"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Table (desktop full, or compact panel at all sizes) ── */}
      <div className={cn(compact ? "" : "hidden sm:block card", "overflow-x-auto")}>
        <table className="w-full text-sm">
          <thead className="bg-ink-50/60 text-xs text-ink-500">
            <tr>
              <th className="text-start p-2 font-medium">שם</th>
              {!compact && <th className="text-start p-2 font-medium">קטגוריה</th>}
              <th className="text-start p-2 font-medium">יחידות</th>
              {!compact && <th className="text-start p-2 font-medium">קל'</th>}
              <th className="text-start p-2 font-medium w-px" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={compact ? 3 : 5} className="p-6 text-center text-ink-400">
                  טוען...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={compact ? 3 : 5} className="p-6 text-center text-ink-400">
                  {ingredients.length === 0
                    ? "עוד אין מצרכים. לחץ + מצרך חדש."
                    : "אין מצרכים שתואמים לסינון."}
                </td>
              </tr>
            ) : (
              filtered.map((i) => {
                const cat = i.category_id ? categoriesById.get(i.category_id) : null;
                const defaultUnit = i.units.find((u) => u.is_default) ?? i.units[0];
                return (
                  <tr key={i.id} className="border-t border-ink-100 hover:bg-ink-50/40">
                    <td className="p-2">
                      <div className="flex items-center gap-1.5">
                        {!i.is_complete && (
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        )}
                        <span className="font-medium text-ink-900">{i.name}</span>
                      </div>
                    </td>
                    {!compact && (
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
                    )}
                    <td className="p-2 text-xs">
                      {i.units.length === 0 ? (
                        <span className="text-amber-600">—</span>
                      ) : (
                        <span className="text-ink-600 line-clamp-1">
                          {i.units.map((u) => u.unit_name).filter(Boolean).join(" / ")}
                        </span>
                      )}
                    </td>
                    {!compact && (
                      <td className="p-2 text-xs tabular-nums text-ink-600">
                        {defaultUnit?.calories != null
                          ? `${defaultUnit.calories} / ${defaultUnit.amount} ${defaultUnit.unit_name ?? ""}`.trim()
                          : "—"}
                      </td>
                    )}
                    <td className="p-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEdit(i)}
                        className="p-1.5 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100"
                        title="ערוך"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {!compact && (
                        <button
                          type="button"
                          onClick={() => confirmDelete(i)}
                          className="p-1.5 rounded-md text-ink-400 hover:text-danger-600 hover:bg-danger-50"
                          title="מחק"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <IngredientEditModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        ingredient={editing}
      />
    </div>
  );
}
