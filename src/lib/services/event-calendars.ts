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
 * Symmetric counterpart to `linkCalendarToList` — same bidirectional
 * link, driven from the task-list side. Picking a calendar clears any
 * previous link on either side (the list's previous calendar AND that
 * calendar's previous list) before setting the new pair, so we never
 * leave a stale back-pointer behind.
 */
export async function linkListToCalendar(
  taskListId: string,
  calendarId: string | null
): Promise<void> {
  const { data: list } = await supabase
    .from("task_lists")
    .select("linked_event_calendar_id")
    .eq("id", taskListId)
    .single();

  let targetCalColor: string | null = null;
  let targetCalPreviousList: string | null = null;
  if (calendarId) {
    const { data: cal } = await supabase
      .from("event_calendars")
      .select("color, linked_task_list_id")
      .eq("id", calendarId)
      .single();
    targetCalColor = cal?.color ?? null;
    targetCalPreviousList = cal?.linked_task_list_id ?? null;
  }

  // Clear the list's previous calendar's back-pointer.
  if (
    list?.linked_event_calendar_id &&
    list.linked_event_calendar_id !== calendarId
  ) {
    await supabase
      .from("event_calendars")
      .update({ linked_task_list_id: null })
      .eq("id", list.linked_event_calendar_id);
  }

  // Clear the target calendar's previous list back-pointer.
  if (targetCalPreviousList && targetCalPreviousList !== taskListId) {
    await supabase
      .from("task_lists")
      .update({ linked_event_calendar_id: null })
      .eq("id", targetCalPreviousList);
  }

  // Update the list, copying the calendar's color so they twin.
  const listPatch: { linked_event_calendar_id: string | null; color?: string } = {
    linked_event_calendar_id: calendarId,
  };
  if (calendarId && targetCalColor) listPatch.color = targetCalColor;
  await supabase.from("task_lists").update(listPatch).eq("id", taskListId);

  // Update the calendar.
  if (calendarId) {
    await supabase
      .from("event_calendars")
      .update({ linked_task_list_id: taskListId })
      .eq("id", calendarId);
  }
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
