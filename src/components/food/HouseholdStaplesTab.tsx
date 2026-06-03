import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useHouseholdStaples,
  useCreateHouseholdStaple,
  useUpdateHouseholdStaple,
  useDeleteHouseholdStaple,
} from "@/lib/hooks/useShopping";
import { useIngredientCategories } from "@/lib/hooks/useFood";
import { pushUndo } from "@/lib/undo/store";
import type { HouseholdStaple } from "@/lib/types/domain";

/**
 * Household staples — fixed consumables that aren't part of any meal (toilet
 * paper, milk, cleaning supplies…). Used as the source of the interactive
 * "need X too?" checklist when assembling a shopping run. A lightweight inline
 * editor (no modal) since each staple is just name + qty/unit + category +
 * active flag.
 */

interface DraftFields {
  name: string;
  default_quantity: string;
  default_unit: string;
  category_id: string | null;
  is_active: boolean;
}

const EMPTY_DRAFT: DraftFields = {
  name: "",
  default_quantity: "1",
  default_unit: "",
  category_id: null,
  is_active: true,
};

function stapleToDraft(s: HouseholdStaple): DraftFields {
  return {
    name: s.name,
    default_quantity: String(s.default_quantity ?? 1),
    default_unit: s.default_unit ?? "",
    category_id: s.category_id,
    is_active: s.is_active,
  };
}

