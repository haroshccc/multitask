/**
 * Upload orchestrator. Handles single PUT (small files) and multipart-from-start
 * (large files / live recordings). Persists every chunk to IndexedDB before
 * uploading; tab crash → next session resumes via `resumeUpload(uploadId)`.
 *
 * Used by:
 *   - drag-drop file upload (single call to `upload(blob, opts)`)
 *   - live MediaRecorder loop (call `appendChunk(blob)` repeatedly, then
 *     `finishUpload()` when recording stops; multipart stays open the whole time)
 *
 * Both use cases share the same chunk persistence + presign + PUT pipeline.
 */

import { useCallback, useRef, useState } from "react";
import {
  presignSingleUpload,
  presignMultipartParts,
  completeMultipartUpload,
  abortMultipartUpload,
} from "@/lib/services/storage";
import {
  saveUploadMeta,
  getUploadMeta,
  saveChunk,
  markChunkAcked,
  listChunks,
  deleteUpload,
  listOpenUploads,
  type UploadMeta,
  type ChunkRow,
} from "@/lib/storage/indexeddb-chunks";

export type UploadStatus =
  | "idle"
  | "single-upload"
  | "multipart-open"
  | "multipart-uploading"
  | "completing"
  | "completed"
  | "aborted"
  | "failed";

export type UploadState = {
  status: UploadStatus;
  /** 0-100; for live recordings without a known total this stays at the last byte ratio uploaded so far. */
  progress: number;
  bytesUploaded: number;
  bytesTotal: number | null;
  key: string | null;
  uploadId: string | null;
  error: string | null;
};

export type UploadOptions = {
  /**
   * Path inside the user's org-scoped key prefix. The Edge Function rewrites
   * to `org/<orgId>/<keySuffix>` and returns the final key.
   */
  keySuffix: string;
  contentType: string;
  /**
   * For single-shot uploads pass the full size; for live recordings pass
   * undefined and we'll progress on each acked chunk instead of total bytes.
   */
  totalBytes?: number;
  recordingId?: string | null;
  /** Triggered after CompleteMultipartUpload (or single PUT) succeeds. */
  onCompleted?: (result: { key: string }) => void;
  onFailed?: (error: Error) => void;
};

const SINGLE_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const PART_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_RETRIES_PER_PART = 3;

const initialState: UploadState = {
  status: "idle",
  progress: 0,
  bytesUploaded: 0,
  bytesTotal: null,
  key: null,
  uploadId: null,
  error: null,
};

