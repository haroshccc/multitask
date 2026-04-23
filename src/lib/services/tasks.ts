import { supabase } from "@/lib/supabase/client";
import type {
  Task,
  TaskInsert,
  TaskUpdate,
  TaskDependency,
  FilterConfig,
} from "@/lib/types/domain";

const SORT_ORDER_STEP = 1000;

export async function listTasks(
  organizationId: string,
  filters: FilterConfig = {}
): Promise<Task[]> {
  let query = supabase
    .from("tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true });

  if (filters.lists?.length) query = query.in("task_list_id", filters.lists);
  if (filters.statuses?.length) query = query.in("status", filters.statuses);
  if (filters.tags?.length) query = query.overlaps("tags", filters.tags);
  if (filters.assignees?.length) query = query.in("assignee_user_id", filters.assignees);
  if (filters.urgencyMin !== undefined) query = query.gte("urgency", filters.urgencyMin);
  if (filters.urgencyMax !== undefined) query = query.lte("urgency", filters.urgencyMax);
  if (filters.dueBefore) query = query.lte("scheduled_at", filters.dueBefore);
  if (filters.dueAfter) query = query.gte("scheduled_at", filters.dueAfter);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getTask(taskId: string): Promise<Task | null> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listTasksByList(
  organizationId: string,
  listId: string | null
): Promise<Task[]> {
  let query = supabase
    .from("tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true });

  if (listId === null) query = query.is("task_list_id", null);
  else query = query.eq("task_list_id", listId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function listTasksByProject(
  organizationId: string,
  projectId: string
): Promise<Task[]> {
  // Tasks inherit their project through their task_list.project_id
  const { data: lists, error: listErr } = await supabase
    .from("task_lists")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("project_id", projectId);
  if (listErr) throw listErr;
  const listIds = (lists ?? []).map((l) => l.id);
  if (listIds.length === 0) return [];

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .in("task_list_id", listIds)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createTask(payload: TaskInsert): Promise<Task> {
  // If no sort_order provided, place at end of its sibling scope
  let sortOrder = payload.sort_order;
  if (sortOrder === undefined || sortOrder === null) {
    const scope = supabase
      .from("tasks")
      .select("sort_order")
      .eq("organization_id", payload.organization_id)
      .order("sort_order", { ascending: false })
      .limit(1);

    const scoped = payload.parent_task_id
      ? scope.eq("parent_task_id", payload.parent_task_id)
      : payload.task_list_id
      ? scope.is("parent_task_id", null).eq("task_list_id", payload.task_list_id)
      : scope.is("parent_task_id", null).is("task_list_id", null);

    const { data: last } = await scoped;
    sortOrder = (last?.[0]?.sort_order ?? 0) + SORT_ORDER_STEP;
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({ ...payload, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTask(taskId: string, patch: TaskUpdate): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .update(patch)
    .eq("id", taskId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function completeTask(taskId: string, completed: boolean): Promise<Task> {
  return updateTask(taskId, {
    completed_at: completed ? new Date().toISOString() : null,
    status: completed ? "done" : "todo",
  });
}

export async function reorderTasks(
  updates: { id: string; sort_order: number }[]
): Promise<void> {
  // Batch update — no single RPC for this, so issue parallel updates.
  // React Query's optimistic updates mask the latency.
  await Promise.all(
    updates.map((u) =>
      supabase.from("tasks").update({ sort_order: u.sort_order }).eq("id", u.id)
    )
  );
}

export async function moveTaskToList(
  taskId: string,
  listId: string | null
): Promise<Task> {
  return updateTask(taskId, { task_list_id: listId });
}

export async function setTaskParent(
  taskId: string,
  parentId: string | null
): Promise<Task> {
  return updateTask(taskId, { parent_task_id: parentId });
}

/**
 * Duplicates a task tree via the `duplicate_task_tree` DB function.
 * Preserves hierarchy, creates new IDs, does NOT copy time_entries or processings.
 */
export async function duplicateTaskTree(
  sourceTaskId: string,
  targetListId?: string,
  targetParentId?: string
): Promise<string> {
  const { data, error } = await supabase.rpc("duplicate_task_tree", {
    p_source_task_id: sourceTaskId,
    p_target_list_id: targetListId,
    p_target_parent_id: targetParentId,
  });
  if (error) throw error;
  return data as string;
}

// Dependencies ---------------------------------------------------------------

export async function listTaskDependencies(taskId: string): Promise<TaskDependency[]> {
  const { data, error } = await supabase
    .from("task_dependencies")
    .select("*")
    .or(`task_id.eq.${taskId},depends_on_task_id.eq.${taskId}`);
  if (error) throw error;
  return data ?? [];
}

export async function createTaskDependency(
  taskId: string,
  dependsOnTaskId: string,
  relation:
    | "finish_to_start"
    | "start_to_start"
    | "finish_to_finish"
    | "start_to_finish" = "finish_to_start",
  lagDays = 0
): Promise<TaskDependency> {
  const { data, error } = await supabase
    .from("task_dependencies")
    .insert({
      task_id: taskId,
      depends_on_task_id: dependsOnTaskId,
      relation,
      lag_days: lagDays,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTaskDependency(depId: string): Promise<void> {
  const { error } = await supabase.from("task_dependencies").delete().eq("id", depId);
  if (error) throw error;
}
