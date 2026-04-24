import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, queryFamilies } from "@/lib/query-keys";
import * as service from "@/lib/services/timer";
import type { TimeEntry } from "@/lib/types/domain";
import { useOrgScope, assertOrgScope } from "./useOrgScope";

export function useActiveTimer() {
  const scope = useOrgScope();
  return useQuery<TimeEntry | null>({
    queryKey: queryKeys.activeTimer(),
    queryFn: service.getActiveTimer,
    enabled: scope.enabled,
    refetchInterval: 30_000,
  });
}

export function useTaskTimeEntries(taskId: string | null | undefined) {
  return useQuery<TimeEntry[]>({
    queryKey: queryKeys.timeEntries(taskId ?? ""),
    queryFn: () => service.listTimeEntries(taskId!),
    enabled: !!taskId,
  });
}

/**
 * All time entries across the org that overlap with the given range.
 * Used by the calendar to render "actual" (solid) stripes over "planned"
 * (dashed) scheduled slots — see SPEC §16.
 */
export function useTimeEntriesByRange(range: { from: string; to: string } | null) {
  const scope = useOrgScope();
  return useQuery<TimeEntry[]>({
    queryKey: queryKeys.timeEntriesByRange(
      scope.organizationId ?? "",
      range?.from ?? "",
      range?.to ?? ""
    ),
    queryFn: () =>
      service.listTimeEntriesByRange(scope.organizationId!, range!.from, range!.to),
    enabled: scope.enabled && !!range,
  });
}

export function useStartTimer() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ taskId, note }: { taskId: string; note?: string }) =>
      service.startTimer(taskId, note),
    onSuccess: (entry) => {
      qc.setQueryData(queryKeys.activeTimer(), entry);
      qc.invalidateQueries({ queryKey: queryKeys.timeEntries(entry.task_id) });
      if (scope.organizationId) {
        qc.invalidateQueries({
          queryKey: queryFamilies.taskFamily(entry.task_id),
        });
      }
    },
  });
}

export function useStopTimer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => service.stopTimer(),
    onSuccess: (entry) => {
      qc.setQueryData(queryKeys.activeTimer(), null);
      if (entry) {
        qc.invalidateQueries({ queryKey: queryKeys.timeEntries(entry.task_id) });
        qc.invalidateQueries({ queryKey: queryFamilies.taskFamily(entry.task_id) });
      }
    },
  });
}

export function useCreateManualTimeEntry() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: {
      task_id: string;
      started_at: string;
      ended_at: string;
      note?: string | null;
    }) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createManualEntry({
        ...input,
        organization_id: organizationId,
        user_id: userId,
      });
    },
    onSuccess: (entry) => {
      qc.invalidateQueries({ queryKey: queryKeys.timeEntries(entry.task_id) });
      qc.invalidateQueries({ queryKey: queryFamilies.taskFamily(entry.task_id) });
    },
  });
}

export function useUpdateTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      entryId,
      patch,
    }: {
      entryId: string;
      taskId: string;
      patch: Parameters<typeof service.updateTimeEntry>[1];
    }) => service.updateTimeEntry(entryId, patch),
    onSuccess: (entry, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.timeEntries(vars.taskId) });
      qc.invalidateQueries({ queryKey: queryFamilies.taskFamily(entry.task_id) });
    },
  });
}

export function useDeleteTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ entryId }: { entryId: string; taskId: string }) =>
      service.deleteTimeEntry(entryId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.timeEntries(vars.taskId) });
      qc.invalidateQueries({ queryKey: queryFamilies.taskFamily(vars.taskId) });
    },
  });
}
