import { supabase } from "@/lib/supabase/client";
import {
  presignDownload,
  uploadBlobToR2,
  type UploadProgress,
} from "@/lib/storage/r2";
import type {
  Recording,
  RecordingInsert,
  RecordingUpdate,
  RecordingSpeaker,
  RecordingSource,
} from "@/lib/types/domain";

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
 * Upload flow (Phase 6א — R2 only):
 *   1. uploadRecordingBlob → presign + PUT to R2; returns the R2 key
 *   2. createRecording → DB row with status='uploaded' and storage_path=key
 *
 * Transcription / extraction (Phase 6ב/6ג) will pick up rows with
 * status='uploaded' via a future `process-recording` Edge Function.
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

export async function uploadRecordingBlob(opts: {
  blob: Blob;
  extension: string;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}): Promise<{ key: string }> {
  return uploadBlobToR2({
    blob: opts.blob,
    extension: opts.extension,
    category: "recordings",
    onProgress: opts.onProgress,
    signal: opts.signal,
  });
}

export async function getRecordingAudioUrl(
  storagePath: string
): Promise<string> {
  return presignDownload(storagePath);
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
  // R2 deletion will move to a dedicated Edge Function action in Phase 6ב.
  // For now, just flag the row — a periodic job can sweep R2 by key prefix.
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
 * Marks a recording as queued for transcription. Wiring to the actual
 * `process-recording` Edge Function arrives in Phase 6ב.
 */
export async function triggerProcessing(recordingId: string): Promise<void> {
  await updateRecording(recordingId, { status: "transcribing" });
}
