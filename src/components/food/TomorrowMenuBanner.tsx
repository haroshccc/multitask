import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Sunrise, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useMealPlanTemplate,
  useMealPlanDays,
  useReplaceMealPlanDayCell,
} from "@/lib/hooks/useFood";
import { MealCellPicker } from "./MealCellPicker";
import {
  MEAL_TIME_KEYS,
  MEAL_TIME_LABELS,
  DAY_OF_WEEK_LABELS,
  type DayOfWeek,
  type MealTimeKey,
} from "@/lib/types/domain";

/**
 * Banner at the top of the Food page that shows what's planned for
 * tomorrow. Defaults to the weekly template; the user can override any
 * slot per-day, and overrides persist to meal_plan_days.
 *
 * Behaviour:
 *  - For each meal_time, show meals from meal_plan_days if any rows exist
 *    for tomorrow's date, else fall back to the template for tomorrow's
 *    day-of-week.
 *  - Editing a slot creates/updates rows in meal_plan_days only — the
 *    template is never touched here.
 *  - "אפס לתבנית" clears the day's overrides for that meal_time so it
 *    falls back to the template again.
 */
export function TomorrowMenuBanner() {
  const [collapsed, setCollapsed] = useState(false);

  // Tomorrow in local time, as ISO date "YYYY-MM-DD".
  const { tomorrowDate, tomorrowDow, tomorrowLabel } = useMemo(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    const yyyy = t.getFullYear();
    const mm = String(t.getMonth() + 1).padStart(2, "0");
    const dd = String(t.getDate()).padStart(2, "0");
    const date = `${yyyy}-${mm}-${dd}`;
    const dow = t.getDay() as DayOfWeek;
    const label = `${DAY_OF_WEEK_LABELS[dow]}, ${dd}/${mm}`;
    return { tomorrowDate: date, tomorrowDow: dow, tomorrowLabel: label };
  }, []);

  const { data: template = [] } = useMealPlanTemplate();
  const { data: dayRows = [] } = useMealPlanDays(tomorrowDate, tomorrowDate);
  const replaceDayCell = useReplaceMealPlanDayCell();

  // For each meal_time, derive the effective list of meal_ids:
  //   1. If any day-rows exist for that slot, use those (override active).
  //   2. Else fall back to the template for tomorrow's day-of-week.
  // We also flag whether the slot is currently "overridden" so the UI can
  // show a small reset affordance.
  const slots = useMemo(() => {
    const dayMap = new Map<string, string[]>();
    for (const r of dayRows) {
      const k = r.meal_time;
      const list = dayMap.get(k) ?? [];
      list.push(r.meal_id);
      dayMap.set(k, list);
    }
    const tplMap = new Map<string, string[]>();
    for (const r of template) {
      if (r.day_of_week !== tomorrowDow) continue;
      const k = r.meal_time;
      const list = tplMap.get(k) ?? [];
      list.push(r.meal_id);
      tplMap.set(k, list);
    }
    return MEAL_TIME_KEYS.map((mt) => {
      const overridden = dayMap.has(mt);
      const ids = overridden ? dayMap.get(mt)! : tplMap.get(mt) ?? [];
      return { mealTime: mt, ids, overridden };
    });
  }, [template, dayRows, tomorrowDow]);

  const handleSlotChange = (mealTime: MealTimeKey, mealIds: string[]) => {
    // Always write — even an empty list is a deliberate "no meal tomorrow"
    // override that should persist over the template.
    replaceDayCell.mutate({ date: tomorrowDate, mealTime, mealIds });
  };

  const handleResetToTemplate = (mealTime: MealTimeKey) => {
    // Clearing the day rows lets the template re-take over on next render.
    replaceDayCell.mutate({ date: tomorrowDate, mealTime, mealIds: [] });
    // ↑ But empty mealIds writes nothing, which means the row count stays 0
    //   and the dayMap.has(mt) check above flips back to false → template
    //   re-shows. Good.
  };

  return (
    <div
      className={cn(
        "card border border-primary-200 bg-gradient-to-l from-amber-50/80 via-white to-white",
        "mb-3"
      )}
    >
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-start hover:bg-ink-50/50"
      >
        <span className="flex items-center gap-2">
          <Sunrise className="w-4 h-4 text-amber-500" />
          <span className="font-medium text-ink-900 text-sm">תפריט מחר</span>
          <span className="text-xs text-ink-500">{tomorrowLabel}</span>
        </span>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-ink-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-ink-400" />
        )}
      </button>
      {!collapsed && (
        <div className="px-3 pb-3 pt-1 space-y-2">
          {slots.map((s) => (
            <div
              key={s.mealTime}
              className="flex items-start gap-2 border-t border-ink-100 pt-2"
            >
              <div className="w-16 shrink-0 pt-1">
                <span className="text-xs font-medium text-ink-700">
                  {MEAL_TIME_LABELS[s.mealTime]}
                </span>
                {s.overridden && (
                  <span className="block text-[9px] text-amber-600 mt-0.5">
                    שינוי ידני
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <MealCellPicker
                  mealIds={s.ids}
                  onChange={(next) => handleSlotChange(s.mealTime, next)}
                  mealTime={s.mealTime}
                  placeholder="—"
                />
              </div>
              {s.overridden && (
                <button
                  type="button"
                  onClick={() => handleResetToTemplate(s.mealTime)}
                  className="shrink-0 p-1.5 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100"
                  title="אפס לפי התפריט הקבוע"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
