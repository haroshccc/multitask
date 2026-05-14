import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as service from "@/lib/services/task-assignees";
export type { TaskAssigneeRow } from "@/lib/services/task-assignees";

export function useTaskAssignees(taskId: string | null) {
  return useQuery({
    queryKey: ["task-assignees", taskId],
    queryFn: () => service.listTaskAssignees(taskId!),
    enabled: !!taskId,
  });
}

export function useAddTaskAssignee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      userId,
      orgId,
    }: {
      taskId: string;
      userId: string;
      orgId: string;
    }) => service.addTaskAssignee(taskId, userId, orgId),
    onSuccess: (_d, { taskId }) =>
      qc.invalidateQueries({ queryKey: ["task-assignees", taskId] }),
  });
}

export function useRemoveTaskAssignee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, userId }: { taskId: string; userId: string }) =>
      service.removeTaskAssignee(taskId, userId),
    onSuccess: (_d, { taskId }) =>
      qc.invalidateQueries({ queryKey: ["task-assignees", taskId] }),
  });
}
