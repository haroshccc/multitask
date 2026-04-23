import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { queryKeys, queryFamilies } from "@/lib/query-keys";
import * as tasksService from "@/lib/services/tasks";
import type {
  Task,
  TaskInsert,
  TaskUpdate,
  FilterConfig,
} from "@/lib/types/domain";
import { useOrgScope, assertOrgScope } from "./useOrgScope";

export function useTasks(
  filters: FilterConfig = {},
  options?: Partial<UseQueryOptions<Task[]>>
) {
  const scope = useOrgScope();
  return useQuery<Task[]>({
    queryKey: queryKeys.tasks(scope.organizationId ?? "", filters),
    queryFn: () => tasksService.listTasks(scope.organizationId!, filters),
    enabled: scope.enabled && (options?.enabled ?? true),
    ...options,
  });
}

export function useTask(taskId: string | null | undefined) {
  return useQuery<Task | null>({
    queryKey: queryKeys.task(taskId ?? ""),
    queryFn: () => tasksService.getTask(taskId!),
    enabled: !!taskId,
  });
}

export function useTasksByList(listId: string | null) {
  const scope = useOrgScope();
  return useQuery<Task[]>({
    queryKey: queryKeys.tasksByList(scope.organizationId ?? "", listId),
    queryFn: () => tasksService.listTasksByList(scope.organizationId!, listId),
    enabled: scope.enabled,
  });
}

export function useTasksByProject(projectId: string | null | undefined) {
  const scope = useOrgScope();
  return useQuery<Task[]>({
    queryKey: queryKeys.tasksByProject(scope.organizationId ?? "", projectId ?? ""),
    queryFn: () => tasksService.listTasksByProject(scope.organizationId!, projectId!),
    enabled: scope.enabled && !!projectId,
  });
}

// Mutations ------------------------------------------------------------------

export function useCreateTask() {
  const qc = useQueryClient();
  const scope = useOrgScope();

  return useMutation({
    mutationFn: (input: Omit<TaskInsert, "organization_id" | "owner_id">) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return tasksService.createTask({
        ...input,
        organization_id: organizationId,
        owner_id: userId,
      });
    },
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({ queryKey: queryFamilies.allTasks(scope.organizationId) });
      }
    },
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  const scope = useOrgScope();

  return useMutation({
    mutationFn: ({ taskId, patch }: { taskId: string; patch: TaskUpdate }) =>
      tasksService.updateTask(taskId, patch),
    // Optimistic update: patch the cached task immediately so UI feels snappy.
    onMutate: async ({ taskId, patch }) => {
      await qc.cancelQueries({ queryKey: queryKeys.task(taskId) });
      const previous = qc.getQueryData<Task>(queryKeys.task(taskId));
      if (previous) {
        qc.setQueryData<Task>(queryKeys.task(taskId), { ...previous, ...patch } as Task);
      }
      return { previous };
    },
    onError: (_err, { taskId }, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(queryKeys.task(taskId), ctx.previous);
      }
    },
    onSettled: (_data, _err, { taskId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.task(taskId) });
      if (scope.organizationId) {
        qc.invalidateQueries({ queryKey: queryFamilies.allTasks(scope.organizationId) });
      }
    },
  });
}

export function useCompleteTask() {
  const qc = useQueryClient();
  const scope = useOrgScope();

  return useMutation({
    mutationFn: ({ taskId, completed }: { taskId: string; completed: boolean }) =>
      tasksService.completeTask(taskId, completed),
    onSuccess: (task) => {
      qc.setQueryData(queryKeys.task(task.id), task);
      if (scope.organizationId) {
        qc.invalidateQueries({ queryKey: queryFamilies.allTasks(scope.organizationId) });
      }
    },
  });
}

export function useReorderTasks() {
  const qc = useQueryClient();
  const scope = useOrgScope();

  return useMutation({
    mutationFn: (updates: { id: string; sort_order: number }[]) =>
      tasksService.reorderTasks(updates),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({ queryKey: queryFamilies.allTasks(scope.organizationId) });
      }
    },
  });
}

export function useMoveTaskToList() {
  const qc = useQueryClient();
  const scope = useOrgScope();

  return useMutation({
    mutationFn: ({ taskId, listId }: { taskId: string; listId: string | null }) =>
      tasksService.moveTaskToList(taskId, listId),
    onSuccess: (task) => {
      qc.setQueryData(queryKeys.task(task.id), task);
      if (scope.organizationId) {
        qc.invalidateQueries({ queryKey: queryFamilies.allTasks(scope.organizationId) });
      }
    },
  });
}

export function useSetTaskParent() {
  const qc = useQueryClient();
  const scope = useOrgScope();

  return useMutation({
    mutationFn: ({ taskId, parentId }: { taskId: string; parentId: string | null }) =>
      tasksService.setTaskParent(taskId, parentId),
    onSuccess: (task) => {
      qc.setQueryData(queryKeys.task(task.id), task);
      if (scope.organizationId) {
        qc.invalidateQueries({ queryKey: queryFamilies.allTasks(scope.organizationId) });
      }
    },
  });
}

export function useDuplicateTaskTree() {
  const qc = useQueryClient();
  const scope = useOrgScope();

  return useMutation({
    mutationFn: ({
      sourceTaskId,
      targetListId,
      targetParentId,
    }: {
      sourceTaskId: string;
      targetListId?: string;
      targetParentId?: string;
    }) => tasksService.duplicateTaskTree(sourceTaskId, targetListId, targetParentId),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({ queryKey: queryFamilies.allTasks(scope.organizationId) });
      }
    },
  });
}

export function useDuplicateTask() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({
      sourceTaskId,
      targetListId,
    }: {
      sourceTaskId: string;
      targetListId?: string | null;
    }) => tasksService.duplicateTask(sourceTaskId, targetListId),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({ queryKey: queryFamilies.allTasks(scope.organizationId) });
      }
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (taskId: string) => tasksService.deleteTask(taskId),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({ queryKey: queryFamilies.allTasks(scope.organizationId) });
      }
    },
  });
}

// Dependencies ---------------------------------------------------------------

export function useTaskDependencies(taskId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.taskDependencies(taskId ?? ""),
    queryFn: () => tasksService.listTaskDependencies(taskId!),
    enabled: !!taskId,
  });
}

export function useCreateTaskDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      dependsOnTaskId,
      relation,
      lagDays,
    }: {
      taskId: string;
      dependsOnTaskId: string;
      relation?: "finish_to_start" | "start_to_start" | "finish_to_finish" | "start_to_finish";
      lagDays?: number;
    }) =>
      tasksService.createTaskDependency(taskId, dependsOnTaskId, relation, lagDays),
    onSuccess: (_dep, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.taskDependencies(vars.taskId) });
      qc.invalidateQueries({
        queryKey: queryKeys.taskDependencies(vars.dependsOnTaskId),
      });
    },
  });
}

export function useDeleteTaskDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (depId: string) => tasksService.deleteTaskDependency(depId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task"] });
    },
  });
}
