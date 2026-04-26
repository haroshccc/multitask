import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, queryFamilies } from "@/lib/query-keys";
import * as service from "@/lib/services/recording-lists";
import type {
  RecordingList,
  RecordingListInsert,
  RecordingListUpdate,
  RecordingListAssignment,
} from "@/lib/types/domain";
import { useOrgScope, assertOrgScope } from "./useOrgScope";

export function useRecordingLists(includeArchived = false) {
  const scope = useOrgScope();
  return useQuery<RecordingList[]>({
    queryKey: queryKeys.recordingLists(scope.organizationId ?? ""),
    queryFn: () =>
      service.listRecordingLists(scope.organizationId!, { includeArchived }),
    enabled: scope.enabled,
  });
}

export function useCreateRecordingList() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (
      input: Omit<RecordingListInsert, "organization_id" | "owner_id">
    ) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createRecordingList({
        ...input,
        organization_id: organizationId,
        owner_id: userId,
      });
    },
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allRecordingLists(scope.organizationId),
        });
      }
    },
  });
}

export function useUpdateRecordingList() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ listId, patch }: { listId: string; patch: RecordingListUpdate }) =>
      service.updateRecordingList(listId, patch),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allRecordingLists(scope.organizationId),
        });
      }
    },
  });
}

export function useArchiveRecordingList() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (listId: string) => service.archiveRecordingList(listId),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.allRecordingLists(scope.organizationId),
        });
      }
    },
  });
}

// Assignments ---------------------------------------------------------------

export function useRecordingListAssignments(recordingId: string | null | undefined) {
  return useQuery<RecordingListAssignment[]>({
    queryKey: queryKeys.recordingListAssignments(recordingId ?? ""),
    queryFn: () => service.listAssignmentsForRecording(recordingId!),
    enabled: !!recordingId,
  });
}

/**
 * Every recording → list assignment the current user can see. Used for the
 * "filter by recording list" chip on the Recordings page.
 */
export function useAllRecordingAssignments() {
  const scope = useOrgScope();
  return useQuery<RecordingListAssignment[]>({
    queryKey: ["all-recording-assignments", scope.organizationId ?? ""],
    queryFn: () => service.listAllAssignments(),
    enabled: scope.enabled,
  });
}

export function useAssignRecordingToList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ recordingId, listId }: { recordingId: string; listId: string }) =>
      service.assignRecordingToList(recordingId, listId),
    onSuccess: (_data, { recordingId }) => {
      qc.invalidateQueries({
        queryKey: queryKeys.recordingListAssignments(recordingId),
      });
    },
  });
}

export function useUnassignRecordingFromList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ recordingId, listId }: { recordingId: string; listId: string }) =>
      service.unassignRecordingFromList(recordingId, listId),
    onSuccess: (_data, { recordingId }) => {
      qc.invalidateQueries({
        queryKey: queryKeys.recordingListAssignments(recordingId),
      });
    },
  });
}
