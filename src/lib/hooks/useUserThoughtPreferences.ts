import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import * as service from "@/lib/services/user-thought-preferences";
import type { UserThoughtPreferences } from "@/lib/services/user-thought-preferences";
import { useOrgScope } from "./useOrgScope";

export function useUserThoughtPreferences() {
  const scope = useOrgScope();
  return useQuery<UserThoughtPreferences>({
    queryKey: queryKeys.userThoughtPreferences(scope.userId ?? ""),
    queryFn: () => service.getUserThoughtPreferences(scope.userId!),
    enabled: scope.enabled && !!scope.userId,
  });
}

export function useUpdateUserThoughtPreferences() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (
      patch: Partial<Pick<UserThoughtPreferences, "auto_transcribe_recorded_thoughts">>
    ) => {
      if (!scope.userId) throw new Error("no user scope");
      return service.upsertUserThoughtPreferences(scope.userId, patch);
    },
    onMutate: async (patch) => {
      if (!scope.userId) return;
      const key = queryKeys.userThoughtPreferences(scope.userId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<UserThoughtPreferences>(key);
      if (prev) qc.setQueryData<UserThoughtPreferences>(key, { ...prev, ...patch });
      return { prev };
    },
    onError: (_err, _patch, ctx) => {
      if (!scope.userId || !ctx?.prev) return;
      qc.setQueryData(queryKeys.userThoughtPreferences(scope.userId), ctx.prev);
    },
    onSettled: () => {
      if (!scope.userId) return;
      qc.invalidateQueries({
        queryKey: queryKeys.userThoughtPreferences(scope.userId),
      });
    },
  });
}
