// Storage Edge Function — entry point for all browser-initiated R2 traffic.
// SPEC §8 + §28 #9. Single function, internal routing on the URL tail.
//
// Endpoints (all POST, JSON in/out):
//   /storage/presign-upload      — short-form direct PUT (< 5MB)
//   /storage/presign-multipart   — open or extend a multipart upload
//   /storage/complete-multipart  — close a multipart upload
//   /storage/abort-multipart     — cancel a multipart upload
//   /storage/presign-get         — short-lived GET URL for playback
//
// All endpoints require an authenticated Supabase user who is a member of
// at least one non-archived organization. Storage keys are namespaced by
// organization to make a leaked URL unable to escape the org boundary.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { jsonResponse, preflight } from "../_shared/cors.ts";
import { requireMember, type MembershipContext } from "../_shared/auth.ts";
import {
  presignSingleUpload,
  presignDownload,
  createMultipart,
  presignUploadParts,
  completeMultipart,
  abortMultipart,
} from "../_shared/r2-client.ts";

type Handler = (req: Request, ctx: MembershipContext) => Promise<Response>;

function buildKey(ctx: MembershipContext, suffix: string): string {
  // Org-scoped keys: a leaked URL still can't reach another org's data,
  // because the next request will reject access via the membership check.
  const safeSuffix = suffix.replace(/^\/+/, "").replace(/\.\./g, "");
  return `org/${ctx.organizationId}/${safeSuffix}`;
}

function ownsKey(ctx: MembershipContext, key: string): boolean {
  return key.startsWith(`org/${ctx.organizationId}/`);
}

const handlers: Record<string, Handler> = {
  "presign-upload": async (req, ctx) => {
    const body = await req.json().catch(() => null) as
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
    const body = await req.json().catch(() => null) as
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
      // Extending an open multipart — caller already has the upload.
      // Validate the key belongs to this org so a leaked uploadId from another
      // org can't be used to mint URLs against this user's R2 bucket access.
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
    const body = await req.json().catch(() => null) as
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
    const body = await req.json().catch(() => null) as
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
    const body = await req.json().catch(() => null) as { key?: string } | null;
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

serve(async (req) => {
  const cors = preflight(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return jsonResponse(
      { error: "method_not_allowed" },
      { status: 405, origin: req.headers.get("origin") }
    );
  }

  // Path tail after `/storage/...` — Supabase invokes the function at
  // `/functions/v1/storage` and forwards anything beyond as the path.
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
