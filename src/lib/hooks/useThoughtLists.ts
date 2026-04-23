import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, queryFamilies } from "@/lib/query-keys";
import * as service from "@/lib/services/thought-lists";
import type { ThoughtList } from "@/lib/types/domain";
import { useOrgScope, assertOrgScope } from "./useOrgScope";

export function useThoughtLists() {
  const scope = useOrgScope();
  return useQuery<ThoughtList[]>({
    queryKey: queryKeys.thoughtLists(scope.organizationId ?? ""),
    queryFn: () =>
      service.listThoughtLists(scope.organizationId!, scope.userId!),
    enabled: scope.enabled,
  });
}

export function useCreateThoughtList() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: { name: string; emoji?: string; color?: string }) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createThoughtList({
        ...input,
        organization_id: organizationId,
        owner_id: userId,
      });
    },
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allThoughtLists(scope.organizationId),
        });
      }
    },
  });
}

export function useUpdateThoughtList() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({
      listId,
      patch,
    }: {
      listId: string;
      patch: Partial<Pick<ThoughtList, "name" | "emoji" | "color" | "sort_order">>;
    }) => service.updateThoughtList(listId, patch),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allThoughtLists(scope.organizationId),
        });
      }
    },
  });
}

export function useArchiveThoughtList() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (listId: string) => service.archiveThoughtList(listId),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allThoughtLists(scope.organizationId),
        });
      }
    },
  });
}