export function useFileUpload() {
  const [state, setState] = useState<UploadState>(initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // For live (multipart) sessions: kept across `appendChunk` calls.
  const sessionRef = useRef<{
    keySuffix: string;
    key: string;
    contentType: string;
    uploadId: string;
    nextPartNumber: number;
    pendingBuffer: Blob[];
    pendingBytes: number;
    cancelled: boolean;
  } | null>(null);

  const reset = useCallback(() => {
    sessionRef.current = null;
    setState(initialState);
  }, []);

  // ---------- single-shot upload ----------

  const singleUpload = useCallback(async (blob: Blob, opts: UploadOptions): Promise<string> => {
    const { url, key } = await presignSingleUpload({
      keySuffix: opts.keySuffix,
      contentType: opts.contentType,
      contentLength: blob.size,
    });
    await putWithProgress(url, blob, opts.contentType, (loaded) => {
      setState((s) => ({
        ...s,
        bytesUploaded: loaded,
        progress: blob.size ? Math.round((loaded / blob.size) * 100) : 0,
      }));
    });
    return key;
  }, []);

  // ---------- multipart upload ----------

  /** Open a multipart upload and presign part #1 (no chunk uploaded yet). */
  const beginMultipart = useCallback(
    async (opts: UploadOptions) => {
      const { uploadId, key, parts } = await presignMultipartParts({
        keySuffix: opts.keySuffix,
        contentType: opts.contentType,
        partNumbers: [1],
      });
      await saveUploadMeta({
        uploadId,
        key,
        contentType: opts.contentType,
        recordingId: opts.recordingId ?? null,
        createdAt: Date.now(),
        totalParts: null,
      });
      sessionRef.current = {
        keySuffix: opts.keySuffix,
        key,
        contentType: opts.contentType,
        uploadId,
        nextPartNumber: 1,
        pendingBuffer: [],
        pendingBytes: 0,
        cancelled: false,
      };
      setState({
        ...initialState,
        status: "multipart-open",
        bytesTotal: opts.totalBytes ?? null,
        key,
        uploadId,
      });
      // We presigned part 1 above but we send it from `flushPart` once the
      // first PART_SIZE_BYTES of audio accumulates. Discard that URL — we'll
      // re-presign in `flushPart`. (Cheap: no R2 op was charged.)
      void parts;
    },
    []
  );

  /**
   * Append data to the current live recording session. Buffers until we have
   * a full PART_SIZE_BYTES (or until `finishUpload` is called for the tail),
   * then uploads as one R2 part.
   */
  const appendChunk = useCallback(async (chunk: Blob): Promise<void> => {
    const sess = sessionRef.current;
    if (!sess) throw new Error("no_active_multipart");
    sess.pendingBuffer.push(chunk);
    sess.pendingBytes += chunk.size;
    while (sess.pendingBytes >= PART_SIZE_BYTES) {
      await flushOnePart(sess, /* finalTail */ false);
    }
  }, []);

  /** Send the buffered tail (if any) and CompleteMultipartUpload. */
  const finishUpload = useCallback(async (): Promise<{ key: string }> => {
    const sess = sessionRef.current;
    if (!sess) throw new Error("no_active_multipart");
    if (sess.cancelled) throw new Error("upload_cancelled");
    if (sess.pendingBytes > 0) {
      await flushOnePart(sess, /* finalTail */ true);
    }
    setState((s) => ({ ...s, status: "completing" }));
    const chunks = await listChunks(sess.uploadId);
    const completed = chunks
      .filter((c): c is ChunkRow & { etag: string } => Boolean(c.etag))
      .map((c) => ({ PartNumber: c.partNumber, ETag: c.etag }));
    await completeMultipartUpload({
      key: sess.key,
      uploadId: sess.uploadId,
      parts: completed,
    });
    await deleteUpload(sess.uploadId);
    setState((s) => ({ ...s, status: "completed", progress: 100 }));
    const key = sess.key;
    sessionRef.current = null;
    return { key };
  }, []);

  /** Flush ONE part out of the buffered bytes (consumes from the head). */
  async function flushOnePart(
    sess: NonNullable<typeof sessionRef.current>,
    finalTail: boolean
  ): Promise<void> {
    const targetBytes = finalTail
      ? sess.pendingBytes
      : Math.min(sess.pendingBytes, PART_SIZE_BYTES);
    const partBlob = takeFromBuffer(sess, targetBytes);
    const partNumber = sess.nextPartNumber++;

    await saveChunk({
      uploadId: sess.uploadId,
      partNumber,
      key: sess.key,
      blob: partBlob,
    });

    setState((s) => ({ ...s, status: "multipart-uploading" }));
    const etag = await uploadPartWithRetry({
      keySuffix: sess.key,
      uploadId: sess.uploadId,
      partNumber,
      contentType: sess.contentType,
      blob: partBlob,
      onProgress: (loaded) => {
        setState((s) => {
          const newBytes = s.bytesUploaded + loaded;
          return {
            ...s,
            bytesUploaded: newBytes,
            progress:
              s.bytesTotal && s.bytesTotal > 0
                ? Math.min(99, Math.round((newBytes / s.bytesTotal) * 100))
                : Math.min(99, partNumber * 5),
          };
        });
      },
    });
    await markChunkAcked(sess.uploadId, partNumber, etag);
  }

  function takeFromBuffer(
    sess: NonNullable<typeof sessionRef.current>,
    bytes: number
  ): Blob {
    const sliceParts: Blob[] = [];
    let remaining = bytes;
    while (remaining > 0 && sess.pendingBuffer.length > 0) {
      const head = sess.pendingBuffer[0];
      if (head.size <= remaining) {
        sliceParts.push(head);
        remaining -= head.size;
        sess.pendingBuffer.shift();
      } else {
        sliceParts.push(head.slice(0, remaining));
        sess.pendingBuffer[0] = head.slice(remaining);
        remaining = 0;
      }
    }
    sess.pendingBytes -= bytes;
    return new Blob(sliceParts, { type: sess.contentType });
  }

  // ---------- public surface ----------

  /**
   * One-shot upload. For files smaller than `SINGLE_UPLOAD_MAX_BYTES` issues a
   * single PUT; otherwise it opens a multipart, splits the file, and completes.
   */
  const upload = useCallback(
    async (file: Blob, opts: UploadOptions): Promise<{ key: string }> => {
      try {
        setState({
          ...initialState,
          status: file.size < SINGLE_UPLOAD_MAX_BYTES ? "single-upload" : "multipart-open",
          bytesTotal: file.size,
        });
        if (file.size < SINGLE_UPLOAD_MAX_BYTES) {
          const key = await singleUpload(file, opts);
          setState((s) => ({ ...s, status: "completed", progress: 100, key }));
          opts.onCompleted?.({ key });
          return { key };
        }
        await beginMultipart({ ...opts, totalBytes: file.size });
        const sess = sessionRef.current!;
        // Split the file into 5MB chunks and feed them through the live pipeline.
        let offset = 0;
        while (offset < file.size) {
          const slice = file.slice(offset, offset + PART_SIZE_BYTES);
          offset += slice.size;
          sess.pendingBuffer.push(slice);
          sess.pendingBytes += slice.size;
          // Flush exactly one part per slice so progress updates as we go.
          await flushOnePart(sess, offset >= file.size);
        }
        const result = await finishUpload();
        opts.onCompleted?.(result);
        return result;
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setState((s) => ({ ...s, status: "failed", error: e.message }));
        opts.onFailed?.(e);
        throw e;
      }
    },
    [singleUpload, beginMultipart, finishUpload]
  );

  /** Open a live multipart session — caller drives via `appendChunk` + `finishUpload`. */
  const startLiveUpload = useCallback(
    async (opts: UploadOptions): Promise<void> => {
      try {
        await beginMultipart(opts);
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setState((s) => ({ ...s, status: "failed", error: e.message }));
        opts.onFailed?.(e);
        throw e;
      }
    },
    [beginMultipart]
  );

  const cancel = useCallback(async (): Promise<void> => {
    const sess = sessionRef.current;
    if (!sess) {
      reset();
      return;
    }
    sess.cancelled = true;
    try {
      await abortMultipartUpload({ key: sess.key, uploadId: sess.uploadId });
    } catch {
      // Cloudflare's bucket lifecycle (7-day abort) cleans up if this fails.
    }
    await deleteUpload(sess.uploadId);
    sessionRef.current = null;
    setState({ ...initialState, status: "aborted" });
  }, [reset]);

  return {
    state,
    upload,
    startLiveUpload,
    appendChunk,
    finishUpload,
    cancel,
    reset,
  };
}

// =============================================================================
// Resume support — module-level helpers, not hooks.
// =============================================================================

export async function listResumableUploads(): Promise<UploadMeta[]> {
  return listOpenUploads();
}

/**
 * Resume an interrupted multipart upload after a tab crash. Re-uploads any
 * chunks still missing an ETag (they were saved to IndexedDB but R2 never
 * acked), then completes the multipart.
 */
export async function resumeUpload(uploadId: string): Promise<{ key: string }> {
  const meta = await getUploadMeta(uploadId);
  if (!meta) throw new Error("upload_not_found");

  const chunks = await listChunks(uploadId);
  for (const c of chunks) {
    if (c.etag) continue;
    const etag = await uploadPartWithRetry({
      keySuffix: c.key,
      uploadId,
      partNumber: c.partNumber,
      contentType: meta.contentType,
      blob: c.blob,
    });
    await markChunkAcked(uploadId, c.partNumber, etag);
  }
  const refreshed = await listChunks(uploadId);
  const completed = refreshed
    .filter((c): c is ChunkRow & { etag: string } => Boolean(c.etag))
    .map((c) => ({ PartNumber: c.partNumber, ETag: c.etag }));
  await completeMultipartUpload({
    key: meta.key,
    uploadId,
    parts: completed,
  });
  await deleteUpload(uploadId);
  return { key: meta.key };
}

// =============================================================================
// Internals
// =============================================================================

async function uploadPartWithRetry(opts: {
  keySuffix: string;
  uploadId: string;
  partNumber: number;
  contentType: string;
  blob: Blob;
  onProgress?: (loadedDelta: number) => void;
}): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES_PER_PART; attempt++) {
    try {
      const { parts } = await presignMultipartParts({
        keySuffix: opts.keySuffix,
        uploadId: opts.uploadId,
        partNumbers: [opts.partNumber],
      });
      const { url } = parts[0];
      let lastLoaded = 0;
      const etag = await putWithProgressForETag(url, opts.blob, opts.contentType, (loaded) => {
        opts.onProgress?.(loaded - lastLoaded);
        lastLoaded = loaded;
      });
      return etag;
    } catch (err) {
      lastErr = err;
      await delay(500 * (attempt + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("upload_part_failed");
}

function putWithProgress(
  url: string,
  blob: Blob,
  contentType: string,
  onProgress: (loaded: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress(ev.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`r2_put_${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("r2_put_network"));
    xhr.send(blob);
  });
}

function putWithProgressForETag(
  url: string,
  blob: Blob,
  contentType: string,
  onProgress: (loaded: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) onProgress(ev.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const etag = xhr.getResponseHeader("ETag");
        if (!etag) reject(new Error("r2_no_etag"));
        else resolve(etag);
      } else {
        reject(new Error(`r2_put_${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("r2_put_network"));
    xhr.send(blob);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type { UploadMeta };
