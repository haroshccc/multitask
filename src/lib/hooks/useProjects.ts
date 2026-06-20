import { useEffect, useMemo, useRef } from "react";
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
import { useTaskLists } from "./useTaskLists";
import { getProjectState } from "@/lib/projects/state";

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

/**
 * Debounced patch accumulator for project updates. Use from blocks that fire
 * many small mutations (slider drags, tag edits) — pending patches are merged
 * and flushed `delayMs` after the last call.
 */
export function useDebouncedProjectUpdate(
  projectId: string | null | undefined,
  delayMs = 600
) {
  const update = useUpdateProject();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<ProjectUpdate>({});

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const scheduleUpdate = (patch: ProjectUpdate) => {
    if (!projectId) return;
    pending.current = { ...pending.current, ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const next = pending.current;
      pending.current = {};
      update.mutate({ projectId, patch: next });
    }, delayMs);
  };

  const flush = () => {
    if (!projectId || !timer.current) return;
    clearTimeout(timer.current);
    timer.current = null;
    const next = pending.current;
    pending.current = {};
    if (Object.keys(next).length > 0) {
      update.mutate({ projectId, patch: next });
    }
  };

  return { scheduleUpdate, flush, saving: update.isPending };
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

/** Set of *hidden* project ids — anything not in the "active" state (i.e.
 *  inactive OR completed). Their tasks/events/lists are kept out of the task
 *  list, calendar and Gantt until the project is set back to active. */
export function useHiddenProjectIds(): Set<string> {
  const { data: projects = [] } = useProjects({}, true);
  return useMemo(
    () =>
      new Set(
        projects.filter((p) => getProjectState(p) !== "active").map((p) => p.id)
      ),
    [projects]
  );
}

/**
 * Set of task-list ids that belong to a *hidden* project (inactive or
 * completed). Used to hide their tasks/lists from the task list, calendar and
 * Gantt. Relies on the shared (cached) projects + task-lists queries.
 */
export function useHiddenProjectListIds(): Set<string> {
  const { data: projects = [] } = useProjects({}, true);
  const { data: lists = [] } = useTaskLists();
  return useMemo(() => {
    const hiddenProjects = new Set(
      projects.filter((p) => getProjectState(p) !== "active").map((p) => p.id)
    );
    const listIds = new Set<string>();
    if (hiddenProjects.size === 0) return listIds;
    for (const l of lists) {
      if (l.project_id && hiddenProjects.has(l.project_id)) listIds.add(l.id);
    }
    return listIds;
  }, [projects, lists]);
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
