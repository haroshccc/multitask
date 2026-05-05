import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Plus, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { IngredientWithUnits } from "@/lib/services/food";

interface IngredientPickerProps {
  value: string | null;
  onChange: (id: string) => void;
  ingredients: IngredientWithUnits[];
  /** When the user types a name that doesn't match any existing ingredient
   *  and confirms, this callback runs. The host (the meal editor) is
   *  responsible for opening the IngredientEditModal pre-filled with the
   *  typed name, then wiring the new id back via onChange. */
  onCreateNew: (typedName: string) => void;
  className?: string;
}

/**
 * Searchable dropdown for picking an ingredient from the org's library, with
 * an inline "+ create new" affordance so editing a meal never blocks on
 * needing to switch tabs and add a missing ingredient first.
 *
 * Shows an "incomplete" badge next to ingredients that haven't yet had their
 * units / nutrition values filled in — those typically came from this exact
 * inline-create flow and need a follow-up.
 */
export function IngredientPicker({
  value,
  onChange,
  ingredients,
  onCreateNew,
  className,
}: IngredientPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const selected = ingredients.find((i) => i.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ingredients;
    return ingredients.filter((i) => i.name.toLowerCase().includes(q));
  }, [ingredients, query]);

  const hasExactMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return false;
    return ingredients.some((i) => i.name.toLowerCase() === q);
  }, [ingredients, query]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="field text-sm flex items-center justify-between gap-2 cursor-pointer"
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {selected && !selected.is_complete && (
            <AlertCircle
              className="w-3.5 h-3.5 text-amber-500 shrink-0"
            />
          )}
          <span className={cn("truncate", !selected && "text-ink-400")}>
            {selected?.name ?? "בחר מצרך"}
          </span>
        </span>
        <ChevronDown className="w-4 h-4 text-ink-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 inset-x-0 bg-white border border-ink-200 rounded-md shadow-soft z-30 overflow-hidden">
          <div className="p-1.5 border-b border-ink-100">
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim() && !hasExactMatch) {
                  e.preventDefault();
                  onCreateNew(query.trim());
                  setOpen(false);
                  setQuery("");
                }
              }}
              placeholder="חפש או הקלד לשם הוספה..."
              className="field text-sm py-1"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-ink-500">
                לא נמצא. לחץ "הוסף חדש" למטה.
              </div>
            ) : (
              filtered.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => {
                    onChange(i.id);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "w-full text-start px-3 py-1.5 text-sm flex items-center justify-between gap-2 hover:bg-ink-50",
                    i.id === value && "bg-ink-50 font-medium"
                  )}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    {!i.is_complete && (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    )}
                    <span className="truncate">{i.name}</span>
                  </span>
                  {i.units.length > 0 && (
                    <span className="text-[10px] text-ink-400 shrink-0">
                      {i.units.map((u) => u.unit_name).filter(Boolean).join(" / ")}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
          {query.trim() && !hasExactMatch && (
            <button
              type="button"
              onClick={() => {
                onCreateNew(query.trim());
                setOpen(false);
                setQuery("");
              }}
              className="w-full px-3 py-2 text-sm text-start border-t border-ink-100 flex items-center gap-2 text-primary-700 hover:bg-primary-50"
            >
              <Plus className="w-4 h-4" />
              הוסף חדש: <strong>"{query.trim()}"</strong>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
