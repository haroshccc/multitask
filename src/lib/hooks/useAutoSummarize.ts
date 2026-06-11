import { useEffect, useRef } from "react";
import type { Recording } from "@/lib/types/domain";
import { useTriggerAiProcessing } from "./useRecordings";

/**
 * Only auto-summarize recordings created within this window. This keeps the
 * feature to "summarize what I record going forward" and deliberately leaves
 * the existing backlog untouched (no surprise burst of Claude calls / status
 * changes on the first page load after deploy). Older recordings can still be
 * summarized on demand via the manual "סכם עכשיו" button.
 */
const AUTO_SUMMARIZE_WINDOW_MS = 72 * 60 * 60 * 1000; // 72h

/**
 * Auto-summarize: once a recording finishes transcription (`status === "ready"`)
 * and has not yet been processed by the AI (`ai_status` empty), fire the
 * `summarize` edge function automatically — the user shouldn't have to click
 * "process" for every recording.
 *
 * IMPORTANT: this NEVER triggers transcription (Gladia). It requires
 * `transcript_text` to already exist, so it only acts on recordings that were
 * already transcribed. The transcription step stays fully manual/unchanged.
 *
 * Two cost guards:
 *  1. Time window (above) — never touches the old backlog.
 *  2. Strictly SEQUENTIAL — at most one summarize call in flight at a time, so
 *     a batch of newly-ready recordings is processed one-by-one, never at once.
 *     (`useTriggerAiProcessing` invalidates the list on success, which re-runs
 *     this effect to pick up the next candidate.)
 *
 * Why client-side (not in the transcribe-webhook): the webhook runs with a
 * service-role context and is deliberately decoupled from summarize. The manual
 * "process again" button covers the app-was-closed case on next open.
 */
export function useAutoSummarize(recordings: Recording[]) {
  const trigger = useTriggerAiProcessing();
  const attempted = useRef<Set<string>>(new Set());
  const inFlight = useRef(false);

  useEffect(() => {
    if (inFlight.current) return;
    const now = Date.now();
    const candidate = recordings.find(
      (r) =>
        r.status === "ready" &&
        (r.ai_status == null || r.ai_status === "") &&
        !!r.transcript_text?.trim() &&
        !r.merged_into &&
        !attempted.current.has(r.id) &&
        now - new Date(r.created_at).getTime() <= AUTO_SUMMARIZE_WINDOW_MS,
    );
    if (!candidate) return;

    attempted.current.add(candidate.id);
    inFlight.current = true;
    trigger.mutate(
      { recordingId: candidate.id },
      {
        // Release the lock either way. On success the list invalidation re-runs
        // this effect for the next candidate; on error we stop (the id stays in
        // `attempted`, so no retry storm — manual re-run is still available).
        onSettled: () => {
          inFlight.current = false;
        },
      },
    );
    // `trigger.mutate` is a stable reference; intentionally not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordings]);
}

