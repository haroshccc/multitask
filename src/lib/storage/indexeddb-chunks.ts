/**
 * Chunk persistence for in-flight R2 multipart uploads.
 *
 * Why this exists: SPEC §8 says we MUST NOT lose a recording when the tab
 * crashes mid-upload. Every chunk is written here BEFORE the PUT to R2;
 * a chunk is only deleted once R2 acks it (returns an ETag). On the next
 * page load `listOpenUploads()` reports anything still pending, and the
 * upload hook resumes the multipart from where it left off.
 *
 * One chunk per row keyed by `[uploadId, partNumber]`. ETag is written back
 * onto the same row when R2 acks it; the row is deleted only after the
 * containing CompleteMultipartUpload (or AbortMultipartUpload) succeeds.
 */

const DB_NAME = "multitask-uploads";
const DB_VERSION = 1;
const CHUNK_STORE = "chunks";
const META_STORE = "uploads";

export type ChunkRow = {
  uploadId: string;
  partNumber: number;
  key: string;
  blob: Blob;
  etag: string | null;
  ackedAt: number | null;
  createdAt: number;
};

export type UploadMeta = {
  uploadId: string;
  key: string;
  contentType: string;
  recordingId: string | null;
  createdAt: number;
  totalParts: number | null;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CHUNK_STORE)) {
        const store = db.createObjectStore(CHUNK_STORE, {
          keyPath: ["uploadId", "partNumber"],
        });
        store.createIndex("by_upload", "uploadId", { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "uploadId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(
  storeNames: string | string[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => Promise<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(storeNames, mode);
        let result: T;
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error ?? new Error("tx_aborted"));
        fn(transaction).then(
          (r) => {
            result = r;
          },
          (err) => {
            try {
              transaction.abort();
            } catch {
              /* already aborting */
            }
            reject(err);
          }
        );
      })
  );
}

function reqAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveUploadMeta(meta: UploadMeta): Promise<void> {
  await tx(META_STORE, "readwrite", (t) =>
    reqAsPromise(t.objectStore(META_STORE).put(meta))
  );
}

export async function getUploadMeta(uploadId: string): Promise<UploadMeta | null> {
  return tx(META_STORE, "readonly", async (t) => {
    const v = await reqAsPromise(t.objectStore(META_STORE).get(uploadId));
    return (v as UploadMeta | undefined) ?? null;
  });
}

export async function listOpenUploads(): Promise<UploadMeta[]> {
  return tx(META_STORE, "readonly", async (t) => {
    const v = await reqAsPromise(t.objectStore(META_STORE).getAll());
    return (v as UploadMeta[]) ?? [];
  });
}

export async function saveChunk(row: Omit<ChunkRow, "etag" | "ackedAt" | "createdAt">): Promise<void> {
  const full: ChunkRow = {
    ...row,
    etag: null,
    ackedAt: null,
    createdAt: Date.now(),
  };
  await tx(CHUNK_STORE, "readwrite", (t) =>
    reqAsPromise(t.objectStore(CHUNK_STORE).put(full))
  );
}

export async function markChunkAcked(
  uploadId: string,
  partNumber: number,
  etag: string
): Promise<void> {
  await tx(CHUNK_STORE, "readwrite", async (t) => {
    const store = t.objectStore(CHUNK_STORE);
    const existing = (await reqAsPromise(store.get([uploadId, partNumber]))) as
      | ChunkRow
      | undefined;
    if (!existing) return;
    existing.etag = etag;
    existing.ackedAt = Date.now();
    await reqAsPromise(store.put(existing));
  });
}

export async function listChunks(uploadId: string): Promise<ChunkRow[]> {
  return tx(CHUNK_STORE, "readonly", async (t) => {
    const idx = t.objectStore(CHUNK_STORE).index("by_upload");
    const v = await reqAsPromise(idx.getAll(IDBKeyRange.only(uploadId)));
    return ((v as ChunkRow[]) ?? []).sort((a, b) => a.partNumber - b.partNumber);
  });
}

export async function deleteUpload(uploadId: string): Promise<void> {
  await tx([CHUNK_STORE, META_STORE], "readwrite", async (t) => {
    const chunks = t.objectStore(CHUNK_STORE);
    const idx = chunks.index("by_upload");
    const keys = (await reqAsPromise(idx.getAllKeys(IDBKeyRange.only(uploadId)))) as
      | IDBValidKey[]
      | undefined;
    for (const key of keys ?? []) {
      await reqAsPromise(chunks.delete(key));
    }
    await reqAsPromise(t.objectStore(META_STORE).delete(uploadId));
  });
}
