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

/**
 * Duplicates just the task row (no subtree). Places the copy at the end of
 * its sibling scope in the chosen list (defaults to the source's list).
 */
export async function duplicateTask(
  sourceTaskId: string,
  targetListId?: string | null
): Promise<Task> {
  const { data: src, error: srcErr } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", sourceTaskId)
    .single();
  if (srcErr) throw srcErr;

  const listId = targetListId === undefined ? src.task_list_id : targetListId;

  const payload: TaskInsert = {
    organization_id: src.organization_id,
    owner_id: src.owner_id,
    task_list_id: listId,
    parent_task_id: null,
    title: `${src.title} (העתק)`,
    description: src.description,
    status: "todo",
    urgency: src.urgency,
    scheduled_at: src.scheduled_at,
    duration_minutes: src.duration_minutes,
    is_event: src.is_event,
    estimated_hours: src.estimated_hours,
    spare_hours: src.spare_hours,
    assignee_user_id: src.assignee_user_id,
    requires_approval: src.requires_approval,
    approver_user_id: src.approver_user_id,
    recurrence_rule: src.recurrence_rule,
    recurrence_ends_at: src.recurrence_ends_at,
    custom_fields: src.custom_fields,
    location: src.location,
    external_url: src.external_url,
    notes: src.notes,
    tags: src.tags,
  };

  return createTask(payload);
}

/** Hard delete. Child tasks cascade via FK. */
export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
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

/**
 * All dependencies where both endpoints live in the given org. RLS ensures
 * cross-org leakage can't happen; filtering client-side by task IDs would
 * still work but the Gantt grid renders the whole graph at once, so we fetch
 * all rows in a single query.
 */
export async function listAllTaskDependencies(
  organizationId: string
): Promise<TaskDependency[]> {
  // The join ensures we only get rows whose source task is in this org.
  // (The DB has a policy that matches the endpoint task to the same org.)
  const { data: tasksInOrg, error: tasksErr } = await supabase
    .from("tasks")
    .select("id")
    .eq("organization_id", organizationId);
  if (tasksErr) throw tasksErr;
  const ids = (tasksInOrg ?? []).map((t) => t.id);
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("task_dependencies")
    .select("*")
    .in("task_id", ids);
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
