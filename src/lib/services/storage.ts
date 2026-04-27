/**
 * Browser-side thin client for the `storage` Edge Function.
 *
 * SPEC §28 #9 — the AWS SDK MUST NOT live in the browser bundle. Anything
 * that needs an R2 secret goes through these calls instead, which terminate
 * in the Edge Function (`supabase/functions/storage/`) where the secret lives.
 *
 * Only knows about presigned URLs and ETags; has no concept of recordings
 * or any other domain entity. Higher-level upload orchestration lives in
 * `useFileUpload`.
 */

import { supabase } from "@/lib/supabase/client";

export type PresignSingleUploadResponse = { key: string; url: string };
export type PresignedPart = { partNumber: number; url: string };
export type PresignMultipartResponse = {
  key: string;
  uploadId: string;
  parts: PresignedPart[];
};
export type CompletedPart = { PartNumber: number; ETag: string };

interface CallOptions {
  /** Per-call timeout in ms. `null` = no timeout. Default 30s. */
  timeoutMs?: number | null;
  /**
   * Number of additional retries on timeout / 5xx / network error.
   * Initial attempt is always made; this is the retry count on top.
   */
  retries?: number;
}

async function callFunction<T>(
  path: string,
  body: unknown,
  options: CallOptions = {}
): Promise<T> {
  const { data: session } = await supabase.auth.getSession();
  const jwt = session.session?.access_token;
  if (!jwt) throw new Error("not_authenticated");

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/storage/${path}`;
  const timeoutMs = options.timeoutMs === undefined ? 30_000 : options.timeoutMs;
  const totalAttempts = 1 + (options.retries ?? 0);

  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    const controller = timeoutMs == null ? null : new AbortController();
    const timer = controller
      ? setTimeout(() => controller.abort(), timeoutMs!)
      : null;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify(body),
        signal: controller?.signal ?? null,
      });
      if (timer) clearTimeout(timer);

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        // Retry only on server-side failures; 4xx is the caller's fault.
        if (res.status >= 500 && attempt < totalAttempts) {
          lastErr = new Error(
            `storage_${path}_failed: ${res.status} ${detail}`
          );
          continue;
        }
        throw new Error(`storage_${path}_failed: ${res.status} ${detail}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      if (timer) clearTimeout(timer);
      const e = err instanceof Error ? err : new Error(String(err));
      const isAbort = e.name === "AbortError";
      const friendly = isAbort
        ? new Error(`storage_${path}_timeout: no response after ${timeoutMs}ms`)
        : e;
      // Retry on timeout / network error; bail otherwise.
      const isRetriable = isAbort || /network|fetch/i.test(e.message);
      if (isRetriable && attempt < totalAttempts) {
        lastErr = friendly;
        continue;
      }
      throw friendly;
    }
  }
  throw lastErr ?? new Error(`storage_${path}_failed: exhausted retries`);
}

export function presignSingleUpload(input: {
  keySuffix: string;
  contentType: string;
  contentLength?: number;
}): Promise<PresignSingleUploadResponse> {
  return callFunction("presign-upload", input);
}

export function presignMultipartParts(input: {
  keySuffix: string;
  contentType?: string;
  uploadId?: string;
  partNumbers: number[];
}): Promise<PresignMultipartResponse> {
  return callFunction("presign-multipart", input);
}

export function completeMultipartUpload(input: {
  key: string;
  uploadId: string;
  parts: CompletedPart[];
}): Promise<{ key: string; ok: true }> {
  // Multipart completion runs an R2 server-side assembly that scales with
  // file size — give it longer than the default and one retry, since the
  // operation is idempotent (R2 returns success for an already-completed
  // upload).
  return callFunction("complete-multipart", input, {
    timeoutMs: 120_000,
    retries: 1,
  });
}

export function abortMultipartUpload(input: {
  key: string;
  uploadId: string;
}): Promise<{ ok: true }> {
  return callFunction("abort-multipart", input);
}

export function presignDownload(key: string): Promise<{ url: string }> {
  return callFunction("presign-get", { key });
}
