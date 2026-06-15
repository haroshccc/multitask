import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  Check,
  Copy,
  Flame,
  Save,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useIngredients,
  useMealPlanDays,
  useMeals,
  useReplaceMealPlanDayCell,
} from "@/lib/hooks/useFood";
import * as foodService from "@/lib/services/food";
import { useFoodPeople } from "@/lib/food/people";
import { useOrgScope, assertOrgScope } from "@/lib/hooks/useOrgScope";
import {
  MEAL_TIME_KEYS,
  MEAL_TIME_LABELS,
  type MealTimeKey,
} from "@/lib/types/domain";
import type { MealWithIngredients } from "@/lib/services/food";
import { computeMealNutrition, round1 } from "@/lib/food/nutrition";
import { pushUndo } from "@/lib/undo/store";
import { DateField } from "@/components/ui/DateField";

// =============================================================================
// "Wolt-like" interactive menu — pick which meals you want for which day(s)
// from cards and a date selector at the top, then commit the lot to
// meal_plan_days in one save.
// =============================================================================

type Mode = "tomorrow" | "specific" | "range" | "week";

const MODE_OPTIONS: Array<{ id: Mode; label: string }> = [
  { id: "tomorrow", label: "מחר" },
  { id: "specific", label: "תאריך ספציפי" },
  { id: "range", label: "טווח ימים" },
  { id: "week", label: "כל השבוע" },
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function isoOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function tomorrowIso(): string {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return isoOf(t);
}
function todayIso(): string {
  return isoOf(new Date());
}
function plusDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + n);
  return isoOf(dt);
}
function eachDate(from: string, to: string): string[] {
  if (from > to) return [];
  const out: string[] = [];
  let cursor = from;
  while (cursor <= to) {
    out.push(cursor);
    cursor = plusDaysIso(cursor, 1);
  }
  return out;
}
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}
function fmtDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString("he-IL", { weekday: "short", day: "numeric" });
}

/** Selection key — "date:mealTime". Set of meal_ids selected for that slot. */
const slotKey = (date: string, mt: MealTimeKey) => `${date}:${mt}`;

