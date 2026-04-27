import { supabase } from "@/lib/supabase/client";
import type {
  Recording,
  RecordingInsert,
  RecordingUpdate,
  RecordingSpeaker,
  RecordingSource,
} from "@/lib/types/domain";

/**
 * Legacy Supabase Storage bucket name. Only used by recordings whose
 * `storage_provider = 'supabase'`. New recordings (default) live in R2 and
 * are accessed via `src/lib/services/storage.ts`.
 */
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
 * 2. client uploads MP3 to Storage at the returned storage_key
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

/** Legacy Supabase-Storage upload. New code uses `useFileUpload` (R2) instead. */
export async function uploadRecordingBlobLegacy(
  storageKey: string,
  blob: Blob
): Promise<void> {
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storageKey, blob, { upsert: true });
  if (error) throw error;
}

/** Legacy Supabase-Storage signed URL. R2 rows use `presignDownload` instead. */
export async function getRecordingAudioUrlLegacy(
  storageKey: string,
  expiresInSeconds = 60 * 60
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storageKey, expiresInSeconds);
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
  // Delete audio file from storage, keep metadata. R2 deletion goes through
  // the storage Edge Function (added in phase 6ב); for legacy Supabase-Storage
  // rows we hit Storage directly. The metadata flip happens regardless.
  const rec = await getRecording(recordingId);
  if (!rec) return;
  if (rec.storage_provider === "supabase") {
    await supabase.storage.from(STORAGE_BUCKET).remove([rec.storage_key]);
  }
  await updateRecording(recordingId, { audio_archived: true });
}

/**
 * Persist transcript edits. The transcript editor lets the user fix individual
 * utterance texts (and we keep the speaker/start/end intact so click-to-seek
 * stays accurate). We rewrite both columns:
 *   - `transcript_json.transcription.utterances[i].text` for the structured copy
 *   - `transcript_text` recomputed by joining utterances, so plain-text consumers
 *     (the linked thought, AI summary, etc.) see the corrected text too.
 */
export async function saveRecordingTranscriptEdits(
  recordingId: string,
  edits: { index: number; text: string }[]
): Promise<Recording> {
  const rec = await getRecording(recordingId);
  if (!rec) throw new Error("recording_not_found");
  const json = (rec.transcript_json ?? null) as
    | {
        transcription?: {
          full_transcript?: string;
          utterances?: { text?: string; speaker?: number; start?: number; end?: number }[];
        };
      }
    | null;
  if (!json?.transcription?.utterances) {
    throw new Error("no_utterances_to_edit");
  }
  const utterances = json.transcription.utterances.slice();
  for (const edit of edits) {
    if (utterances[edit.index]) {
      utterances[edit.index] = { ...utterances[edit.index], text: edit.text };
    }
  }
  const newFullTranscript = utterances
    .map((u) => (u.text ?? "").trim())
    .filter(Boolean)
    .join(" ");
  const newJson = {
    ...json,
    transcription: {
      ...json.transcription,
      utterances,
      full_transcript: newFullTranscript,
    },
  };
  return updateRecording(recordingId, {
    transcript_json: newJson as unknown as Recording["transcript_json"],
    transcript_text: newFullTranscript,
  });
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
 * Kicks off Gladia transcription via the `transcribe` Edge Function.
 *
 * The Edge Function presigns a GET on R2, submits the job to Gladia v2 with
 * a webhook callback, and flips `recordings.status` to 'transcribing' once
 * Gladia accepts the job. Realtime then propagates the status flip to the UI.
 *
 * Idempotent: a second call on a recording that's already 'transcribing' /
 * 'extracting' / 'ready' returns ok without re-submitting.
 */
export async function triggerProcessing(recordingId: string): Promise<void> {
  const { data: session } = await supabase.auth.getSession();
  const jwt = session.session?.access_token;
  if (!jwt) throw new Error("not_authenticated");

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ recording_id: recordingId }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`transcribe_start_failed: ${res.status} ${detail}`);
  }
}
