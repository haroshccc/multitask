import { supabase } from "@/lib/supabase/client";
import type { EventRow } from "@/lib/types/domain";

// `events.project_id` is a nullable column added by a later migration that
// the generated Supabase types may not include yet, so we go through a cast
// `db` for the project-scoped query (mirrors the pattern used elsewhere in
// the codebase when typegen lags the schema).
const db = supabase as any;

/**
 * Lists events that belong to a single project (`events.project_id =
 * projectId`) whose `starts_at` falls inside the visible window. Used by the
 * project calendar tab so a project shows only its own events (plus any
 * meeting-synced events, which carry the same `project_id`).
 */
export async function listProjectEvents(
  projectId: string,
  range?: { from: string; to: string }
): Promise<EventRow[]> {
  let query = db
    .from("events")
    .select("*")
    .eq("project_id", projectId)
    .order("starts_at", { ascending: true });
  if (range) {
    query = query.gte("starts_at", range.from).lte("starts_at", range.to);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as EventRow[];
}
