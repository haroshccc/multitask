// =============================================================================
// Multitask — storage Edge Function (single-file deploy bundle)
// =============================================================================
// This file inlines `_shared/cors.ts`, `_shared/auth.ts`, and
// `_shared/r2-client.ts` so the Supabase Dashboard's "Deploy a new function"
// flow (single-file editor) can deploy the storage function in one paste.
//
// SOURCE OF TRUTH: the multi-file version under `supabase/functions/storage/`
// + `supabase/functions/_shared/`. Edits go there; this bundle is regenerated
// when needed. See `docs/recordings-architecture-prompt.md` for architecture.
//
// Required Supabase secrets (Dashboard → Settings → Edge Functions → Secrets):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
//  automatically by Supabase.)
// =============================================================================

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  type CompletedPart,
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
// R2 client (S3-compatible)
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

const PRESIGN_EXPIRES_SECONDS = 15 * 60;
const PRESIGN_GET_EXPIRES_SECONDS = 60 * 60;

async function presignSingleUpload(opts: {
  key: string;
  contentType: string;
  contentLength?: number;
}): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: opts.key,
    ContentType: opts.contentType,
    ContentLength: opts.contentLength,
  });
  return getSignedUrl(r2, cmd, { expiresIn: PRESIGN_EXPIRES_SECONDS });
}

async function presignDownload(key: string): Promise<string> {
  const cmd = new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key });
  return getSignedUrl(r2, cmd, { expiresIn: PRESIGN_GET_EXPIRES_SECONDS });
}

async function createMultipart(opts: {
  key: string;
  contentType: string;
}): Promise<{ uploadId: string }> {
  const out = await r2.send(
    new CreateMultipartUploadCommand({
      Bucket: R2_BUCKET_NAME,
      Key: opts.key,
      ContentType: opts.contentType,
    })
  );
  if (!out.UploadId) throw new Error("r2_no_upload_id");
  return { uploadId: out.UploadId };
}

async function presignUploadParts(opts: {
  key: string;
  uploadId: string;
  partNumbers: number[];
}): Promise<{ partNumber: number; url: string }[]> {
  return Promise.all(
    opts.partNumbers.map(async (partNumber) => {
      const cmd = new UploadPartCommand({
        Bucket: R2_BUCKET_NAME,
        Key: opts.key,
        UploadId: opts.uploadId,
        PartNumber: partNumber,
      });
      const url = await getSignedUrl(r2, cmd, { expiresIn: PRESIGN_EXPIRES_SECONDS });
      return { partNumber, url };
    })
  );
}

async function completeMultipart(opts: {
  key: string;
  uploadId: string;
  parts: CompletedPart[];
}): Promise<void> {
  await r2.send(
    new CompleteMultipartUploadCommand({
      Bucket: R2_BUCKET_NAME,
      Key: opts.key,
      UploadId: opts.uploadId,
      MultipartUpload: {
        Parts: opts.parts.sort((a, b) => (a.PartNumber ?? 0) - (b.PartNumber ?? 0)),
      },
    })
  );
}

async function abortMultipart(opts: {
  key: string;
  uploadId: string;
}): Promise<void> {
  await r2.send(
    new AbortMultipartUploadCommand({
      Bucket: R2_BUCKET_NAME,
      Key: opts.key,
      UploadId: opts.uploadId,
    })
  );
}

// =============================================================================
// Handlers
// =============================================================================

type Handler = (req: Request, ctx: MembershipContext) => Promise<Response>;

function buildKey(ctx: MembershipContext, suffix: string): string {
  const safeSuffix = suffix.replace(/^\/+/, "").replace(/\.\./g, "");
  return `org/${ctx.organizationId}/${safeSuffix}`;
}

function ownsKey(ctx: MembershipContext, key: string): boolean {
  return key.startsWith(`org/${ctx.organizationId}/`);
}

