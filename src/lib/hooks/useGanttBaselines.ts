import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useOrgScope } from "./useOrgScope";
import * as service from "@/lib/services/gantt-baselines";
import type { GanttBaselineTask } from "@/lib/services/gantt-baselines";

export type { GanttBaseline, GanttBaselineTask } from "@/lib/services/gantt-baselines";

const BASELINES_KEY = (orgId: string) => ["gantt_baselines", orgId];
const BASELINE_TASKS_KEY = (baselineId: string) => ["gantt_baseline_tasks", baselineId];

export function useGanttBaselines() {
  const scope = useOrgScope();
  return useQuery({
    queryKey: BASELINES_KEY(scope.organizationId ?? ""),
    queryFn: () => service.listBaselines(scope.organizationId!),
    enabled: scope.enabled,
  });
}

export function useGanttBaselineTasks(baselineId: string | null) {
  return useQuery({
    queryKey: BASELINE_TASKS_KEY(baselineId ?? ""),
    queryFn: () => service.getBaselineTasks(baselineId!),
    enabled: !!baselineId,
  });
}

export function useCreateBaseline() {
  const scope = useOrgScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      tasks,
    }: {
      name: string;
      tasks: Array<{ task_id: string; scheduled_at: string | null; duration_minutes: number | null }>;
    }) => service.createBaseline(scope.organizationId!, name, tasks),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BASELINES_KEY(scope.organizationId ?? "") });
    },
  });
}

export function useDeleteBaseline() {
  const scope = useOrgScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (baselineId: string) => service.deleteBaseline(baselineId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BASELINES_KEY(scope.organizationId ?? "") });
    },
  });
}

/** Build a lookup map from baseline tasks for quick access in the Gantt grid. */
export function buildBaselineMap(
  tasks: GanttBaselineTask[]
): Map<string, { scheduled_at: string | null; duration_minutes: number | null }> {
  const m = new Map<string, { scheduled_at: string | null; duration_minutes: number | null }>();
  for (const t of tasks) m.set(t.task_id, { scheduled_at: t.scheduled_at, duration_minutes: t.duration_minutes });
  return m;
}
