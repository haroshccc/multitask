import { supabase } from "@/lib/supabase/client";
import type { ThoughtList } from "@/lib/types/domain";

export async function listThoughtLists(
  organizationId: string,
  ownerId: string
): Promise<ThoughtList[]> {
  const { data, error } = await supabase
    .from("thought_lists")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("owner_id", ownerId)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createThoughtList(input: {
  organization_id: string;
  owner_id: string;
  name: string;
  emoji?: string;
  color?: string;
}): Promise<ThoughtList> {
  const { data: last } = await supabase
    .from("thought_lists")
    .select("sort_order")
    .eq("organization_id", input.organization_id)
    .eq("owner_id", input.owner_id)
    .order("sort_order", { ascending: false })
    .limit(1);
  const sortOrder = (last?.[0]?.sort_order ?? 0) + 1000;
  const { data, error } = await supabase
    .from("thought_lists")
    .insert({ ...input, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateThoughtList(
  listId: string,
  patch: Partial<Pick<ThoughtList, "name" | "emoji" | "color" | "sort_order">>
): Promise<ThoughtList> {
  const { data, error } = await supabase
    .from("thought_lists")
    .update(patch)
    .eq("id", listId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function archiveThoughtList(listId: string): Promise<void> {
  const now = new Date();
  const expires = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const { error } = await supabase
    .from("thought_lists")
    .update({
      is_archived: true,
      archived_at: now.toISOString(),
      archive_expires_at: expires.toISOString(),
    })
    .eq("id", listId);
  if (error) throw error;
}
