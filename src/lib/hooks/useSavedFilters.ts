import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import * as service from "@/lib/services/user-prefs";
import type { DashboardScreen, FilterConfig } from "@/lib/types/domain";
import { useOrgScope } from "./useOrgScope";

export function useSavedFilters(screenKey: DashboardScreen) {
  const scope = useOrgScope();
  return useQuery({
    queryKey: queryKeys.savedFilters(scope.userId ?? "", screenKey),
    queryFn: () => service.listSavedFilters(scope.userId!, screenKey),
    enabled: scope.enabled,
  });
}

export function useCreateSavedFilter() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: {
      screenKey: DashboardScreen;
      name: string;
      filter_config: FilterConfig;
      is_default?: boolean;
    }) =>
      service.createSavedFilter({
        user_id: scope.userId!,
        screen_key: input.screenKey,
        name: input.name,
        filter_config: input.filter_config,
        is_default: input.is_default,
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: queryKeys.savedFilters(scope.userId ?? "", vars.screenKey),
      });
    },
  });
}

export function useUpdateSavedFilter() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({
      filterId,
      patch,
    }: {
      filterId: string;
      screenKey: DashboardScreen;
      patch: Parameters<typeof service.updateSavedFilter>[1];
    }) => service.updateSavedFilter(filterId, patch),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: queryKeys.savedFilters(scope.userId ?? "", vars.screenKey),
      });
    },
  });
}

export function useDeleteSavedFilter() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({
      filterId,
    }: {
      filterId: string;
      screenKey: DashboardScreen;
    }) => service.deleteSavedFilter(filterId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: queryKeys.savedFilters(scope.userId ?? "", vars.screenKey),
      });
    },
  });
}