export function InteractiveMenuTab() {
  const { me } = useFoodPeople();
  const { data: meals = [] } = useMeals();
  const { data: ingredients = [] } = useIngredients();
  const replaceCell = useReplaceMealPlanDayCell();
  const scope = useOrgScope();

  // Date mode + range. Defaults to "tomorrow" because the most common
  // entry path is the upcoming-day plan.
  const [mode, setMode] = useState<Mode>("tomorrow");
  const [from, setFrom] = useState<string>(() => tomorrowIso());
  const [to, setTo] = useState<string>(() => tomorrowIso());

  // When more than one day is in the range, the user can pick whether
  // each day gets its own selection ("per day") or whether the SAME
  // selection applies to every date in the range ("same for all").
  const [perDay, setPerDay] = useState<boolean>(true);
  const [activeDate, setActiveDate] = useState<string>(from);

  // Sync from/to/activeDate when the mode changes.
  useEffect(() => {
    if (mode === "tomorrow") {
      const tom = tomorrowIso();
      setFrom(tom);
      setTo(tom);
      setActiveDate(tom);
    } else if (mode === "week") {
      const start = todayIso();
      const end = plusDaysIso(start, 6);
      setFrom(start);
      setTo(end);
      setActiveDate(start);
    } else if (mode === "specific") {
      const tom = tomorrowIso();
      setFrom(tom);
      setTo(tom);
      setActiveDate(tom);
    } else if (mode === "range") {
      const tom = tomorrowIso();
      const end = plusDaysIso(tom, 2);
      setFrom(tom);
      setTo(end);
      setActiveDate(tom);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Keep activeDate inside the range when from/to change.
  useEffect(() => {
    if (activeDate < from || activeDate > to) setActiveDate(from);
  }, [from, to, activeDate]);

  const dates = useMemo(() => eachDate(from, to), [from, to]);
  const isMultiDay = dates.length > 1;
  // "Same for all" only meaningful when there's more than one day.
  const effectivePerDay = isMultiDay ? perDay : true;

  // --- Selection state ----------------------------------------------------
  // Map<dateKey, Set<mealId>>. dateKey is "YYYY-MM-DD:mealTime".
  // For "same for all" mode we use the synthetic date "*" so the UI
  // doesn't need to know the difference; the save loop fans out.
  const [selection, setSelection] = useState<Map<string, Set<string>>>(
    () => new Map()
  );
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Initial load from existing meal_plan_days (for the current user, in
  // the visible range). Re-loads when the range or the user changes; we
  // skip the reload if the user has unsaved local edits to avoid stomping
  // on their work.
  const { data: existingDays = [] } = useMealPlanDays(from, to);
  const hydrationKeyRef = useRef<string>("");
  useEffect(() => {
    if (!me?.userId) return;
    if (dirty) return;
    const key = `${me.userId}:${from}:${to}:${effectivePerDay ? "per" : "same"}`;
    if (hydrationKeyRef.current === key) return;
    hydrationKeyRef.current = key;

    const next = new Map<string, Set<string>>();
    for (const row of existingDays) {
      if (row.user_id !== me.userId) continue;
      const k = effectivePerDay
        ? slotKey(row.date, row.meal_time as MealTimeKey)
        : slotKey("*", row.meal_time as MealTimeKey);
      let bucket = next.get(k);
      if (!bucket) {
        bucket = new Set();
        next.set(k, bucket);
      }
      bucket.add(row.meal_id);
    }
    setSelection(next);
  }, [existingDays, me?.userId, from, to, effectivePerDay, dirty]);

  // --- Selection helpers --------------------------------------------------
  const toggle = (date: string, mt: MealTimeKey, mealId: string) => {
    const key = effectivePerDay ? slotKey(date, mt) : slotKey("*", mt);
    setSelection((prev) => {
      const next = new Map(prev);
      const cur = new Set(next.get(key) ?? []);
      if (cur.has(mealId)) cur.delete(mealId);
      else cur.add(mealId);
      if (cur.size === 0) next.delete(key);
      else next.set(key, cur);
      return next;
    });
    setDirty(true);
    setSavedAt(null);
  };
  const isSelected = (date: string, mt: MealTimeKey, mealId: string): boolean => {
    const key = effectivePerDay ? slotKey(date, mt) : slotKey("*", mt);
    return selection.get(key)?.has(mealId) ?? false;
  };

  // Index meals by meal_time so each section gets just its set. Untagged
  // meals appear under every section (you'd use them for whatever slot).
  const mealsByTime = useMemo(() => {
    const out = new Map<MealTimeKey, MealWithIngredients[]>();
    for (const t of MEAL_TIME_KEYS) out.set(t, []);
    for (const m of meals) {
      const tags = (m.meal_times ?? []).filter(
        (t): t is MealTimeKey => (MEAL_TIME_KEYS as readonly string[]).includes(t)
      );
      if (tags.length === 0) {
        // Untagged → make available everywhere; the user picks where it fits.
        for (const t of MEAL_TIME_KEYS) out.get(t)!.push(m);
      } else {
        for (const t of tags) out.get(t)!.push(m);
      }
    }
    // Stable sort — selected first, then alphabetical, so the cart bubbles up.
    return out;
  }, [meals]);

  // --- "Duplicate from previous week" ------------------------------------
  // Loads existing meal_plan_days from (from-7d, to-7d) for the current user
  // and copies them into the current selection (overwrites). Useful for
  // "I had a good week, do the same again".
  const [duplicating, setDuplicating] = useState(false);
  const handleDuplicateFromPrevWeek = async () => {
    if (!me?.userId || !scope.organizationId) return;
    setDuplicating(true);
    try {
      const { organizationId } = assertOrgScope(scope);
      const prevFrom = plusDaysIso(from, -7);
      const prevTo = plusDaysIso(to, -7);
      const rows = await foodService.listMealPlanDays(
        organizationId,
        prevFrom,
        prevTo
      );
      const next = new Map<string, Set<string>>();
      for (const r of rows) {
        if (r.user_id !== me.userId) continue;
        // Map each prev-week date → same day-offset in current range.
        const offset = dateDiffDays(prevFrom, r.date);
        const target = effectivePerDay
          ? plusDaysIso(from, offset)
          : "*";
        if (target > to && effectivePerDay) continue;
        const k = slotKey(target, r.meal_time as MealTimeKey);
        let bucket = next.get(k);
        if (!bucket) {
          bucket = new Set();
          next.set(k, bucket);
        }
        bucket.add(r.meal_id);
      }
      setSelection(next);
      setDirty(true);
      setSavedAt(null);
    } finally {
      setDuplicating(false);
    }
  };

  // --- Save ---------------------------------------------------------------
  const handleSave = async () => {
    if (!me?.userId || saving) return;
    const uid = me.userId;
    setSaving(true);
    setSaveError(null);
    // Snapshot every cell we're about to overwrite so we can undo.
    const changes: Array<{
      date: string;
      mealTime: (typeof MEAL_TIME_KEYS)[number];
      prevIds: string[];
      nextIds: string[];
    }> = [];
    try {
      for (const date of dates) {
        for (const mt of MEAL_TIME_KEYS) {
          const key = effectivePerDay ? slotKey(date, mt) : slotKey("*", mt);
          const nextIds = Array.from(selection.get(key) ?? []);
          const prevIds = existingDays
            .filter(
              (r) =>
                r.date === date &&
                r.user_id === uid &&
                r.meal_time === mt
            )
            .map((r) => r.meal_id);
          if (
            prevIds.length === nextIds.length &&
            prevIds.every((id, i) => id === nextIds[i])
          ) {
            continue; // unchanged
          }
          changes.push({ date, mealTime: mt, prevIds, nextIds });
          await replaceCell.mutateAsync({
            userId: uid,
            date,
            mealTime: mt,
            mealIds: nextIds,
          });
        }
      }
      setDirty(false);
      setSavedAt(Date.now());
      if (changes.length > 0) {
        pushUndo({
          description: `שמירת תפריט (${changes.length} שינויים)`,
          undo: async () => {
            for (const c of changes) {
              await replaceCell.mutateAsync({
                userId: uid,
                date: c.date,
                mealTime: c.mealTime,
                mealIds: c.prevIds,
              });
            }
          },
          redo: async () => {
            for (const c of changes) {
              await replaceCell.mutateAsync({
                userId: uid,
                date: c.date,
                mealTime: c.mealTime,
                mealIds: c.nextIds,
              });
            }
          },
        });
      }
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!me) {
    return (
      <div className="card p-6 text-center text-ink-500">
        טוען…
      </div>
    );
  }

  const totalSelectedSlots = Array.from(selection.values()).reduce(
    (sum, s) => sum + s.size,
    0
  );

  return (
    <div className="space-y-3">
      {/* Top: mode chips + date inputs + per-day toggle */}
      <div className="card p-3 space-y-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs text-ink-600 me-1">
            <Calendar className="w-3.5 h-3.5" />
            תכנון ל:
          </span>
          {MODE_OPTIONS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={cn(
                "px-3 py-1 text-sm rounded-md border",
                mode === m.id
                  ? "bg-ink-900 text-white border-ink-900"
                  : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Date inputs — only when the mode requires them. */}
        {(mode === "specific" || mode === "range") && (
          <div className="flex items-center gap-2 flex-wrap">
            <DateField
              value={from}
              onChange={(v) => {
                setFrom(v);
                if (mode === "specific") setTo(v);
                else if (v > to) setTo(v);
                setDirty(true);
              }}
              className="w-40"
              required
              label="מתאריך"
            />
            {mode === "range" && (
              <>
                <span className="text-xs text-ink-500">עד</span>
                <DateField
                  value={to}
                  min={from || undefined}
                  onChange={(v) => {
                    setTo(v);
                    setDirty(true);
                  }}
                  className="w-40"
                  required
                  label="עד תאריך"
                />
              </>
            )}
          </div>
        )}
        {mode === "week" && (
          <div className="text-xs text-ink-600">
            {fmtDate(from)} – {fmtDate(to)}
          </div>
        )}

        {/* Per-day toggle (only meaningful for multi-day ranges) */}
        {isMultiDay && (
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-ink-600">סוג בחירה:</span>
            <button
              type="button"
              onClick={() => {
                setPerDay(true);
                setDirty(true);
              }}
              className={cn(
                "px-2.5 py-1 rounded-md border",
                perDay
                  ? "bg-primary-600 text-white border-primary-600"
                  : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
              )}
            >
              לכל יום בנפרד
            </button>
            <button
              type="button"
              onClick={() => {
                setPerDay(false);
                setDirty(true);
              }}
              className={cn(
                "px-2.5 py-1 rounded-md border",
                !perDay
                  ? "bg-primary-600 text-white border-primary-600"
                  : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
              )}
            >
              אותו תפריט לכל הימים
            </button>
          </div>
        )}

        {/* Day tabs — only when per-day && multi-day */}
        {isMultiDay && effectivePerDay && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {dates.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setActiveDate(d)}
                className={cn(
                  "px-2.5 py-1 rounded-md border text-xs",
                  d === activeDate
                    ? "bg-ink-900 text-white border-ink-900"
                    : "bg-white text-ink-700 border-ink-200 hover:bg-ink-50"
                )}
              >
                {fmtDateShort(d)}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleDuplicateFromPrevWeek}
            disabled={duplicating}
            className="btn-ghost text-xs gap-1.5"
            title="טוען את התפריט שתכננת לאותם תאריכים בשבוע שעבר"
          >
            <Copy className="w-3.5 h-3.5" />
            {duplicating ? "מעתיק…" : "שכפלי משבוע שעבר"}
          </button>
          <button
            type="button"
            disabled
            title="בקרוב — הצעת תפריט אוטומטית לפי העדפות והרגלים"
            className="btn-ghost text-xs gap-1.5 opacity-60 cursor-not-allowed"
          >
            <Sparkles className="w-3.5 h-3.5" />
            הצע תפריט (בקרוב)
          </button>
        </div>
      </div>

      {/* Most-ordered meals banner */}
      {meals.length > 0 && (
        <TopMealsBanner meals={meals} ingredients={ingredients} />
      )}

      {/* Meal-time sections */}
      {meals.length === 0 ? (
        <div className="card p-6 text-center text-ink-500 text-sm">
          עוד אין מנות. הוסיפי מנות מלשונית "מנות" כדי לראות אותן כאן.
        </div>
      ) : (
        MEAL_TIME_KEYS.map((mt) => (
          <MealTimeSection
            key={mt}
            mealTime={mt}
            meals={mealsByTime.get(mt) ?? []}
            ingredients={ingredients}
            isSelected={(mealId) => isSelected(activeDate, mt, mealId)}
            onToggle={(mealId) => toggle(activeDate, mt, mealId)}
          />
        ))
      )}

      {/* Sticky save bar */}
      <div className="sticky bottom-2 z-10">
        <div className="card flex items-center justify-between gap-3 p-3 shadow-lift">
          <div className="text-xs text-ink-700">
            {totalSelectedSlots > 0 ? (
              <>
                <strong>{totalSelectedSlots}</strong> בחירות
                {effectivePerDay ? null : (
                  <span className="text-ink-500"> · אותו תפריט לכל הימים</span>
                )}
              </>
            ) : (
              <span className="text-ink-500">בחרי מנות בארוחות שלמעלה</span>
            )}
            {saveError && (
              <div className="text-danger-600 text-[11px] mt-0.5">
                שגיאה בשמירה: {saveError}
              </div>
            )}
            {savedAt && !dirty && (
              <div className="text-success-600 text-[11px] mt-0.5">נשמר ✓</div>
            )}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="btn-dark gap-1.5"
          >
            <Save className="w-4 h-4" />
            {saving ? "שומר…" : "שמרי תפריט"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Top-meals banner — shows the 2 most-ordered meals per meal time based on
// the last 90 days of meal_plan_days history.
// =============================================================================

interface TopMealsBannerProps {
  meals: MealWithIngredients[];
  ingredients: MealTimeSectionProps["ingredients"];
}

function TopMealsBanner({ meals, ingredients }: TopMealsBannerProps) {
  const today = useMemo(() => isoOf(new Date()), []);
  const start = useMemo(() => plusDaysIso(today, -90), [today]);
  const { data: historyRows = [] } = useMealPlanDays(start, today);

  const unitsById = useMemo(() => {
    const m = new Map();
    for (const ing of ingredients) {
      for (const u of ing.units) m.set(u.id, u);
    }
    return m;
  }, [ingredients]);

  const topByMealTime = useMemo(() => {
    // Count (meal_id, meal_time) pairs across all users
    const counts = new Map<string, number>();
    for (const row of historyRows) {
      const key = `${row.meal_id}:${row.meal_time}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const mealsById = new Map(meals.map((m) => [m.id, m]));
    const result = new Map<MealTimeKey, Array<{ meal: MealWithIngredients; count: number; mealTime: MealTimeKey }>>();

    for (const mt of MEAL_TIME_KEYS) {
      const pairs: Array<{ meal: MealWithIngredients; count: number; mealTime: MealTimeKey }> = [];
      for (const [key, count] of counts) {
        const colonIdx = key.lastIndexOf(":");
        const mealId = key.slice(0, colonIdx);
        const mealTime = key.slice(colonIdx + 1) as MealTimeKey;
        if (mealTime !== mt) continue;
        const meal = mealsById.get(mealId);
        if (!meal) continue;
        pairs.push({ meal, count, mealTime: mt });
      }
      pairs.sort((a, b) => b.count - a.count);
      if (pairs.length > 0) result.set(mt, pairs.slice(0, 2));
    }
    return result;
  }, [historyRows, meals]);

  const allItems = useMemo(
    () => MEAL_TIME_KEYS.flatMap((mt) => topByMealTime.get(mt) ?? []),
    [topByMealTime]
  );

  if (allItems.length === 0) return null;

  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
        <TrendingUp className="w-4 h-4 text-primary-600" />
        המנות המוזמנות ביותר
      </div>
      <div className="-mx-3 px-3 overflow-x-auto no-scrollbar">
        <div className="flex gap-2.5 pb-0.5">
          {MEAL_TIME_KEYS.map((mt) => {
            const items = topByMealTime.get(mt);
            if (!items || items.length === 0) return null;
            return (
              <div key={mt} className="shrink-0 space-y-1.5">
                <div className="text-[10px] font-medium text-ink-500 uppercase tracking-wide px-0.5">
                  {MEAL_TIME_LABELS[mt]}
                </div>
                <div className="flex gap-2">
                  {items.map(({ meal, count }) => (
                    <TopMealCard
                      key={`${mt}:${meal.id}`}
                      meal={meal}
                      mealTime={mt}
                      count={count}
                      unitsById={unitsById}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface TopMealCardProps {
  meal: MealWithIngredients;
  mealTime: MealTimeKey;
  count: number;
  unitsById: Map<string, { amount: number; calories: number | null; protein_g: number | null; fat_g: number | null; carbs_g: number | null }>;
}

function TopMealCard({ meal, count, unitsById }: TopMealCardProps) {
  const totals = useMemo(() => {
    return computeMealNutrition(
      meal.ingredients.map((mi) => ({
        ingredient_id: mi.ingredient_id,
        unit_id: mi.unit_id,
        quantity: Number(mi.quantity) || 0,
      })),
      unitsById as Parameters<typeof computeMealNutrition>[1]
    );
  }, [meal.ingredients, unitsById]);

  return (
    <div className="w-32 shrink-0 rounded-lg overflow-hidden border border-ink-200 bg-white">
      <div className="aspect-[4/3] bg-ink-100 relative">
        {meal.image_url ? (
          // eslint-disable-next-line jsx-a11y/img-redundant-alt
          <img
            src={meal.image_url}
            alt={meal.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-300">
            <Flame className="w-6 h-6" />
          </div>
        )}
        <div className="absolute top-1 end-1 bg-primary-600/90 text-white text-[10px] font-semibold rounded-full px-1.5 py-0.5">
          ×{count}
        </div>
      </div>
      <div className="p-1.5 space-y-0.5">
        <div className="text-xs font-medium text-ink-900 truncate">{meal.name}</div>
        <div className="flex items-center gap-1 text-[10px] text-ink-600 flex-wrap">
          <span className="tabular-nums font-semibold text-ink-800">{round1(totals.calories)}</span>
          <span>קל'</span>
          <span className="text-ink-400">·</span>
          <span className="tabular-nums">{round1(totals.protein_g)}ח'</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Meal-time section — one block per meal time (breakfast/lunch/etc), with
// horizontal-scroll cards on mobile and a wrap grid on wider screens.
// =============================================================================

interface MealTimeSectionProps {
  mealTime: MealTimeKey;
  meals: MealWithIngredients[];
  ingredients: Array<{ id: string; units: Array<{ id: string; is_default: boolean; amount: number; calories: number | null; protein_g: number | null; fat_g: number | null; carbs_g: number | null }> }>;
  isSelected: (mealId: string) => boolean;
  onToggle: (mealId: string) => void;
}

function MealTimeSection({
  mealTime,
  meals,
  ingredients,
  isSelected,
  onToggle,
}: MealTimeSectionProps) {
  // Pre-compute units lookup once — used by every card to derive macros.
  const unitsById = useMemo(() => {
    const m = new Map();
    for (const ing of ingredients) {
      for (const u of ing.units) m.set(u.id, u);
    }
    return m;
  }, [ingredients]);

  // Stable per-mount shuffle order for non-selected meals.
  // Rebuilt only when the set of meal IDs changes (e.g. meals loaded).
  const shuffleOrderRef = useRef<Map<string, number>>(new Map());
  const mealIdsKeyRef = useRef<string>("");
  const currentKey = meals.map((m) => m.id).join(",");
  if (mealIdsKeyRef.current !== currentKey) {
    mealIdsKeyRef.current = currentKey;
    const indices = meals.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j]!, indices[i]!];
    }
    const order = new Map<string, number>();
    indices.forEach((origIdx, pos) => order.set(meals[origIdx]!.id, pos));
    shuffleOrderRef.current = order;
  }

  // Selected first, then shuffled non-selected (stable per mount).
  const sorted = useMemo(() => {
    const order = shuffleOrderRef.current;
    return [...meals].sort((a, b) => {
      const aSel = isSelected(a.id) ? 0 : 1;
      const bSel = isSelected(b.id) ? 0 : 1;
      if (aSel !== bSel) return aSel - bSel;
      return (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999);
    });
  }, [meals, isSelected]);

  if (meals.length === 0) {
    return (
      <section className="card p-3">
        <SectionHeader mealTime={mealTime} count={0} />
        <div className="text-xs text-ink-500 mt-1">
          אין מנות מתויגות לארוחה זו עדיין.
        </div>
      </section>
    );
  }

  const selectedCount = meals.filter((m) => isSelected(m.id)).length;

  return (
    <section className="card p-3">
      <SectionHeader mealTime={mealTime} count={selectedCount} />
      {/* Mobile: horizontal scroll. Desktop: wrap grid. */}
      <div className="mt-2 -mx-3 px-3 overflow-x-auto sm:overflow-visible no-scrollbar">
        <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 snap-x snap-mandatory sm:snap-none">
          {sorted.map((m) => (
            <MealCard
              key={m.id}
              meal={m}
              selected={isSelected(m.id)}
              onToggle={() => onToggle(m.id)}
              unitsById={unitsById}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionHeader({
  mealTime,
  count,
}: {
  mealTime: MealTimeKey;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-ink-900">
        {MEAL_TIME_LABELS[mealTime]}
      </h3>
      {count > 0 && (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-700 bg-primary-50 border border-primary-200 px-2 py-0.5 rounded-full">
          <Check className="w-3 h-3" />
          {count}
        </span>
      )}
    </div>
  );
}

// =============================================================================
// Meal card — single dish in a meal-time row. Tappable; flips between
// "neutral" and "selected" with a colored ring + check overlay.
// =============================================================================

interface MealCardProps {
  meal: MealWithIngredients;
  selected: boolean;
  onToggle: () => void;
  unitsById: Map<string, { amount: number; calories: number | null; protein_g: number | null; fat_g: number | null; carbs_g: number | null }>;
}

function MealCard({ meal, selected, onToggle, unitsById }: MealCardProps) {
  const totals = useMemo(() => {
    return computeMealNutrition(
      meal.ingredients.map((mi) => ({
        ingredient_id: mi.ingredient_id,
        unit_id: mi.unit_id,
        quantity: Number(mi.quantity) || 0,
      })),
      unitsById as Parameters<typeof computeMealNutrition>[1]
    );
  }, [meal.ingredients, unitsById]);

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "relative shrink-0 sm:shrink w-44 sm:w-auto rounded-lg overflow-hidden text-start bg-white border-2 transition-all snap-start",
        selected
          ? "border-primary-500 shadow-lift"
          : "border-ink-200 hover:border-ink-300"
      )}
    >
      <div className="aspect-[4/3] bg-ink-100 relative">
        {meal.image_url ? (
          // eslint-disable-next-line jsx-a11y/img-redundant-alt
          <img
            src={meal.image_url}
            alt={meal.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-ink-300">
            <Flame className="w-8 h-8" />
          </div>
        )}
        {selected && (
          <div className="absolute top-1.5 end-1.5 bg-primary-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow">
            <Check className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
      <div className="p-2 space-y-1">
        <div className="text-sm font-medium text-ink-900 truncate">
          {meal.name}
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-ink-600 flex-wrap">
          <Macro label="קל'" value={round1(totals.calories)} />
          <Macro label="ח'" value={round1(totals.protein_g)} />
          <Macro label="ש'" value={round1(totals.fat_g)} />
          <Macro label="פ'" value={round1(totals.carbs_g)} />
        </div>
      </div>
    </button>
  );
}

function Macro({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-baseline gap-0.5">
      <span className="font-semibold text-ink-900 tabular-nums">{value}</span>
      <span className="text-ink-500">{label}</span>
    </span>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function dateDiffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const da = new Date(ay, (am ?? 1) - 1, ad ?? 1).getTime();
  const db = new Date(by, (bm ?? 1) - 1, bd ?? 1).getTime();
  return Math.round((db - da) / (24 * 60 * 60 * 1000));
}
