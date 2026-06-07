import { supabase } from "@/lib/supabase/client";

export interface ProjectShareRow {
  user_id: string;
  permission: "read" | "write";
  organization_id: string;
}

/** All explicit share rows for a project (entity_type='project'). */
export async function listProjectShares(
  projectId: string
): Promise<ProjectShareRow[]> {
  const { data, error } = await (supabase as any)
    .from("shares")
    .select("user_id, permission, organization_id")
    .eq("entity_type", "project")
    .eq("entity_id", projectId);
  if (error) throw error;
  return (data ?? []) as ProjectShareRow[];
}

export async function setProjectShare(
  orgId: string,
  projectId: string,
  userId: string,
  permission: "read" | "write"
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await (supabase as any).from("shares").upsert(
    {
      organization_id: orgId,
      entity_type: "project",
      entity_id: projectId,
      user_id: userId,
      permission,
      granted_by: user?.id ?? null,
    },
    { onConflict: "entity_type,entity_id,user_id" }
  );
  if (error) throw error;
}

export async function removeProjectShare(
  projectId: string,
  userId: string
): Promise<void> {
  const { error } = await (supabase as any)
    .from("shares")
    .delete()
    .eq("entity_type", "project")
    .eq("entity_id", projectId)
    .eq("user_id", userId);
  if (error) throw error;
}
