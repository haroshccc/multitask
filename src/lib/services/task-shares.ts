import { supabase } from "@/lib/supabase/client";

export interface TaskShareRow {
  user_id: string;
  permission: "read" | "write";
  organization_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export async function listTaskShares(taskId: string): Promise<TaskShareRow[]> {
  const db = supabase as any;
  const { data: shareRows, error } = await db
    .from("shares")
    .select("user_id, permission, organization_id")
    .eq("entity_type", "task")
    .eq("entity_id", taskId);
  if (error) throw error;
  if (!shareRows || shareRows.length === 0) return [];

  const userIds = shareRows.map((r: { user_id: string }) => r.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", userIds);
  const profileMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();
  (profiles ?? []).forEach((p: { id: string; full_name: string | null; avatar_url: string | null }) =>
    profileMap.set(p.id, p)
  );

  return shareRows.map((r: { user_id: string; permission: "read" | "write"; organization_id: string }) => ({
    ...r,
    full_name: profileMap.get(r.user_id)?.full_name ?? null,
    avatar_url: profileMap.get(r.user_id)?.avatar_url ?? null,
  }));
}

export async function setTaskShare(
  orgId: string,
  taskId: string,
  userId: string,
  permission: "read" | "write"
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await (supabase as any).from("shares").upsert(
    {
      organization_id: orgId,
      entity_type: "task",
      entity_id: taskId,
      user_id: userId,
      permission,
      granted_by: user?.id ?? null,
    },
    { onConflict: "entity_type,entity_id,user_id" }
  );
  if (error) throw error;
}

export async function removeTaskShare(taskId: string, userId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("shares")
    .delete()
    .eq("entity_type", "task")
    .eq("entity_id", taskId)
    .eq("user_id", userId);
  if (error) throw error;
}
