import { useState, useEffect } from "react";
import { X, Plus, Trash2, Star } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { CategoryPicker } from "./CategoryPicker";
import {
  useIngredientCategories,
  useCreateIngredientCategory,
  useUpdateIngredientCategory,
  useDeleteIngredientCategory,
  useCreateIngredient,
  useUpdateIngredient,
  useCreateIngredientUnit,
  useUpdateIngredientUnit,
  useDeleteIngredientUnit,
} from "@/lib/hooks/useFood";
import type { IngredientWithUnits } from "@/lib/services/food";
import type { IngredientUnit } from "@/lib/types/domain";

interface IngredientEditModalProps {
  open: boolean;
  onClose: () => void;
  /** When provided, edit mode. Otherwise create mode. */
  ingredient?: IngredientWithUnits | null;
  /** Pre-fill the name when launched from the meal editor's "+ create new". */
  initialName?: string;
  /** Called after a successful create with the new ingredient's id, so the
   *  meal editor can wire the new ingredient straight into the row that
   *  triggered it. */
  onCreated?: (ingredientId: string) => void;
}

interface UnitDraft {
  /** Existing unit row id when editing. Empty for new rows. */
  id: string;
  unit_name: string;
  amount: string;
  calories: string;
  fat_g: string;
  protein_g: string;
  carbs_g: string;
  is_default: boolean;
  /** Tracks deletion of an existing unit. New rows just get filtered. */
  _deleted?: boolean;
}

const emptyUnit = (isFirst: boolean): UnitDraft => ({
  id: "",
  unit_name: "",
  amount: "1",
  calories: "",
  fat_g: "",
  protein_g: "",
  carbs_g: "",
  is_default: isFirst,
});

const toDraft = (u: IngredientUnit): UnitDraft => ({
  id: u.id,
  unit_name: u.unit_name,
  amount: String(u.amount ?? 1),
  calories: u.calories != null ? String(u.calories) : "",
  fat_g: u.fat_g != null ? String(u.fat_g) : "",
  protein_g: u.protein_g != null ? String(u.protein_g) : "",
  carbs_g: u.carbs_g != null ? String(u.carbs_g) : "",
  is_default: u.is_default,
});

