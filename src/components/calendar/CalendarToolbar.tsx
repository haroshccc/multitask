import { ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  addDays,
  addMonths,
  formatDayLong,
  formatMonthYear,
  formatWeekRange,
} from "./calendar-utils";
import { HourRangeSettings } from "./HourRangeSettings";

export type CalendarView = "day" | "week" | "month" | "agenda";

interface CalendarToolbarProps {
  view: CalendarView;
  onViewChange: (v: CalendarView) => void;
  anchor: Date;
  onAnchorChange: (d: Date) => void;
  /** Hide views that don't make sense right now (e.g. hide week on mobile). */
  availableViews?: CalendarView[];
  /** If true, render the hour-range settings gear (only useful for day/week). */
  showHourSettings?: boolean;
}

const LABELS: Record<CalendarView, string> = {
  day: "יום",
  week: "שבוע",
  month: "חודש",
  agenda: "אג׳נדה",
};

export function CalendarToolbar({
  view,
  onViewChange,
  anchor,
  onAnchorChange,
  availableViews = ["day", "week", "month", "agenda"],
  showHourSettings = true,
}: CalendarToolbarProps) {
  const step = (direction: 1 | -1) => {
    if (view === "day") onAnchorChange(addDays(anchor, direction));
    else if (view === "week" || view === "agenda")
      onAnchorChange(addDays(anchor, direction * 7));
    else onAnchorChange(addMonths(anchor, direction));
  };

  const label =
    view === "day"
      ? formatDayLong(anchor)
      : view === "week" || view === "agenda"
      ? formatWeekRange(anchor)
      : formatMonthYear(anchor);

  return (
    <div className="card p-2 flex items-center gap-2 flex-wrap">
      {/* View toggle */}
      <div className="inline-flex rounded-md border border-ink-200 p-0.5 bg-ink-50 text-xs">
        {availableViews.map((v) => (
          <button
            key={v}
            onClick={() => onViewChange(v)}
            className={cn(
              "px-3 py-1.5 rounded-sm font-medium transition-colors",
              view === v
                ? "bg-white text-ink-900 shadow-soft"
                : "text-ink-600 hover:text-ink-900"
            )}
            type="button"
          >
            {LABELS[v]}
          </button>
        ))}
      </div>

      {/* Date navigation. In RTL, ChevronRight points toward the past. */}
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

      <span className="text-sm font-semibold text-ink-900 mx-2 truncate flex-1">
        {label}
      </span>

      {showHourSettings && (view === "day" || view === "week") && (
        <HourRangeSettings />
      )}
    </div>
  );
}
