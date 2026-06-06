import { useMemo, useRef, useState } from "react";
import {
  Folder,
  FolderPlus,
  File as FileIcon,
  FileText,
  Link as LinkIcon,
  Upload,
  Plus,
  Loader2,
  Trash2,
  Download,
  ExternalLink,
  ChevronLeft,
  X,
  MoreVertical,
  Pencil,
} from "lucide-react";
import { useProjectContext } from "@/pages/app/ProjectShell";
import {
  useProjectDocuments,
  useCreateProjectDocument,
  useUpdateProjectDocument,
  useDeleteProjectDocument,
  type ProjectDocument,
} from "@/lib/hooks/useProjectDocuments";
import { useFileUpload } from "@/lib/hooks/useFileUpload";
import { presignDownload } from "@/lib/services/storage";
import { downloadFolderZip, fetchFileByKey } from "@/lib/export/zip";
import { cn } from "@/lib/utils/cn";
import { FileArchive } from "lucide-react";

function formatSize(bytes: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectDocumentsTab() {
  const { projectId } = useProjectContext();
  const { data: docs = [], isLoading } = useProjectDocuments(projectId);
  const createDoc = useCreateProjectDocument();
  const updateDoc = useUpdateProjectDocument();
  const deleteDoc = useDeleteProjectDocument();

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useFileUpload();
  const [isUploading, setIsUploading] = useState(false);
  const [zippingId, setZippingId] = useState<string | "__current__" | null>(null);

  const byId = useMemo(() => {
    const m = new Map<string, ProjectDocument>();
    for (const d of docs) m.set(d.id, d);
    return m;
  }, [docs]);

  // Breadcrumb path from root → current folder.
  const breadcrumb = useMemo(() => {
    const path: ProjectDocument[] = [];
    let cur = currentFolderId ? byId.get(currentFolderId) ?? null : null;
    const guard = new Set<string>();
    while (cur && !guard.has(cur.id)) {
      guard.add(cur.id);
      path.unshift(cur);
      cur = cur.parent_id ? byId.get(cur.parent_id) ?? null : null;
    }
    return path;
  }, [currentFolderId, byId]);

  const children = useMemo(
    () => docs.filter((d) => d.parent_id === currentFolderId),
    [docs, currentFolderId]
  );
  const folders = children.filter((d) => d.kind === "folder");
  const files = children.filter((d) => d.kind !== "folder");

  const openNote = noteId ? byId.get(noteId) ?? null : null;

  // ── Create actions ──────────────────────────────────────────────────────
  const handleNewFolder = () => {
    const name = window.prompt("שם התיקייה:");
    if (name == null) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    createDoc.mutate({
      projectId,
      parentId: currentFolderId,
      kind: "folder",
      name: trimmed,
    });
  };

  const handleNewNote = async () => {
    const note = await createDoc.mutateAsync({
      projectId,
      parentId: currentFolderId,
      kind: "note",
      name: "פתק חדש",
      content: "",
    });
    setNoteId(note.id);
  };

  const handlePickFile = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const safeName = file.name.replace(/[^\w.-]+/g, "_");
        const keySuffix = `projects/${projectId}/documents/${Date.now()}-${safeName}`;
        const { key } = await upload.upload(file, {
          keySuffix,
          contentType: file.type || "application/octet-stream",
          totalBytes: file.size,
        });
        await createDoc.mutateAsync({
          projectId,
          parentId: currentFolderId,
          kind: "file",
          name: file.name,
          file_key: key,
          file_size: file.size,
          mime: file.type || "application/octet-stream",
        });
      }
    } catch {
      alert("שגיאה בהעלאת הקובץ");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Item actions ────────────────────────────────────────────────────────
  const handleRename = (doc: ProjectDocument) => {
    const next = window.prompt("שם חדש:", doc.name);
    if (next == null) return;
    const trimmed = next.trim();
    if (!trimmed || trimmed === doc.name) return;
    updateDoc.mutate({ id: doc.id, projectId, patch: { name: trimmed } });
  };

  const handleDelete = (doc: ProjectDocument) => {
    const msg =
      doc.kind === "folder"
        ? "למחוק את התיקייה? כל מה שבתוכה יימחק גם."
        : "למחוק את הפריט?";
    if (!window.confirm(msg)) return;
    deleteDoc.mutate({ id: doc.id, projectId });
  };

  const handleDownload = async (doc: ProjectDocument) => {
    if (!doc.file_key) return;
    try {
      const { url } = await presignDownload(doc.file_key);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      alert("שגיאה ביצירת קישור הורדה");
    }
  };

  const handleDownloadZip = async (
    folderId: string | null,
    folderName: string,
    busyKey: string
  ) => {
    setZippingId(busyKey);
    try {
      await downloadFolderZip(folderName, docs, folderId, fetchFileByKey);
    } catch {
      alert("שגיאה ביצירת קובץ ה-ZIP");
    } finally {
      setZippingId(null);
    }
  };

  const currentFolderName =
    (currentFolderId ? byId.get(currentFolderId)?.name : null) || "מסמכים";

  const openItem = (doc: ProjectDocument) => {
    switch (doc.kind) {
      case "folder":
        setCurrentFolderId(doc.id);
        break;
      case "note":
        setNoteId(doc.id);
        break;
      case "link":
        if (doc.url) window.open(doc.url, "_blank", "noopener,noreferrer");
        break;
      case "file":
        void handleDownload(doc);
        break;
    }
  };

  if (isLoading) {
    return (
      <div className="card p-10 text-center text-ink-500 text-sm">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
        טוען מסמכים…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Breadcrumb
          path={breadcrumb}
          onNavigate={(id) => setCurrentFolderId(id)}
        />
        <div className="inline-flex items-center gap-1.5 flex-wrap">
          {children.length > 0 && (
            <button
              type="button"
              onClick={() =>
                handleDownloadZip(
                  currentFolderId,
                  currentFolderName,
                  "__current__"
                )
              }
              disabled={zippingId !== null}
              className="btn-ghost text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
              title="הורדת התיקייה הנוכחית כקובץ ZIP"
            >
              {zippingId === "__current__" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileArchive className="w-4 h-4" />
              )}
              הורד כ‑ZIP
            </button>
          )}
          <button
            type="button"
            onClick={handleNewFolder}
            className="btn-ghost text-xs inline-flex items-center gap-1.5"
          >
            <FolderPlus className="w-4 h-4" />
            תיקייה
          </button>
          <button
            type="button"
            onClick={handleNewNote}
            className="btn-ghost text-xs inline-flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4" />
            פתק
          </button>
          <button
            type="button"
            onClick={() => setLinkModalOpen(true)}
            className="btn-ghost text-xs inline-flex items-center gap-1.5"
          >
            <LinkIcon className="w-4 h-4" />
            קישור
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="btn-accent text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            העלאה
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handlePickFile(e.target.files)}
          />
        </div>
      </div>

      {/* Listing */}
      {children.length === 0 ? (
        <EmptyFolder
          onNewFolder={handleNewFolder}
          onNewNote={handleNewNote}
          onUpload={() => fileInputRef.current?.click()}
        />
      ) : (
        <div className="card divide-y divide-ink-100 overflow-hidden">
          {folders.map((doc) => (
            <DocRow
              key={doc.id}
              doc={doc}
              onOpen={() => openItem(doc)}
              onRename={() => handleRename(doc)}
              onDelete={() => handleDelete(doc)}
              onDownload={null}
              onZip={() => handleDownloadZip(doc.id, doc.name || "תיקייה", doc.id)}
              zipping={zippingId === doc.id}
            />
          ))}
          {files.map((doc) => (
            <DocRow
              key={doc.id}
              doc={doc}
              onOpen={() => openItem(doc)}
              onRename={() => handleRename(doc)}
              onDelete={() => handleDelete(doc)}
              onDownload={doc.kind === "file" ? () => handleDownload(doc) : null}
              onZip={null}
              zipping={false}
            />
          ))}
        </div>
      )}

      {openNote && (
        <NoteEditorModal
          note={openNote}
          projectId={projectId}
          onClose={() => setNoteId(null)}
        />
      )}

      {linkModalOpen && (
        <LinkModal
          onClose={() => setLinkModalOpen(false)}
          onSave={(name, url) => {
            createDoc.mutate({
              projectId,
              parentId: currentFolderId,
              kind: "link",
              name,
              url,
            });
            setLinkModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ── Breadcrumb ──────────────────────────────────────────────────────────────
function Breadcrumb({
  path,
  onNavigate,
}: {
  path: ProjectDocument[];
  onNavigate: (id: string | null) => void;
}) {
  return (
    <nav className="inline-flex items-center gap-1 text-sm min-w-0 flex-wrap">
      <button
        type="button"
        onClick={() => onNavigate(null)}
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-ink-100",
          path.length === 0 ? "font-semibold text-ink-900" : "text-ink-600"
        )}
      >
        <Folder className="w-4 h-4" />
        מסמכים
      </button>
      {path.map((folder, i) => (
        <span key={folder.id} className="inline-flex items-center gap-1 min-w-0">
          <ChevronLeft className="w-3.5 h-3.5 text-ink-300 shrink-0" />
          <button
            type="button"
            onClick={() => onNavigate(folder.id)}
            className={cn(
              "px-1.5 py-0.5 rounded hover:bg-ink-100 truncate max-w-[160px]",
              i === path.length - 1
                ? "font-semibold text-ink-900"
                : "text-ink-600"
            )}
          >
            {folder.name || "תיקייה"}
          </button>
        </span>
      ))}
    </nav>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────
function iconFor(doc: ProjectDocument) {
  switch (doc.kind) {
    case "folder":
      return <Folder className="w-5 h-5 text-amber-500 shrink-0" />;
    case "note":
      return <FileText className="w-5 h-5 text-blue-500 shrink-0" />;
    case "link":
      return <LinkIcon className="w-5 h-5 text-emerald-600 shrink-0" />;
    case "file":
    default:
      return <FileIcon className="w-5 h-5 text-ink-400 shrink-0" />;
  }
}

function DocRow({
  doc,
  onOpen,
  onRename,
  onDelete,
  onDownload,
  onZip,
  zipping,
}: {
  doc: ProjectDocument;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDownload: (() => void) | null;
  onZip: (() => void) | null;
  zipping: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const subtitle =
    doc.kind === "file"
      ? formatSize(doc.file_size)
      : doc.kind === "link"
      ? doc.url ?? ""
      : "";

  return (
    <div className="group flex items-center gap-2 px-3 py-2 hover:bg-ink-50">
      <button
        type="button"
        onClick={onOpen}
        className="flex items-center gap-2.5 min-w-0 flex-1 text-start"
      >
        {iconFor(doc)}
        <span className="min-w-0">
          <span className="block truncate font-medium text-ink-900">
            {doc.name || (doc.kind === "folder" ? "תיקייה" : "ללא שם")}
            {doc.kind === "link" && (
              <ExternalLink className="inline-block w-3 h-3 ms-1 text-ink-400 align-text-bottom" />
            )}
          </span>
          {subtitle && (
            <span className="block truncate text-[11px] text-ink-400">
              {subtitle}
            </span>
          )}
        </span>
      </button>

      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="p-1.5 rounded-md text-ink-400 hover:text-ink-700 hover:bg-ink-100 opacity-0 group-hover:opacity-100 focus:opacity-100 aria-expanded:opacity-100"
          aria-label="פעולות"
          aria-expanded={menuOpen}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute end-0 mt-1 z-20 w-40 bg-white rounded-xl shadow-lift border border-ink-100 py-1 text-sm">
              {onDownload && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onDownload();
                  }}
                  className="w-full text-start px-3 py-1.5 hover:bg-ink-50 inline-flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" />
                  הורדה
                </button>
              )}
              {onZip && (
                <button
                  type="button"
                  disabled={zipping}
                  onClick={() => {
                    setMenuOpen(false);
                    onZip();
                  }}
                  className="w-full text-start px-3 py-1.5 hover:bg-ink-50 inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {zipping ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileArchive className="w-3.5 h-3.5" />
                  )}
                  הורד כ‑ZIP
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onRename();
                }}
                className="w-full text-start px-3 py-1.5 hover:bg-ink-50 inline-flex items-center gap-2"
              >
                <Pencil className="w-3.5 h-3.5" />
                שינוי שם
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                className="w-full text-start px-3 py-1.5 hover:bg-danger/10 text-danger-600 inline-flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                מחיקה
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────
function EmptyFolder({
  onNewFolder,
  onNewNote,
  onUpload,
}: {
  onNewFolder: () => void;
  onNewNote: () => void;
  onUpload: () => void;
}) {
  return (
    <div className="card p-8 text-center">
      <Folder className="w-9 h-9 text-ink-300 mx-auto mb-2" />
      <h3 className="text-base font-semibold text-ink-900 mb-1">
        התיקייה ריקה
      </h3>
      <p className="text-xs text-ink-500 mb-4 max-w-sm mx-auto">
        הוסיפו תיקיות, פתקים, קבצים שתעלו או קישורים חיצוניים (כולל קישור לתיקיית
        Google Drive).
      </p>
      <div className="inline-flex items-center gap-2 flex-wrap justify-center">
        <button
          type="button"
          onClick={onNewFolder}
          className="btn-ghost text-sm inline-flex items-center gap-1.5"
        >
          <FolderPlus className="w-4 h-4" />
          תיקייה
        </button>
        <button
          type="button"
          onClick={onNewNote}
          className="btn-ghost text-sm inline-flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          פתק
        </button>
        <button
          type="button"
          onClick={onUpload}
          className="btn-accent text-sm inline-flex items-center gap-1.5"
        >
          <Upload className="w-4 h-4" />
          העלאת קובץ
        </button>
      </div>
    </div>
  );
}

// ── Note editor ─────────────────────────────────────────────────────────────
function NoteEditorModal({
  note,
  projectId,
  onClose,
}: {
  note: ProjectDocument;
  projectId: string;
  onClose: () => void;
}) {
  const updateDoc = useUpdateProjectDocument();
  const [name, setName] = useState(note.name);
  const [content, setContent] = useState(note.content ?? "");

  const save = () => {
    updateDoc.mutate({
      id: note.id,
      projectId,
      patch: { name: name.trim() || "פתק", content },
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-lift w-full max-w-2xl my-8 flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-ink-900">עריכת פתק</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-100">
            <X className="w-4 h-4 text-ink-600" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto min-h-0">
          <div>
            <label className="eyebrow mb-1.5 block">כותרת</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="כותרת הפתק"
              className="field"
            />
          </div>
          <div>
            <label className="eyebrow mb-1.5 block">תוכן</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={12}
              placeholder="כתבי כאן…"
              className="field resize-y"
            />
          </div>
        </div>

        <div className="px-5 py-3 bg-ink-50 border-t border-ink-200 flex items-center justify-end gap-2 shrink-0">
          <button onClick={onClose} className="btn-ghost text-sm">
            ביטול
          </button>
          <button
            onClick={save}
            disabled={updateDoc.isPending}
            className={cn("btn-accent text-sm", updateDoc.isPending && "opacity-50")}
          >
            {updateDoc.isPending ? "שומר…" : "שמירה"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Link modal ──────────────────────────────────────────────────────────────
function LinkModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (name: string, url: string) => void;
}) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const canSave = url.trim().length > 0;
  const save = () => {
    if (!canSave) return;
    const trimmedUrl = url.trim();
    onSave(name.trim() || trimmedUrl, trimmedUrl);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-lift w-full max-w-md my-8 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-ink-900">הוספת קישור</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-100">
            <X className="w-4 h-4 text-ink-600" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="eyebrow mb-1.5 block">כתובת (URL)</label>
            <input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://drive.google.com/…"
              className="field"
              dir="ltr"
            />
          </div>
          <div>
            <label className="eyebrow mb-1.5 block">שם (אופציונלי)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="למשל: תיקיית Drive של הפרויקט"
              className="field"
            />
          </div>
        </div>

        <div className="px-5 py-3 bg-ink-50 border-t border-ink-200 flex items-center justify-end gap-2 shrink-0">
          <button onClick={onClose} className="btn-ghost text-sm">
            ביטול
          </button>
          <button
            onClick={save}
            disabled={!canSave}
            className={cn("btn-accent text-sm", !canSave && "opacity-50")}
          >
            הוספה
          </button>
        </div>
      </div>
    </div>
  );
}
