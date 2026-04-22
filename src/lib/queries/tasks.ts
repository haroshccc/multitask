import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { Task, TaskInsert, TaskStatus, TaskUpdate } from "@/lib/types/domain";
import { thoughtKeys } from "./thoughts";

export const taskKeys = {
  all: ["tasks"] as const,
  list: (orgId: string, scope: string) => ["tasks", orgId, scope] as const,
};

interface ListOptions {
  scope: "inbox" | "today" | "open" | "all";
  limit?: number;
}

export function useTasks(orgId: string | null, options: ListOptions) {
  const { scope, limit } = options;
  return useQuery({
    queryKey: taskKeys.list(orgId ?? "none", scope),
    enabled: Boolean(orgId),
    queryFn: async (): Promise<Task[]> => {
      let query = supabase
        .from("tasks")
        .select("*")
        .eq("organization_id", orgId!)
        .order("completed_at", { ascending: true, nullsFirst: true })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

      if (scope === "inbox") {
        query = query.is("task_list_id", null).neq("status", "cancelled");
      } else if (scope === "today") {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        query = query
          .gte("scheduled_at", start.toISOString())
          .lt("scheduled_at", end.toISOString())
          .neq("status", "cancelled");
      } else if (scope === "open") {
        query = query.in("status", ["todo", "in_progress", "pending_approval"]);
      }

      if (limit) query = query.limit(limit);

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTasksInRange(
  orgId: string | null,
  fromIso: string,
  toIso: string
) {
  return useQuery({
    queryKey: ["tasks", orgId ?? "none", "range", fromIso, toIso] as const,
    enabled: Boolean(orgId),
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("organization_id", orgId!)
        .gte("scheduled_at", fromIso)
        .lt("scheduled_at", toIso)
        .neq("status", "cancelled")
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: ["tasks", "detail", id ?? "none"] as const,
    enabled: Boolean(id),
    queryFn: async (): Promise<Task | null> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

interface CreateTaskInput {
  orgId: string;
  ownerId: string;
  title: string;
  description?: string;
  sourceThoughtId?: string;
  scheduledAt?: string | null;
  urgency?: number;
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orgId,
      ownerId,
      title,
      description,
      sourceThoughtId,
      scheduledAt,
      urgency,
    }: CreateTaskInput): Promise<Task> => {
      const insert: TaskInsert = {
        organization_id: orgId,
        owner_id: ownerId,
        title,
        description: description ?? null,
        source_thought_id: sourceThoughtId ?? null,
        scheduled_at: scheduledAt ?? null,
        urgency: urgency ?? 3,
        status: "todo",
      };
      const { data, error } = await supabase
        .from("tasks")
        .insert(insert)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

interface UpdateTaskStatusInput {
  id: string;
  status: TaskStatus;
}

export function useUpdateTaskStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: UpdateTaskStatusInput) => {
      const patch: TaskUpdate = { status };
      if (status === "done") patch.completed_at = new Date().toISOString();
      if (status === "todo" || status === "in_progress") patch.completed_at = null;
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

interface UpdateTaskInput {
  id: string;
  patch: TaskUpdate;
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: UpdateTaskInput): Promise<Task> => {
      const { data, error } = await supabase
        .from("tasks")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (task) => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
      qc.invalidateQueries({ queryKey: ["tasks", "detail", task.id] });
    },
  });
}

// Convert a thought into a task: create task with source_thought_id, log a
// processing row, and mark the thought as processed. Wrapped in a single
// mutation so the UI can invalidate both lists on success.
interface ConvertThoughtToTaskInput {
  orgId: string;
  ownerId: string;
  thoughtId: string;
  title: string;
}

export function useConvertThoughtToTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orgId,
      ownerId,
      thoughtId,
      title,
    }: ConvertThoughtToTaskInput): Promise<Task> => {
      const { data: task, error: taskErr } = await supabase
        .from("tasks")
        .insert({
          organization_id: orgId,
          owner_id: ownerId,
          title,
          source_thought_id: thoughtId,
          status: "todo",
        } satisfies TaskInsert)
        .select("*")
        .single();
      if (taskErr) throw taskErr;

      const { error: procErr } = await supabase.from("thought_processings").insert({
        thought_id: thoughtId,
        target_type: "task",
        target_id: task.id,
        ai_suggested: false,
        created_by: ownerId,
      });
      if (procErr) throw procErr;

      const { error: thoughtErr } = await supabase
        .from("thoughts")
        .update({ status: "processed", processed_at: new Date().toISOString() })
        .eq("id", thoughtId);
      if (thoughtErr) throw thoughtErr;

      return task;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
      qc.invalidateQueries({ queryKey: thoughtKeys.all });
    },
  });
}
