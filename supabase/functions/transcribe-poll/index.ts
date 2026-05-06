// Transcribe Poll Edge Function — fallback for missing Gladia webhooks.
//
// Pairs with `transcribe/index.ts` (submit) and `transcribe-webhook/index.ts`
// (callback). When Gladia's webhook is delayed or fails to deliver, the UI
// polls this endpoint every ~30s while the recording is in 'transcribing'.
// We GET https://api.gladia.io/v2/pre-recorded/{job_id} and, if the job is
// done, mirror the webhook's exact persistence logic (transcript_text,
// transcript_json, recording_speakers, linked-thought sync). On error, we
// flip status → 'error'. On 'processing'/'queued', we no-op.
//
// Endpoint:
//   POST /transcribe-poll       — { recording_id } → { status, gladia_status, ... }
//
// Auth: same JWT + org-membership check as `transcribe`.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { jsonResponse, preflight } from "../_shared/cors.ts";
import { requireMember, type MembershipContext } from "../_shared/auth.ts";

const GLADIA_API_KEY = Deno.env.get("GLADIA_API_KEY")!;
const GLADIA_API_BASE = "https://api.gladia.io";

type GladiaSegment = {
  speaker?: number;
  start?: number;
  end?: number;
  text?: string;
  language?: string;
};

type GladiaPollResponse = {
  id?: string;
  status?: string;
  error_code?: number | string;
  result?: {
    transcription?: {
      full_transcript?: string;
      languages?: string[];
      utterances?: GladiaSegment[];
    };
    metadata?: { audio_duration?: number; number_of_distinct_channels?: number };
  };
};

async function pollHandler(req: Request, ctx: MembershipContext): Promise<Response> {
  const origin = req.headers.get("origin");
  const body = (await req.json().catch(() => null)) as
    | { recording_id?: string }
    | null;
  if (!body?.recording_id) {
    return jsonResponse(
      { error: "missing_fields", required: ["recording_id"] },
      { status: 400, origin }
    );
  }

  const { data: recording, error: recErr } = await ctx.serviceClient
    .from("recordings")
    .select("id, organization_id, status, provider, provider_job_id")
    .eq("id", body.recording_id)
    .maybeSingle();

  if (recErr || !recording) {
    return jsonResponse({ error: "recording_not_found" }, { status: 404, origin });
  }
  if (recording.organization_id !== ctx.organizationId) {
    return jsonResponse({ error: "recording_outside_org" }, { status: 403, origin });
  }
  if (!recording.provider_job_id) {
    return jsonResponse(
      { ok: true, no_op: "no_provider_job_id", status: recording.status },
      { origin }
    );
  }
  // Only poll while transcribing — don't waste a Gladia call on terminal states.
  if (recording.status !== "transcribing") {
    return jsonResponse(
      { ok: true, no_op: "not_transcribing", status: recording.status },
      { origin }
    );
  }

  const r = await fetch(
    `${GLADIA_API_BASE}/v2/pre-recorded/${recording.provider_job_id}`,
    { headers: { "x-gladia-key": GLADIA_API_KEY } }
  );
  const text = await r.text();
  let payload: GladiaPollResponse = {};
  try {
    payload = JSON.parse(text) as GladiaPollResponse;
  } catch {
    return jsonResponse(
      { error: "gladia_invalid_response", http_status: r.status, raw: text.slice(0, 500) },
      { status: 502, origin }
    );
  }
  if (!r.ok) {
    return jsonResponse(
      { error: "gladia_poll_failed", http_status: r.status, body: payload },
      { status: 502, origin }
    );
  }

  const gStatus = payload.status;

  if (gStatus === "error") {
    await ctx.serviceClient
      .from("recordings")
      .update({
        status: "error",
        error_message: `gladia_error_polled: ${payload.error_code ?? "unknown"}`,
      })
      .eq("id", recording.id);
    return jsonResponse({ ok: true, status: "error", gladia_status: gStatus }, { origin });
  }

  if (gStatus !== "done" || !payload.result) {
    return jsonResponse(
      { ok: true, status: "transcribing", gladia_status: gStatus ?? "unknown" },
      { origin }
    );
  }

  // Mirror transcribe-webhook's persistence logic exactly so polled and
  // webhook paths produce identical DB state.
  const transcription = payload.result.transcription ?? {};
  const transcriptText = transcription.full_transcript ?? "";
  const utterances = transcription.utterances ?? [];

  const speakerIndices = new Set<number>();
  for (const u of utterances) {
    if (typeof u.speaker === "number") speakerIndices.add(u.speaker);
  }
  const speakersCount = speakerIndices.size;

  const { error: updErr } = await ctx.serviceClient
    .from("recordings")
    .update({
      status: "ready",
      transcript_text: transcriptText,
      transcript_json: payload.result as unknown as Record<string, unknown>,
      speakers_count: speakersCount,
      error_message: null,
    })
    .eq("id", recording.id);

  if (updErr) {
    return jsonResponse({ error: "db_update_failed", detail: updErr.message }, { status: 500, origin });
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
    await ctx.serviceClient
      .from("recording_speakers")
      .upsert(rows, { onConflict: "recording_id,speaker_index" });
  }

  // Sync transcript into linked thoughts (Option C: append, never overwrite).
  if (transcriptText.trim()) {
    const { data: linkedThoughts } = await ctx.serviceClient
      .from("thoughts")
      .select("id, text_content")
      .eq("recording_id", recording.id);
    if (linkedThoughts && linkedThoughts.length > 0) {
      for (const t of linkedThoughts) {
        const existing = (t.text_content ?? "").trim();
        const merged = existing
          ? `${t.text_content}\n\n---\n${transcriptText}`
          : transcriptText;
        await ctx.serviceClient
          .from("thoughts")
          .update({ text_content: merged })
          .eq("id", t.id);
      }
    }
  }

  return jsonResponse(
    { ok: true, status: "ready", gladia_status: gStatus, speakers_count: speakersCount },
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
    return await pollHandler(req, auth.ctx);
  } catch (err) {
    console.error("transcribe_poll_error", err);
    return jsonResponse(
      {
        error: "server_error",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500, origin: req.headers.get("origin") }
    );
  }
});
