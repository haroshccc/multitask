import { supabase } from "@/lib/supabase/client";
import type { TaskList, TaskListInsert, TaskListUpdate } from "@/lib/types/domain";

export async function listTaskLists(
  organizationId: string,
  includeArchived = false
): Promise<TaskList[]> {
  let query = supabase
    .from("task_lists")
    .select("*")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true });
  if (!includeArchived) query = query.eq("is_archived", false);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function listArchivedTaskLists(
  organizationId: string
): Promise<TaskList[]> {
  const { data, error } = await supabase
    .from("task_lists")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("is_archived", true)
    .order("archived_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getTaskList(listId: string): Promise<TaskList | null> {
  const { data, error } = await supabase
    .from("task_lists")
    .select("*")
    .eq("id", listId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createTaskList(payload: TaskListInsert): Promise<TaskList> {
  let sortOrder = payload.sort_order;
  if (sortOrder === undefined || sortOrder === null) {
    const { data: last } = await supabase
      .from("task_lists")
      .select("sort_order")
      .eq("organization_id", payload.organization_id)
      .order("sort_order", { ascending: false })
      .limit(1);
    sortOrder = (last?.[0]?.sort_order ?? 0) + 1000;
  }

  const { data, error } = await supabase
    .from("task_lists")
    .insert({ ...payload, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTaskList(
  listId: string,
  patch: TaskListUpdate
): Promise<TaskList> {
  const { data, error } = await supabase
    .from("task_lists")
    .update(patch)
    .eq("id", listId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function archiveTaskList(listId: string): Promise<void> {
  const now = new Date();
  const expires = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const { error } = await supabase
    .from("task_lists")
    .update({
      is_archived: true,
      archived_at: now.toISOString(),
      archive_expires_at: expires.toISOString(),
    })
    .eq("id", listId);
  if (error) throw error;
}

export async function restoreTaskList(listId: string): Promise<void> {
  const { error } = await supabase
    .from("task_lists")
    .update({
      is_archived: false,
      archived_at: null,
      archive_expires_at: null,
    })
    .eq("id", listId);
  if (error) throw error;
}

export async function reorderTaskLists(
  updates: { id: string; sort_order: number }[]
): Promise<void> {
  await Promise.all(
    updates.map((u) =>
      supabase.from("task_lists").update({ sort_order: u.sort_order }).eq("id", u.id)
    )
  );
}

// Shares ---------------------------------------------------------------------

export async function listTaskListShares(
  listId: string
): Promise<{ user_id: string; permission: "read" | "write" }[]> {
  const { data, error } = await supabase
    .from("shares")
    .select("user_id, permission")
    .eq("entity_type", "task_list")
    .eq("entity_id", listId);
  if (error) throw error;
  return (data ?? []) as { user_id: string; permission: "read" | "write" }[];
}

export async function setTaskListShare(
  organizationId: string,
  listId: string,
  userId: string,
  permission: "read" | "write"
): Promise<void> {
  const { error } = await supabase.from("shares").upsert(
    {
      organization_id: organizationId,
      entity_type: "task_list",
      entity_id: listId,
      user_id: userId,
      permission,
    },
    { onConflict: "entity_type,entity_id,user_id" }
  );
  if (error) throw error;
}

export async function removeTaskListShare(
  listId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("shares")
    .delete()
    .eq("entity_type", "task_list")
    .eq("entity_id", listId)
    .eq("user_id", userId);
  if (error) throw error;
}
