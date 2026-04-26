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

async function callFunction<T>(path: string, body: unknown): Promise<T> {
  const { data: session } = await supabase.auth.getSession();
  const jwt = session.session?.access_token;
  if (!jwt) throw new Error("not_authenticated");

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/storage/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`storage_${path}_failed: ${res.status} ${detail}`);
  }
  return res.json() as Promise<T>;
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
  return callFunction("complete-multipart", input);
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
