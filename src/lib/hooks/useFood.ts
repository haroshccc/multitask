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
  MealPlanShare,
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
// Meal plan template (weekly recurring) — per-user
// =============================================================================

/** Returns ALL templates the caller can see (owner + shared-with-me).
 *  Caller is responsible for grouping by user_id and rendering the
 *  active person's view. */
export function useMealPlanTemplate() {
  const scope = useOrgScope();
  return useQuery<MealPlanTemplate[]>({
    queryKey: queryKeys.mealPlanTemplate(scope.organizationId ?? ""),
    queryFn: () => service.listMealPlanTemplate(scope.organizationId!),
    enabled: scope.enabled,
  });
}

/** Replace one (day_of_week, meal_time) cell for `userId`'s template.
 *  RLS enforces that auth.uid() must own this user's plan or have an
 *  edit-grant via meal_plan_shares. */
export function useReplaceMealPlanTemplateCell() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({
      userId,
      dayOfWeek,
      mealTime,
      mealIds,
    }: {
      userId: string;
      dayOfWeek: number;
      mealTime: string;
      mealIds: string[];
    }) => {
      const { organizationId } = assertOrgScope(scope);
      return service.replaceMealPlanTemplateCell(
        organizationId,
        userId,
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
// Meal plan days (per-date plan / history) — per-user
// =============================================================================

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
      userId,
      date,
      mealTime,
      mealIds,
    }: {
      userId: string;
      date: string;
      mealTime: string;
      mealIds: string[];
    }) => {
      const { organizationId } = assertOrgScope(scope);
      return service.replaceMealPlanDayCell(
        organizationId,
        userId,
        date,
        mealTime,
        mealIds
      );
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

// =============================================================================
// Sharing
// =============================================================================

/** All meal-plan-share rows visible to the caller, in both directions
 *  (sharing-out and being-shared-with). */
export function useMealPlanShares() {
  const scope = useOrgScope();
  return useQuery<MealPlanShare[]>({
    queryKey: queryKeys.mealPlanShares(scope.organizationId ?? ""),
    queryFn: () => service.listMealPlanShares(scope.organizationId!),
    enabled: scope.enabled,
  });
}

export function useCreateMealPlanShare() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (sharedWithUserId: string) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createMealPlanShare({
        organization_id: organizationId,
        sharer_user_id: userId,
        shared_with_user_id: sharedWithUserId,
      });
    },
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allMealPlanShares(scope.organizationId),
        });
        // Newly-shared user can now see additional plan rows; refresh those
        // caches so their banner updates immediately.
        qc.invalidateQueries({
          queryKey: queryFamilies.allMealPlanTemplate(scope.organizationId),
        });
        qc.invalidateQueries({
          queryKey: queryFamilies.allMealPlanDays(scope.organizationId),
        });
      }
    },
  });
}

export function useDeleteMealPlanShare() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({
      sharerUserId,
      sharedWithUserId,
    }: {
      sharerUserId: string;
      sharedWithUserId: string;
    }) => {
      const { organizationId } = assertOrgScope(scope);
      return service.deleteMealPlanShare({
        organization_id: organizationId,
        sharer_user_id: sharerUserId,
        shared_with_user_id: sharedWithUserId,
      });
    },
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allMealPlanShares(scope.organizationId),
        });
        qc.invalidateQueries({
          queryKey: queryFamilies.allMealPlanTemplate(scope.organizationId),
        });
        qc.invalidateQueries({
          queryKey: queryFamilies.allMealPlanDays(scope.organizationId),
        });
      }
    },
  });
}
