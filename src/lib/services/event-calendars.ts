import { supabase } from "@/lib/supabase/client";
import type {
  EventCalendar,
  EventCalendarInsert,
  EventCalendarUpdate,
} from "@/lib/types/domain";

export async function listEventCalendars(
  organizationId: string,
  ownerId: string
): Promise<EventCalendar[]> {
  const { data, error } = await supabase
    .from("event_calendars")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("owner_id", ownerId)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createEventCalendar(
  payload: EventCalendarInsert
): Promise<EventCalendar> {
  const { data, error } = await supabase
    .from("event_calendars")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEventCalendar(
  calendarId: string,
  patch: EventCalendarUpdate
): Promise<EventCalendar> {
  const { data, error } = await supabase
    .from("event_calendars")
    .update(patch)
    .eq("id", calendarId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function archiveEventCalendar(
  calendarId: string
): Promise<EventCalendar> {
  return updateEventCalendar(calendarId, {
    is_archived: true,
    archived_at: new Date().toISOString(),
  });
}

/**
 * Set or clear the bidirectional link between a task list and an event
 * calendar. Updates both sides in one logical step (best-effort — if the
 * second update fails the first is left in place; we accept that for MVP).
 *
 * Passing `taskListId === null` un-links the calendar (and clears the
 * back-pointer on whatever task list it was previously linked to).
 */
export async function linkCalendarToList(
  calendarId: string,
  taskListId: string | null
): Promise<void> {
  // Read current link to clear the old back-pointer if any.
  const { data: cal } = await supabase
    .from("event_calendars")
    .select("linked_task_list_id, color")
    .eq("id", calendarId)
    .single();

  // Clear any previous task-list back-pointer.
  if (cal?.linked_task_list_id && cal.linked_task_list_id !== taskListId) {
    await supabase
      .from("task_lists")
      .update({ linked_event_calendar_id: null })
      .eq("id", cal.linked_task_list_id);
  }

  // Update the calendar.
  await supabase
    .from("event_calendars")
    .update({ linked_task_list_id: taskListId })
    .eq("id", calendarId);

  if (taskListId) {
    // Set the forward pointer on the new list and copy the color across so
    // the two visually share a hue. Keep the list's existing color if the
    // calendar has none.
    const patch: { linked_event_calendar_id: string; color?: string } = {
      linked_event_calendar_id: calendarId,
    };
    if (cal?.color) patch.color = cal.color;
    await supabase.from("task_lists").update(patch).eq("id", taskListId);
  }
}
