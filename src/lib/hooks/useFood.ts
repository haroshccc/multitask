import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, queryFamilies } from "@/lib/query-keys";
import * as service from "@/lib/services/food";
import type {
  MealInsert,
  MealUpdate,
  MealCategory,
  MealCategoryInsert,
  MealCategoryUpdate,
  IngredientInsert,
  IngredientUpdate,
  IngredientCategory,
  IngredientCategoryInsert,
  IngredientCategoryUpdate,
  IngredientUnitInsert,
  IngredientUnitUpdate,
  MealIngredient,
  MealPlanTemplate,
  MealPlanDay,
  MealPlanDayUpdate,
} from "@/lib/types/domain";
import { useOrgScope, assertOrgScope } from "./useOrgScope";

// =============================================================================
// Meal categories
// =============================================================================

export function useMealCategories() {
  const scope = useOrgScope();
  return useQuery<MealCategory[]>({
    queryKey: queryKeys.mealCategories(scope.organizationId ?? ""),
    queryFn: () => service.listMealCategories(scope.organizationId!),
    enabled: scope.enabled,
  });
}

export function useCreateMealCategory() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: Omit<MealCategoryInsert, "organization_id">) => {
      const { organizationId } = assertOrgScope(scope);
      return service.createMealCategory({
        ...input,
        organization_id: organizationId,
      });
    },
    onSuccess: () => {
      if (scope.organizationId)
        qc.invalidateQueries({ queryKey: queryFamilies.allMealCategories(scope.organizationId) });
    },
  });
}

export function useUpdateMealCategory() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: MealCategoryUpdate }) =>
      service.updateMealCategory(id, patch),
    onSuccess: () => {
      if (scope.organizationId)
        qc.invalidateQueries({ queryKey: queryFamilies.allMealCategories(scope.organizationId) });
    },
  });
}

export function useDeleteMealCategory() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (id: string) => service.deleteMealCategory(id),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({ queryKey: queryFamilies.allMealCategories(scope.organizationId) });
        qc.invalidateQueries({ queryKey: queryFamilies.allMeals(scope.organizationId) });
      }
    },
  });
}

// =============================================================================
// Ingredient categories
// =============================================================================

export function useIngredientCategories() {
  const scope = useOrgScope();
  return useQuery<IngredientCategory[]>({
    queryKey: queryKeys.ingredientCategories(scope.organizationId ?? ""),
    queryFn: () => service.listIngredientCategories(scope.organizationId!),
    enabled: scope.enabled,
  });
}

export function useCreateIngredientCategory() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: Omit<IngredientCategoryInsert, "organization_id">) => {
      const { organizationId } = assertOrgScope(scope);
      return service.createIngredientCategory({
        ...input,
        organization_id: organizationId,
      });
    },
    onSuccess: () => {
      if (scope.organizationId)
        qc.invalidateQueries({
          queryKey: queryFamilies.allIngredientCategories(scope.organizationId),
        });
    },
  });
}

export function useUpdateIngredientCategory() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: IngredientCategoryUpdate }) =>
      service.updateIngredientCategory(id, patch),
    onSuccess: () => {
      if (scope.organizationId)
        qc.invalidateQueries({
          queryKey: queryFamilies.allIngredientCategories(scope.organizationId),
        });
    },
  });
}

export function useDeleteIngredientCategory() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (id: string) => service.deleteIngredientCategory(id),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allIngredientCategories(scope.organizationId),
        });
        qc.invalidateQueries({ queryKey: queryFamilies.allIngredients(scope.organizationId) });
      }
    },
  });
}

// =============================================================================
// Ingredients (list comes pre-bundled with units)
// =============================================================================

export function useIngredients() {
  const scope = useOrgScope();
  return useQuery<service.IngredientWithUnits[]>({
    queryKey: queryKeys.ingredients(scope.organizationId ?? ""),
    queryFn: () => service.listIngredients(scope.organizationId!),
    enabled: scope.enabled,
  });
}

export function useCreateIngredient() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: Omit<IngredientInsert, "organization_id" | "owner_id">) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createIngredient({
        ...input,
        organization_id: organizationId,
        owner_id: userId,
      });
    },
    onSuccess: () => {
      if (scope.organizationId)
        qc.invalidateQueries({ queryKey: queryFamilies.allIngredients(scope.organizationId) });
    },
  });
}

export function useUpdateIngredient() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: IngredientUpdate }) =>
      service.updateIngredient(id, patch),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({ queryKey: queryFamilies.allIngredients(scope.organizationId) });
        qc.invalidateQueries({ queryKey: queryFamilies.allMeals(scope.organizationId) });
      }
    },
  });
}

export function useDeleteIngredient() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (id: string) => service.deleteIngredient(id),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({ queryKey: queryFamilies.allIngredients(scope.organizationId) });
        qc.invalidateQueries({ queryKey: queryFamilies.allMeals(scope.organizationId) });
      }
    },
  });
}

// =============================================================================
// Ingredient units
// =============================================================================

export function useCreateIngredientUnit() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: Omit<IngredientUnitInsert, "organization_id">) => {
      const { organizationId } = assertOrgScope(scope);
      return service.createIngredientUnit({
        ...input,
        organization_id: organizationId,
      });
    },
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({ queryKey: queryFamilies.allIngredients(scope.organizationId) });
        qc.invalidateQueries({ queryKey: queryFamilies.allMeals(scope.organizationId) });
      }
    },
  });
}

