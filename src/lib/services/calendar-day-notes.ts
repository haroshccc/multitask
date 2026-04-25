import { supabase } from "@/lib/supabase/client";
import type { CalendarDayNote } from "@/lib/types/domain";

/**
 * Per-day calendar notes — one optional sticky note per (user, org, date).
 * The `date` column is `DATE` in postgres; we always pass `yyyy-mm-dd`
 * strings (the local date the user is viewing).
 */

/** Format a JS Date as the local-date `yyyy-mm-dd` we use as the key. */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export async function listNotesInRange(
  organizationId: string,
  userId: string,
  fromDate: string,
  toDate: string
): Promise<CalendarDayNote[]> {
  const { data, error } = await supabase
    .from("calendar_day_notes")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .gte("date", fromDate)
    .lte("date", toDate);
  if (error) throw error;
  return data ?? [];
}

export async function upsertDayNote(input: {
  organization_id: string;
  user_id: string;
  date: string;
  body: string;
}): Promise<CalendarDayNote> {
  const { data, error } = await supabase
    .from("calendar_day_notes")
    .upsert(input, { onConflict: "user_id,organization_id,date" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDayNote(
  organizationId: string,
  userId: string,
  date: string
): Promise<void> {
  const { error } = await supabase
    .from("calendar_day_notes")
    .delete()
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("date", date);
  if (error) throw error;
}
