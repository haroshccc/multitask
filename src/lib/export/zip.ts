import JSZip from "jszip";
import type { ProjectDocument } from "@/lib/services/project-documents";
import { presignDownload } from "@/lib/services/storage";
import { downloadBlob } from "./download";

/** Fetch a stored file's bytes by its R2 key via the presign-get edge function. */
export async function fetchFileByKey(key: string): Promise<ArrayBuffer> {
  const { url } = await presignDownload(key);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download_failed_${res.status}`);
  return res.arrayBuffer();
}

/**
 * Sanitize a documents-tree name for use as a filesystem path segment. Strips
 * path separators and characters that break archives / OS file systems, and
 * collapses whitespace. Empty names get a stable fallback.
 */
function sanitizeName(name: string | null, fallback: string): string {
  const cleaned = (name ?? "")
    .replace(/[/\\:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || fallback;
}

/**
 * De-duplicate sibling names within the same folder so two items called the
 * same thing don't collide in the archive.
 */
function uniqueName(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  // Insert the counter before the extension if there is one.
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";
  let i = 2;
  let candidate = `${stem} (${i})${ext}`;
  while (used.has(candidate)) {
    i += 1;
    candidate = `${stem} (${i})${ext}`;
  }
  used.add(candidate);
  return candidate;
}

/**
 * Recursively walk the project-documents tree and populate `zip` under
 * `basePath`. Children are those whose `parent_id === rootParentId`:
 *   - folders  → a nested zip folder, recursed into
 *   - files    → fetched via `fetchFile(file_key)` and added as bytes
 *   - notes    → `<name>.txt` with the note content
 *   - links    → `<name>.url.txt` with the URL
 *
 * `basePath` should be "" for the archive root or "folder/sub" (no trailing
 * slash). File fetch failures are swallowed into a `<name>.ERROR.txt` marker
 * so one missing object doesn't abort the whole backup.
 */
export async function buildDocsZip(
  zip: JSZip,
  basePath: string,
  docs: ProjectDocument[],
  rootParentId: string | null,
  fetchFile: (key: string) => Promise<ArrayBuffer>
): Promise<void> {
  const children = docs.filter((d) => d.parent_id === rootParentId);
  const used = new Set<string>();

  for (const doc of children) {
    const prefix = basePath ? `${basePath}/` : "";
    switch (doc.kind) {
      case "folder": {
        const folderName = uniqueName(sanitizeName(doc.name, "תיקייה"), used);
        // Recurse — empty folders still get created via the file() calls of
        // descendants; if a folder is empty JSZip simply won't list it, which
        // is acceptable.
        await buildDocsZip(zip, `${prefix}${folderName}`, docs, doc.id, fetchFile);
        // Ensure even empty folders show up in the archive.
        zip.folder(`${prefix}${folderName}`);
        break;
      }
      case "file": {
        const fileName = uniqueName(sanitizeName(doc.name, "קובץ"), used);
        if (!doc.file_key) break;
        try {
          const buf = await fetchFile(doc.file_key);
          zip.file(`${prefix}${fileName}`, buf);
        } catch {
          zip.file(
            `${prefix}${fileName}.ERROR.txt`,
            "לא ניתן היה להוריד את הקובץ הזה בזמן הגיבוי."
          );
        }
        break;
      }
      case "note": {
        const noteName = uniqueName(
          `${sanitizeName(doc.name, "פתק")}.txt`,
          used
        );
        zip.file(`${prefix}${noteName}`, doc.content ?? "");
        break;
      }
      case "link": {
        const linkName = uniqueName(
          `${sanitizeName(doc.name, "קישור")}.url.txt`,
          used
        );
        zip.file(`${prefix}${linkName}`, doc.url ?? "");
        break;
      }
    }
  }
}

/**
 * Build a ZIP rooted at a single folder (its children become the archive's
 * top level) and trigger a browser download. `folderId` is null for the
 * documents root.
 */
export async function downloadFolderZip(
  folderName: string,
  docs: ProjectDocument[],
  folderId: string | null,
  fetchFile: (key: string) => Promise<ArrayBuffer>
): Promise<void> {
  const zip = new JSZip();
  await buildDocsZip(zip, "", docs, folderId, fetchFile);
  const blob = await zip.generateAsync({ type: "blob" });
  const safe = sanitizeName(folderName, "מסמכים");
  downloadBlob(`${safe}.zip`, blob);
}
