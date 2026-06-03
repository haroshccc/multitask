// Transcribe Webhook Edge Function — Gladia callback handler.
// SPEC §8 + Phase 6ג. Pair of `transcribe/index.ts` (the submit side).
//
// This function MUST be deployed with `verify_jwt = false` — Gladia callbacks
// don't carry a Supabase JWT. We authenticate by comparing the `?token=` query
// param against the `GLADIA_WEBHOOK_TOKEN` shared secret. See
// `supabase/config.toml`.
//
// Endpoint:
//   POST /transcribe-webhook?token=<GLADIA_WEBHOOK_TOKEN>
//   Body: { id, status, result?: {...}, error_code? }
//   Effect:
//     - status === 'done'  → save transcript_text + transcript_json,
//                            insert recording_speakers, flip status to
//                            'ready'.
//     - status === 'error' → flip status to 'error', save error_message.
//     - other statuses     → ignored (acked 200 so Gladia doesn't retry).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { jsonResponse, preflight } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GLADIA_WEBHOOK_TOKEN = Deno.env.get("GLADIA_WEBHOOK_TOKEN")!;

type GladiaSegment = {
  speaker?: number;
  start?: number;
  end?: number;
  text?: string;
  language?: string;
};

type GladiaPayloadResult = {
  transcription?: {
    full_transcript?: string;
    languages?: string[];
    utterances?: GladiaSegment[];
  };
  metadata?: { audio_duration?: number; number_of_distinct_channels?: number };
};

// Gladia v2 callback shape (what we actually receive):
//   { id, event: "transcription.success" | "transcription.error", payload: {...} }
// We also accept the older `{ id, status: "done"|"error", result: {...} }` shape
// defensively, in case Gladia ever toggles back.
type GladiaWebhookBody = {
  id?: string;
  event?: string;
  payload?: GladiaPayloadResult & { error_code?: number | string };
  status?: string;
  result?: GladiaPayloadResult;
  error_code?: number | string;
};

