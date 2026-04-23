import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, queryFamilies } from "@/lib/query-keys";
import * as service from "@/lib/services/thoughts";
import type {
  Thought,
  ThoughtInsert,
  ThoughtUpdate,
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

export function useAssignThoughtToList() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ thoughtId, listId }: { thoughtId: string; listId: string }) =>
      service.assignThoughtToList(thoughtId, listId),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allThoughts(scope.organizationId),
        });
      }
    },
  });
}

export function useUnassignThoughtFromList() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ thoughtId, listId }: { thoughtId: string; listId: string }) =>
      service.unassignThoughtFromList(thoughtId, listId),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allThoughts(scope.organizationId),
        });
      }
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
    },
  });
}