const handlers: Record<string, Handler> = {
  "presign-upload": async (req, ctx) => {
    const body = (await req.json().catch(() => null)) as
      | { keySuffix?: string; contentType?: string; contentLength?: number }
      | null;
    if (!body?.keySuffix || !body?.contentType) {
      return jsonResponse(
        { error: "missing_fields", required: ["keySuffix", "contentType"] },
        { status: 400, origin: req.headers.get("origin") }
      );
    }
    const key = buildKey(ctx, body.keySuffix);
    const url = await presignSingleUpload({
      key,
      contentType: body.contentType,
      contentLength: body.contentLength,
    });
    return jsonResponse({ key, url }, { origin: req.headers.get("origin") });
  },

  "presign-multipart": async (req, ctx) => {
    const body = (await req.json().catch(() => null)) as
      | {
          keySuffix?: string;
          contentType?: string;
          uploadId?: string;
          partNumbers?: number[];
        }
      | null;
    if (!body || !Array.isArray(body.partNumbers) || body.partNumbers.length === 0) {
      return jsonResponse(
        { error: "missing_fields", required: ["partNumbers"] },
        { status: 400, origin: req.headers.get("origin") }
      );
    }

    let key: string;
    let uploadId: string;

    if (body.uploadId) {
      if (!body.keySuffix || !ownsKey(ctx, body.keySuffix)) {
        return jsonResponse(
          { error: "key_outside_org" },
          { status: 403, origin: req.headers.get("origin") }
        );
      }
      key = body.keySuffix;
      uploadId = body.uploadId;
    } else {
      if (!body.keySuffix || !body.contentType) {
        return jsonResponse(
          { error: "missing_fields", required: ["keySuffix", "contentType"] },
          { status: 400, origin: req.headers.get("origin") }
        );
      }
      key = buildKey(ctx, body.keySuffix);
      const created = await createMultipart({ key, contentType: body.contentType });
      uploadId = created.uploadId;
    }

    const parts = await presignUploadParts({
      key,
      uploadId,
      partNumbers: body.partNumbers,
    });
    return jsonResponse(
      { key, uploadId, parts },
      { origin: req.headers.get("origin") }
    );
  },

  "complete-multipart": async (req, ctx) => {
    const body = (await req.json().catch(() => null)) as
      | {
          key?: string;
          uploadId?: string;
          parts?: { PartNumber: number; ETag: string }[];
        }
      | null;
    if (!body?.key || !body?.uploadId || !Array.isArray(body.parts)) {
      return jsonResponse(
        { error: "missing_fields", required: ["key", "uploadId", "parts"] },
        { status: 400, origin: req.headers.get("origin") }
      );
    }
    if (!ownsKey(ctx, body.key)) {
      return jsonResponse(
        { error: "key_outside_org" },
        { status: 403, origin: req.headers.get("origin") }
      );
    }
    await completeMultipart({
      key: body.key,
      uploadId: body.uploadId,
      parts: body.parts,
    });
    return jsonResponse(
      { key: body.key, ok: true },
      { origin: req.headers.get("origin") }
    );
  },

  "abort-multipart": async (req, ctx) => {
    const body = (await req.json().catch(() => null)) as
      | { key?: string; uploadId?: string }
      | null;
    if (!body?.key || !body?.uploadId) {
      return jsonResponse(
        { error: "missing_fields", required: ["key", "uploadId"] },
        { status: 400, origin: req.headers.get("origin") }
      );
    }
    if (!ownsKey(ctx, body.key)) {
      return jsonResponse(
        { error: "key_outside_org" },
        { status: 403, origin: req.headers.get("origin") }
      );
    }
    await abortMultipart({ key: body.key, uploadId: body.uploadId });
    return jsonResponse({ ok: true }, { origin: req.headers.get("origin") });
  },

  "presign-get": async (req, ctx) => {
    const body = (await req.json().catch(() => null)) as { key?: string } | null;
    if (!body?.key) {
      return jsonResponse(
        { error: "missing_fields", required: ["key"] },
        { status: 400, origin: req.headers.get("origin") }
      );
    }
    if (!ownsKey(ctx, body.key)) {
      return jsonResponse(
        { error: "key_outside_org" },
        { status: 403, origin: req.headers.get("origin") }
      );
    }
    const url = await presignDownload(body.key);
    return jsonResponse({ url }, { origin: req.headers.get("origin") });
  },
};

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

  const url = new URL(req.url);
  const tail = url.pathname.replace(/^.*?\/storage\/?/, "");
  const handler = handlers[tail];
  if (!handler) {
    return jsonResponse(
      { error: "not_found", path: tail },
      { status: 404, origin: req.headers.get("origin") }
    );
  }

  const auth = await requireMember(req);
  if ("error" in auth) return auth.error;

  try {
    return await handler(req, auth.ctx);
  } catch (err) {
    console.error("storage_handler_error", { tail, err });
    return jsonResponse(
      { error: "server_error", message: err instanceof Error ? err.message : String(err) },
      { status: 500, origin: req.headers.get("origin") }
    );
  }
});
