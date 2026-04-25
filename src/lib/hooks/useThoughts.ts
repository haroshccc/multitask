import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, queryFamilies } from "@/lib/query-keys";
import * as service from "@/lib/services/thoughts";
import type {
  Thought,
  ThoughtInsert,
  ThoughtUpdate,
  ThoughtListAssignment,
  ThoughtProcessing,
  ThoughtProcessingTarget,
} from "@/lib/types/domain";
import { useOrgScope, assertOrgScope } from "./useOrgScope";

export function useThoughts(options?: {
  status?: "unprocessed" | "processed" | "archived";
  listId?: string | null;
  includeArchived?: boolean;
}) {
  const scope = useOrgScope();
  return useQuery<Thought[]>({
    queryKey: queryKeys.thoughts(scope.organizationId ?? "", options),
    queryFn: () => service.listThoughts(scope.organizationId!, options),
    enabled: scope.enabled,
  });
}

export function useThought(thoughtId: string | null | undefined) {
  return useQuery<Thought | null>({
    queryKey: queryKeys.thought(thoughtId ?? ""),
    queryFn: () => service.getThought(thoughtId!),
    enabled: !!thoughtId,
  });
}

export function useCreateThought() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (
      input: Omit<ThoughtInsert, "organization_id" | "owner_id">
    ) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createThought({
        ...input,
        organization_id: organizationId,
        owner_id: userId,
      });
    },
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allThoughts(scope.organizationId),
        });
      }
    },
  });
}

export function useUpdateThought() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({
      thoughtId,
      patch,
    }: {
      thoughtId: string;
      patch: ThoughtUpdate;
    }) => service.updateThought(thoughtId, patch),
    onMutate: async ({ thoughtId, patch }) => {
      await qc.cancelQueries({ queryKey: queryKeys.thought(thoughtId) });
      const previous = qc.getQueryData<Thought>(queryKeys.thought(thoughtId));
      if (previous) {
        qc.setQueryData<Thought>(queryKeys.thought(thoughtId), {
          ...previous,
          ...patch,
        } as Thought);
      }
      return { previous };
    },
    onError: (_err, { thoughtId }, ctx) => {
      if (ctx?.previous) qc.setQueryData(queryKeys.thought(thoughtId), ctx.previous);
    },
    onSettled: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allThoughts(scope.organizationId),
        });
      }
    },
  });
}

export function useMarkThoughtProcessed() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ thoughtId, processed }: { thoughtId: string; processed: boolean }) =>
      service.markProcessed(thoughtId, processed),
    onSuccess: (thought) => {
      qc.setQueryData(queryKeys.thought(thought.id), thought);
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allThoughts(scope.organizationId),
        });
      }
    },
  });
}

export function useArchiveThought() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (thoughtId: string) => service.archiveThought(thoughtId),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allThoughts(scope.organizationId),
        });
      }
    },
  });
}

export function useRestoreThought() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (thoughtId: string) => service.restoreThought(thoughtId),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allThoughts(scope.organizationId),
        });
      }
    },
  });
}

// Assignments ---------------------------------------------------------------

export function useThoughtAssignments(thoughtId: string | null | undefined) {
  return useQuery<ThoughtListAssignment[]>({
    queryKey: ["thought", thoughtId ?? "", "assignments"] as const,
    queryFn: () => service.listThoughtAssignments(thoughtId!),
    enabled: !!thoughtId,
  });
}

/**
 * Bulk assignments for many thoughts in one round-trip — feeds the cards
 * grid without issuing N queries.
 */
export function useBulkThoughtAssignments(thoughtIds: string[]) {
  const scope = useOrgScope();
  const key = thoughtIds.slice().sort().join(",");
  return useQuery<ThoughtListAssignment[]>({
    queryKey: [
      "thought-assignments",
      scope.organizationId ?? "",
      key,
    ] as const,
    queryFn: () => service.listAssignmentsForThoughts(thoughtIds),
    enabled: scope.enabled && thoughtIds.length > 0,
  });
}

/** Invalidate everything that depends on a thought's list assignments,
 *  including the bulk-assignments query that the Thoughts page reads. */
function invalidateAssignmentQueries(
  qc: ReturnType<typeof useQueryClient>,
  orgId: string | null,
  thoughtId: string
) {
  if (orgId) {
    qc.invalidateQueries({ queryKey: queryFamilies.allThoughts(orgId) });
    // The bulk hook keys live under ["thought-assignments", orgId, ...]
    qc.invalidateQueries({ queryKey: ["thought-assignments", orgId] });
  }
  // The single-thought assignments query.
  qc.invalidateQueries({ queryKey: ["thought", thoughtId, "assignments"] });
}

export function useAssignThoughtToList() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ thoughtId, listId }: { thoughtId: string; listId: string }) =>
      service.assignThoughtToList(thoughtId, listId),
    onSuccess: (_data, vars) => {
      invalidateAssignmentQueries(qc, scope.organizationId ?? null, vars.thoughtId);
    },
  });
}

export function useUnassignThoughtFromList() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ thoughtId, listId }: { thoughtId: string; listId: string }) =>
      service.unassignThoughtFromList(thoughtId, listId),
    onSuccess: (_data, vars) => {
      invalidateAssignmentQueries(qc, scope.organizationId ?? null, vars.thoughtId);
    },
  });
}

// Processings ---------------------------------------------------------------

export function useThoughtProcessings(thoughtId: string | null | undefined) {
  return useQuery<ThoughtProcessing[]>({
    queryKey: queryKeys.thoughtProcessings(thoughtId ?? ""),
    queryFn: () => service.listThoughtProcessings(thoughtId!),
    enabled: !!thoughtId,
  });
}

export function useRecordThoughtProcessing() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: {
      thought_id: string;
      target_type: ThoughtProcessingTarget;
      target_id: string;
      ai_suggested: boolean;
      created_by?: string;
    }) => service.recordThoughtProcessing(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.thoughtProcessings(vars.thought_id) });
      // Also invalidate any bulk-count queries so the per-card badge refreshes.
      if (scope.organizationId) {
        qc.invalidateQueries({ queryKey: ["thought-processing-counts", scope.organizationId] });
      }
    },
  });
}

/** Bulk processing counts — one query for many thoughts; powers the
 *  per-card "have I done anything from this thought yet?" badge. */
export function useBulkThoughtProcessingCounts(thoughtIds: string[]) {
  const scope = useOrgScope();
  const key = thoughtIds.slice().sort().join(",");
  return useQuery<Map<string, number>>({
    queryKey: [
      "thought-processing-counts",
      scope.organizationId ?? "",
      key,
    ] as const,
    queryFn: () => service.countProcessingsForThoughts(thoughtIds),
    enabled: scope.enabled && thoughtIds.length > 0,
  });
}