async function webhookHandler(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token || token !== GLADIA_WEBHOOK_TOKEN) {
    return jsonResponse({ error: "invalid_token" }, { status: 401, origin });
  }

  const body = (await req.json().catch(() => null)) as GladiaWebhookBody | null;
  console.log("transcribe_webhook_received", {
    id: body?.id,
    event: body?.event,
    status: body?.status,
    has_payload: Boolean(body?.payload),
    has_result: Boolean(body?.result),
    error_code: body?.error_code,
  });
  if (!body?.id) {
    return jsonResponse(
      { error: "missing_fields", required: ["id"] },
      { status: 400, origin }
    );
  }

  // Normalize v2 (`event`/`payload`) and legacy (`status`/`result`) shapes.
  const isError =
    body.event === "transcription.error" ||
    body.event === "transcription.failure" ||
    body.status === "error" ||
    Boolean(body.error_code);
  const isSuccess =
    body.event === "transcription.success" || body.status === "done";
  const resultBlob = body.payload ?? body.result;

  // Service-role client — webhook has no JWT. RLS-bypass is intentional.
  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: recording, error: recErr } = await service
    .from("recordings")
    .select("id, organization_id, status")
    .eq("provider", "gladia")
    .eq("provider_job_id", body.id)
    .maybeSingle();

  if (recErr || !recording) {
    // Don't 4xx — Gladia retries on non-2xx and we don't want noise for an
    // unknown job (could be a deleted recording).
    console.warn("transcribe_webhook_unknown_job", { job_id: body.id });
    return jsonResponse({ ok: true, ignored: "unknown_job" }, { origin });
  }

  // Idempotency / retry guard. Gladia may deliver duplicate or retried
  // callbacks for the same job (and on any non-2xx response it retries).
  // Once we've persisted a terminal state, ack 200 and do nothing — otherwise
  // each retry re-writes the (large) transcript and re-appends it to linked
  // thoughts, and under load these concurrent UPDATEs pile row-locks onto the
  // same recording. Only the `transcribing → terminal` transition does work.
  if (recording.status !== "transcribing") {
    return jsonResponse(
      {
        ok: true,
        ignored: "not_transcribing",
        status: recording.status,
        job_id: body.id,
      },
      { origin }
    );
  }

  if (isError) {
    // Conditional on status so two racing callbacks (or a late error after a
    // success) can't clobber a recording that already moved past transcribing.
    await service
      .from("recordings")
      .update({
        status: "error",
        error_message: `gladia_error: ${body.error_code ?? body.event ?? "unknown"}`,
      })
      .eq("id", recording.id)
      .eq("status", "transcribing");
    return jsonResponse({ ok: true }, { origin });
  }

  // We only act on terminal success. Intermediate states (queued, processing)
  // arrive too but we ignore them — recording.status is already 'transcribing'.
  if (!isSuccess || !resultBlob) {
    return jsonResponse(
      {
        ok: true,
        ignored: body.event ?? body.status ?? "no_status",
        job_id: body.id,
      },
      { origin }
    );
  }

  const transcription = resultBlob.transcription ?? {};
  const transcriptText = transcription.full_transcript ?? "";
  const utterances = transcription.utterances ?? [];

  const speakerIndices = new Set<number>();
  for (const u of utterances) {
    if (typeof u.speaker === "number") speakerIndices.add(u.speaker);
  }
  const speakersCount = speakerIndices.size;

  // Conditional on status = 'transcribing' so only ONE writer wins the
  // transition. A racing poll/webhook (or a Gladia retry) updates 0 rows and
  // skips the speakers upsert + thought sync below, so we never double-write
  // the transcript or double-append it to linked thoughts.
  const { data: updated, error: updErr } = await service
    .from("recordings")
    .update({
      status: "ready",
      transcript_text: transcriptText,
      transcript_json: resultBlob as unknown as Record<string, unknown>,
      speakers_count: speakersCount,
      error_message: null,
    })
    .eq("id", recording.id)
    .eq("status", "transcribing")
    .select("id");

  if (updErr) {
    console.error("transcribe_webhook_update_failed", updErr);
    return jsonResponse({ error: "db_update_failed" }, { status: 500, origin });
  }

  // Another writer already finished this recording — ack and stop.
  if (!updated || updated.length === 0) {
    return jsonResponse(
      { ok: true, ignored: "already_finalized", recording_id: recording.id },
      { origin }
    );
  }

  if (speakersCount > 0) {
    const rows = Array.from(speakerIndices)
      .sort((a, b) => a - b)
      .map((idx) => ({
        recording_id: recording.id,
        speaker_index: idx,
        label: null as string | null,
        role: null as "owner" | "contact" | "other" | null,
      }));
    const { error: spkErr } = await service
      .from("recording_speakers")
      .upsert(rows, { onConflict: "recording_id,speaker_index" });
    if (spkErr) console.warn("transcribe_webhook_speakers_upsert_failed", spkErr);
  }

  // Sync the transcript into any thought linked to this recording.
  // Option C (append): if the user already typed something, keep it and
  // append the transcript below a separator; if the field is empty, just
  // set it. We never overwrite typed content.
  if (transcriptText.trim()) {
    const { data: linkedThoughts, error: lookupErr } = await service
      .from("thoughts")
      .select("id, text_content")
      .eq("recording_id", recording.id);
    console.log("transcribe_webhook_thought_sync_v2", {
      recording_id: recording.id,
      linked_thoughts: linkedThoughts?.length ?? 0,
      transcript_chars: transcriptText.length,
    });
    if (lookupErr) {
      console.warn("transcribe_webhook_thought_lookup_failed", lookupErr);
    } else if (linkedThoughts && linkedThoughts.length > 0) {
      for (const t of linkedThoughts) {
        const existing = (t.text_content ?? "").trim();
        // Idempotency guard: never append the same transcript twice (e.g. if a
        // poll and a webhook both raced through before the status flipped).
        if (existing.includes(transcriptText.trim())) continue;
        const merged = existing
          ? `${t.text_content}\n\n---\n${transcriptText}`
          : transcriptText;
        const { error: thoughtUpdErr } = await service
          .from("thoughts")
          .update({ text_content: merged })
          .eq("id", t.id);
        if (thoughtUpdErr) {
          console.warn("transcribe_webhook_thought_update_failed", {
            thought_id: t.id,
            error: thoughtUpdErr,
          });
        }
      }
    }
  }

  // AI processing (`summarize` Edge Function) is a separate, manual step
  // the user triggers from the recording player. Don't gate the `ready`
  // status on it — go straight to 'ready' so the transcript editor and
  // the AI button are both reachable.

  return jsonResponse({ ok: true, recording_id: recording.id, speakersCount }, { origin });
}

serve(async (req) => {
  const cors = preflight(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return jsonResponse(
      { error: "method_not_allowed" },
      { status: 405, origin: req.headers.get("origin") }
    );
  }

  try {
    return await webhookHandler(req);
  } catch (err) {
    console.error("transcribe_webhook_error", err);
    return jsonResponse(
      { error: "server_error", message: err instanceof Error ? err.message : String(err) },
      { status: 500, origin: req.headers.get("origin") }
    );
  }
});
