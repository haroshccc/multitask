import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import {
  useTasksByProject,
  useTimeEntriesByRange,
} from "@/lib/hooks";
import type { TimeEntry } from "@/lib/types/domain";

const DAY_LABELS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];

/**
 * Compact 7-day stripe — for the last week, shows hours-per-day worked on
 * tasks belonging to this project. Bars scale to the busiest day in view so
 * patterns surface even on light weeks. The full hourly grid view (planned
 * vs. actual stripes per day/week/month) lands in a follow-up PR.
 */
export function CalendarBlock({ scopeId }: { scopeId?: string | null }) {
  const projectId = scopeId ?? null;

  const range = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 6);
    from.setHours(0, 0, 0, 0);
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      fromDate: from,
    };
  }, []);

  const { data: tasks = [] } = useTasksByProject(projectId);
  const { data: entries = [], isLoading } = useTimeEntriesByRange({
    from: range.from,
    to: range.to,
  });

  const projectTaskIds = useMemo(
    () => new Set(tasks.map((t) => t.id)),
    [tasks]
  );

  const days = useMemo(() => {
    const out: { date: Date; hours: number; entries: TimeEntry[] }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(range.fromDate);
      d.setDate(d.getDate() + i);
      out.push({ date: d, hours: 0, entries: [] });
    }
    for (const e of entries) {
      if (!projectTaskIds.has(e.task_id ?? "")) continue;
      const start = new Date(e.started_at);
      const end = e.ended_at ? new Date(e.ended_at) : new Date();
      const idx = Math.floor(
        (start.getTime() - range.fromDate.getTime()) / 86_400_000
      );
      if (idx < 0 || idx > 6) continue;
      const seconds = Math.max(0, (end.getTime() - start.getTime()) / 1000);
      out[idx].hours += seconds / 3600;
      out[idx].entries.push(e);
    }
    return out;
  }, [entries, projectTaskIds, range]);

  const maxHours = Math.max(0.5, ...days.map((d) => d.hours));
  const todayIdx = days.findIndex(
    (d) => d.date.toDateString() === new Date().toDateString()
  );

  if (!projectId || isLoading) {
    return (
      <div className="text-xs text-ink-500 text-center py-6">
        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2 shrink-0">
        <span className="text-xs font-medium text-ink-700">7 ימים אחרונים</span>
        <span className="text-[10px] text-ink-400">
          סה״כ {days.reduce((s, d) => s + d.hours, 0).toFixed(1)} ש
        </span>
      </div>

      <div className="flex items-end gap-1.5 flex-1 min-h-0">
        {days.map((d, i) => {
          const heightPct = maxHours > 0 ? (d.hours / maxHours) * 100 : 0;
          const isToday = i === todayIdx;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-1 min-w-0"
            >
              <div
                className="flex-1 w-full flex items-end"
                title={`${d.hours.toFixed(1)} ש`}
              >
                <div
                  className={
                    "w-full rounded-t-sm transition-all duration-300 " +
                    (d.hours > 0
                      ? isToday
                        ? "bg-primary-500"
                        : "bg-primary-300"
                      : "bg-ink-100")
                  }
                  style={{
                    height: d.hours > 0 ? `${Math.max(8, heightPct)}%` : "4px",
                  }}
                />
              </div>
              <div
                className={
                  "text-[10px] text-center " +
                  (isToday
                    ? "text-primary-700 font-semibold"
                    : "text-ink-500")
                }
              >
                <div>{DAY_LABELS[d.date.getDay()]}</div>
                <div className="text-[9px] tabular-nums">
                  {d.date.getDate()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
