import { supabase } from "@/lib/supabase/client";
import type {
  RecordingList,
  RecordingListInsert,
  RecordingListUpdate,
  RecordingListAssignment,
} from "@/lib/types/domain";

export async function listRecordingLists(
  organizationId: string,
  options: { includeArchived?: boolean } = {}
): Promise<RecordingList[]> {
  let query = supabase
    .from("recording_lists")
    .select("*")
    .eq("organization_id", organizationId)
    .order("sort_order", { ascending: true });
  if (!options.includeArchived) query = query.eq("is_archived", false);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createRecordingList(
  payload: RecordingListInsert
): Promise<RecordingList> {
  const { data, error } = await supabase
    .from("recording_lists")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateRecordingList(
  listId: string,
  patch: RecordingListUpdate
): Promise<RecordingList> {
  const { data, error } = await supabase
    .from("recording_lists")
    .update(patch)
    .eq("id", listId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function archiveRecordingList(listId: string): Promise<void> {
  const now = new Date();
  const expires = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days
  await updateRecordingList(listId, {
    is_archived: true,
    archived_at: now.toISOString(),
    archive_expires_at: expires.toISOString(),
  });
}

export async function unarchiveRecordingList(listId: string): Promise<void> {
  await updateRecordingList(listId, {
    is_archived: false,
    archived_at: null,
    archive_expires_at: null,
  });
}

// Assignments -----------------------------------------------------------------

export async function listAssignmentsForRecording(
  recordingId: string
): Promise<RecordingListAssignment[]> {
  const { data, error } = await supabase
    .from("recording_list_assignments")
    .select("*")
    .eq("recording_id", recordingId);
  if (error) throw error;
  return data ?? [];
}

/**
 * All assignments visible to the current user. RLS narrows to assignments
 * whose recording belongs to one of the user's orgs, so callers don't need
 * to pass an org id.
 */
export async function listAllAssignments(): Promise<RecordingListAssignment[]> {
  const { data, error } = await supabase
    .from("recording_list_assignments")
    .select("*");
  if (error) throw error;
  return data ?? [];
}

export async function assignRecordingToList(
  recordingId: string,
  listId: string
): Promise<void> {
  const { error } = await supabase
    .from("recording_list_assignments")
    .upsert(
      { recording_id: recordingId, list_id: listId },
      { onConflict: "recording_id,list_id" }
    );
  if (error) throw error;
}

export async function unassignRecordingFromList(
  recordingId: string,
  listId: string
): Promise<void> {
  const { error } = await supabase
    .from("recording_list_assignments")
    .delete()
    .eq("recording_id", recordingId)
    .eq("list_id", listId);
  if (error) throw error;
}
