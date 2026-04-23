import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import * as service from "@/lib/services/user-task-statuses";
import type {
  UserTaskStatus,
  UserTaskStatusInsert,
  UserTaskStatusUpdate,
} from "@/lib/types/domain";
import { useOrgScope } from "./useOrgScope";

/** All statuses visible to the current user (own + same-org peers). */
export function useUserTaskStatuses() {
  const scope = useOrgScope();
  return useQuery<UserTaskStatus[]>({
    queryKey: queryKeys.userTaskStatuses("all"),
    queryFn: () => service.listUserTaskStatuses(),
    enabled: scope.enabled,
  });
}

/** Own palette — what the settings screen edits and what dropdowns use. */
export function useMyTaskStatuses() {
  const scope = useOrgScope();
  return useQuery<UserTaskStatus[]>({
    queryKey: queryKeys.userTaskStatuses(scope.userId ?? ""),
    queryFn: () => service.listMyTaskStatuses(scope.userId!),
    enabled: scope.enabled && !!scope.userId,
  });
}

export function useCreateUserTaskStatus() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (
      input: Omit<UserTaskStatusInsert, "user_id">
    ) => {
      if (!scope.userId) throw new Error("no user scope");
      return service.createUserTaskStatus({ ...input, user_id: scope.userId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-task-statuses"] });
    },
  });
}

export function useUpdateUserTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      statusId,
      patch,
    }: {
      statusId: string;
      patch: UserTaskStatusUpdate;
    }) => service.updateUserTaskStatus(statusId, patch),
    onMutate: async ({ statusId, patch }) => {
      // Best-effort optimistic update across every variant of the key
      const snap = qc.getQueriesData<UserTaskStatus[]>({
        queryKey: ["user-task-statuses"],
      });
      for (const [key, list] of snap) {
        if (!list) continue;
        qc.setQueryData<UserTaskStatus[]>(
          key,
          list.map((s) =>
            s.id === statusId ? ({ ...s, ...patch } as UserTaskStatus) : s
          )
        );
      }
      return { snap };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snap.forEach(([key, value]) => qc.setQueryData(key, value));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["user-task-statuses"] });
    },
  });
}

export function useDeleteUserTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (statusId: string) => service.deleteUserTaskStatus(statusId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-task-statuses"] });
    },
  });
}

export function useReorderUserTaskStatuses() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (updates: { id: string; sort_order: number }[]) =>
      service.reorderUserTaskStatuses(updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-task-statuses"] });
    },
  });
}
