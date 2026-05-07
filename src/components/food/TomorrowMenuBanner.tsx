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

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function isoOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function plusDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + n);
  return isoOf(dt);
}
function dowOf(iso: string): DayOfWeek {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).getDay() as DayOfWeek;
}
function labelFor(iso: string, todayIso: string, tomorrowIso: string): string {
  const [, m, d] = iso.split("-");
  const dowLabel = DAY_OF_WEEK_LABELS[dowOf(iso)];
  const dateShort = `${d}/${m}`;
  if (iso === todayIso) return `היום, ${dateShort}`;
  if (iso === tomorrowIso) return `מחר, ${dateShort}`;
  return `${dowLabel}, ${dateShort}`;
}

// ---------------------------------------------------------------------------
// Hidden-users persistence (keyed by date so each day remembers separately)
// ---------------------------------------------------------------------------

const HIDDEN_KEY = "multitask.food.dayplan.hiddenUsers";

function loadHiddenUsers(): Record<string, string[]> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}
function saveHiddenUsers(val: Record<string, string[]>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(HIDDEN_KEY, JSON.stringify(val));
}

// ---------------------------------------------------------------------------
// Root component — renders one DayBanner per date that has plan rows
// ---------------------------------------------------------------------------

export function TomorrowMenuBanner() {
  const todayIso = useMemo(() => isoOf(new Date()), []);
  const tomorrowIso = useMemo(() => plusDays(todayIso, 1), [todayIso]);
  const endIso = useMemo(() => plusDays(todayIso, 13), [todayIso]);

  const { data: template = [] } = useMealPlanTemplate();
  const { data: allDayRows = [] } = useMealPlanDays(todayIso, endIso);
  const replaceDayCell = useReplaceMealPlanDayCell();
  const { people, me } = useFoodPeople();

  // Dates that have at least one meal_plan_days row, sorted ascending.
  const datesWithPlan = useMemo(() => {
    const set = new Set<string>();
    for (const r of allDayRows) set.add(r.date);
    return Array.from(set).sort();
  }, [allDayRows]);

  const [hiddenAll, setHiddenAll] = useState<Record<string, string[]>>(loadHiddenUsers);

  useEffect(() => {
    saveHiddenUsers(hiddenAll);
  }, [hiddenAll]);

  const toggleHidden = (date: string, uid: string) => {
    setHiddenAll((prev) => {
      const cur = new Set(prev[date] ?? []);
      if (cur.has(uid)) cur.delete(uid);
      else cur.add(uid);
      return { ...prev, [date]: Array.from(cur) };
    });
  };

  const handleSlotChange = (
    date: string,
    userId: string,
    mealTime: MealTimeKey,
    mealIds: string[]
  ) => {
    replaceDayCell.mutate({ userId, date, mealTime, mealIds });
  };

  const handleResetToTemplate = (
    date: string,
    userId: string,
    mealTime: MealTimeKey
  ) => {
    replaceDayCell.mutate({ userId, date, mealTime, mealIds: [] });
  };

  if (datesWithPlan.length === 0) return null;

  return (
    <div className="space-y-2 mb-3">
      {datesWithPlan.map((date) => {
        const hiddenSet = new Set(hiddenAll[date] ?? []);
        const dayRows = allDayRows.filter((r) => r.date === date);
        return (
          <DayBanner
            key={date}
            label={labelFor(date, todayIso, tomorrowIso)}
            isTomorrow={date === tomorrowIso}
            dow={dowOf(date)}
            template={template}
            dayRows={dayRows}
            people={people}
            me={me}
            hiddenUsers={hiddenSet}
            onToggleHidden={(uid) => toggleHidden(date, uid)}
            onSlotChange={(uid, mt, ids) => handleSlotChange(date, uid, mt, ids)}
            onResetSlot={(uid, mt) => handleResetToTemplate(date, uid, mt)}
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single-day collapsible banner
// ---------------------------------------------------------------------------

interface DayBannerProps {
  label: string;
  isTomorrow: boolean;
  dow: DayOfWeek;
  template: MealPlanTemplate[];
  dayRows: MealPlanDay[];
  people: FoodPerson[];
  me: FoodPerson | null;
  hiddenUsers: Set<string>;
  onToggleHidden: (uid: string) => void;
  onSlotChange: (uid: string, mt: MealTimeKey, ids: string[]) => void;
  onResetSlot: (uid: string, mt: MealTimeKey) => void;
}

function DayBanner({
  label,
  isTomorrow,
  dow,
  template,
  dayRows,
  people,
  me,
  hiddenUsers,
  onToggleHidden,
  onSlotChange,
  onResetSlot,
}: DayBannerProps) {
  // Default collapsed — user expands on demand.
  const [collapsed, setCollapsed] = useState(true);

  // Only show people who have at least one row for this date.
  const peopleWithRows = useMemo(() => {
    const uidsWithRows = new Set(dayRows.map((r) => r.user_id));
    return people.filter((p) => uidsWithRows.has(p.userId));
  }, [people, dayRows]);

  const visiblePeople = peopleWithRows.filter((p) => !hiddenUsers.has(p.userId));
  const hiddenList = peopleWithRows.filter((p) => hiddenUsers.has(p.userId));

  const totalMeals = dayRows.length;

  return (
    <div className="card border border-primary-200 bg-gradient-to-l from-amber-50/80 via-white to-white">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-start hover:bg-ink-50/50"
      >
        <span className="flex items-center gap-2 min-w-0">
          <Sunrise className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="font-medium text-ink-900 text-sm whitespace-nowrap">
            {isTomorrow ? "תפריט מחר" : "תפריט"}
          </span>
          <span className="text-xs text-ink-500 truncate">{label}</span>
          {totalMeals > 0 && collapsed && (
            <span className="text-[10px] bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 whitespace-nowrap">
              {totalMeals} מנות
            </span>
          )}
        </span>
        {collapsed ? (
          <ChevronDown className="w-4 h-4 text-ink-400 shrink-0" />
        ) : (
          <ChevronUp className="w-4 h-4 text-ink-400 shrink-0" />
        )}
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 pt-1 space-y-3">
          {visiblePeople.length === 0 ? (
            <div className="text-xs text-ink-400 px-3 py-3 text-center">
              כל הסעיפים מוסתרים.
            </div>
          ) : (
            visiblePeople.map((p) => (
              <PersonSection
                key={p.userId}
                person={p}
                isMe={p.userId === me?.userId}
                dow={dow}
                template={template}
                dayRows={dayRows}
                onSlotChange={(mt, ids) => onSlotChange(p.userId, mt, ids)}
                onResetSlot={(mt) => onResetSlot(p.userId, mt)}
                onHide={() => onToggleHidden(p.userId)}
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
                  onClick={() => onToggleHidden(p.userId)}
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

// ---------------------------------------------------------------------------
// One person's section inside a day banner
// ---------------------------------------------------------------------------

function PersonSection({
  person,
  isMe,
  dow,
  template,
  dayRows,
  onSlotChange,
  onResetSlot,
  onHide,
}: {
  person: FoodPerson;
  isMe: boolean;
  dow: DayOfWeek;
  template: MealPlanTemplate[];
  dayRows: MealPlanDay[];
  onSlotChange: (mealTime: MealTimeKey, mealIds: string[]) => void;
  onResetSlot: (mealTime: MealTimeKey) => void;
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
      if (r.day_of_week !== dow) continue;
      const list = tplMap.get(r.meal_time) ?? [];
      list.push(r.meal_id);
      tplMap.set(r.meal_time, list);
    }
    return MEAL_TIME_KEYS.map((mt) => {
      const overridden = dayMap.has(mt);
      const ids = overridden ? dayMap.get(mt)! : tplMap.get(mt) ?? [];
      return { mealTime: mt, ids, overridden };
    });
  }, [template, dayRows, dow, person.userId]);

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
              (שינויים יישמרו אצלו/ה)
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
                onChange={(next) => onSlotChange(s.mealTime, next)}
                mealTime={s.mealTime}
                placeholder="—"
              />
            </div>
            {s.overridden && (
              <button
                type="button"
                onClick={() => onResetSlot(s.mealTime)}
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
