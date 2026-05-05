import { useMemo, useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Sunrise,
  RefreshCw,
  EyeOff,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useMealPlanTemplate,
  useMealPlanDays,
  useReplaceMealPlanDayCell,
} from "@/lib/hooks/useFood";
import { MealCellPicker } from "./MealCellPicker";
import { useFoodPeople, PersonAvatar, type FoodPerson } from "@/lib/food/people";
import {
  MEAL_TIME_KEYS,
  MEAL_TIME_LABELS,
  DAY_OF_WEEK_LABELS,
  type DayOfWeek,
  type MealTimeKey,
  type MealPlanTemplate,
  type MealPlanDay,
} from "@/lib/types/domain";

const HIDDEN_STORAGE_KEY = "multitask.food.tomorrow.hiddenUsers";

/** Reads the set of user_ids the current user has chosen to hide from the
 *  tomorrow banner. Persists in localStorage so the choice survives reloads. */
function loadHiddenUsers(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(HIDDEN_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

/**
 * Banner showing what's planned for tomorrow — split into one section per
 * person whose plan is visible. Each section starts from that person's
 * weekly template and overlays per-day overrides from meal_plan_days.
 *
 * The user can:
 *   • Edit any visible plan inline (RLS enforces access)
 *   • Reset a slot to fall back to that person's template
 *   • Hide individual people's sections (persists to localStorage)
 *
 * Visual cue: each person's section is bordered + tinted with their
 * deterministic color, and editing someone else's plan reads as
 * deliberate by virtue of the colored border surrounding the cells.
 */
export function TomorrowMenuBanner() {
  const [collapsed, setCollapsed] = useState(false);
  const [hiddenUsers, setHiddenUsers] = useState<Set<string>>(loadHiddenUsers);

  const { tomorrowDate, tomorrowDow, tomorrowLabel } = useMemo(() => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    const yyyy = t.getFullYear();
    const mm = String(t.getMonth() + 1).padStart(2, "0");
    const dd = String(t.getDate()).padStart(2, "0");
    return {
      tomorrowDate: `${yyyy}-${mm}-${dd}`,
      tomorrowDow: t.getDay() as DayOfWeek,
      tomorrowLabel: `${DAY_OF_WEEK_LABELS[t.getDay() as DayOfWeek]}, ${dd}/${mm}`,
    };
  }, []);

  const { data: template = [] } = useMealPlanTemplate();
  const { data: dayRows = [] } = useMealPlanDays(tomorrowDate, tomorrowDate);
  const replaceDayCell = useReplaceMealPlanDayCell();
  const { people, me } = useFoodPeople();

  // Persist hidden-users state.
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      HIDDEN_STORAGE_KEY,
      JSON.stringify(Array.from(hiddenUsers))
    );
  }, [hiddenUsers]);

  const toggleHidden = (uid: string) => {
    setHiddenUsers((s) => {
      const next = new Set(s);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const handleSlotChange = (
    userId: string,
    mealTime: MealTimeKey,
    mealIds: string[]
  ) => {
    replaceDayCell.mutate({
      userId,
      date: tomorrowDate,
      mealTime,
      mealIds,
    });
  };

  const handleResetToTemplate = (userId: string, mealTime: MealTimeKey) => {
    // Empty mealIds clears the day's overrides for that slot — the
    // template re-takes over on the next render.
    replaceDayCell.mutate({
      userId,
      date: tomorrowDate,
      mealTime,
      mealIds: [],
    });
  };

  const visiblePeople = people.filter((p) => !hiddenUsers.has(p.userId));
  const hiddenList = people.filter((p) => hiddenUsers.has(p.userId));

  return (
    <div className="card border border-primary-200 bg-gradient-to-l from-amber-50/80 via-white to-white mb-3">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-start hover:bg-ink-50/50"
      >
        <span className="flex items-center gap-2">
          <Sunrise className="w-4 h-4 text-amber-500" />
          <span className="font-medium text-ink-900 text-sm">תפריט מחר</span>
          <span className="text-xs text-ink-500">{tomorrowLabel}</span>
          {visiblePeople.length > 1 && (
            <span className="text-[10px] text-ink-400">
              · {visiblePeople.length} משתתפים
            </span>
          )}
        </span>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-ink-400" />
        ) : (
          <ChevronUp className="w-4 h-4 text-ink-400" />
        )}
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 pt-1 space-y-3">
          {visiblePeople.length === 0 ? (
            <div className="text-xs text-ink-400 px-3 py-3 text-center">
              כל הסעיפים מוסתרים. לחצי "הצג שוב" למטה כדי לפתוח חזרה.
            </div>
          ) : (
            visiblePeople.map((p) => (
              <PersonSection
                key={p.userId}
                person={p}
                isMe={p.userId === me?.userId}
                tomorrowDow={tomorrowDow}
                template={template}
                dayRows={dayRows}
                onSlotChange={handleSlotChange}
                onResetSlot={handleResetToTemplate}
                onHide={() => toggleHidden(p.userId)}
              />
            ))
          )}
          {hiddenList.length > 0 && (
            <div className="border-t border-ink-100 pt-2 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-ink-400">מוסתרים:</span>
              {hiddenList.map((p) => (
                <button
                  key={p.userId}
                  type="button"
                  onClick={() => toggleHidden(p.userId)}
                  className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-900 px-2 py-0.5 rounded-md hover:bg-ink-50"
                  title="הצג שוב"
                >
                  <Eye className="w-3 h-3" />
                  <PersonAvatar person={p} size="xs" />
                  <span>{p.isMe ? "אני" : p.displayName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** A single person's tomorrow section. Computes effective slots: overrides
 *  from meal_plan_days take precedence over the weekly template. */
function PersonSection({
  person,
  isMe,
  tomorrowDow,
  template,
  dayRows,
  onSlotChange,
  onResetSlot,
  onHide,
}: {
  person: FoodPerson;
  isMe: boolean;
  tomorrowDow: DayOfWeek;
  template: MealPlanTemplate[];
  dayRows: MealPlanDay[];
  onSlotChange: (userId: string, mealTime: MealTimeKey, mealIds: string[]) => void;
  onResetSlot: (userId: string, mealTime: MealTimeKey) => void;
  onHide: () => void;
}) {
  const slots = useMemo(() => {
    const dayMap = new Map<string, string[]>();
    for (const r of dayRows) {
      if (r.user_id !== person.userId) continue;
      const list = dayMap.get(r.meal_time) ?? [];
      list.push(r.meal_id);
      dayMap.set(r.meal_time, list);
    }
    const tplMap = new Map<string, string[]>();
    for (const r of template) {
      if (r.user_id !== person.userId) continue;
      if (r.day_of_week !== tomorrowDow) continue;
      const list = tplMap.get(r.meal_time) ?? [];
      list.push(r.meal_id);
      tplMap.set(r.meal_time, list);
    }
    return MEAL_TIME_KEYS.map((mt) => {
      const overridden = dayMap.has(mt);
      const ids = overridden ? dayMap.get(mt)! : tplMap.get(mt) ?? [];
      return { mealTime: mt, ids, overridden };
    });
  }, [template, dayRows, tomorrowDow, person.userId]);

  return (
    <div
      className={cn(
        "rounded-md border-r-4 ps-2 py-1",
        person.color.border,
        !isMe && cn(person.color.bg, "border")
      )}
    >
      <div className="flex items-center justify-between gap-2 pe-1">
        <span className="flex items-center gap-2">
          <PersonAvatar person={person} size="sm" />
          <span className={cn("font-medium text-sm", person.color.text)}>
            {isMe ? "התפריט שלי" : `התפריט של ${person.displayName}`}
          </span>
          {!isMe && (
            <span className="text-[10px] text-ink-500 italic">
              (משותף — שינויים יישמרו אצלו/ה)
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={onHide}
          className="p-1 rounded text-ink-400 hover:text-ink-900 hover:bg-ink-100"
          title="הסתר"
        >
          <EyeOff className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="mt-1 space-y-1.5">
        {slots.map((s) => (
          <div
            key={s.mealTime}
            className="flex items-start gap-2 border-t border-ink-100/70 pt-1.5"
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
                onChange={(next) => onSlotChange(person.userId, s.mealTime, next)}
                mealTime={s.mealTime}
                placeholder="—"
              />
            </div>
            {s.overridden && (
              <button
                type="button"
                onClick={() => onResetSlot(person.userId, s.mealTime)}
                className="shrink-0 p-1.5 rounded-md text-ink-400 hover:text-ink-900 hover:bg-ink-100"
                title="אפס לפי התפריט הקבוע"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
