import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, queryFamilies } from "@/lib/query-keys";
import * as service from "@/lib/services/task-lists";
import type { TaskList, TaskListInsert, TaskListUpdate } from "@/lib/types/domain";
import { useOrgScope, assertOrgScope } from "./useOrgScope";

export function useTaskLists(includeArchived = false) {
  const scope = useOrgScope();
  return useQuery<TaskList[]>({
    queryKey: queryKeys.taskLists(scope.organizationId ?? ""),
    queryFn: () => service.listTaskLists(scope.organizationId!, includeArchived),
    enabled: scope.enabled,
  });
}

export function useTaskList(listId: string | null | undefined) {
  return useQuery<TaskList | null>({
    queryKey: queryKeys.taskList(listId ?? ""),
    queryFn: () => service.getTaskList(listId!),
    enabled: !!listId,
  });
}

export function useCreateTaskList() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (
      input: Omit<TaskListInsert, "organization_id" | "owner_id">
    ) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createTaskList({
        ...input,
        organization_id: organizationId,
        owner_id: userId,
      });
    },
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allTaskLists(scope.organizationId),
        });
      }
    },
  });
}

export function useUpdateTaskList() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ listId, patch }: { listId: string; patch: TaskListUpdate }) =>
      service.updateTaskList(listId, patch),
    onMutate: async ({ listId, patch }) => {
      await qc.cancelQueries({ queryKey: queryKeys.taskList(listId) });
      const previous = qc.getQueryData<TaskList>(queryKeys.taskList(listId));
      if (previous) {
        qc.setQueryData<TaskList>(queryKeys.taskList(listId), {
          ...previous,
          ...patch,
        } as TaskList);
      }
      return { previous };
    },
    onError: (_err, { listId }, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.taskList(listId), ctx.previous);
    },
    onSettled: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allTaskLists(scope.organizationId),
        });
      }
    },
  });
}

export function useArchiveTaskList() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (listId: string) => service.archiveTaskList(listId),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allTaskLists(scope.organizationId),
        });
        qc.invalidateQueries({ queryKey: queryFamilies.allTasks(scope.organizationId) });
      }
    },
  });
}

export function useRestoreTaskList() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (listId: string) => service.restoreTaskList(listId),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allTaskLists(scope.organizationId),
        });
      }
    },
  });
}

export function useReorderTaskLists() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (updates: { id: string; sort_order: number }[]) =>
      service.reorderTaskLists(updates),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allTaskLists(scope.organizationId),
        });
      }
    },
  });
}
