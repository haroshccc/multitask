import { supabase } from "@/lib/supabase/client";

export interface TaskAssigneeRow {
  user_id: string;
  organization_id: string;
  delegation_status: "pending" | "accepted" | "rejected";
  full_name: string | null;
  avatar_url: string | null;
}

export async function listTaskAssignees(taskId: string): Promise<TaskAssigneeRow[]> {
  const db = supabase as any;
  const { data: rows, error } = await db
    .from("task_assignees")
    .select("user_id, organization_id, delegation_status")
    .eq("task_id", taskId);
  if (error) throw error;
  if (!rows || rows.length === 0) return [];

  const userIds = rows.map((r: { user_id: string }) => r.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", userIds);
  const profileMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
  (profiles ?? []).forEach((p: { id: string; full_name: string | null; avatar_url: string | null }) =>
    profileMap.set(p.id, p)
  );

  return rows.map(
    (r: { user_id: string; organization_id: string; delegation_status: TaskAssigneeRow["delegation_status"] }) => ({
      ...r,
      full_name: profileMap.get(r.user_id)?.full_name ?? null,
      avatar_url: profileMap.get(r.user_id)?.avatar_url ?? null,
    })
  );
}

export async function addTaskAssignee(
  taskId: string,
  userId: string,
  orgId: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await (supabase as any).from("task_assignees").upsert(
    {
      task_id: taskId,
      user_id: userId,
      organization_id: orgId,
      created_by: user?.id ?? null,
    },
    { onConflict: "task_id,user_id" }
  );
  if (error) throw error;
}

export async function removeTaskAssignee(taskId: string, userId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("task_assignees")
    .delete()
    .eq("task_id", taskId)
    .eq("user_id", userId);
  if (error) throw error;
}
