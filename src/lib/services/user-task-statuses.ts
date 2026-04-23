import { supabase } from "@/lib/supabase/client";
import type {
  UserTaskStatus,
  UserTaskStatusInsert,
  UserTaskStatusUpdate,
} from "@/lib/types/domain";

/**
 * Lists statuses visible to the current user. RLS returns own + same-org.
 * The result is sorted by (user_id, sort_order) so callers can group by owner
 * to resolve each task's status chip against its owner's palette.
 */
export async function listUserTaskStatuses(): Promise<UserTaskStatus[]> {
  const { data, error } = await supabase
    .from("user_task_statuses")
    .select("*")
    .order("user_id", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Own palette only — for editing in settings / rendering dropdowns. */
export async function listMyTaskStatuses(
  userId: string
): Promise<UserTaskStatus[]> {
  const { data, error } = await supabase
    .from("user_task_statuses")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createUserTaskStatus(
  payload: UserTaskStatusInsert
): Promise<UserTaskStatus> {
  const { data, error } = await supabase
    .from("user_task_statuses")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateUserTaskStatus(
  statusId: string,
  patch: UserTaskStatusUpdate
): Promise<UserTaskStatus> {
  const { data, error } = await supabase
    .from("user_task_statuses")
    .update(patch)
    .eq("id", statusId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteUserTaskStatus(statusId: string): Promise<void> {
  // RLS enforces is_builtin=false for delete; builtins cannot be dropped.
  const { error } = await supabase
    .from("user_task_statuses")
    .delete()
    .eq("id", statusId);
  if (error) throw error;
}

export async function reorderUserTaskStatuses(
  updates: { id: string; sort_order: number }[]
): Promise<void> {
  await Promise.all(
    updates.map((u) =>
      supabase
        .from("user_task_statuses")
        .update({ sort_order: u.sort_order })
        .eq("id", u.id)
    )
  );
}

/** Wipes the user's palette and re-seeds the five factory defaults. */
export async function resetUserTaskStatuses(): Promise<void> {
  const { error } = await supabase.rpc("reset_user_task_statuses");
  if (error) throw error;
}

/** Slugify a label into a key; callers should ensure uniqueness per user. */
export function slugifyStatusKey(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[\s/]+/g, "_")
    .replace(/[^a-z0-9_֐-׿]/gi, "")
    .slice(0, 40);
  return base || `status_${Date.now()}`;
}
