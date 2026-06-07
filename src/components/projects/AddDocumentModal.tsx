import { useRef, useState } from "react";
import { X, Upload, Loader2, Link as LinkIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useOrgScope, assertOrgScope } from "@/lib/hooks/useOrgScope";
import { useFileUpload } from "@/lib/hooks/useFileUpload";
import { createProjectDocument } from "@/lib/services/project-documents";
import { useCreateDocumentLink } from "@/lib/hooks/useDocumentLinks";
import type { DocumentLinkTargetType } from "@/lib/services/document-links";
import { cn } from "@/lib/utils/cn";

/** Doc-type tag stored in `project_documents.category`. */
export const DOCUMENT_CATEGORIES = [
  "דרישת תשלום",
  "חשבונית",
  "קבלה",
  "חוזה",
  "אחר",
] as const;

export type AddDocumentTarget = {
  type: DocumentLinkTargetType;
  id: string;
  label: string;
};

type SourceMode = "file" | "link";

export function AddDocumentModal({
  projectId,
  defaultFolderId = null,
  targets,
  onClose,
  onDone,
}: {
  projectId: string;
  defaultFolderId?: string | null;
  targets: AddDocumentTarget[];
  onClose: () => void;
  onDone?: () => void;
}) {
  const scope = useOrgScope();
  const qc = useQueryClient();
  const upload = useFileUpload();
  const createLink = useCreateDocumentLink();

  const [source, setSource] = useState<SourceMode>("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(DOCUMENT_CATEGORIES[0]);
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(targets.map((t) => [`${t.type}:${t.id}`, true]))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleTarget = (key: string) =>
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));

  const handlePickFile = (list: FileList | null) => {
    const picked = list?.[0] ?? null;
    setFile(picked);
    if (picked && !name.trim()) setName(picked.name);
  };

  const trimmedUrl = url.trim();
  const canSubmit =
    !busy &&
    (source === "file" ? !!file : trimmedUrl.length > 0);

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const { organizationId, userId } = assertOrgScope(scope);

      let doc;
      if (source === "file") {
        const f = file!;
        const safeName = f.name.replace(/[^\w.-]+/g, "_");
        const keySuffix = `projects/${projectId}/documents/${Date.now()}-${safeName}`;
        const { key } = await upload.upload(f, {
          keySuffix,
          contentType: f.type || "application/octet-stream",
          totalBytes: f.size,
        });
        doc = await createProjectDocument({
          organization_id: organizationId,
          owner_id: userId,
          project_id: projectId,
          parent_id: defaultFolderId,
          kind: "file",
          name: name.trim() || f.name,
          category,
          file_key: key,
          file_size: f.size,
          mime: f.type || "application/octet-stream",
        });
      } else {
        doc = await createProjectDocument({
          organization_id: organizationId,
          owner_id: userId,
          project_id: projectId,
          parent_id: defaultFolderId,
          kind: "link",
          name: name.trim() || trimmedUrl,
          category,
          url: trimmedUrl,
        });
      }

      // Link to every checked target.
      for (const t of targets) {
        if (!checked[`${t.type}:${t.id}`]) continue;
        await createLink.mutateAsync({
          documentId: doc.id,
          targetType: t.type,
          targetId: t.id,
          projectId,
        });
      }

      // Make sure the documents tab + any unchecked target lists refresh.
      qc.invalidateQueries({ queryKey: ["project-documents", projectId] });

      onDone?.();
      onClose();
    } catch {
      setError("שגיאה בשמירת המסמך. נסי שוב.");
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-ink-900/50 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-lift w-full max-w-md my-8 flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-ink-900">הוסף מסמך</h3>
          <button
            onClick={onClose}
            disabled={busy}
            className="p-1.5 rounded-lg hover:bg-ink-100 disabled:opacity-40"
          >
            <X className="w-4 h-4 text-ink-600" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto min-h-0">
          {/* Source */}
          <div>
            <label className="eyebrow mb-1.5 block">מקור</label>
            <div className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setSource("file")}
                className={cn(
                  "px-3 py-1.5 text-xs inline-flex items-center gap-1.5",
                  source === "file"
                    ? "bg-ink-900 text-white"
                    : "text-ink-600 hover:bg-ink-50"
                )}
              >
                <Upload className="w-3.5 h-3.5" />
                העלאת קובץ
              </button>
              <button
                type="button"
                onClick={() => setSource("link")}
                className={cn(
                  "px-3 py-1.5 text-xs inline-flex items-center gap-1.5",
                  source === "link"
                    ? "bg-ink-900 text-white"
                    : "text-ink-600 hover:bg-ink-50"
                )}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                קישור חיצוני
              </button>
            </div>
          </div>

          {source === "file" ? (
            <div>
              <label className="eyebrow mb-1.5 block">קובץ</label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => handlePickFile(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full text-start px-3 py-2 rounded-lg border border-dashed border-ink-300 hover:bg-ink-50 text-sm text-ink-700 inline-flex items-center gap-2"
              >
                <Upload className="w-4 h-4 text-ink-400 shrink-0" />
                <span className="truncate">
                  {file ? file.name : "בחרי קובץ להעלאה…"}
                </span>
              </button>
            </div>
          ) : (
            <div>
              <label className="eyebrow mb-1.5 block">כתובת (URL)</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                className="field"
                dir="ltr"
              />
            </div>
          )}

          {/* Category */}
          <div>
            <label className="eyebrow mb-1.5 block">סוג מסמך</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="field"
            >
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="eyebrow mb-1.5 block">שם</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="שם המסמך"
              className="field"
            />
          </div>

          {/* Targets */}
          {targets.length > 0 && (
            <div>
              <label className="eyebrow mb-1.5 block">קישור אל</label>
              <div className="space-y-1.5">
                {targets.map((t) => {
                  const key = `${t.type}:${t.id}`;
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-2 text-sm text-ink-700 select-none"
                    >
                      <input
                        type="checkbox"
                        checked={!!checked[key]}
                        onChange={() => toggleTarget(key)}
                        className="rounded accent-primary-600"
                      />
                      {t.label}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-[11px] text-ink-400">
            המסמך יישמר פעם אחת בתיקיית המסמכים של הפרויקט, ויקושר אל הפריטים
            שסומנו.
          </p>

          {error && (
            <p className="text-xs text-danger-600">{error}</p>
          )}
        </div>

        <div className="px-5 py-3 bg-ink-50 border-t border-ink-200 flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            disabled={busy}
            className="btn-ghost text-sm disabled:opacity-40"
          >
            ביטול
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className={cn(
              "btn-accent text-sm inline-flex items-center gap-1.5",
              !canSubmit && "opacity-50"
            )}
          >
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                שומר…
              </>
            ) : (
              "שמירה"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
