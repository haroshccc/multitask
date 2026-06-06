import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as service from "@/lib/services/project-payments";
import { useOrgScope, assertOrgScope } from "./useOrgScope";
export type { ProjectPayment } from "@/lib/services/project-payments";

const key = (projectId: string) => ["project-payments", projectId];

export function useProjectPayments(projectId: string | null | undefined) {
  return useQuery({
    queryKey: key(projectId ?? ""),
    queryFn: () => service.listProjectPayments(projectId!),
    enabled: !!projectId,
  });
}

export function useCreateProjectPayment() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: {
      projectId: string;
      title?: string;
      direction?: string;
      amount_cents?: number;
      currency?: string;
      status?: string;
    }) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createProjectPayment({
        organization_id: organizationId,
        owner_id: userId,
        project_id: input.projectId,
        title: input.title ?? "",
        direction: input.direction ?? "in",
        amount_cents: input.amount_cents ?? 0,
        currency: input.currency ?? "ILS",
        status: input.status ?? "pending",
      });
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: key(vars.projectId) }),
  });
}

export function useUpdateProjectPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      projectId: string;
      patch: service.ProjectPaymentUpdate;
    }) => service.updateProjectPayment(id, patch),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: key(vars.projectId) }),
  });
}

export function useDeleteProjectPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) =>
      service.deleteProjectPayment(id),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: key(vars.projectId) }),
  });
}
