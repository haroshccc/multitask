import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as service from "@/lib/services/task-shares";

export function useTaskShares(taskId: string | null) {
  return useQuery({
    queryKey: ["task-shares", taskId],
    queryFn: () => service.listTaskShares(taskId!),
    enabled: !!taskId,
  });
}

export function useSetTaskShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orgId,
      taskId,
      userId,
      permission,
    }: {
      orgId: string;
      taskId: string;
      userId: string;
      permission: "read" | "write";
    }) => service.setTaskShare(orgId, taskId, userId, permission),
    onSuccess: (_d, { taskId }) =>
      qc.invalidateQueries({ queryKey: ["task-shares", taskId] }),
  });
}

export function useRemoveTaskShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, userId }: { taskId: string; userId: string }) =>
      service.removeTaskShare(taskId, userId),
    onSuccess: (_d, { taskId }) =>
      qc.invalidateQueries({ queryKey: ["task-shares", taskId] }),
  });
}
