import { supabase } from "@/lib/supabase/client";
import type {
  Thought,
  ThoughtInsert,
  ThoughtUpdate,
  ThoughtListAssignment,
  ThoughtProcessing,
  ThoughtProcessingTarget,
} from "@/lib/types/domain";

export async function listThoughts(
  organizationId: string,
  options: {
    status?: "unprocessed" | "processed" | "archived";
    listId?: string | null;
    includeArchived?: boolean;
  } = {}
): Promise<Thought[]> {
  let query = supabase
    .from("thoughts")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (options.status) {
    query = query.eq("status", options.status);
  } else if (!options.includeArchived) {
    query = query.neq("status", "archived");
  }

  const { data, error } = await query;
  if (error) throw error;
  let results = data ?? [];

  // Filter by list membership client-side (join table, done after main fetch to keep SQL simple)
  if (options.listId !== undefined) {
    const thoughtIds = results.map((t) => t.id);
    if (thoughtIds.length === 0) return [];
    const { data: assignments } = await supabase
      .from("thought_list_assignments")
      .select("thought_id, list_id")
      .in("thought_id", thoughtIds);
    const lookup = new Map<string, string[]>();
    for (const a of assignments ?? []) {
      const prev = lookup.get(a.thought_id) ?? [];
      prev.push(a.list_id);
      lookup.set(a.thought_id, prev);
    }
    if (options.listId === null) {
      results = results.filter((t) => !lookup.has(t.id));
    } else {
      results = results.filter((t) => lookup.get(t.id)?.includes(options.listId as string));
    }
  }

  return results;
}

export async function getThought(thoughtId: string): Promise<Thought | null> {
  const { data, error } = await supabase
    .from("thoughts")
    .select("*")
    .eq("id", thoughtId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createThought(payload: ThoughtInsert): Promise<Thought> {
  const { data, error } = await supabase
    .from("thoughts")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateThought(
  thoughtId: string,
  patch: ThoughtUpdate
): Promise<Thought> {
  const { data, error } = await supabase
    .from("thoughts")
    .update(patch)
    .eq("id", thoughtId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markProcessed(thoughtId: string, processed: boolean): Promise<Thought> {
  return updateThought(thoughtId, {
    processed_at: processed ? new Date().toISOString() : null,
    status: processed ? "processed" : "unprocessed",
  });
}

export async function archiveThought(thoughtId: string): Promise<Thought> {
  const now = new Date();
  const expires = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  return updateThought(thoughtId, {
    status: "archived",
    archived_at: now.toISOString(),
    archive_expires_at: expires.toISOString(),
  });
}

export async function restoreThought(thoughtId: string): Promise<Thought> {
  return updateThought(thoughtId, {
    status: "unprocessed",
    archived_at: null,
    archive_expires_at: null,
  });
}

// List assignments (many-to-many) --------------------------------------------

export async function listThoughtAssignments(
  thoughtId: string
): Promise<ThoughtListAssignment[]> {
  const { data, error } = await supabase
    .from("thought_list_assignments")
    .select("*")
    .eq("thought_id", thoughtId);
  if (error) throw error;
  return data ?? [];
}

/** Bulk: fetch all assignments for a set of thoughts in a single query. */
export async function listAssignmentsForThoughts(
  thoughtIds: string[]
): Promise<ThoughtListAssignment[]> {
  if (thoughtIds.length === 0) return [];
  const { data, error } = await supabase
    .from("thought_list_assignments")
    .select("*")
    .in("thought_id", thoughtIds);
  if (error) throw error;
  return data ?? [];
}

export async function assignThoughtToList(
  thoughtId: string,
  listId: string
): Promise<void> {
  const { error } = await supabase
    .from("thought_list_assignments")
    .upsert(
      { thought_id: thoughtId, list_id: listId },
      { onConflict: "thought_id,list_id", ignoreDuplicates: true }
    );
  if (error) throw error;
}

export async function unassignThoughtFromList(
  thoughtId: string,
  listId: string
): Promise<void> {
  const { error } = await supabase
    .from("thought_list_assignments")
    .delete()
    .eq("thought_id", thoughtId)
    .eq("list_id", listId);
  if (error) throw error;
}

// Processings (which thoughts spawned which entities) ------------------------

export async function listThoughtProcessings(
  thoughtId: string
): Promise<ThoughtProcessing[]> {
  const { data, error } = await supabase
    .from("thought_processings")
    .select("*")
    .eq("thought_id", thoughtId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function recordThoughtProcessing(input: {
  thought_id: string;
  target_type: ThoughtProcessingTarget;
  target_id: string;
  ai_suggested: boolean;
  created_by?: string;
}): Promise<ThoughtProcessing> {
  const { data, error } = await supabase
    .from("thought_processings")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Bulk: count `thought_processings` per thought_id, in one round-trip. */
export async function countProcessingsForThoughts(
  thoughtIds: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (thoughtIds.length === 0) return out;
  const { data, error } = await supabase
    .from("thought_processings")
    .select("thought_id")
    .in("thought_id", thoughtIds);
  if (error) throw error;
  for (const row of data ?? []) {
    out.set(row.thought_id, (out.get(row.thought_id) ?? 0) + 1);
  }
  return out;
}
