import { X } from "lucide-react";
import { useFrameworkHistory } from "@/lib/hooks/useFrameworks";
import type { Framework } from "@/lib/types/frameworks";

interface Props {
  framework: Framework;
  onClose: () => void;
}

const ACTION_LABEL: Record<string, string> = {
  create: "יצירה",
  update: "עדכון",
  delete: "מחיקה",
};

export function FrameworkHistoryModal({ framework, onClose }: Props) {
  const { data: entries = [], isLoading } = useFrameworkHistory(framework.id);

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-lift w-full max-w-lg flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-ink-200 flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-semibold text-ink-900">היסטוריית שינויים</h3>
            <p className="text-xs text-ink-500">{framework.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-100">
            <X className="w-4 h-4 text-ink-600" />
          </button>
        </div>

        <div className="p-4 flex-1 overflow-y-auto min-h-0">
          {isLoading && <p className="text-sm text-ink-500 text-center py-6">טוען...</p>}
          {!isLoading && entries.length === 0 && (
            <p className="text-sm text-ink-500 text-center py-6">אין שינויים עדיין.</p>
          )}
          <ol className="space-y-2">
            {entries.map((e) => (
              <li
                key={e.id}
                className="flex items-start gap-3 rounded-xl border border-ink-100 px-3 py-2"
              >
                <span className="text-[10px] mt-0.5 rounded-md bg-ink-100 text-ink-600 px-1.5 py-0.5 shrink-0">
                  {ACTION_LABEL[e.action] ?? e.action}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink-800">{e.summary ?? e.entity_type}</div>
                  <div className="text-[11px] text-ink-400">
                    {new Date(e.created_at).toLocaleString("he-IL")}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="px-4 py-3 border-t border-ink-200 flex items-center justify-end shrink-0">
          <button onClick={onClose} className="btn-ghost text-sm">
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}
