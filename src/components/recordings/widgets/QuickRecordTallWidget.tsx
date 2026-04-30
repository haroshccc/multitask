import { Mic } from "lucide-react";
import { useRecordingsPageCtx } from "./context";

/**
 * Narrow tall column. At lg the widget is only ≈100px wide, so the layout
 * is icon-first with a tiny label. Content is vertically distributed so
 * the button sits at the bottom regardless of widget height.
 */
export function QuickRecordTallWidget() {
  const ctx = useRecordingsPageCtx();
  return (
    <button
      type="button"
      onClick={ctx.onStartRecording}
      className={[
        "card h-full w-full p-2 transition-all",
        "flex flex-col items-center justify-between gap-2",
        "hover:-translate-y-0.5 hover:shadow-lift",
        "border-primary-200 hover:border-primary-400",
        "bg-gradient-to-b from-primary-50 to-white",
      ].join(" ")}
      title="הקלטה מהירה — ישירות מהמערכת"
    >
      <div className="flex flex-col items-center gap-1.5 text-center">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center shadow-accent">
          <Mic className="w-4 h-4" />
        </div>
        <p className="text-[11px] font-semibold text-ink-900 leading-tight">
          הקלטה
          <br />
          מהירה
        </p>
      </div>

      <span className="btn-primary !py-1.5 !px-2 !text-[11px] pointer-events-none w-full justify-center">
        <Mic className="w-3.5 h-3.5" />
        הקליטי
      </span>
    </button>
  );
}