export function useUpdateIngredientUnit() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: IngredientUnitUpdate }) =>
      service.updateIngredientUnit(id, patch),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({ queryKey: queryFamilies.allIngredients(scope.organizationId) });
        qc.invalidateQueries({ queryKey: queryFamilies.allMeals(scope.organizationId) });
      }
    },
  });
}

export function useDeleteIngredientUnit() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (id: string) => service.deleteIngredientUnit(id),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({ queryKey: queryFamilies.allIngredients(scope.organizationId) });
        qc.invalidateQueries({ queryKey: queryFamilies.allMeals(scope.organizationId) });
      }
    },
  });
}

// =============================================================================
// Meals (list comes pre-bundled with their ingredient lines)
// =============================================================================

export function useMeals() {
  const scope = useOrgScope();
  return useQuery<service.MealWithIngredients[]>({
    queryKey: queryKeys.meals(scope.organizationId ?? ""),
    queryFn: () => service.listMeals(scope.organizationId!),
    enabled: scope.enabled,
  });
}

export function useCreateMeal() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: Omit<MealInsert, "organization_id" | "owner_id">) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createMeal({
        ...input,
        organization_id: organizationId,
        owner_id: userId,
      });
    },
    onSuccess: () => {
      if (scope.organizationId)
        qc.invalidateQueries({ queryKey: queryFamilies.allMeals(scope.organizationId) });
    },
  });
}

export function useUpdateMeal() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: MealUpdate }) =>
      service.updateMeal(id, patch),
    onSuccess: () => {
      if (scope.organizationId)
        qc.invalidateQueries({ queryKey: queryFamilies.allMeals(scope.organizationId) });
    },
  });
}

export function useDeleteMeal() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (id: string) => service.deleteMeal(id),
    onSuccess: () => {
      if (scope.organizationId)
        qc.invalidateQueries({ queryKey: queryFamilies.allMeals(scope.organizationId) });
    },
  });
}

/** Replace all of a meal's ingredient lines in one go. The meal editor
 *  collects rows in local state and saves them as a batch on submit. */
export function useReplaceMealIngredients() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({
      mealId,
      rows,
    }: {
      mealId: string;
      rows: Array<
        Pick<MealIngredient, "ingredient_id" | "unit_id" | "quantity" | "sort_order">
      >;
    }) => {
      const { organizationId } = assertOrgScope(scope);
      return service.replaceMealIngredients(mealId, organizationId, rows);
    },
    onSuccess: () => {
      if (scope.organizationId)
        qc.invalidateQueries({ queryKey: queryFamilies.allMeals(scope.organizationId) });
    },
  });
}

// =============================================================================
// Meal plan template (weekly recurring)
// =============================================================================

export function useMealPlanTemplate() {
  const scope = useOrgScope();
  return useQuery<MealPlanTemplate[]>({
    queryKey: queryKeys.mealPlanTemplate(scope.organizationId ?? ""),
    queryFn: () => service.listMealPlanTemplate(scope.organizationId!),
    enabled: scope.enabled,
  });
}

/** Replace one (day_of_week, meal_time) cell of the weekly template with
 *  a fresh ordered list of meal_ids. Empty list clears the cell. */
export function useReplaceMealPlanTemplateCell() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({
      dayOfWeek,
      mealTime,
      mealIds,
    }: {
      dayOfWeek: number;
      mealTime: string;
      mealIds: string[];
    }) => {
      const { organizationId } = assertOrgScope(scope);
      return service.replaceMealPlanTemplateCell(
        organizationId,
        dayOfWeek,
        mealTime,
        mealIds
      );
    },
    onSuccess: () => {
      if (scope.organizationId)
        qc.invalidateQueries({
          queryKey: queryFamilies.allMealPlanTemplate(scope.organizationId),
        });
    },
  });
}

// =============================================================================
// Meal plan days (per-date plan / history)
// =============================================================================

/** Fetch the day-specific plan rows for a date range. The "tomorrow's
 *  menu" banner queries [today, today+1]; a future history view will
 *  query a wider window. */
export function useMealPlanDays(fromDate: string, toDate: string) {
  const scope = useOrgScope();
  return useQuery<MealPlanDay[]>({
    queryKey: queryKeys.mealPlanDays(scope.organizationId ?? "", fromDate, toDate),
    queryFn: () => service.listMealPlanDays(scope.organizationId!, fromDate, toDate),
    enabled: scope.enabled,
  });
}

export function useReplaceMealPlanDayCell() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({
      date,
      mealTime,
      mealIds,
    }: {
      date: string;
      mealTime: string;
      mealIds: string[];
    }) => {
      const { organizationId } = assertOrgScope(scope);
      return service.replaceMealPlanDayCell(organizationId, date, mealTime, mealIds);
    },
    onSuccess: () => {
      if (scope.organizationId)
        qc.invalidateQueries({
          queryKey: queryFamilies.allMealPlanDays(scope.organizationId),
        });
    },
  });
}

export function useUpdateMealPlanDay() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: MealPlanDayUpdate }) =>
      service.updateMealPlanDay(id, patch),
    onSuccess: () => {
      if (scope.organizationId)
        qc.invalidateQueries({
          queryKey: queryFamilies.allMealPlanDays(scope.organizationId),
        });
    },
  });
}
