import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, queryFamilies } from "@/lib/query-keys";
import * as service from "@/lib/services/frameworks";
import { useOrgScope, assertOrgScope } from "./useOrgScope";
import type {
  Framework,
  FrameworkInsert,
  FrameworkUpdate,
  FrameworkDayLabelInsert,
  FrameworkDayLabelUpdate,
  FrameworkBlockInsert,
  FrameworkBlockUpdate,
  FrameworkOccurrenceStatus,
  FrameworkVisibility,
} from "@/lib/types/frameworks";

// ── frameworks ───────────────────────────────────────────────────────────────

export function useFrameworks(includeArchived = false) {
  const scope = useOrgScope();
  return useQuery<Framework[]>({
    queryKey: queryKeys.frameworks(scope.organizationId ?? ""),
    queryFn: () => service.listFrameworks(scope.organizationId!, includeArchived),
    enabled: scope.enabled,
  });
}

export function useFramework(id: string | null | undefined) {
  return useQuery<Framework | null>({
    queryKey: queryKeys.framework(id ?? ""),
    queryFn: () => service.getFramework(id!),
    enabled: !!id,
  });
}

export function useFrameworkContent(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.frameworkContent(id ?? ""),
    queryFn: () => service.getFrameworkContent(id!),
    enabled: !!id,
  });
}

export function useFrameworkContentForMany(ids: string[]) {
  const key = ids.slice().sort().join(",");
  return useQuery({
    queryKey: ["framework-content-batch", key],
    queryFn: () => service.getFrameworkContentForMany(ids),
    enabled: ids.length > 0,
  });
}

export function useCreateFramework() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: Omit<FrameworkInsert, "organization_id" | "owner_id">) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createFramework({
        ...input,
        organization_id: organizationId,
        owner_id: userId,
      });
    },
    onSuccess: () => {
      if (scope.organizationId)
        qc.invalidateQueries({ queryKey: queryFamilies.allFrameworks(scope.organizationId) });
    },
  });
}

export function useUpdateFramework() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: FrameworkUpdate }) =>
      service.updateFramework(id, patch),
    onSuccess: (_d, vars) => {
      if (scope.organizationId)
        qc.invalidateQueries({ queryKey: queryFamilies.allFrameworks(scope.organizationId) });
      qc.invalidateQueries({ queryKey: queryFamilies.frameworkFamily(vars.id) });
    },
  });
}

export function useDeleteFramework() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (id: string) => service.deleteFramework(id),
    onSuccess: () => {
      if (scope.organizationId)
        qc.invalidateQueries({ queryKey: queryFamilies.allFrameworks(scope.organizationId) });
    },
  });
}

export function useReorderFrameworks() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (updates: { id: string; sort_order: number }[]) =>
      service.reorderFrameworks(updates),
    onSettled: () => {
      if (scope.organizationId)
        qc.invalidateQueries({ queryKey: queryFamilies.allFrameworks(scope.organizationId) });
    },
  });
}

// ── content mutations ────────────────────────────────────────────────────────

function useContentInvalidator() {
  const qc = useQueryClient();
  return (frameworkId: string) => {
    qc.invalidateQueries({ queryKey: queryKeys.frameworkContent(frameworkId) });
    qc.invalidateQueries({ queryKey: queryKeys.frameworkHistory(frameworkId) });
    // calendar batch caches
    qc.invalidateQueries({ queryKey: ["framework-content-batch"] });
  };
}

export function useCreateDayLabel() {
  const invalidate = useContentInvalidator();
  return useMutation({
    mutationFn: (payload: FrameworkDayLabelInsert) => service.createDayLabel(payload),
    onSuccess: (row) => invalidate(row.framework_id),
  });
}

export function useUpdateDayLabel() {
  const invalidate = useContentInvalidator();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: FrameworkDayLabelUpdate }) =>
      service.updateDayLabel(id, patch),
    onSuccess: (row) => invalidate(row.framework_id),
  });
}

export function useDeleteDayLabel() {
  const invalidate = useContentInvalidator();
  return useMutation({
    mutationFn: ({ id }: { id: string; frameworkId: string }) => service.deleteDayLabel(id),
    onSuccess: (_d, vars) => invalidate(vars.frameworkId),
  });
}

export function useCreateBlock() {
  const invalidate = useContentInvalidator();
  return useMutation({
    mutationFn: (payload: FrameworkBlockInsert) => service.createBlock(payload),
    onSuccess: (row) => invalidate(row.framework_id),
  });
}

export function useUpdateBlock() {
  const invalidate = useContentInvalidator();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: FrameworkBlockUpdate }) =>
      service.updateBlock(id, patch),
    onSuccess: (row) => invalidate(row.framework_id),
  });
}

export function useDeleteBlock() {
  const invalidate = useContentInvalidator();
  return useMutation({
    mutationFn: ({ id }: { id: string; frameworkId: string }) => service.deleteBlock(id),
    onSuccess: (_d, vars) => invalidate(vars.frameworkId),
  });
}

export function useSetBlockOccurrence() {
  const invalidate = useContentInvalidator();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (args: {
      blockId: string;
      frameworkId: string;
      date: string;
      status: FrameworkOccurrenceStatus | null;
    }) => {
      const { organizationId } = assertOrgScope(scope);
      return service.setBlockOccurrence({
        blockId: args.blockId,
        frameworkId: args.frameworkId,
        organizationId,
        date: args.date,
        status: args.status,
      });
    },
    onSuccess: (_d, vars) => invalidate(vars.frameworkId),
  });
}

// ── visibility ───────────────────────────────────────────────────────────────

export function useFrameworkVisibility() {
  const scope = useOrgScope();
  return useQuery<FrameworkVisibility[]>({
    queryKey: queryKeys.frameworkVisibility(scope.userId ?? "", scope.organizationId ?? ""),
    queryFn: () => service.listFrameworkVisibility(),
    enabled: scope.enabled,
  });
}

export function useSetFrameworkVisibility() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ frameworkId, isActive }: { frameworkId: string; isActive: boolean }) => {
      const { userId } = assertOrgScope(scope);
      return service.setFrameworkVisibility(userId, frameworkId, isActive);
    },
    onSuccess: () => {
      if (scope.userId && scope.organizationId)
        qc.invalidateQueries({
          queryKey: queryKeys.frameworkVisibility(scope.userId, scope.organizationId),
        });
    },
  });
}

// ── shares + history ─────────────────────────────────────────────────────────

export function useFrameworkShares(frameworkId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.frameworkShares(frameworkId ?? ""),
    queryFn: () => service.listFrameworkShares(frameworkId!),
    enabled: !!frameworkId,
  });
}

export function useAddFrameworkShare() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ frameworkId, userId }: { frameworkId: string; userId: string }) => {
      const { organizationId } = assertOrgScope(scope);
      return service.addFrameworkShare(organizationId, frameworkId, userId);
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: queryKeys.frameworkShares(vars.frameworkId) }),
  });
}

export function useRemoveFrameworkShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ frameworkId, userId }: { frameworkId: string; userId: string }) =>
      service.removeFrameworkShare(frameworkId, userId),
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: queryKeys.frameworkShares(vars.frameworkId) }),
  });
}

export function useFrameworkHistory(frameworkId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.frameworkHistory(frameworkId ?? ""),
    queryFn: () => service.listFrameworkHistory(frameworkId!),
    enabled: !!frameworkId,
  });
}
