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
//                            'extracting' (Claude phase) or 'ready' (no Claude).
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

type GladiaWebhookBody = {
  id?: string;
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
  if (!body?.id) {
    return jsonResponse(
      { error: "missing_fields", required: ["id"] },
      { status: 400, origin }
    );
  }

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

  if (body.status === "error" || body.error_code) {
    await service
      .from("recordings")
      .update({
        status: "error",
        error_message: `gladia_error: ${body.error_code ?? "unknown"}`,
      })
      .eq("id", recording.id);
    return jsonResponse({ ok: true }, { origin });
  }

  // We only act on terminal `done`. Intermediate states (queued, processing)
  // arrive too but we ignore them — recording.status is already 'transcribing'.
  if (body.status !== "done" || !body.result) {
    return jsonResponse({ ok: true, ignored: body.status ?? "no_status" }, { origin });
  }

  const transcription = body.result.transcription ?? {};
  const transcriptText = transcription.full_transcript ?? "";
  const utterances = transcription.utterances ?? [];

  const speakerIndices = new Set<number>();
  for (const u of utterances) {
    if (typeof u.speaker === "number") speakerIndices.add(u.speaker);
  }
  const speakersCount = speakerIndices.size;

  const { error: updErr } = await service
    .from("recordings")
    .update({
      status: "extracting", // next stop = Claude (phase 6ג #2). Fallback below if not wired.
      transcript_text: transcriptText,
      transcript_json: body.result as unknown as Record<string, unknown>,
      speakers_count: speakersCount,
      error_message: null,
    })
    .eq("id", recording.id);

  if (updErr) {
    console.error("transcribe_webhook_update_failed", updErr);
    return jsonResponse({ error: "db_update_failed" }, { status: 500, origin });
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

  // If Claude (phase 6ג #2) isn't wired yet, advance to 'ready' so the UI
  // doesn't get stuck in 'extracting' forever. Once `summarize` exists, drop
  // this fallback and let it own the transition.
  const summarizeWired = Deno.env.get("ANTHROPIC_API_KEY");
  if (!summarizeWired) {
    await service.from("recordings").update({ status: "ready" }).eq("id", recording.id);
  }

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
