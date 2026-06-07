import {
  FileText,
  Link as LinkIcon,
  Download,
  ExternalLink,
  Unlink,
  Loader2,
  Plus,
} from "lucide-react";
import {
  useLinkedDocuments,
  useDeleteDocumentLink,
  type DocumentLinkTargetType,
  type LinkedDocument,
} from "@/lib/hooks/useDocumentLinks";
import { presignDownload } from "@/lib/services/storage";

async function openDocument(doc: LinkedDocument) {
  if (doc.kind === "link") {
    if (doc.url) window.open(doc.url, "_blank", "noopener,noreferrer");
    return;
  }
  if (!doc.file_key) return;
  try {
    const { url } = await presignDownload(doc.file_key);
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    alert("שגיאה ביצירת קישור הורדה");
  }
}

/**
 * "מסמכים" section for a payment/contact detail modal. Lists the documents
 * linked via `document_links` and offers a "צרף מסמך" button.
 */
export function LinkedDocumentsSection({
  targetType,
  targetId,
  projectId,
  onAttach,
}: {
  targetType: DocumentLinkTargetType;
  targetId: string;
  projectId: string;
  onAttach: () => void;
}) {
  const { data: docs = [], isLoading } = useLinkedDocuments(
    targetType,
    targetId
  );
  const deleteLink = useDeleteDocumentLink();

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label className="eyebrow">מסמכים</label>
        <button
          type="button"
          onClick={onAttach}
          className="btn-ghost text-xs inline-flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          צרף מסמך
        </button>
      </div>

      {isLoading ? (
        <div className="py-3 text-center text-xs text-ink-400">
          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
        </div>
      ) : docs.length === 0 ? (
        <p className="text-[11px] text-ink-400 py-1">אין מסמכים מקושרים.</p>
      ) : (
        <div className="rounded-xl border border-ink-200 divide-y divide-ink-100 overflow-hidden">
          {docs.map((doc) => (
            <div
              key={doc.link_id}
              className="group flex items-center gap-2 px-2.5 py-1.5 hover:bg-ink-50"
            >
              {doc.kind === "link" ? (
                <LinkIcon className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-ink-400 shrink-0" />
              )}
              <button
                type="button"
                onClick={() => void openDocument(doc)}
                className="min-w-0 flex-1 text-start"
              >
                <span className="block truncate text-sm text-ink-900">
                  {doc.name || "ללא שם"}
                </span>
              </button>
              {doc.category && (
                <span className="chip text-[10px] bg-ink-100 text-ink-600 shrink-0">
                  {doc.category}
                </span>
              )}
              <button
                type="button"
                onClick={() => void openDocument(doc)}
                className="p-1 rounded-md text-ink-400 hover:text-ink-700 hover:bg-ink-100 shrink-0"
                aria-label={doc.kind === "link" ? "פתח" : "הורד"}
                title={doc.kind === "link" ? "פתח" : "הורד"}
              >
                {doc.kind === "link" ? (
                  <ExternalLink className="w-3.5 h-3.5" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm("להסיר את קישור המסמך? (המסמך עצמו יישאר בתיקייה)"))
                    deleteLink.mutate({
                      linkId: doc.link_id,
                      targetType,
                      targetId,
                      projectId,
                    });
                }}
                className="p-1 rounded-md text-ink-400 hover:text-danger-600 hover:bg-danger/10 shrink-0"
                aria-label="הסר קישור"
                title="הסר קישור"
              >
                <Unlink className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
