import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { DashboardRangeContext } from "../dashboard-context";
import { RangeKpis } from "../widgets/RangeKpis";
import { BriefBanner } from "../widgets/BriefBanner";
import { GoalsWeekReview } from "./GoalsWeekReview";
import { CompletedByDay } from "./CompletedByDay";
import { startOfWeek, staticWeekRange } from "./static-range";

// =============================================================================
// "סקירה" — the dashboard's retrospective mode. Looks back at a selected
// week (defaults to the current one): KPI comparison vs the previous week,
// per-goal hit/miss, completions day-by-day, and the weekly AI brief.
// =============================================================================

export function ReviewMode() {
  const [anchor, setAnchor] = useState<Date>(() => new Date());

  const ctx = useMemo(() => {
    const base = staticWeekRange(anchor);
    return {
      ...base,
      step: (dir: -1 | 1) =>
        setAnchor((a) => {
          const next = new Date(a);
          next.setDate(next.getDate() + dir * 7);
          return next;
        }),
      resetToToday: () => setAnchor(new Date()),
    };
  }, [anchor]);

  const weekFrom = useMemo(() => startOfWeek(anchor), [anchor]);
  const weekTo = useMemo(() => {
    const d = new Date(weekFrom);
    d.setDate(d.getDate() + 7);
    return d;
  }, [weekFrom]);

  return (
    <DashboardRangeContext.Provider value={ctx}>
      <div className="space-y-4">
        {/* Week picker — RTL: the visually-left chevron steps forward. */}
        <div className="card !p-2 flex items-center gap-1">
          <span className="px-2 text-sm font-bold text-ink-900">
            {ctx.isCurrent ? "השבוע" : "שבוע"}
          </span>
          <span className="text-sm text-ink-600 tabular-nums" dir="ltr">
            {ctx.label}
          </span>
          <span className="ms-auto inline-flex items-center gap-0.5">
            {!ctx.isCurrent && (
              <button
                type="button"
                onClick={ctx.resetToToday}
                className="me-1 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-ink-100 hover:bg-ink-200 text-xs text-ink-700"
                title="חזרה לשבוע הנוכחי"
              >
                <RotateCcw className="w-3 h-3" aria-hidden="true" />
                השבוע
              </button>
            )}
            <button
              type="button"
              onClick={() => ctx.step(-1)}
              aria-label="שבוע קודם"
              className="p-1.5 rounded-md hover:bg-ink-100 text-ink-600"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => ctx.step(1)}
              aria-label="שבוע הבא"
              className="p-1.5 rounded-md hover:bg-ink-100 text-ink-600"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </span>
        </div>

        {/* KPI tiles — RangeKpis already compares against the previous week. */}
        <RangeKpis />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <GoalsWeekReview weekFrom={weekFrom} weekTo={weekTo} />
          <CompletedByDay weekFrom={weekFrom} weekTo={weekTo} />
        </div>

        {/* Weekly AI brief — the retrospective is where it shines. */}
        <BriefBanner />
      </div>
    </DashboardRangeContext.Provider>
  );
}
