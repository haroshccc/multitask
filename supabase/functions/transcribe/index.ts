// Transcribe Edge Function — Gladia v2 pre-recorded job submission.
// SPEC §8 + Phase 6ג (step 1 of 2; the webhook callback lives in the
// `transcribe-webhook` function so it can opt out of Supabase JWT
// verification — Gladia callbacks have no Supabase auth).
//
// Endpoint:
//   POST /transcribe        — { recording_id } → submits to Gladia,
//                              writes provider_job_id, flips status to
//                              'transcribing'
//
// Pipeline:
//   1. Browser calls this with { recording_id }.
//   2. We presign a GET URL on R2 (~1h), POST to Gladia v2 pre-recorded
//      with { audio_url, callback_url, diarization, language_config }.
//   3. Gladia returns a job id; we save it to recordings.provider_job_id and
//      flip status → 'transcribing'.
//   4. When Gladia is done it POSTs to /transcribe-webhook?token=… with the
//      full result. See `transcribe-webhook/index.ts` for that side.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { jsonResponse, preflight } from "../_shared/cors.ts";
import { requireMember, type MembershipContext } from "../_shared/auth.ts";
import { presignDownload } from "../_shared/r2-client.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const GLADIA_API_KEY = Deno.env.get("GLADIA_API_KEY")!;
const GLADIA_WEBHOOK_TOKEN = Deno.env.get("GLADIA_WEBHOOK_TOKEN")!;
const GLADIA_API_BASE = "https://api.gladia.io";

function webhookCallbackUrl(): string {
  return `${SUPABASE_URL}/functions/v1/transcribe-webhook?token=${encodeURIComponent(
    GLADIA_WEBHOOK_TOKEN
  )}`;
}

async function startHandler(
  req: Request,
  ctx: MembershipContext
): Promise<Response> {
  const origin = req.headers.get("origin");
  const body = (await req.json().catch(() => null)) as
    | { recording_id?: string; language?: string }
    | null;

  if (!body?.recording_id) {
    return jsonResponse(
      { error: "missing_fields", required: ["recording_id"] },
      { status: 400, origin }
    );
  }

  const { data: recording, error: recErr } = await ctx.serviceClient
    .from("recordings")
    .select(
      "id, organization_id, storage_provider, storage_key, language, status, provider_job_id"
    )
    .eq("id", body.recording_id)
    .maybeSingle();

  if (recErr || !recording) {
    return jsonResponse({ error: "recording_not_found" }, { status: 404, origin });
  }
  if (recording.organization_id !== ctx.organizationId) {
    return jsonResponse({ error: "recording_outside_org" }, { status: 403, origin });
  }
  if (recording.storage_provider !== "r2") {
    // Legacy Supabase-Storage rows aren't supported here; transcribe only on R2.
    return jsonResponse(
      { error: "unsupported_storage_provider", provider: recording.storage_provider },
      { status: 400, origin }
    );
  }
  if (
    recording.status === "transcribing" ||
    recording.status === "extracting" ||
    recording.status === "ready"
  ) {
    // Idempotent: re-trigger on a running or completed job is a no-op.
    return jsonResponse(
      { ok: true, already: recording.status, provider_job_id: recording.provider_job_id },
      { origin }
    );
  }

  const audioUrl = await presignDownload(recording.storage_key);
  const language = body.language ?? recording.language ?? "he";

  const gladiaPayload = {
    audio_url: audioUrl,
    callback_url: webhookCallbackUrl(),
    diarization: true,
    diarization_config: { min_speakers: 1, max_speakers: 6 },
    language_config: { languages: [language], code_switching: false },
    detect_language: false,
  };

  const gladiaRes = await fetch(`${GLADIA_API_BASE}/v2/pre-recorded`, {
    method: "POST",
    headers: {
      "x-gladia-key": GLADIA_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify(gladiaPayload),
  });

  if (!gladiaRes.ok) {
    const detail = await gladiaRes.text().catch(() => "");
    await ctx.serviceClient
      .from("recordings")
      .update({
        status: "error",
        error_message: `gladia_submit_failed: ${gladiaRes.status} ${detail.slice(0, 500)}`,
      })
      .eq("id", recording.id);
    return jsonResponse(
      { error: "gladia_submit_failed", status: gladiaRes.status, detail: detail.slice(0, 500) },
      { status: 502, origin }
    );
  }

  const gladiaJob = (await gladiaRes.json()) as { id: string; result_url?: string };

  await ctx.serviceClient
    .from("recordings")
    .update({
      status: "transcribing",
      provider: "gladia",
      provider_job_id: gladiaJob.id,
      error_message: null,
    })
    .eq("id", recording.id);

  return jsonResponse(
    { ok: true, recording_id: recording.id, provider_job_id: gladiaJob.id },
    { origin }
  );
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

  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;

  try {
    return await startHandler(req, auth.ctx);
  } catch (err) {
    console.error("transcribe_start_error", err);
    return jsonResponse(
      { error: "server_error", message: err instanceof Error ? err.message : String(err) },
      { status: 500, origin: req.headers.get("origin") }
    );
  }
});
