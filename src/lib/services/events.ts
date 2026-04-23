import { supabase } from "@/lib/supabase/client";
import type {
  EventRow,
  EventInsert,
  EventUpdate,
  EventParticipant,
  EventRsvpStatus,
} from "@/lib/types/domain";

export async function listEvents(
  organizationId: string,
  range?: { from: string; to: string }
): Promise<EventRow[]> {
  let query = supabase
    .from("events")
    .select("*")
    .eq("organization_id", organizationId)
    .order("starts_at", { ascending: true });
  if (range) {
    query = query.gte("starts_at", range.from).lte("starts_at", range.to);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getEvent(eventId: string): Promise<EventRow | null> {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createEvent(payload: EventInsert): Promise<EventRow> {
  const { data, error } = await supabase
    .from("events")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEvent(
  eventId: string,
  patch: EventUpdate
): Promise<EventRow> {
  const { data, error } = await supabase
    .from("events")
    .update(patch)
    .eq("id", eventId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEvent(eventId: string): Promise<void> {
  const { error } = await supabase.from("events").delete().eq("id", eventId);
  if (error) throw error;
}

// Participants --------------------------------------------------------------

export async function listEventParticipants(
  eventId: string
): Promise<EventParticipant[]> {
  const { data, error } = await supabase
    .from("event_participants")
    .select("*")
    .eq("event_id", eventId);
  if (error) throw error;
  return data ?? [];
}

export async function addEventParticipants(
  eventId: string,
  userIds: string[]
): Promise<void> {
  if (userIds.length === 0) return;
  const rows = userIds.map((user_id) => ({
    event_id: eventId,
    user_id,
  }));
  const { error } = await supabase
    .from("event_participants")
    .upsert(rows, { onConflict: "event_id,user_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function removeEventParticipant(
  eventId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("event_participants")
    .delete()
    .eq("event_id", eventId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function updateRsvp(
  eventId: string,
  userId: string,
  status: EventRsvpStatus
): Promise<void> {
  const { error } = await supabase
    .from("event_participants")
    .update({
      rsvp_status: status,
      responded_at: new Date().toISOString(),
    })
    .eq("event_id", eventId)
    .eq("user_id", userId);
  if (error) throw error;
}
