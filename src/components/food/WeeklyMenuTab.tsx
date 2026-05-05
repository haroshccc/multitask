import { useMemo } from "react";
import { useMealPlanTemplate, useReplaceMealPlanTemplateCell } from "@/lib/hooks/useFood";
import { MealCellPicker } from "./MealCellPicker";
import {
  DAY_OF_WEEK_KEYS,
  DAY_OF_WEEK_LABELS,
  MEAL_TIME_KEYS,
  MEAL_TIME_LABELS,
  type DayOfWeek,
  type MealTimeKey,
} from "@/lib/types/domain";

/**
 * Weekly recurring menu — a 7-row × 5-column grid (days as rows, meal-times
 * as columns). Each cell holds 0+ meals. Edits write to the
 * meal_plan_template table; the per-date overrides live in meal_plan_days
 * and are owned by the TomorrowMenuBanner / future history view.
 */
export function WeeklyMenuTab() {
  const { data: rows = [], isLoading } = useMealPlanTemplate();
  const replaceCell = useReplaceMealPlanTemplateCell();

  // Group rows into a (day,mealTime)→ordered mealIds[] map for fast lookup.
  const cellMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of rows) {
      const k = `${r.day_of_week}:${r.meal_time}`;
      const list = m.get(k) ?? [];
      list.push(r.meal_id);
      m.set(k, list);
    }
    return m;
  }, [rows]);

  const handleCellChange = (
    day: DayOfWeek,
    mealTime: MealTimeKey,
    mealIds: string[]
  ) => {
    replaceCell.mutate({ dayOfWeek: day, mealTime, mealIds });
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-500">
        תפריט שבועי קבוע — מה בדרך כלל אוכלים בכל יום ובכל זמן ארוחה. את "תפריט מחר"
        מחליטים בכל לילה (בבאנר בראש המסך), והוא מתחיל מתבנית זו ומאפשר חריגות.
      </p>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-ink-50/60 text-xs text-ink-500">
            <tr>
              <th className="text-start p-2 font-medium w-20 sticky right-0 bg-ink-50/90 z-10">
                יום
              </th>
              {MEAL_TIME_KEYS.map((mt) => (
                <th
                  key={mt}
                  className="text-start p-2 font-medium min-w-[160px]"
                >
                  {MEAL_TIME_LABELS[mt]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={MEAL_TIME_KEYS.length + 1}
                  className="p-6 text-center text-ink-400"
                >
                  טוען...
                </td>
              </tr>
            ) : (
              DAY_OF_WEEK_KEYS.map((day) => (
                <tr
                  key={day}
                  className="border-t border-ink-100 align-top"
                >
                  <td className="p-2 font-medium text-ink-900 sticky right-0 bg-white z-10 border-l border-ink-100">
                    {DAY_OF_WEEK_LABELS[day]}
                  </td>
                  {MEAL_TIME_KEYS.map((mt) => {
                    const k = `${day}:${mt}`;
                    const ids = cellMap.get(k) ?? [];
                    return (
                      <td key={mt} className="p-1.5 align-top">
                        <MealCellPicker
                          mealIds={ids}
                          onChange={(next) => handleCellChange(day, mt, next)}
                          mealTime={mt}
                          compact
                          placeholder="+ הוסף"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
