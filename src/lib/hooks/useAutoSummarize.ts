import { useEffect, useRef } from "react";
import type { Recording } from "@/lib/types/domain";
import { useTriggerAiProcessing } from "./useRecordings";

/**
 * Auto-summarize: once a recording finishes transcription (`status === "ready"`)
 * and has not yet been processed by the AI (`ai_status` empty), fire the
 * `summarize` edge function automatically — the user shouldn't have to click
 * "process" for every recording.
 *
 * Why client-side (not in the transcribe-webhook): the webhook runs with a
 * service-role context and is deliberately decoupled from summarize; forging an
 * org-scoped membership context there is a large blast radius on a hot,
 * retry-sensitive function. Here it's trivial because realtime already
 * invalidates the recordings list on the ready-flip, so this hook re-runs with
 * the fresh row and triggers exactly once. The manual "process again" button
 * covers the app-was-closed case on next open.
 *
 * Duplicate-trigger guard: an in-flight `Set` of attempted ids (the server sets
 * `ai_status='pending'` synchronously, so the realtime re-render no longer
 * matches the trigger condition — the Set just guards the brief window before
 * that write lands).
 */
export function useAutoSummarize(recordings: Recording[]) {
  const trigger = useTriggerAiProcessing();
  const attempted = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const r of recordings) {
      const needsSummary =
        r.status === "ready" &&
        (r.ai_status == null || r.ai_status === "") &&
        !!r.transcript_text?.trim() &&
        !r.merged_into;
      if (needsSummary && !attempted.current.has(r.id)) {
        attempted.current.add(r.id);
        // Fire-and-forget. Errors surface on the row's error_message via the
        // edge function; we don't block the UI or retry here.
        trigger.mutate({ recordingId: r.id });
      }
    }
    // `trigger.mutate` is a stable reference in react-query; intentionally not
    // a dependency so mutation-state changes don't re-run this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordings]);
}
