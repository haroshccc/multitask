import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import * as service from "@/lib/services/user-prefs";
import type { DashboardScreen } from "@/lib/types/domain";
import { useOrgScope } from "./useOrgScope";

export function useListVisibility(screenKey: DashboardScreen) {
  const scope = useOrgScope();
  return useQuery({
    queryKey: queryKeys.listVisibility(scope.userId ?? "", screenKey),
    queryFn: () => service.getListVisibility(scope.userId!, screenKey),
    enabled: scope.enabled,
  });
}

export function useSetListVisibility() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({
      screenKey,
      hiddenListIds,
    }: {
      screenKey: DashboardScreen;
      hiddenListIds: string[];
    }) =>
      service.upsertListVisibility({
        user_id: scope.userId!,
        screen_key: screenKey,
        hidden_list_ids: hiddenListIds,
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: queryKeys.listVisibility(scope.userId ?? "", vars.screenKey),
      });
    },
  });
}