export function HouseholdStaplesTab() {
  const { data: staples = [], isLoading } = useHouseholdStaples();
  const { data: categories = [] } = useIngredientCategories();
  const createStaple = useCreateHouseholdStaple();
  const updateStaple = useUpdateHouseholdStaple();
  const deleteStaple = useDeleteHouseholdStaple();

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | "all">("all");
  // editingId === "new" → the add row; a uuid → editing that staple inline.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftFields>(EMPTY_DRAFT);

  const categoriesById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staples.filter((s) => {
      if (filterCategory !== "all" && s.category_id !== filterCategory) return false;
      if (q && !s.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [staples, filterCategory, search]);

  const startAdd = () => {
    setEditingId("new");
    setDraft(EMPTY_DRAFT);
  };
  const startEdit = (s: HouseholdStaple) => {
    setEditingId(s.id);
    setDraft(stapleToDraft(s));
  };
  const cancelEdit = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  };

  const draftPayload = () => ({
    name: draft.name.trim(),
    default_quantity: Number(draft.default_quantity) || 1,
    default_unit: draft.default_unit.trim() || null,
    category_id: draft.category_id,
    is_active: draft.is_active,
  });

  const saveAdd = async () => {
    if (!draft.name.trim()) return;
    const created = await createStaple.mutateAsync(draftPayload());
    pushUndo({
      description: `הוספת מוצר בית: ${created.name}`,
      undo: () => deleteStaple.mutate(created.id),
      redo: () => createStaple.mutate(draftPayload()),
    });
    cancelEdit();
  };

  const saveEdit = async (s: HouseholdStaple) => {
    if (!draft.name.trim()) return;
    const before = stapleToDraft(s);
    const patch = draftPayload();
    await updateStaple.mutateAsync({ id: s.id, patch });
    pushUndo({
      description: `עריכת מוצר בית: ${s.name}`,
      undo: () =>
        updateStaple.mutate({
          id: s.id,
          patch: {
            name: before.name,
            default_quantity: Number(before.default_quantity) || 1,
            default_unit: before.default_unit || null,
            category_id: before.category_id,
            is_active: before.is_active,
          },
        }),
      redo: () => updateStaple.mutate({ id: s.id, patch }),
    });
    cancelEdit();
  };

  const toggleActive = async (s: HouseholdStaple) => {
    const next = !s.is_active;
    await updateStaple.mutateAsync({ id: s.id, patch: { is_active: next } });
    pushUndo({
      description: `${next ? "הפעלת" : "כיבוי"} מוצר בית: ${s.name}`,
      undo: () => updateStaple.mutate({ id: s.id, patch: { is_active: !next } }),
      redo: () => updateStaple.mutate({ id: s.id, patch: { is_active: next } }),
    });
  };

  const confirmDelete = async (s: HouseholdStaple) => {
    if (!confirm(`למחוק את "${s.name}" מרשימת מוצרי הבית?`)) return;
    const snapshot = {
      name: s.name,
      category_id: s.category_id,
      default_quantity: s.default_quantity,
      default_unit: s.default_unit,
      is_active: s.is_active,
      sort_order: s.sort_order,
      notes: s.notes,
    };
    await deleteStaple.mutateAsync(s.id);
    pushUndo({
      description: `מחיקת מוצר בית: ${s.name}`,
      undo: () => createStaple.mutate(snapshot),
      redo: () => {}, // re-deletion handled by the next list refresh; no-op is safe
    });
  };

  const EditorRow = ({ onSave }: { onSave: () => void }) => (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-ink-50/60 rounded-lg">
      <input
        autoFocus
        type="text"
        value={draft.name}
        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave();
          if (e.key === "Escape") cancelEdit();
        }}
        placeholder="שם המוצר (נייר טואלט, חלב...)"
        className="field text-sm py-1.5 flex-1 min-w-[8rem]"
      />
      <input
        type="number"
        min={0}
        step="any"
        value={draft.default_quantity}
        onChange={(e) => setDraft((d) => ({ ...d, default_quantity: e.target.value }))}
        className="field text-sm py-1.5 w-16"
        title="כמות ברירת מחדל"
      />
      <input
        type="text"
        value={draft.default_unit}
        onChange={(e) => setDraft((d) => ({ ...d, default_unit: e.target.value }))}
        placeholder="יחידה"
        className="field text-sm py-1.5 w-20"
        title="יחידה (חבילה, ליטר...)"
      />
      <select
        value={draft.category_id ?? ""}
        onChange={(e) =>
          setDraft((d) => ({ ...d, category_id: e.target.value || null }))
        }
        className="field text-sm py-1.5 w-32"
      >
        <option value="">ללא קטגוריה</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <label className="inline-flex items-center gap-1.5 text-xs text-ink-700 select-none cursor-pointer">
        <input
          type="checkbox"
          checked={draft.is_active}
          onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))}
          className="w-3.5 h-3.5"
        />
        פעיל
      </label>
      <div className="flex items-center gap-1 ms-auto">
        <button
          type="button"
          onClick={onSave}
          disabled={!draft.name.trim()}
          className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
          title="שמור"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={cancelEdit}
          className="p-1.5 rounded-md text-ink-400 hover:bg-ink-100"
          title="ביטול"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-500">
        מוצרי צריכה קבועים שאינם חלק מהתפריט. כשתכיני רשימת קניות, נציע לך לבדוק
        אילו מהם חסרים.
      </p>

      {/* ── Toolbar ── */}
      <div className="card p-2 flex items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש מוצר..."
          className="field text-sm py-1.5 flex-1 min-w-0"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="field text-sm py-1.5 w-36"
        >
          <option value="all">כל הקטגוריות</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={startAdd}
          className="btn-dark text-sm gap-1.5 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          מוצר חדש
        </button>
      </div>

      {/* ── Add row ── */}
      {editingId === "new" && <EditorRow onSave={saveAdd} />}

      {/* ── List ── */}
      <div className="card divide-y divide-ink-100">
        {isLoading ? (
          <div className="p-6 text-center text-ink-400">טוען...</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-ink-400">
            {staples.length === 0
              ? "עוד אין מוצרי בית. לחצי + מוצר חדש."
              : "אין מוצרים שתואמים לסינון."}
          </div>
        ) : (
          filtered.map((s) =>
            editingId === s.id ? (
              <div key={s.id} className="p-1">
                <EditorRow onSave={() => saveEdit(s)} />
              </div>
            ) : (
              <div
                key={s.id}
                className={cn(
                  "flex items-center gap-2 p-2.5",
                  !s.is_active && "opacity-50"
                )}
              >
                <button
                  type="button"
                  onClick={() => toggleActive(s)}
                  className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                    s.is_active
                      ? "bg-ink-900 border-ink-900 text-white"
                      : "border-ink-300"
                  )}
                  title={s.is_active ? "פעיל — כבי" : "כבוי — הפעילי"}
                >
                  {s.is_active && <Check className="w-3 h-3" />}
                </button>
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-ink-900">{s.name}</span>
                  <span className="text-xs text-ink-500 ms-2">
                    {Number(s.default_quantity)}
                    {s.default_unit ? ` ${s.default_unit}` : ""}
                  </span>
                </div>
                {s.category_id && categoriesById.get(s.category_id) && (
                  <span className="inline-flex items-center gap-1 text-xs text-ink-500">
                    {categoriesById.get(s.category_id)!.color && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: categoriesById.get(s.category_id)!.color! }}
                      />
                    )}
                    {categoriesById.get(s.category_id)!.name}
                  </span>
                )}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(s)}
                    className="p-1.5 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100"
                    title="ערוך"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmDelete(s)}
                    className="p-1.5 rounded-md text-ink-400 hover:text-danger-600 hover:bg-danger-50"
                    title="מחק"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}
