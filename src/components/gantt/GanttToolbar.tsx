import { ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { addDays, type GanttZoom } from "./gantt-utils";

interface GanttToolbarProps {
  zoom: GanttZoom;
  onZoomChange: (z: GanttZoom) => void;
  anchor: Date;
  onAnchorChange: (d: Date) => void;
  showCriticalOnly: boolean;
  onShowCriticalOnlyChange: (b: boolean) => void;
}

const ZOOM_LABELS: Record<GanttZoom, string> = {
  day: "יום",
  week: "שבוע",
  month: "חודש",
  quarter: "רבעון",
};

export function GanttToolbar({
  zoom,
  onZoomChange,
  anchor,
  onAnchorChange,
  showCriticalOnly,
  onShowCriticalOnlyChange,
}: GanttToolbarProps) {
  const step = (n: 1 | -1) => {
    const days = zoom === "day" ? 7 : zoom === "week" ? 28 : zoom === "month" ? 90 : 180;
    onAnchorChange(addDays(anchor, n * days));
  };

  return (
    <div className="card p-2 flex items-center gap-2 flex-wrap">
      {/* Zoom toggle */}
      <div className="inline-flex rounded-md border border-ink-200 p-0.5 bg-ink-50 text-xs">
        {(["day", "week", "month", "quarter"] as GanttZoom[]).map((z) => (
          <button
            key={z}
            onClick={() => onZoomChange(z)}
            className={cn(
              "px-3 py-1.5 rounded-sm font-medium transition-colors",
              zoom === z
                ? "bg-white text-ink-900 shadow-soft"
                : "text-ink-600 hover:text-ink-900"
            )}
            type="button"
          >
            {ZOOM_LABELS[z]}
          </button>
        ))}
      </div>

      {/* Date nav */}
      <div className="inline-flex items-center gap-1">
        <button
          onClick={() => step(-1)}
          className="p-1.5 rounded-md hover:bg-ink-100 text-ink-700"
          aria-label="הקודם"
          type="button"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <button
          onClick={() => onAnchorChange(new Date())}
          className="btn-ghost text-xs py-1 px-2"
          type="button"
        >
          היום
        </button>
        <button
          onClick={() => step(1)}
          className="p-1.5 rounded-md hover:bg-ink-100 text-ink-700"
          aria-label="הבא"
          type="button"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      <label className="ms-auto inline-flex items-center gap-1.5 text-xs text-ink-700 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={showCriticalOnly}
          onChange={(e) => onShowCriticalOnlyChange(e.target.checked)}
          className="w-3.5 h-3.5"
        />
        Critical path בלבד
      </label>
    </div>
  );
}
