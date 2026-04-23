import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type {
  TaskList,
  TaskListInsert,
  TaskListUpdate,
} from "@/lib/types/domain";

export const taskListKeys = {
  all: ["task_lists"] as const,
  list: (orgId: string) => ["task_lists", orgId] as const,
};

export function useTaskLists(orgId: string | null) {
  return useQuery({
    queryKey: taskListKeys.list(orgId ?? "none"),
    enabled: Boolean(orgId),
    queryFn: async (): Promise<TaskList[]> => {
      const { data, error } = await supabase
        .from("task_lists")
        .select("*")
        .eq("organization_id", orgId!)
        .eq("is_archived", false)
        .order("kind", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

interface CreateTaskListInput {
  orgId: string;
  ownerId: string;
  name: string;
  emoji?: string | null;
  color?: string | null;
}

export function useCreateTaskList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orgId,
      ownerId,
      name,
      emoji,
      color,
    }: CreateTaskListInput): Promise<TaskList> => {
      const insert: TaskListInsert = {
        organization_id: orgId,
        owner_id: ownerId,
        name,
        emoji: emoji ?? null,
        color: color ?? null,
        kind: "custom",
      };
      const { data, error } = await supabase
        .from("task_lists")
        .insert(insert)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskListKeys.all });
    },
  });
}

export function useUpdateTaskList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: TaskListUpdate }) => {
      const { error } = await supabase.from("task_lists").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskListKeys.all });
    },
  });
}

export function useDeleteTaskList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_lists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskListKeys.all });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
