import { X } from "lucide-react";
import { StatusesSettings } from "@/components/settings/StatusesSettings";

interface StatusesModalProps {
  onClose: () => void;
}

/**
 * Page-level modal hosting the statuses palette editor. Moved here from the
 * global Settings page so it lives next to the rest of the Tasks page gear
 * options (ארכיון / תצוגת שורה / עמודות בתצוגה).
 */
export function StatusesModal({ onClose }: StatusesModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-lift w-full max-w-2xl my-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between">
          <h3 className="font-semibold text-ink-900">סטטוסים של משימות</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-ink-100"
          >
            <X className="w-4 h-4 text-ink-600" />
          </button>
        </div>

        <div className="p-4 max-h-[calc(100vh-16rem)] overflow-y-auto">
          <StatusesSettings />
        </div>

        <div className="px-4 py-3 border-t border-ink-200 flex items-center justify-end">
          <button onClick={onClose} className="btn-accent text-sm">
            סיים
          </button>
        </div>
      </div>
    </div>
  );
}