export function IngredientEditModal({
  open,
  onClose,
  ingredient,
  initialName,
  onCreated,
}: IngredientEditModalProps) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [units, setUnits] = useState<UnitDraft[]>([emptyUnit(true)]);
  const [saving, setSaving] = useState(false);

  const { data: categories = [] } = useIngredientCategories();
  const createCategory = useCreateIngredientCategory();
  const renameCategory = useUpdateIngredientCategory();
  const deleteCategory = useDeleteIngredientCategory();
  const createIngredient = useCreateIngredient();
  const updateIngredient = useUpdateIngredient();
  const createUnit = useCreateIngredientUnit();
  const updateUnit = useUpdateIngredientUnit();
  const deleteUnit = useDeleteIngredientUnit();

  // Reset form whenever the modal opens or the target ingredient changes.
  useEffect(() => {
    if (!open) return;
    if (ingredient) {
      setName(ingredient.name);
      setCategoryId(ingredient.category_id);
      setNotes(ingredient.notes ?? "");
      setUnits(
        ingredient.units.length > 0 ? ingredient.units.map(toDraft) : [emptyUnit(true)]
      );
    } else {
      setName(initialName ?? "");
      setCategoryId(null);
      setNotes("");
      setUnits([emptyUnit(true)]);
    }
  }, [open, ingredient, initialName]);

  if (!open) return null;

  const liveUnits = units.filter((u) => !u._deleted);

  const addUnit = () => {
    setUnits((arr) => [...arr, emptyUnit(arr.filter((u) => !u._deleted).length === 0)]);
  };

  const removeUnit = (idx: number) => {
    setUnits((arr) => {
      const next = [...arr];
      const target = next[idx];
      if (target.id) {
        next[idx] = { ...target, _deleted: true };
      } else {
        next.splice(idx, 1);
      }
      // Make sure we still have a default selected after removal.
      const remaining = next.filter((u) => !u._deleted);
      if (remaining.length > 0 && !remaining.some((u) => u.is_default)) {
        const firstLive = next.findIndex((u) => !u._deleted);
        if (firstLive >= 0) next[firstLive] = { ...next[firstLive], is_default: true };
      }
      return next;
    });
  };

  const setUnitField = <K extends keyof UnitDraft>(idx: number, key: K, val: UnitDraft[K]) => {
    setUnits((arr) => {
      const next = [...arr];
      next[idx] = { ...next[idx], [key]: val };
      return next;
    });
  };

  const setDefault = (idx: number) => {
    setUnits((arr) => arr.map((u, i) => ({ ...u, is_default: i === idx && !u._deleted })));
  };

  const isComplete = (): boolean => {
    // "Complete" means: at least one live unit with at least the calories
    // value filled in. Rough heuristic — keeps incomplete-flagging useful
    // without nagging on a partial fat/protein.
    return liveUnits.some((u) => u.unit_name.trim() && u.calories.trim() !== "");
  };

  const num = (s: string): number | null => {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const complete = isComplete();
      let id: string;
      if (ingredient) {
        await updateIngredient.mutateAsync({
          id: ingredient.id,
          patch: {
            name: name.trim(),
            category_id: categoryId,
            notes: notes.trim() || null,
            is_complete: complete,
          },
        });
        id = ingredient.id;
        // Diff units: delete flagged, update existing, create new.
        for (const u of units) {
          if (u._deleted && u.id) {
            await deleteUnit.mutateAsync(u.id);
            continue;
          }
          if (u._deleted) continue;
          if (!u.unit_name.trim()) continue;
          const payload = {
            unit_name: u.unit_name.trim(),
            amount: Number(u.amount) || 1,
            calories: num(u.calories),
            fat_g: num(u.fat_g),
            protein_g: num(u.protein_g),
            carbs_g: num(u.carbs_g),
            is_default: u.is_default,
          };
          if (u.id) {
            await updateUnit.mutateAsync({ id: u.id, patch: payload });
          } else {
            await createUnit.mutateAsync({ ingredient_id: id, ...payload });
          }
        }
      } else {
        const created = await createIngredient.mutateAsync({
          name: name.trim(),
          category_id: categoryId,
          notes: notes.trim() || null,
          is_complete: complete,
        });
        id = created.id;
        for (const u of units) {
          if (u._deleted) continue;
          if (!u.unit_name.trim()) continue;
          await createUnit.mutateAsync({
            ingredient_id: id,
            unit_name: u.unit_name.trim(),
            amount: Number(u.amount) || 1,
            calories: num(u.calories),
            fat_g: num(u.fat_g),
            protein_g: num(u.protein_g),
            carbs_g: num(u.carbs_g),
            is_default: u.is_default,
          });
        }
        onCreated?.(id);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-2 p-4 border-b border-ink-100">
          <h2 className="text-lg font-semibold text-ink-900">
            {ingredient ? "עריכת מצרך" : "מצרך חדש"}
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
          <div>
            <label className="text-xs text-ink-500 mb-1 block">שם</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="field text-sm"
              placeholder="לדוגמה: מלפפון"
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

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-ink-500">יחידות מידה וערכים תזונתיים</label>
              <button
                type="button"
                onClick={addUnit}
                className="inline-flex items-center gap-1 text-xs text-primary-700 hover:text-primary-900"
              >
                <Plus className="w-3 h-3" />
                הוסף יחידה
              </button>
            </div>
            <p className="text-[11px] text-ink-400 mb-2">
              אפשר לרשום את אותו מצרך בכמה יחידות (למשל מלפפון = 1 יחידה, וגם 100 גרם).
              הערכים שמכניסים כאן הם פר הכמות שצוינה — חישוב ערכים למנה הוא כפל פשוט.
            </p>
            <div className="space-y-2">
              {units.map((u, idx) => {
                if (u._deleted) return null;
                return (
                  <div
                    key={idx}
                    className={cn(
                      "border rounded-md p-2 space-y-2",
                      u.is_default
                        ? "border-primary-300 bg-primary-50/30"
                        : "border-ink-200 bg-white"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={u.unit_name}
                        onChange={(e) => setUnitField(idx, "unit_name", e.target.value)}
                        placeholder="שם יחידה (יחידה / גרם / כוס)"
                        className="field text-sm py-1.5 flex-1"
                      />
                      <span className="text-xs text-ink-500">לכל</span>
                      <input
                        type="number"
                        step="any"
                        min={0}
                        value={u.amount}
                        onChange={(e) => setUnitField(idx, "amount", e.target.value)}
                        className="field text-sm py-1.5 w-20"
                      />
                      <button
                        type="button"
                        onClick={() => setDefault(idx)}
                        className={cn(
                          "p-1.5 rounded-md transition-colors",
                          u.is_default
                            ? "text-amber-500"
                            : "text-ink-300 hover:text-amber-500"
                        )}
                        title="קבע כברירת מחדל"
                      >
                        <Star
                          className="w-4 h-4"
                          fill={u.is_default ? "currentColor" : "none"}
                        />
                      </button>
                      {liveUnits.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeUnit(idx)}
                          className="p-1.5 rounded-md text-ink-400 hover:text-danger-600 hover:bg-danger-50"
                          title="הסר יחידה"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <NutritionField
                        label="קלוריות"
                        value={u.calories}
                        onChange={(v) => setUnitField(idx, "calories", v)}
                      />
                      <NutritionField
                        label="חלבון (ג)"
                        value={u.protein_g}
                        onChange={(v) => setUnitField(idx, "protein_g", v)}
                      />
                      <NutritionField
                        label="שומן (ג)"
                        value={u.fat_g}
                        onChange={(v) => setUnitField(idx, "fat_g", v)}
                      />
                      <NutritionField
                        label="פחמ' (ג)"
                        value={u.carbs_g}
                        onChange={(v) => setUnitField(idx, "carbs_g", v)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs text-ink-500 mb-1 block">הערות</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
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
  );
}

function NutritionField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] text-ink-500 mb-0.5 block">{label}</span>
      <input
        type="number"
        step="any"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field text-sm py-1"
        placeholder="—"
      />
    </label>
  );
}
