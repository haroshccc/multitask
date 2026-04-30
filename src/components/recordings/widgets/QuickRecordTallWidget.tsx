import { Mic } from "lucide-react";
import { useRecordingsPageCtx } from "./context";

/**
 * Compact horizontal "Quick record" banner — fits in the recordings page's
 * single-row top strip (h=1). Layout reads RTL: orange mic chip on the
 * right, label in the middle, "הקליטי" pill on the left. Whole card is
 * one button so the entire surface is the click target.
 */
export function QuickRecordTallWidget() {
  const ctx = useRecordingsPageCtx();
  return (
    <button
      type="button"
      onClick={ctx.onStartRecording}
      className={[
        "card h-full w-full px-3",
        "flex items-center gap-3",
        "transition-all hover:-translate-y-0.5 hover:shadow-lift",
        "border-primary-200 hover:border-primary-400",
        "bg-gradient-to-l from-primary-50 to-white",
      ].join(" ")}
    >
      <span className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center shadow-accent">
        <Mic className="w-4 h-4" />
      </span>
      <span className="flex-1 min-w-0 text-start">
        <span className="block text-sm font-semibold text-ink-900 truncate">
          הקלטה מהירה
        </span>
        <span className="block text-[11px] text-ink-500 truncate">
          ישירות מהמערכת
        </span>
      </span>
      <span className="btn-primary !py-1.5 !px-3 pointer-events-none shrink-0 text-xs">
        <Mic className="w-3.5 h-3.5" />
        הקליטי
      </span>
    </button>
  );
}
