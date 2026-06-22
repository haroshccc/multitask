import { useCallback, useState } from "react";
import { useCreateRecording, useUpdateRecording } from "./useRecordings";
import { useFileUpload } from "./useFileUpload";
import { getRecordingAudioUrl } from "@/lib/services/recordings";
import { concatToWav } from "@/lib/audio/concatAudio";
import type { Recording } from "@/lib/types/domain";

export type MergePhase =
  | "idle"
  | "preparing"
  | "concatenating"
  | "uploading"
  | "finalizing";

export interface MergeProgress {
  phase: MergePhase;
  /** During "concatenating": which part is being processed. */
  done?: number;
  total?: number;
}

/**
 * True audio merge: concatenates the selected recordings' audio (in order) into
 * a single WAV, uploads it as a NEW recording, and (optionally) archives the
 * originals — exactly like the old transcript-merge marked them, so they leave
 * the list but stay recoverable. The new recording lands as `status:'uploaded'`,
 * ready to transcribe as one continuous conversation.
 *
 * Recordings-side only — never touches the task-save path.
 */
export function useAudioMerge() {
  const createRecording = useCreateRecording();
  const update = useUpdateRecording();
  const upload = useFileUpload();
  const [progress, setProgress] = useState<MergeProgress>({ phase: "idle" });
  const [pending, setPending] = useState(false);

  const run = useCallback(
    async (
      recordings: Recording[],
      opts: { archiveOriginals: boolean },
    ): Promise<Recording> => {
      if (recordings.length < 2) throw new Error("need_at_least_two_recordings");
      if (recordings.some((r) => r.audio_archived)) {
        throw new Error("archived_audio_in_selection");
      }

      setPending(true);
      setProgress({ phase: "preparing" });
      try {
        // 1) Resolve a playback URL for each part (in the chosen order).
        const urls: string[] = [];
        for (const r of recordings) urls.push(await getRecordingAudioUrl(r));

        // 2) Decode + stitch into one WAV.
        setProgress({ phase: "concatenating", done: 0, total: recordings.length });
        const { blob, durationSeconds } = await concatToWav(urls, (p) =>
          setProgress({ phase: "concatenating", done: p.done, total: p.total }),
        );

        // 3) Upload the merged WAV (single PUT — see useFileUpload).
        setProgress({ phase: "uploading" });
        const keySuffix = `recordings/${stamp()}-${rand()}.wav`;
        const file = new File([blob], `merged-${stamp()}.wav`, {
          type: "audio/wav",
        });
        const { key } = await upload.upload(file, {
          keySuffix,
          contentType: "audio/wav",
        });

        // 4) Create the merged recording row.
        setProgress({ phase: "finalizing" });
        const first = recordings[0];
        const merged = await createRecording.mutateAsync({
          source: first.source ?? "recording",
          title: `${(first.title ?? "הקלטה").trim()} (מאוחד)`,
          storage_key: key,
          storage_provider: "r2",
          size_bytes: blob.size,
          mime_type: "audio/wav",
          status: "uploaded",
          duration_seconds: Math.round(durationSeconds),
        });

        // 5) Archive the originals so they leave the list (recoverable).
        if (opts.archiveOriginals) {
          for (const r of recordings) {
            await update.mutateAsync({
              recordingId: r.id,
              patch: { merged_into: merged.id, audio_archived: true },
            });
          }
        }

        setProgress({ phase: "idle" });
        return merged;
      } finally {
        setPending(false);
      }
    },
    [createRecording, update, upload],
  );

  return { run, progress, pending };
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
function rand() {
  return Math.random().toString(36).slice(2, 8);
}
