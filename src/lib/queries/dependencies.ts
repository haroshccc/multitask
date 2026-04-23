import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type {
  DependencyRelation,
  Task,
  TaskDependency,
} from "@/lib/types/domain";

const depKeys = {
  forTask: (taskId: string) => ["task_dependencies", taskId] as const,
};

export interface DependencyWithTask extends TaskDependency {
  depends_on: Task | null;
}

export function useTaskDependencies(taskId: string | null) {
  return useQuery({
    queryKey: depKeys.forTask(taskId ?? "none"),
    enabled: Boolean(taskId),
    queryFn: async (): Promise<DependencyWithTask[]> => {
      const { data: deps, error } = await supabase
        .from("task_dependencies")
        .select("*")
        .eq("task_id", taskId!);
      if (error) throw error;
      const ids = (deps ?? []).map((d) => d.depends_on_task_id);
      if (ids.length === 0) return [];
      const { data: tasks, error: tErr } = await supabase
        .from("tasks")
        .select("*")
        .in("id", ids);
      if (tErr) throw tErr;
      const byId = new Map((tasks ?? []).map((t) => [t.id, t]));
      return (deps ?? []).map((d) => ({
        ...d,
        depends_on: byId.get(d.depends_on_task_id) ?? null,
      }));
    },
  });
}

export function useCreateDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      taskId: string;
      dependsOnTaskId: string;
      relation?: DependencyRelation;
      lagDays?: number;
    }) => {
      const { error } = await supabase.from("task_dependencies").insert({
        task_id: input.taskId,
        depends_on_task_id: input.dependsOnTaskId,
        relation: input.relation ?? "finish_to_start",
        lag_days: input.lagDays ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: depKeys.forTask(vars.taskId) });
    },
  });
}

export function useDeleteDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; taskId: string }) => {
      const { error } = await supabase
        .from("task_dependencies")
        .delete()
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: depKeys.forTask(vars.taskId) });
    },
  });
}

// All deps in the org for the Gantt critical-path computation.
export function useAllDependencies(orgId: string | null) {
  return useQuery({
    queryKey: ["task_dependencies", "org", orgId ?? "none"] as const,
    enabled: Boolean(orgId),
    queryFn: async (): Promise<TaskDependency[]> => {
      const { data: tasks, error: tErr } = await supabase
        .from("tasks")
        .select("id")
        .eq("organization_id", orgId!);
      if (tErr) throw tErr;
      const ids = (tasks ?? []).map((t) => t.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("task_dependencies")
        .select("*")
        .in("task_id", ids);
      if (error) throw error;
      return data ?? [];
    },
  });
}
