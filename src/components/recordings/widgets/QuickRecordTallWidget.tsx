import { Mic } from "lucide-react";
import { useRecordingsPageCtx } from "./context";

/**
 * Full quick-record card. Shown at w=3 in the recordings layout.
 * Matches the reference screenshot: orange mic circle, title +
 * description, full-width gradient "הקליטי" button.
 */
export function QuickRecordTallWidget() {
  const ctx = useRecordingsPageCtx();
  return (
    <button
      type="button"
      onClick={ctx.onStartRecording}
      className={[
        "card h-full w-full p-4 transition-all",
        "flex flex-col items-center justify-between gap-3 text-center",
        "hover:-translate-y-0.5 hover:shadow-lift",
        "border-primary-200 hover:border-primary-400",
        "bg-gradient-to-b from-primary-50 to-white",
      ].join(" ")}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center shadow-accent">
          <Mic className="w-5 h-5" />
        </div>
        <p className="text-sm font-semibold text-ink-900">הקלטה מהירה</p>
        <p className="text-[11px] text-ink-500 leading-snug px-1">
          ישירות מהמערכת — השהי, המשיכי, סיימי, שמרי.
        </p>
      </div>

      <span className="btn-primary !py-2 !px-3 pointer-events-none w-full justify-center text-xs">
        <Mic className="w-4 h-4" />
        הקליטי
      </span>
    </button>
  );
}
