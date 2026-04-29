import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as service from "@/lib/services/project-templates";
import type { ProjectTemplate } from "@/lib/types/domain";
import { useOrgScope, assertOrgScope } from "./useOrgScope";

export function useProjectTemplates() {
  const scope = useOrgScope();
  return useQuery<ProjectTemplate[]>({
    queryKey: ["project_templates", scope.organizationId ?? ""],
    queryFn: () => service.listProjectTemplates(scope.organizationId!),
    enabled: scope.enabled,
  });
}

export function useApplyProjectTemplate() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({
      templateId,
      projectId,
    }: {
      templateId: string;
      projectId: string;
    }) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.applyTemplateToProject({
        templateId,
        projectId,
        organizationId,
        ownerId: userId,
      });
    },
    onSuccess: () => {
      if (scope.organizationId) {
        // Tasks list & tasks themselves will refetch.
        qc.invalidateQueries({
          predicate: (q) => {
            const k = q.queryKey?.[0];
            return (
              k === "tasks" || k === "task_lists" || k === "tasks_by_project"
            );
          },
        });
      }
    },
  });
}
