import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, queryFamilies } from "@/lib/query-keys";
import * as service from "@/lib/services/thought-developments";
import type {
  ThoughtDevelopment,
  ThoughtDevelopmentFile,
  ThoughtDevelopmentShare,
} from "@/lib/types/thought-developments";
import { useOrgScope, assertOrgScope } from "./useOrgScope";

// ---------------------------------------------------------------------------
// Developments
// ---------------------------------------------------------------------------

export function useThoughtDevelopments() {
  const scope = useOrgScope();
  return useQuery<ThoughtDevelopment[]>({
    queryKey: queryKeys.thoughtDevelopments(scope.organizationId ?? ""),
    queryFn: () => service.listThoughtDevelopments(scope.organizationId!),
    enabled: scope.enabled,
  });
}

export function useThoughtDevelopment(id: string | null | undefined) {
  return useQuery<ThoughtDevelopment | null>({
    queryKey: queryKeys.thoughtDevelopment(id ?? ""),
    queryFn: () => service.getThoughtDevelopment(id!),
    enabled: !!id,
  });
}

export function useCreateThoughtDevelopment() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (
      input: Omit<
        service.CreateThoughtDevelopmentInput,
        "organization_id" | "owner_id"
      >
    ) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createThoughtDevelopment({
        ...input,
        organization_id: organizationId,
        owner_id: userId,
      });
    },
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allThoughtDevelopments(scope.organizationId),
        });
      }
    },
  });
}

export function useUpdateThoughtDevelopment() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: service.ThoughtDevelopmentPatch;
    }) => service.updateThoughtDevelopment(id, patch),
    onSuccess: (dev) => {
      qc.setQueryData(queryKeys.thoughtDevelopment(dev.id), dev);
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allThoughtDevelopments(scope.organizationId),
        });
      }
    },
  });
}

export function useDeleteThoughtDevelopment() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (id: string) => service.deleteThoughtDevelopment(id),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allThoughtDevelopments(scope.organizationId),
        });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

export function useThoughtDevelopmentFiles(id: string | null | undefined) {
  return useQuery<ThoughtDevelopmentFile[]>({
    queryKey: queryKeys.thoughtDevelopmentFiles(id ?? ""),
    queryFn: () => service.listThoughtDevelopmentFiles(id!),
    enabled: !!id,
  });
}

/** Bulk file load for the cards/table grid (one query for all developments). */
export function useFilesForDevelopments(developmentIds: string[]) {
  const scope = useOrgScope();
  const key = [...developmentIds].sort().join(",");
  return useQuery<ThoughtDevelopmentFile[]>({
    queryKey: ["thought-development-files-batch", scope.organizationId ?? "", key],
    queryFn: () => service.listFilesForDevelopments(developmentIds),
    enabled: scope.enabled && developmentIds.length > 0,
  });
}

export function useAddThoughtDevelopmentFile() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (
      input: Omit<service.AddThoughtDevelopmentFileInput, "organization_id">
    ) => {
      const { organizationId } = assertOrgScope(scope);
      return service.addThoughtDevelopmentFile({
        ...input,
        organization_id: organizationId,
      });
    },
    onSuccess: (file) => {
      qc.invalidateQueries({
        queryKey: queryKeys.thoughtDevelopmentFiles(file.thought_development_id),
      });
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: ["thought-development-files-batch", scope.organizationId],
        });
      }
    },
  });
}

export function useDeleteThoughtDevelopmentFile() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ fileId }: { fileId: string; developmentId: string }) =>
      service.deleteThoughtDevelopmentFile(fileId),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({
        queryKey: queryKeys.thoughtDevelopmentFiles(vars.developmentId),
      });
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: ["thought-development-files-batch", scope.organizationId],
        });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Sharing
// ---------------------------------------------------------------------------

export function useThoughtDevelopmentShares(id: string | null | undefined) {
  return useQuery<ThoughtDevelopmentShare[]>({
    queryKey: queryKeys.thoughtDevelopmentShares(id ?? ""),
    queryFn: () => service.listThoughtDevelopmentShares(id!),
    enabled: !!id,
  });
}

/** Bulk share rows for the cards/table grid (powers "shared / mine" badges). */
export function useSharesForDevelopments(developmentIds: string[]) {
  const scope = useOrgScope();
  const key = [...developmentIds].sort().join(",");
  return useQuery({
    queryKey: ["thought-development-shares-batch", scope.organizationId ?? "", key],
    queryFn: () => service.listSharesForDevelopments(developmentIds),
    enabled: scope.enabled && developmentIds.length > 0,
  });
}

export function useSetThoughtDevelopmentShare() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({
      id,
      userId,
      permission,
    }: {
      id: string;
      userId: string;
      permission: "read" | "write";
    }) => {
      const { organizationId } = assertOrgScope(scope);
      return service.setThoughtDevelopmentShare(
        organizationId,
        id,
        userId,
        permission
      );
    },
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({
        queryKey: queryKeys.thoughtDevelopmentShares(id),
      });
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: ["thought-development-shares-batch", scope.organizationId],
        });
      }
    },
  });
}

export function useRemoveThoughtDevelopmentShare() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      service.removeThoughtDevelopmentShare(id, userId),
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({
        queryKey: queryKeys.thoughtDevelopmentShares(id),
      });
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: ["thought-development-shares-batch", scope.organizationId],
        });
      }
    },
  });
}
