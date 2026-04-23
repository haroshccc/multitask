import { supabase } from "@/lib/supabase/client";
import type {
  Recording,
  RecordingInsert,
  RecordingUpdate,
  RecordingSpeaker,
  RecordingSource,
} from "@/lib/types/domain";

const STORAGE_BUCKET = "recordings";

export async function listRecordings(
  organizationId: string,
  options: { includeArchived?: boolean; source?: RecordingSource } = {}
): Promise<Recording[]> {
  let query = supabase
    .from("recordings")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (!options.includeArchived) query = query.eq("audio_archived", false);
  if (options.source) query = query.eq("source", options.source);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getRecording(
  recordingId: string
): Promise<Recording | null> {
  const { data, error } = await supabase
    .from("recordings")
    .select("*")
    .eq("id", recordingId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Upload flow:
 * 1. client calls createRecording to get a row with status='uploaded'
 * 2. client uploads MP3 to Storage at the returned storage_path
 * 3. client calls triggerProcessing which kicks off transcription via edge fn
 *
 * In MVP, transcription/extraction are stubbed — row stays status='ready'
 * with placeholder transcript until integrations wired.
 */
export async function createRecording(
  payload: RecordingInsert
): Promise<Recording> {
  const { data, error } = await supabase
    .from("recordings")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function uploadRecordingBlob(
  storagePath: string,
  blob: Blob
): Promise<void> {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, blob, { upsert: true });
  if (error) throw error;
}

export async function getRecordingAudioUrl(
  storagePath: string,
  expiresInSeconds = 60 * 60
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function updateRecording(
  recordingId: string,
  patch: RecordingUpdate
): Promise<Recording> {
  const { data, error } = await supabase
    .from("recordings")
    .update(patch)
    .eq("id", recordingId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function archiveRecordingAudio(
  recordingId: string
): Promise<void> {
  // Delete audio file from storage, keep metadata.
  const rec = await getRecording(recordingId);
  if (!rec) return;
  await supabase.storage.from(STORAGE_BUCKET).remove([rec.storage_path]);
  await updateRecording(recordingId, { audio_archived: true });
}

// Speakers -----------------------------------------------------------------

export async function listRecordingSpeakers(
  recordingId: string
): Promise<RecordingSpeaker[]> {
  const { data, error } = await supabase
    .from("recording_speakers")
    .select("*")
    .eq("recording_id", recordingId)
    .order("speaker_index", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateRecordingSpeaker(
  speakerId: string,
  patch: { label?: string; role?: "owner" | "contact" | "other"; user_id?: string | null }
): Promise<RecordingSpeaker> {
  const { data, error } = await supabase
    .from("recording_speakers")
    .update(patch)
    .eq("id", speakerId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Placeholder for "process recording" — kicks off transcription + extraction.
 * In MVP this is a no-op; will call an edge function once integrations wired.
 */
export async function triggerProcessing(recordingId: string): Promise<void> {
  // TODO: invoke edge function `recordings-process` with recording_id.
  // For now, just mark status so UI reflects work queued.
  await updateRecording(recordingId, { status: "transcribing" });
}
