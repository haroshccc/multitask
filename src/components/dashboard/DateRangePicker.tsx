import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { DashboardRange, DashboardView } from "@/lib/hooks/useDateRange";

const VIEWS: { value: DashboardView; label: string }[] = [
  { value: "day", label: "יום" },
  { value: "week", label: "שבוע" },
  { value: "month", label: "חודש" },
];

/**
 * Top bar of the dashboard: view toggle (יום/שבוע/חודש) + previous/next arrows
 * + "today" button + the formatted period label.
 *
 * RTL note: arrow direction is *visually* reversed for Hebrew users — the
 * left-pointing chevron steps forward in time (= future is to the left).
 */
export function DateRangePicker({ range }: { range: DashboardRange }) {
  return (
    <div className="card !p-2 flex flex-wrap items-center gap-2">
      {/* View toggle */}
      <div className="inline-flex items-center rounded-lg bg-ink-100 p-0.5">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => range.setView(v.value)}
            aria-pressed={range.view === v.value}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-md transition-colors",
              range.view === v.value
                ? "bg-white text-ink-900 shadow-sm"
                : "text-ink-600 hover:text-ink-900",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Period label + arrows. The chevrons read RTL: ▷ visually-left = next. */}
      <div className="inline-flex items-center gap-1 ms-auto">
        <button
          type="button"
          onClick={() => range.step(-1)}
          aria-label="הקודם"
          className="p-1.5 rounded-md hover:bg-ink-100 text-ink-600"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <span className="px-2 text-sm font-medium text-ink-900 min-w-0 truncate">
          {range.label}
        </span>

        <button
          type="button"
          onClick={() => range.step(1)}
          aria-label="הבא"
          className="p-1.5 rounded-md hover:bg-ink-100 text-ink-600"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {!range.isCurrent && (
          <button
            type="button"
            onClick={range.resetToToday}
            className="ms-1 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-ink-100 hover:bg-ink-200 text-xs text-ink-700"
            title="חזרה להיום"
          >
            <RotateCcw className="w-3 h-3" />
            היום
          </button>
        )}
      </div>
    </div>
  );
}
