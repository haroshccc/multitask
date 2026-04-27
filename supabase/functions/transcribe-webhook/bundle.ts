// =============================================================================
// Multitask — transcribe-webhook Edge Function (single-file deploy bundle)
// =============================================================================
// This file inlines `_shared/cors.ts` so the Supabase Dashboard's "Deploy a
// new function" flow (single-file editor) can deploy the webhook function in
// one paste. No auth helper is needed because Gladia callbacks have no
// Supabase JWT — we authenticate via a `?token=` query param.
//
// SOURCE OF TRUTH: the multi-file version under
// `supabase/functions/transcribe-webhook/`. Edits go there; this bundle is
// regenerated when needed. See `SPEC.md` Phase 6ג Changelog entry.
//
// Required Supabase secrets (Dashboard → Settings → Edge Functions → Secrets):
//   GLADIA_WEBHOOK_TOKEN
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// ⚠ DEPLOY WITH `verify_jwt = false`. Gladia callbacks don't carry a Supabase
//   JWT; if the platform-level JWT check is on, Gladia hits 401 before our
//   handler runs. Toggle it off in the Supabase Dashboard's function settings
//   for this function specifically.
//
// Endpoint:
//   POST /transcribe-webhook?token=<GLADIA_WEBHOOK_TOKEN>
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

// =============================================================================
// CORS
// =============================================================================

const ALLOWED_ORIGINS = new Set<string>([
  "https://multitask-one.vercel.app",
  "http://localhost:5173",
]);

function corsHeaders(origin: string | null): HeadersInit {
  const allowOrigin =
    origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://multitask-one.vercel.app";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "3600",
    Vary: "Origin",
  };
}

function preflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

function jsonResponse(
  body: unknown,
  init: ResponseInit & { origin?: string | null } = {}
): Response {
  const { origin, ...rest } = init;
  return new Response(JSON.stringify(body), {
    ...rest,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(origin ?? null),
      ...(rest.headers ?? {}),
    },
  });
}

// =============================================================================
// Webhook handler
// =============================================================================

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
    console.warn("transcribe_webhook_unknown_job", { job_id: body.id });
    return jsonResponse({ ok: true, ignored: "unknown_job" }, { origin });
  }

  if (isError) {
    await service
      .from("recordings")
      .update({
        status: "error",
        error_message: `gladia_error: ${body.error_code ?? body.event ?? "unknown"}`,
      })
      .eq("id", recording.id);
    return jsonResponse({ ok: true }, { origin });
  }

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

  const { error: updErr } = await service
    .from("recordings")
    .update({
      status: "extracting",
      transcript_text: transcriptText,
      transcript_json: resultBlob as unknown as Record<string, unknown>,
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
  // doesn't get stuck in 'extracting' forever.
  const summarizeWired = Deno.env.get("ANTHROPIC_API_KEY");
  if (!summarizeWired) {
    await service.from("recordings").update({ status: "ready" }).eq("id", recording.id);
  }

  return jsonResponse({ ok: true, recording_id: recording.id, speakersCount }, { origin });
}

// =============================================================================
// Entry point
// =============================================================================

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
