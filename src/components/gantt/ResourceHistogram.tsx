import { useMemo, useRef, useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import { DAY_MS, type GanttRow, type GanttZoom, pxPerDay as pxPerDayFn, buildTicks } from "./gantt-utils";

interface ResourceHistogramProps {
  rows: GanttRow[];
  zoom: GanttZoom;
  windowStart: Date;
  windowEnd: Date;
  /** map of userId → display name */
  memberNames: Map<string, string>;
  /** Optional external scroll sync: pass the ref of the Gantt grid timeline scroll container */
  syncScrollRef?: React.RefObject<HTMLDivElement | null>;
}

const ROW_HEIGHT = 48;
const MAX_HOURS_DAY = 8;
const RESOURCE_COL_WIDTH = 120;

const COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
  "#ef4444", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
];

export function ResourceHistogram({
  rows,
  zoom,
  windowStart,
  windowEnd,
  memberNames,
  syncScrollRef,
}: ResourceHistogramProps) {
  const pxPerDay = pxPerDayFn(zoom);
  const totalDays = Math.max(1, Math.ceil((windowEnd.getTime() - windowStart.getTime()) / DAY_MS));
  const timelineWidth = totalDays * pxPerDay;

  const scrollRef = useRef<HTMLDivElement>(null);

  // Sync scroll with the main Gantt grid
  useEffect(() => {
    const el = scrollRef.current;
    const src = syncScrollRef?.current;
    if (!el || !src) return;
    const onSrcScroll = () => { el.scrollLeft = src.scrollLeft; };
    const onElScroll = () => { src.scrollLeft = el.scrollLeft; };
    src.addEventListener("scroll", onSrcScroll, { passive: true });
    el.addEventListener("scroll", onElScroll, { passive: true });
    return () => {
      src.removeEventListener("scroll", onSrcScroll);
      el.removeEventListener("scroll", onElScroll);
    };
  }, [syncScrollRef]);

  // Build per-user per-day workload (hours)
  const { userIds, loadMap } = useMemo(() => {
    const userSet = new Set<string>();
    // loadMap: userId → Map<dayIndex, totalMinutes>
    const lm = new Map<string, Map<number, number>>();

    for (const r of rows) {
      if (r.kind !== "task" || !r.task || r.unscheduled) continue;
      const assignee = r.task.assignee_user_id;
      if (!assignee) continue;
      userSet.add(assignee);
      if (!lm.has(assignee)) lm.set(assignee, new Map());
      const userMap = lm.get(assignee)!;

      const taskStart = r.start.getTime();
      const taskEnd = r.end.getTime();
      // Distribute duration evenly across overlapping days in window
      const durationMs = taskEnd - taskStart;
      if (durationMs <= 0) continue;
      const durationMinutes = r.task.duration_minutes ?? Math.round(durationMs / 60_000);

      // Find which days this task spans
      const dayStart = Math.floor((taskStart - windowStart.getTime()) / DAY_MS);
      const dayEnd = Math.ceil((taskEnd - windowStart.getTime()) / DAY_MS);
      const spanDays = Math.max(1, dayEnd - dayStart);
      const minsPerDay = durationMinutes / spanDays;

      for (let d = dayStart; d < dayEnd; d++) {
        if (d < 0 || d >= totalDays) continue;
        userMap.set(d, (userMap.get(d) ?? 0) + minsPerDay);
      }
    }

    return { userIds: [...userSet], loadMap: lm };
  }, [rows, windowStart, totalDays]);

  const tickGroups = useMemo(
    () => buildTicks(windowStart, windowEnd, zoom),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zoom, windowStart.getTime(), windowEnd.getTime()]
  );

  if (userIds.length === 0) {
    return (
      <div className="card px-4 py-3 text-xs text-ink-400 text-center">
        אין משימות עם אחראי מוגדר בטווח זה.
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex">
        {/* Resource name column */}
        <div className="shrink-0 border-e border-ink-200" style={{ width: RESOURCE_COL_WIDTH }}>
          <div className="h-8 border-b border-ink-200 bg-ink-50/60 flex items-center px-3">
            <span className="eyebrow text-[10px]">משאב</span>
          </div>
          {userIds.map((uid) => (
            <div
              key={uid}
              className="flex items-center px-3 border-b border-ink-150 text-xs text-ink-700 truncate"
              style={{ height: ROW_HEIGHT }}
            >
              {memberNames.get(uid) ?? uid.slice(0, 8)}
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-x-auto scrollbar-thin" ref={scrollRef}>
          <div className="relative" style={{ width: timelineWidth }}>
            {/* Header ticks */}
            <div className="sticky top-0 z-10 bg-ink-50/95 backdrop-blur-sm border-b border-ink-200 flex h-8 relative">
              {tickGroups.flatMap((g) =>
                g.subTicks.map((st, i) => {
                  const nextTick = g.subTicks[i + 1];
                  const end = nextTick ? nextTick.date : g.end;
                  const left = ((st.date.getTime() - windowStart.getTime()) / DAY_MS) * pxPerDay;
                  const width = ((end.getTime() - st.date.getTime()) / DAY_MS) * pxPerDay;
                  return (
                    <div
                      key={g.start.toISOString() + "-" + i}
                      className="absolute top-0 bottom-0 border-e border-ink-150 flex items-center justify-center text-[9px] text-ink-400"
                      style={{ insetInlineStart: left, width }}
                    >
                      <span className="truncate px-1">{st.label}</span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bars */}
            {userIds.map((uid, userIdx) => {
              const userMap = loadMap.get(uid) ?? new Map();
              const color = COLORS[userIdx % COLORS.length]!;
              return (
                <div
                  key={uid}
                  className="relative border-b border-ink-150"
                  style={{ height: ROW_HEIGHT, width: timelineWidth }}
                >
                  {/* Max-load guideline */}
                  <div
                    className="absolute inset-x-0 border-t border-dashed border-ink-200 pointer-events-none"
                    style={{ top: ROW_HEIGHT * (1 - MAX_HOURS_DAY / MAX_HOURS_DAY) }}
                  />
                  {Array.from(userMap.entries()).map(([dayIdx, mins]) => {
                    const hours = mins / 60;
                    const heightPct = Math.min(1, hours / MAX_HOURS_DAY);
                    const barH = Math.max(2, Math.round(heightPct * (ROW_HEIGHT - 6)));
                    const left = dayIdx * pxPerDay;
                    const isOverloaded = hours > MAX_HOURS_DAY;
                    return (
                      <div
                        key={dayIdx}
                        className={cn(
                          "absolute bottom-1 rounded-sm",
                          isOverloaded && "ring-1 ring-red-500"
                        )}
                        style={{
                          insetInlineStart: left + 1,
                          width: Math.max(2, pxPerDay - 2),
                          height: barH,
                          backgroundColor: isOverloaded ? "#ef4444" : color,
                          opacity: 0.8,
                        }}
                        title={`${memberNames.get(uid) ?? uid}: ${hours.toFixed(1)} שעות`}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
