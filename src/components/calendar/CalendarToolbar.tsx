import { ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  addDays,
  addMonths,
  formatDayLong,
  formatMonthYear,
  formatWeekRange,
} from "./calendar-utils";

export type CalendarView = "day" | "week" | "month";

interface CalendarToolbarProps {
  view: CalendarView;
  onViewChange: (v: CalendarView) => void;
  anchor: Date;
  onAnchorChange: (d: Date) => void;
}

export function CalendarToolbar({
  view,
  onViewChange,
  anchor,
  onAnchorChange,
}: CalendarToolbarProps) {
  const step = (direction: 1 | -1) => {
    if (view === "day") onAnchorChange(addDays(anchor, direction));
    else if (view === "week") onAnchorChange(addDays(anchor, direction * 7));
    else onAnchorChange(addMonths(anchor, direction));
  };

  const label =
    view === "day"
      ? formatDayLong(anchor)
      : view === "week"
      ? formatWeekRange(anchor)
      : formatMonthYear(anchor);

  return (
    <div className="card p-2 flex items-center gap-2 flex-wrap">
      {/* View toggle */}
      <div className="inline-flex rounded-md border border-ink-200 p-0.5 bg-ink-50 text-xs">
        {(["day", "week", "month"] as CalendarView[]).map((v) => (
          <button
            key={v}
            onClick={() => onViewChange(v)}
            className={cn(
              "px-3 py-1.5 rounded-sm font-medium transition-colors",
              view === v
                ? "bg-white text-ink-900 shadow-soft"
                : "text-ink-600 hover:text-ink-900"
            )}
          >
            {v === "day" ? "יום" : v === "week" ? "שבוע" : "חודש"}
          </button>
        ))}
      </div>

      {/* Date navigation. In RTL, "previous" sits on the right edge intuitively,
          so we use logical-direction icons that flip with dir="rtl". */}
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

      <span className="text-sm font-semibold text-ink-900 ms-auto">{label}</span>
    </div>
  );
}
