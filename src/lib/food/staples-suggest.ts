import type { HouseholdStaple, IngredientCategory } from "@/lib/types/domain";
import type { ShoppingRunItemDraft } from "./shopping-list";

/**
 * Interactive "need X too?" suggestions for the household-staples list —
 * consumables that aren't part of any meal (toilet paper, milk, cleaning
 * supplies…). When assembling a shopping run we offer the user a checklist of
 * active staples to tack onto the menu-derived list.
 *
 * Ordering heuristic: staples not added in a while float to the top (most
 * likely to be running low), then by the user-defined sort_order, then name.
 * Newly-created staples with no last_added_at are treated as "stale" so they
 * surface for the first decision.
 */

export interface StapleSuggestion {
  staple: HouseholdStaple;
  /** Days since this staple was last added to a run, or null if never. */
  daysSinceAdded: number | null;
  categoryName: string | null;
}

function daysBetween(fromIso: string | null, now: Date): number | null {
  if (!fromIso) return null;
  const then = new Date(fromIso);
  if (isNaN(then.getTime())) return null;
  const ms = now.getTime() - then.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** Builds the ordered suggestion list shown in the run wizard. Only active
 *  staples are included. */
export function buildStapleSuggestions(
  staples: HouseholdStaple[],
  categories: IngredientCategory[],
  now: Date = new Date()
): StapleSuggestion[] {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const active = staples.filter((s) => s.is_active);

  const suggestions = active.map((staple) => ({
    staple,
    daysSinceAdded: daysBetween(staple.last_added_at, now),
    categoryName: staple.category_id
      ? catById.get(staple.category_id)?.name ?? null
      : null,
  }));

  // "Never added" (null) sorts first (most stale), then by descending age,
  // then sort_order, then name — a stable, predictable checklist.
  suggestions.sort((a, b) => {
    const aAge = a.daysSinceAdded ?? Number.POSITIVE_INFINITY;
    const bAge = b.daysSinceAdded ?? Number.POSITIVE_INFINITY;
    if (aAge !== bAge) return bAge - aAge;
    if (a.staple.sort_order !== b.staple.sort_order)
      return a.staple.sort_order - b.staple.sort_order;
    return a.staple.name.localeCompare(b.staple.name, "he");
  });

  return suggestions;
}

/** Turns the staples the user ticked into run-item drafts (source='staple'),
 *  using each staple's default quantity/unit. */
export function selectedStaplesToRunItems(
  staples: HouseholdStaple[]
): ShoppingRunItemDraft[] {
  return staples.map((s) => {
    // Preserve an explicit 0 (and only fall back to 1 for null/NaN) — a user
    // may set qty 0 as a "check if we need it" placeholder.
    const qty = Number(s.default_quantity);
    return {
      ingredientId: null,
      stapleId: s.id,
      name: s.name,
      quantity: Number.isFinite(qty) ? qty : 1,
      unit: s.default_unit,
      categoryId: s.category_id,
      source: "staple" as const,
      sourceMeals: [],
    };
  });
}
