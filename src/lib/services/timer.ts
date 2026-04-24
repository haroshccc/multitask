import { supabase } from "@/lib/supabase/client";
import type { TimeEntry } from "@/lib/types/domain";

/**
 * One active timer per user — the RPC `start_timer` enforces this by stopping
 * any currently running entry before opening a new one.
 */
export async function startTimer(taskId: string, note?: string): Promise<TimeEntry> {
  const { data, error } = await supabase.rpc("start_timer", {
    p_task_id: taskId,
    p_note: note ?? undefined,
  });
  if (error) throw error;
  return data as TimeEntry;
}

export async function stopTimer(): Promise<TimeEntry | null> {
  const { data, error } = await supabase.rpc("stop_timer");
  if (error) throw error;
  return (data as TimeEntry | null) ?? null;
}

export async function getActiveTimer(): Promise<TimeEntry | null> {
  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listTimeEntries(taskId: string): Promise<TimeEntry[]> {
  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .eq("task_id", taskId)
    .order("started_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * All time entries for the organization that overlap with [from, to).
 * Used by the calendar overlay ("actual" stripes over "planned" blocks).
 * Overlap = started_at < to AND (ended_at IS NULL OR ended_at > from).
 */
export async function listTimeEntriesByRange(
  organizationId: string,
  from: string,
  to: string
): Promise<TimeEntry[]> {
  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .eq("organization_id", organizationId)
    .lt("started_at", to)
    .or(`ended_at.is.null,ended_at.gt.${from}`)
    .order("started_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createManualEntry(input: {
  task_id: string;
  organization_id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  note?: string | null;
}): Promise<TimeEntry> {
  // IMPORTANT: the DB has an AFTER-INSERT trigger that tries to fill
  // `duration_seconds` when it's missing, but NEW modifications are ignored
  // in AFTER triggers — so the row stays NULL and never gets summed into
  // `tasks.actual_seconds`. Compute it client-side before insert.
  const durationSeconds = Math.max(
    0,
    Math.round(
      (new Date(input.ended_at).getTime() -
        new Date(input.started_at).getTime()) /
        1000
    )
  );
  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      ...input,
      duration_seconds: durationSeconds,
      is_manual: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTimeEntry(
  entryId: string,
  patch: Partial<Pick<TimeEntry, "started_at" | "ended_at" | "note">>
): Promise<TimeEntry> {
  // Same reason as createManualEntry — if the edit changes start/end, recompute
  // duration_seconds client-side so the aggregate trigger picks it up.
  const nextPatch: Partial<
    Pick<TimeEntry, "started_at" | "ended_at" | "note" | "duration_seconds">
  > = { ...patch };
  if (patch.started_at !== undefined || patch.ended_at !== undefined) {
    const { data: current, error: getErr } = await supabase
      .from("time_entries")
      .select("started_at, ended_at")
      .eq("id", entryId)
      .single();
    if (getErr) throw getErr;
    const start = (patch.started_at ?? current.started_at) as string | null;
    const end = (patch.ended_at ?? current.ended_at) as string | null;
    if (start && end) {
      nextPatch.duration_seconds = Math.max(
        0,
        Math.round(
          (new Date(end).getTime() - new Date(start).getTime()) / 1000
        )
      );
    } else if (patch.ended_at === null) {
      nextPatch.duration_seconds = null;
    }
  }

  const { data, error } = await supabase
    .from("time_entries")
    .update(nextPatch)
    .eq("id", entryId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTimeEntry(entryId: string): Promise<void> {
  const { error } = await supabase.from("time_entries").delete().eq("id", entryId);
  if (error) throw error;
}
