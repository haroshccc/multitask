// =============================================================================
// Multitask — transcribe Edge Function (single-file deploy bundle)
// =============================================================================
// This file inlines `_shared/cors.ts`, `_shared/auth.ts`, and the
// `presignDownload` helper from `_shared/r2-client.ts` so the Supabase
// Dashboard's "Deploy a new function" flow (single-file editor) can deploy
// the transcribe function in one paste.
//
// SOURCE OF TRUTH: the multi-file version under `supabase/functions/transcribe/`
// + `supabase/functions/_shared/`. Edits go there; this bundle is regenerated
// when needed. See `SPEC.md` Phase 6ג Changelog entry.
//
// Required Supabase secrets (Dashboard → Settings → Edge Functions → Secrets):
//   GLADIA_API_KEY, GLADIA_WEBHOOK_TOKEN,
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
//  automatically by Supabase.)
//
// Endpoint:
//   POST /transcribe        — { recording_id } → submits to Gladia,
//                              writes provider_job_id, flips status to
//                              'transcribing'
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import {
  S3Client,
  GetObjectCommand,
} from "npm:@aws-sdk/client-s3@3.700.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.700.0";

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
// Auth — JWT verification + active-org membership
// =============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type MembershipContext = {
  userId: string;
  organizationId: string;
  role: string;
  serviceClient: SupabaseClient;
};

async function requireMember(
  req: Request
): Promise<{ ctx: MembershipContext } | { error: Response }> {
  const auth = req.headers.get("authorization");
  const origin = req.headers.get("origin");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) {
    return { error: jsonResponse({ error: "missing_auth" }, { status: 401, origin }) };
  }
  const jwt = auth.slice(7);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return { error: jsonResponse({ error: "invalid_jwt" }, { status: 401, origin }) };
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: membership, error: memErr } = await serviceClient
    .from("organization_members")
    .select("organization_id, role, organizations!inner(is_archived)")
    .eq("user_id", userData.user.id)
    .eq("organizations.is_archived", false)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (memErr || !membership) {
    return { error: jsonResponse({ error: "no_active_org" }, { status: 403, origin }) };
  }

  return {
    ctx: {
      userId: userData.user.id,
      organizationId: membership.organization_id,
      role: membership.role,
      serviceClient,
    },
  };
}

// =============================================================================
// R2 client — presignDownload only (transcribe doesn't upload)
// =============================================================================

const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID")!;
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")!;
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME")!;

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const PRESIGN_GET_EXPIRES_SECONDS = 60 * 60;

async function presignDownload(key: string): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key });
  return getSignedUrl(r2, cmd, { expiresIn: PRESIGN_GET_EXPIRES_SECONDS });
}

// =============================================================================
// Gladia configuration
// =============================================================================

const GLADIA_API_KEY = Deno.env.get("GLADIA_API_KEY")!;
const GLADIA_WEBHOOK_TOKEN = Deno.env.get("GLADIA_WEBHOOK_TOKEN")!;
const GLADIA_API_BASE = "https://api.gladia.io";

function webhookCallbackUrl(): string {
  return `${SUPABASE_URL}/functions/v1/transcribe-webhook?token=${encodeURIComponent(
    GLADIA_WEBHOOK_TOKEN
  )}`;
}

// =============================================================================
// Handler
// =============================================================================

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
