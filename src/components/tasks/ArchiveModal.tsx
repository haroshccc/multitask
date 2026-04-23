import { X, ArchiveRestore, Clock } from "lucide-react";
import {
  useArchivedTaskLists,
  useRestoreTaskList,
} from "@/lib/hooks/useTaskLists";
import { format, differenceInDays } from "date-fns";
import { he } from "date-fns/locale";

interface ArchiveModalProps {
  onClose: () => void;
}

export function ArchiveModal({ onClose }: ArchiveModalProps) {
  const { data: lists = [], isLoading } = useArchivedTaskLists();
  const restore = useRestoreTaskList();

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-lift w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-ink-900">ארכיון רשימות</h3>
            <p className="text-xs text-ink-500">
              רשימות בארכיון נמחקות אוטומטית אחרי 60 יום. ניתן לשחזר בכל זמן
              לפני כן.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-100">
            <X className="w-4 h-4 text-ink-600" />
          </button>
        </div>

        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {isLoading ? (
            <div className="text-sm text-ink-500 text-center py-6">טוען...</div>
          ) : lists.length === 0 ? (
            <div className="text-sm text-ink-500 text-center py-10">
              אין רשימות בארכיון.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {lists.map((l) => {
                const archivedAt = l.archived_at ? new Date(l.archived_at) : null;
                const expiresAt = l.archive_expires_at
                  ? new Date(l.archive_expires_at)
                  : null;
                const daysLeft = expiresAt
                  ? Math.max(0, differenceInDays(expiresAt, new Date()))
                  : null;
                return (
                  <li
                    key={l.id}
                    className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white px-3 py-2"
                    style={
                      l.color
                        ? { borderInlineStartWidth: 3, borderInlineStartColor: l.color }
                        : undefined
                    }
                  >
                    <span className="text-base leading-none">
                      {l.emoji ?? "📋"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink-900 truncate">
                        {l.name}
                      </div>
                      <div className="text-xs text-ink-500 flex items-center gap-2 flex-wrap">
                        {archivedAt && (
                          <span>
                            בארכיון מאז{" "}
                            {format(archivedAt, "d בMMMM yyyy", { locale: he })}
                          </span>
                        )}
                        {daysLeft !== null && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            נמחקת בעוד {daysLeft} ימים
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => restore.mutate(l.id)}
                      className="btn-outline text-xs"
                      type="button"
                    >
                      <ArchiveRestore className="w-3.5 h-3.5" />
                      שחזר
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-4 py-3 border-t border-ink-200 flex items-center justify-end">
          <button onClick={onClose} className="btn-ghost text-sm">
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
