import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, queryFamilies } from "@/lib/query-keys";
import * as service from "@/lib/services/food";
import type {
  Meal,
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
  IngredientUnit,
  IngredientUnitInsert,
  IngredientUnitUpdate,
  MealIngredient,
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
