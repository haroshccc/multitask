import { useEffect, useState } from "react";
import { Mic } from "lucide-react";
import { useRecordingsPageCtx } from "./context";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 640,
  );
  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return isMobile;
}

/**
 * Compact horizontal "Quick record" banner — fits in the recordings page's
 * single-row top strip (h=1). Layout reads RTL: orange mic chip on the
 * right, label in the middle, "הקליטי" pill on the left. Whole card is
 * one button so the entire surface is the click target.
 *
 * On mobile renders as a tiny icon+label button to share a row with upload.
 */
export function QuickRecordTallWidget() {
  const ctx = useRecordingsPageCtx();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <button
        type="button"
        onClick={ctx.onStartRecording}
        className="card h-full w-full flex items-center justify-center gap-2 border-primary-200 hover:border-primary-400 bg-gradient-to-l from-primary-50 to-white"
      >
        <span className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 text-white flex items-center justify-center">
          <Mic className="w-3.5 h-3.5" />
        </span>
        <span className="text-sm font-semibold text-ink-900">הקלטה</span>
      </button>
    );
  }

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
