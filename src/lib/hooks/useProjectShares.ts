import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as service from "@/lib/services/project-shares";
export type { ProjectShareRow } from "@/lib/services/project-shares";

export function useProjectShares(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["project-shares", projectId ?? ""],
    queryFn: () => service.listProjectShares(projectId!),
    enabled: !!projectId,
  });
}

export function useSetProjectShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orgId,
      projectId,
      userId,
      permission,
    }: {
      orgId: string;
      projectId: string;
      userId: string;
      permission: "read" | "write";
    }) => service.setProjectShare(orgId, projectId, userId, permission),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: ["project-shares", projectId] }),
  });
}

export function useRemoveProjectShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, userId }: { projectId: string; userId: string }) =>
      service.removeProjectShare(projectId, userId),
    onSuccess: (_d, { projectId }) =>
      qc.invalidateQueries({ queryKey: ["project-shares", projectId] }),
  });
}
