import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, queryFamilies } from "@/lib/query-keys";
import * as service from "@/lib/services/projects";
import type {
  Project,
  ProjectInsert,
  ProjectUpdate,
  ProjectExpense,
  FilterConfig,
} from "@/lib/types/domain";
import { useOrgScope, assertOrgScope } from "./useOrgScope";

export function useProjects(filters: FilterConfig = {}, includeArchived = false) {
  const scope = useOrgScope();
  return useQuery<Project[]>({
    queryKey: queryKeys.projects(scope.organizationId ?? "", filters),
    queryFn: () =>
      service.listProjects(scope.organizationId!, filters, includeArchived),
    enabled: scope.enabled,
  });
}

export function useProject(projectId: string | null | undefined) {
  return useQuery<Project | null>({
    queryKey: queryKeys.project(projectId ?? ""),
    queryFn: () => service.getProject(projectId!),
    enabled: !!projectId,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: Omit<ProjectInsert, "organization_id" | "owner_id">) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createProject({
        ...input,
        organization_id: organizationId,
        owner_id: userId,
      });
    },
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allProjects(scope.organizationId),
        });
        qc.invalidateQueries({
          queryKey: queryFamilies.allTaskLists(scope.organizationId),
        });
      }
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ projectId, patch }: { projectId: string; patch: ProjectUpdate }) =>
      service.updateProject(projectId, patch),
    onMutate: async ({ projectId, patch }) => {
      await qc.cancelQueries({ queryKey: queryKeys.project(projectId) });
      const previous = qc.getQueryData<Project>(queryKeys.project(projectId));
      if (previous) {
        qc.setQueryData<Project>(queryKeys.project(projectId), {
          ...previous,
          ...patch,
        } as Project);
      }
      return { previous };
    },
    onError: (_err, { projectId }, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.project(projectId), ctx.previous);
    },
    onSettled: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allProjects(scope.organizationId),
        });
      }
    },
  });
}

export function useArchiveProject() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (projectId: string) => service.archiveProject(projectId),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allProjects(scope.organizationId),
        });
        qc.invalidateQueries({
          queryKey: queryFamilies.allTaskLists(scope.organizationId),
        });
      }
    },
  });
}

export function useRestoreProject() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (projectId: string) => service.restoreProject(projectId),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allProjects(scope.organizationId),
        });
      }
    },
  });
}

// Expenses -------------------------------------------------------------------

export function useProjectExpenses(projectId: string | null | undefined) {
  return useQuery<ProjectExpense[]>({
    queryKey: queryKeys.projectExpenses(projectId ?? ""),
    queryFn: () => service.listProjectExpenses(projectId!),
    enabled: !!projectId,
  });
}

export function useCreateProjectExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { project_id: string; label: string; amount_cents: number }) =>
      service.createProjectExpense(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.projectExpenses(vars.project_id) });
    },
  });
}

export function useUpdateProjectExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      expenseId,
      patch,
    }: {
      expenseId: string;
      projectId: string;
      patch: Partial<Pick<ProjectExpense, "label" | "amount_cents" | "sort_order">>;
    }) => service.updateProjectExpense(expenseId, patch),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.projectExpenses(vars.projectId) });
    },
  });
}

export function useDeleteProjectExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId }: { expenseId: string; projectId: string }) =>
      service.deleteProjectExpense(expenseId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.projectExpenses(vars.projectId) });
    },
  });
}
