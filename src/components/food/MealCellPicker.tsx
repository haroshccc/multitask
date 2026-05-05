import { useState, useRef, useEffect, useMemo } from "react";
import { Plus, X, Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useMeals } from "@/lib/hooks/useFood";
import {
  MEAL_TIME_LABELS,
  type MealTimeKey,
} from "@/lib/types/domain";

interface MealCellPickerProps {
  /** Ordered list of meal_ids currently in the cell. Empty means "no meal". */
  mealIds: string[];
  onChange: (mealIds: string[]) => void;
  /** When provided, only meals tagged with this meal_time are pre-filtered.
   *  The user can still search any meal — this just sorts matches first. */
  mealTime?: MealTimeKey;
  /** Compact rendering trims paddings — use inside the dense weekly grid. */
  compact?: boolean;
  /** Visual placeholder shown when the cell is empty. */
  placeholder?: string;
  className?: string;
}

/**
 * Editable cell that holds zero or more meals. Shows pills for the picked
 * meals and an inline "+ הוסף" button that opens a searchable popover. Used
 * by the weekly template grid and the "tomorrow's menu" banner — the only
 * difference is whether the persistence target is the template table or
 * the day-plan table; that's owned by the caller via onChange.
 */
export function MealCellPicker({
  mealIds,
  onChange,
  mealTime,
  compact = false,
  placeholder = "—",
  className,
}: MealCellPickerProps) {
  const { data: meals = [] } = useMeals();
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

  const mealsById = useMemo(() => new Map(meals.map((m) => [m.id, m])), [meals]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchesQuery = (name: string) => !q || name.toLowerCase().includes(q);
    // Prefer meals tagged with this meal_time, but show others under them.
    const tagged = meals.filter(
      (m) => mealTime && m.meal_times?.includes(mealTime) && matchesQuery(m.name)
    );
    const others = meals.filter(
      (m) =>
        (!mealTime || !m.meal_times?.includes(mealTime)) && matchesQuery(m.name)
    );
    return { tagged, others };
  }, [meals, query, mealTime]);

  const addMeal = (id: string) => {
    if (mealIds.includes(id)) return;
    onChange([...mealIds, id]);
  };
  const removeMeal = (id: string) => {
    onChange(mealIds.filter((x) => x !== id));
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-1",
          compact ? "min-h-[28px]" : "min-h-[34px]"
        )}
      >
        {mealIds.length === 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "rounded-md border border-dashed border-ink-300 text-ink-400 hover:bg-ink-50 hover:text-ink-700",
              compact ? "px-2 py-0.5 text-xs" : "px-2 py-1 text-sm",
              "w-full text-start"
            )}
          >
            {placeholder}
          </button>
        )}
        {mealIds.map((id) => {
          const m = mealsById.get(id);
          return (
            <span
              key={id}
              className={cn(
                "inline-flex items-center gap-1 rounded-md bg-ink-100 text-ink-900 max-w-full",
                compact ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-xs"
              )}
              title={m?.name ?? "מנה לא קיימת"}
            >
              <span className="truncate">{m?.name ?? "(נמחק)"}</span>
              <button
                type="button"
                onClick={() => removeMeal(id)}
                className="text-ink-400 hover:text-danger-600 shrink-0"
                title="הסר"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          );
        })}
        {mealIds.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={cn(
              "rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100",
              compact ? "p-0.5" : "p-1"
            )}
            title="הוסף מנה"
          >
            <Plus className={compact ? "w-3 h-3" : "w-3.5 h-3.5"} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute top-full mt-1 inset-x-0 min-w-[220px] bg-white border border-ink-200 rounded-md shadow-soft z-30 overflow-hidden">
          <div className="p-1.5 border-b border-ink-100 flex items-center gap-1">
            <Search className="w-3.5 h-3.5 text-ink-400" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חפש מנה..."
              className="field text-sm py-1 flex-1 border-0 focus:ring-0 focus:border-0"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {meals.length === 0 ? (
              <div className="px-3 py-2 text-xs text-ink-400">
                עוד אין מנות. צור מנה בלשונית "מנות" קודם.
              </div>
            ) : (
              <>
                {candidates.tagged.length > 0 && mealTime && (
                  <div className="px-3 py-1 text-[10px] text-ink-400 font-medium">
                    {MEAL_TIME_LABELS[mealTime]}
                  </div>
                )}
                {candidates.tagged.map((m) => (
                  <MealOption
                    key={m.id}
                    name={m.name}
                    selected={mealIds.includes(m.id)}
                    onClick={() => addMeal(m.id)}
                  />
                ))}
                {candidates.others.length > 0 && candidates.tagged.length > 0 && (
                  <div className="px-3 py-1 text-[10px] text-ink-400 font-medium border-t border-ink-100 mt-1">
                    מנות אחרות
                  </div>
                )}
                {candidates.others.map((m) => (
                  <MealOption
                    key={m.id}
                    name={m.name}
                    selected={mealIds.includes(m.id)}
                    onClick={() => addMeal(m.id)}
                  />
                ))}
                {candidates.tagged.length === 0 && candidates.others.length === 0 && (
                  <div className="px-3 py-2 text-xs text-ink-400">לא נמצא.</div>
                )}
              </>
            )}
          </div>
          <div className="border-t border-ink-100 p-1 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs px-2 py-1 text-ink-500 hover:text-ink-900"
            >
              סגור
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MealOption({
  name,
  selected,
  onClick,
}: {
  name: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={selected}
      className={cn(
        "w-full text-start px-3 py-1.5 text-sm hover:bg-ink-50 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between",
        selected && "bg-ink-50"
      )}
    >
      <span className="truncate">{name}</span>
      {selected && <span className="text-[10px] text-ink-400 shrink-0">נבחר</span>}
    </button>
  );
}
