import { supabase } from "@/lib/supabase/client";

export type PresignUploadResponse = { key: string; url: string };
export type UploadProgress = { loaded: number; total: number };

/**
 * Calls the `storage` Edge Function to obtain a short-lived (15 min)
 * presigned R2 PutObject URL. The function namespaces the returned key
 * under `org/<active_org_id>/...` regardless of the suffix the client requests.
 */
export async function presignUpload(opts: {
  keySuffix: string;
  contentType: string;
  contentLength?: number;
}): Promise<PresignUploadResponse> {
  const { data, error } = await supabase.functions.invoke<PresignUploadResponse>(
    "storage/presign-upload",
    { body: opts }
  );
  if (error) throw error;
  if (!data?.key || !data?.url) {
    throw new Error("storage/presign-upload returned malformed response");
  }
  return data;
}

/**
 * Calls the `storage` Edge Function to obtain a short-lived (60 min)
 * presigned R2 GetObject URL. The function rejects keys outside the
 * caller's active org.
 */
export async function presignDownload(key: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ url: string }>(
    "storage/presign-get",
    { body: { key } }
  );
  if (error) throw error;
  if (!data?.url) {
    throw new Error("storage/presign-get returned malformed response");
  }
  return data.url;
}

/**
 * PUT a blob to a presigned R2 URL. Uses XHR so callers get upload-progress
 * events; the fetch API doesn't expose them.
 */
export function uploadToR2(opts: {
  url: string;
  blob: Blob;
  contentType: string;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", opts.url);
    xhr.setRequestHeader("Content-Type", opts.contentType);

    if (opts.onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          opts.onProgress!({ loaded: e.loaded, total: e.total });
        }
      });
    }

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`R2 PUT failed with status ${xhr.status}`));
    });
    xhr.addEventListener("error", () => reject(new Error("R2 PUT network error")));
    xhr.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));

    if (opts.signal) {
      if (opts.signal.aborted) {
        xhr.abort();
        return;
      }
      opts.signal.addEventListener("abort", () => xhr.abort());
    }

    xhr.send(opts.blob);
  });
}

/**
 * Builds a key suffix the Edge Function will namespace into the active org's
 * folder. Format: `<category>/<isoTimestamp>-<rand>.<ext>`.
 */
export function buildKeySuffix(opts: {
  category?: string;
  extension: string;
}): string {
  const cat = opts.category ?? "recordings";
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(36).slice(2, 8);
  return `${cat}/${ts}-${rand}.${opts.extension}`;
}

/**
 * Best-effort extension from a MIME type or original filename.
 * Falls back to "bin" if nothing matches.
 */
export function inferExtension(input: { mimeType?: string; filename?: string }): string {
  if (input.filename) {
    const m = input.filename.match(/\.([a-z0-9]+)$/i);
    if (m) return m[1].toLowerCase();
  }
  const t = (input.mimeType ?? "").toLowerCase();
  if (t.includes("mpeg") || t.includes("mp3")) return "mp3";
  if (t.includes("mp4") || t.includes("m4a") || t.includes("aac")) return "m4a";
  if (t.includes("webm")) return "webm";
  if (t.includes("ogg") || t.includes("opus")) return "ogg";
  if (t.includes("wav")) return "wav";
  if (t.includes("flac")) return "flac";
  return "bin";
}

/**
 * One-shot: get a presigned URL and PUT the blob. Returns the final R2 key
 * (which the Edge Function chose) so the caller can persist it on a DB row.
 */
export async function uploadBlobToR2(opts: {
  blob: Blob;
  extension: string;
  category?: string;
  onProgress?: (progress: UploadProgress) => void;
  signal?: AbortSignal;
}): Promise<{ key: string }> {
  const contentType = opts.blob.type || "application/octet-stream";
  const { key, url } = await presignUpload({
    keySuffix: buildKeySuffix({ category: opts.category, extension: opts.extension }),
    contentType,
    contentLength: opts.blob.size,
  });
  await uploadToR2({
    url,
    blob: opts.blob,
    contentType,
    onProgress: opts.onProgress,
    signal: opts.signal,
  });
  return { key };
}
