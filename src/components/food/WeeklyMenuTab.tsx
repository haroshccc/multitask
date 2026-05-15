import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useMealPlanTemplate,
  useReplaceMealPlanTemplateCell,
} from "@/lib/hooks/useFood";
import { MealCellPicker } from "./MealCellPicker";
import { useFoodPeople, PersonAvatar } from "@/lib/food/people";
import { pushUndo } from "@/lib/undo/store";
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
 * as columns). Each cell holds 0+ meals. Now multi-user: a pill bar at the
 * top picks WHOSE template you're editing — your own or someone who shared
 * their plan with you. Edits write to that person's template rows.
 *
 * When editing someone else's plan, a banner makes it visually obvious
 * (their color tint + explicit "את עורכת את התפריט של X" text) so you
 * never accidentally edit the wrong person's plan.
 */
export function WeeklyMenuTab() {
  const { data: rows = [], isLoading } = useMealPlanTemplate();
  const replaceCell = useReplaceMealPlanTemplateCell();
  const { people, me } = useFoodPeople();

  // Active person — defaults to me, persisted to localStorage so when the
  // user switches tabs and comes back they see whose plan they last edited.
  const [activeUserId, setActiveUserId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("multitask.food.weekly.activeUser");
  });
  const effectiveUserId = activeUserId ?? me?.userId ?? null;
  const activePerson =
    people.find((p) => p.userId === effectiveUserId) ?? me ?? null;

  const setActive = (uid: string) => {
    setActiveUserId(uid);
    if (typeof window !== "undefined") {
      localStorage.setItem("multitask.food.weekly.activeUser", uid);
    }
  };

  // (day, meal_time) → ordered meal_ids[], scoped to the active user.
  const cellMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const r of rows) {
      if (r.user_id !== effectiveUserId) continue;
      const k = `${r.day_of_week}:${r.meal_time}`;
      const list = m.get(k) ?? [];
      list.push(r.meal_id);
      m.set(k, list);
    }
    return m;
  }, [rows, effectiveUserId]);

  const handleCellChange = (
    day: DayOfWeek,
    mealTime: MealTimeKey,
    mealIds: string[]
  ) => {
    if (!effectiveUserId) return;
    const uid = effectiveUserId;
    const prevIds = cellMap.get(`${day}:${mealTime}`) ?? [];
    replaceCell.mutate({
      userId: uid,
      dayOfWeek: day,
      mealTime,
      mealIds,
    });
    pushUndo({
      description: "עדכון תפריט שבועי",
      undo: () =>
        replaceCell.mutate({
          userId: uid,
          dayOfWeek: day,
          mealTime,
          mealIds: prevIds,
        }),
      redo: () =>
        replaceCell.mutate({
          userId: uid,
          dayOfWeek: day,
          mealTime,
          mealIds,
        }),
    });
  };

  const editingSomeoneElse = activePerson && !activePerson.isMe;

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-500">
        תפריט שבועי קבוע — מה בדרך כלל אוכלים בכל יום ובכל זמן ארוחה. את "תפריט מחר"
        מחליטים בכל לילה (בבאנר בראש המסך), והוא מתחיל מהתבנית הזו ומאפשר חריגות.
      </p>

      {/* Person pills — always visible so you know who's plan you're seeing */}
      <div className="card p-2 flex items-center gap-1 flex-wrap">
        <span className="text-xs text-ink-500 ms-1 me-2">תפריט של:</span>
        {people.map((p) => {
          const active = p.userId === effectiveUserId;
          return (
            <button
              key={p.userId}
              type="button"
              onClick={() => setActive(p.userId)}
              className={cn(
                "inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-sm border transition-colors",
                active
                  ? `${p.color.bg} ${p.color.border} ${p.color.text} font-medium`
                  : "bg-white border-ink-200 text-ink-700 hover:bg-ink-50"
              )}
            >
              <PersonAvatar person={p} size="xs" />
              <span>{p.isMe ? "אני" : p.displayName}</span>
            </button>
          );
        })}
      </div>

      {editingSomeoneElse && activePerson && (
        <div
          className={cn(
            "card flex items-center gap-2 px-3 py-2 text-sm border",
            activePerson.color.bg,
            activePerson.color.border,
            activePerson.color.text
          )}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            את עורכת את התפריט של <strong>{activePerson.displayName}</strong>.
            שינויים כאן יישמרו אצלו/ה.
          </span>
        </div>
      )}

      <div
        className={cn(
          "card overflow-x-auto",
          editingSomeoneElse &&
            activePerson &&
            `border-t-2 ${activePerson.color.border}`
        )}
      >
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
                <tr key={day} className="border-t border-ink-100 align-top">
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
