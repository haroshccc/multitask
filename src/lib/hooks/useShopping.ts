import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, queryFamilies } from "@/lib/query-keys";
import * as service from "@/lib/services/shopping";
import type {
  HouseholdStaple,
  HouseholdStapleInsert,
  HouseholdStapleUpdate,
  StoreConnection,
  StoreConnectionInsert,
  StoreConnectionUpdate,
  ShoppingRun,
  ShoppingRunUpdate,
  ShoppingItemStatus,
} from "@/lib/types/domain";
import type { ShoppingRunItemDraft } from "@/lib/food/shopping-list";
import { useOrgScope, assertOrgScope } from "./useOrgScope";

// =============================================================================
// Household staples
// =============================================================================

export function useHouseholdStaples() {
  const scope = useOrgScope();
  return useQuery<HouseholdStaple[]>({
    queryKey: queryKeys.householdStaples(scope.organizationId ?? ""),
    queryFn: () => service.listHouseholdStaples(scope.organizationId!),
    enabled: scope.enabled,
  });
}

export function useCreateHouseholdStaple() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: Omit<HouseholdStapleInsert, "organization_id" | "owner_id">) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createHouseholdStaple({
        ...input,
        organization_id: organizationId,
        owner_id: userId,
      });
    },
    onSuccess: () => {
      if (scope.organizationId)
        qc.invalidateQueries({
          queryKey: queryFamilies.allHouseholdStaples(scope.organizationId),
        });
    },
  });
}

export function useUpdateHouseholdStaple() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: HouseholdStapleUpdate }) =>
      service.updateHouseholdStaple(id, patch),
    onSuccess: () => {
      if (scope.organizationId)
        qc.invalidateQueries({
          queryKey: queryFamilies.allHouseholdStaples(scope.organizationId),
        });
    },
  });
}

export function useDeleteHouseholdStaple() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (id: string) => service.deleteHouseholdStaple(id),
    onSuccess: () => {
      if (scope.organizationId)
        qc.invalidateQueries({
          queryKey: queryFamilies.allHouseholdStaples(scope.organizationId),
        });
    },
  });
}

// =============================================================================
// Store connections
// =============================================================================

export function useStoreConnections() {
  const scope = useOrgScope();
  return useQuery<StoreConnection[]>({
    queryKey: queryKeys.storeConnections(scope.organizationId ?? ""),
    queryFn: () => service.listStoreConnections(scope.organizationId!),
    enabled: scope.enabled,
  });
}

export function useCreateStoreConnection() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: Omit<StoreConnectionInsert, "organization_id" | "created_by">) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createStoreConnection({
        ...input,
        organization_id: organizationId,
        created_by: userId,
      });
    },
    onSuccess: () => {
      if (scope.organizationId)
        qc.invalidateQueries({
          queryKey: queryFamilies.allStoreConnections(scope.organizationId),
        });
    },
  });
}

export function useUpdateStoreConnection() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: StoreConnectionUpdate }) =>
      service.updateStoreConnection(id, patch),
    onSuccess: () => {
      if (scope.organizationId)
        qc.invalidateQueries({
          queryKey: queryFamilies.allStoreConnections(scope.organizationId),
        });
    },
  });
}

export function useDeleteStoreConnection() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (id: string) => service.deleteStoreConnection(id),
    onSuccess: () => {
      if (scope.organizationId)
        qc.invalidateQueries({
          queryKey: queryFamilies.allStoreConnections(scope.organizationId),
        });
    },
  });
}

// =============================================================================
// Shopping runs
// =============================================================================

export function useShoppingRuns() {
  const scope = useOrgScope();
  return useQuery<ShoppingRun[]>({
    queryKey: queryKeys.shoppingRuns(scope.organizationId ?? ""),
    queryFn: () => service.listShoppingRuns(scope.organizationId!),
    enabled: scope.enabled,
  });
}

export function useShoppingRun(runId: string | null | undefined) {
  return useQuery<service.ShoppingRunWithItems | null>({
    queryKey: queryKeys.shoppingRun(runId ?? ""),
    queryFn: () => service.getShoppingRun(runId!),
    enabled: !!runId,
  });
}

