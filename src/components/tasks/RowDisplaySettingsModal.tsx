import { X, Eye, EyeOff, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  ROW_DISPLAY_FIELDS,
  type RowDisplayPrefs,
} from "@/lib/hooks/useRowDisplayPrefs";

interface RowDisplaySettingsModalProps {
  prefs: RowDisplayPrefs;
  onChange: (next: Partial<RowDisplayPrefs>) => void;
  onReset: () => void;
  onClose: () => void;
}

export function RowDisplaySettingsModal({
  prefs,
  onChange,
  onReset,
  onClose,
}: RowDisplaySettingsModalProps) {
  const turnAllOff = () => {
    const off: Partial<RowDisplayPrefs> = {};
    ROW_DISPLAY_FIELDS.forEach((f) => {
      off[f.key] = false;
    });
    onChange(off);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-lift w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3 border-b border-ink-200 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-ink-900">תצוגת שורה</h3>
            <p className="text-xs text-ink-500">
              בחרי אילו אייקונים להציג ליד כל משימה. המצב נשמר לכל המכשירים שלך.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-100">
            <X className="w-4 h-4 text-ink-600" />
          </button>
        </div>

        <div className="p-3 max-h-[60vh] overflow-y-auto">
          <ul className="space-y-1">
            {ROW_DISPLAY_FIELDS.map((f) => {
              const on = prefs[f.key];
              return (
                <li key={f.key}>
                  <button
                    type="button"
                    onClick={() => onChange({ [f.key]: !on })}
                    className={cn(
                      "w-full flex items-start gap-3 rounded-xl border px-3 py-2 text-start transition-colors",
                      on
                        ? "border-primary-500 bg-primary-50"
                        : "border-ink-200 bg-white hover:bg-ink-50"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-lg shrink-0",
                        on ? "bg-primary-500 text-white" : "bg-ink-100 text-ink-500"
                      )}
                    >
                      {on ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-ink-900">{f.label}</div>
                      <div className="text-xs text-ink-500">{f.description}</div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="px-4 py-3 border-t border-ink-200 flex items-center justify-between gap-2">
          <button onClick={turnAllOff} className="btn-ghost text-xs" type="button">
            <EyeOff className="w-3.5 h-3.5" />
            כבי הכל
          </button>
          <div className="flex items-center gap-2">
            <button onClick={onReset} className="btn-ghost text-xs" type="button">
              <RotateCcw className="w-3.5 h-3.5" />
              ברירת מחדל
            </button>
            <button onClick={onClose} className="btn-accent text-xs" type="button">
              סיים
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