export function useCreateRunFromDrafts() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: {
      title: string;
      fromDate: string;
      toDate: string;
      includedUserIds: string[];
      storeConnectionId: string | null;
      drafts: ShoppingRunItemDraft[];
    }) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createRunFromDrafts({
        organizationId,
        createdBy: userId,
        ...input,
      });
    },
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({ queryKey: queryFamilies.allShoppingRuns(scope.organizationId) });
        qc.invalidateQueries({
          queryKey: queryFamilies.allHouseholdStaples(scope.organizationId),
        });
      }
    },
  });
}

export function useUpdateShoppingRun() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ShoppingRunUpdate }) =>
      service.updateShoppingRun(id, patch),
    onSuccess: (run) => {
      qc.invalidateQueries({ queryKey: queryFamilies.shoppingRunFamily(run.id) });
      if (scope.organizationId)
        qc.invalidateQueries({ queryKey: queryFamilies.allShoppingRuns(scope.organizationId) });
    },
  });
}

export function useDeleteShoppingRun() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (id: string) => service.deleteShoppingRun(id),
    onSuccess: () => {
      if (scope.organizationId)
        qc.invalidateQueries({ queryKey: queryFamilies.allShoppingRuns(scope.organizationId) });
    },
  });
}

// --- run items ---------------------------------------------------------------

export function useSetRunItemStatus() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: ShoppingItemStatus }) =>
      service.setRunItemStatus(itemId, status),
    onSuccess: (item) => {
      qc.invalidateQueries({ queryKey: queryFamilies.shoppingRunFamily(item.run_id) });
      if (scope.organizationId)
        qc.invalidateQueries({ queryKey: queryFamilies.allShoppingRuns(scope.organizationId) });
    },
  });
}

export function useSetRunItemsStatus() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({
      itemIds,
      status,
    }: {
      itemIds: string[];
      status: ShoppingItemStatus;
      runId: string;
    }) => service.setRunItemsStatus(itemIds, status),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryFamilies.shoppingRunFamily(vars.runId) });
      if (scope.organizationId)
        qc.invalidateQueries({ queryKey: queryFamilies.allShoppingRuns(scope.organizationId) });
    },
  });
}

export function useAddManualRunItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      runId: string;
      organizationId: string;
      name: string;
      quantity: number;
      unit: string | null;
      categoryId: string | null;
      sortOrder: number;
    }) => service.addManualRunItem(input),
    onSuccess: (item) => {
      qc.invalidateQueries({ queryKey: queryFamilies.shoppingRunFamily(item.run_id) });
    },
  });
}

export function useDeleteRunItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId }: { itemId: string; runId: string }) =>
      service.deleteRunItem(itemId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryFamilies.shoppingRunFamily(vars.runId) });
    },
  });
}

// --- carry-over (merge) ------------------------------------------------------

/** Returns open runs (excluding the given run) that have 'missing' items —
 *  drives the carry-over prompt. */
export function useRunsWithMissingItems(excludeRunId?: string) {
  const scope = useOrgScope();
  return useQuery<service.ShoppingRunWithItems[]>({
    queryKey: [
      ...queryKeys.shoppingRuns(scope.organizationId ?? ""),
      "missing",
      excludeRunId ?? "__none__",
    ],
    queryFn: () =>
      service.listRunsWithMissingItems(scope.organizationId!, excludeRunId),
    enabled: scope.enabled,
  });
}

export function useMergeRunItems() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: {
      targetRunId: string;
      items: import("@/lib/types/domain").ShoppingRunItem[];
    }) => {
      const { organizationId } = assertOrgScope(scope);
      return service.mergeRunItems({ ...input, organizationId });
    },
    onSuccess: (_res, vars) => {
      qc.invalidateQueries({ queryKey: queryFamilies.shoppingRunFamily(vars.targetRunId) });
      if (scope.organizationId)
        qc.invalidateQueries({ queryKey: queryFamilies.allShoppingRuns(scope.organizationId) });
    },
  });
}
