import { useMemo, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import type { TaskDependency } from "@/lib/types/domain";
import {
  DAY_MS,
  type GanttRow,
  type GanttZoom,
  buildTicks,
  pxPerDay as pxPerDayFn,
} from "./gantt-utils";
import { GanttBar } from "./GanttBar";
import { GanttDependencyArrows } from "./GanttDependencyArrows";

const ROW_HEIGHT = 40;
const LEFT_COL_WIDTH = 280;

interface GanttGridProps {
  rows: GanttRow[];
  deps: TaskDependency[];
  zoom: GanttZoom;
  windowStart: Date;
  windowEnd: Date;
  criticalSet: Set<string>;
  onRowClick: (row: GanttRow) => void;
  onBarChange: (
    row: GanttRow,
    patch: { scheduled_at: string; duration_minutes: number }
  ) => void;
  /** Caller controls whether the task-name sidebar shows (collapsed mode
   *  gives the timeline full width). */
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export function GanttGrid({
  rows,
  deps,
  zoom,
  windowStart,
  windowEnd,
  criticalSet,
  onRowClick,
  onBarChange,
  sidebarCollapsed,
  onToggleSidebar,
}: GanttGridProps) {
  const pxPerDay = pxPerDayFn(zoom);
  const totalDays = Math.max(
    1,
    Math.ceil((windowEnd.getTime() - windowStart.getTime()) / DAY_MS)
  );
  const timelineWidth = totalDays * pxPerDay;
  const timelineHeight = rows.length * ROW_HEIGHT;

  const tickGroups = useMemo(
    () => buildTicks(windowStart, windowEnd, zoom),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zoom, windowStart.getTime(), windowEnd.getTime()]
  );

  const scrollRef = useRef<HTMLDivElement>(null);

  const isRtl =
    typeof document !== "undefined" && document.documentElement.dir === "rtl";

  const nowLeft = (() => {
    const now = Date.now();
    if (now < windowStart.getTime() || now > windowEnd.getTime()) return null;
    const days = (now - windowStart.getTime()) / DAY_MS;
    return days * pxPerDay;
  })();

  if (rows.length === 0) {
    return (
      <div className="card p-12 text-center text-ink-500">
        <p className="text-base">אין משימות מתוזמנות להצגה.</p>
        <p className="text-xs mt-2">
          הוסף לתאריך עם <code className="text-primary-700">scheduled_at</code> או{" "}
          <code className="text-primary-700">estimated_hours</code> ממסך המשימות.
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex" style={{ minHeight: timelineHeight + 64 }}>
        {/* Left column: task rows — can be collapsed to a thin strip */}
        {sidebarCollapsed ? (
          <button
            onClick={onToggleSidebar}
            className="shrink-0 border-e border-ink-200 bg-ink-50/60 hover:bg-ink-100 w-6 flex items-center justify-center text-ink-500"
            title="הצג שמות משימות"
            type="button"
          >
            <span className="rotate-180" style={{ writingMode: "vertical-rl" }}>
              ☰
            </span>
          </button>
        ) : (
        <div
          className="shrink-0 border-e border-ink-200 bg-white"
          style={{ width: LEFT_COL_WIDTH }}
        >
          {/* Spacer for the 2-row header */}
          <div className="h-16 border-b border-ink-200 bg-ink-50/60 flex items-end justify-between px-3 py-2">
            <span className="eyebrow">משימה</span>
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="p-1 rounded-md hover:bg-ink-100 text-ink-500"
                title="מזער את עמודת המשימות"
                type="button"
              >
                ⟨
              </button>
            )}
          </div>
          {rows.map((r, i) => {
            const isCritical =
              r.kind === "task" && !!r.task && criticalSet.has(r.task.id);
            const isPhase = !!r.isPhase;
            return (
            <button
              key={r.id}
              onClick={() => onRowClick(r)}
              className={cn(
                "w-full h-10 flex items-center gap-2 px-2 text-start text-[13px] border-b border-ink-150 hover:bg-ink-50",
                r.completed && "opacity-60",
                isCritical && "bg-danger-500/5",
                isPhase && "font-bold bg-ink-50/60"
              )}
              style={{
                paddingInlineStart: 8 + r.depth * 16,
                ...(isPhase
                  ? ({ borderInlineStartWidth: 4, borderInlineStartColor: r.accentColor ?? "#6b6b80" } as React.CSSProperties)
                  : {}),
              }}
              type="button"
              title={r.title}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  isCritical
                    ? "bg-danger-500"
                    : r.kind === "event"
                    ? "bg-primary-500"
                    : "bg-ink-300"
                )}
              />
              <span className="truncate flex-1 min-w-0">
                {r.completed ? "✓ " : ""}
                {r.kind === "event" && (
                  <span className="text-[10px] text-primary-600 me-1">●</span>
                )}
                {r.title}
              </span>
              <span className="text-[10px] text-ink-400 shrink-0 tabular-nums">
                {r.start.toLocaleDateString("he-IL", { month: "numeric", day: "numeric" })}
              </span>
              {i === rows.length - 1 ? null : null}
            </button>
            );
          })}
        </div>
        )}

        {/* Timeline scrollable area */}
        <div className="flex-1 overflow-x-auto scrollbar-thin" ref={scrollRef}>
          <div className="relative" style={{ width: timelineWidth }}>
            {/* Header — 2 rows: group labels (top), sub-ticks (bottom). */}
            <div className="sticky top-0 z-10 bg-ink-50/95 backdrop-blur-sm border-b border-ink-200">
              <div className="flex h-8 relative">
                {tickGroups.map((g) => {
                  const left =
                    ((g.start.getTime() - windowStart.getTime()) / DAY_MS) *
                    pxPerDay;
                  const width =
                    ((g.end.getTime() - g.start.getTime()) / DAY_MS) * pxPerDay;
                  return (
                    <div
                      key={g.start.toISOString()}
                      className="absolute top-0 bottom-0 border-e border-ink-200 flex items-center justify-center text-[11px] font-semibold text-ink-700"
                      style={{ insetInlineStart: left, width }}
                    >
                      <span className="truncate px-2">{g.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex h-8 relative border-t border-ink-150">
                {tickGroups.flatMap((g) =>
                  g.subTicks.map((st, i) => {
                    const nextTick = g.subTicks[i + 1];
                    const end = nextTick ? nextTick.date : g.end;
                    const left =
                      ((st.date.getTime() - windowStart.getTime()) / DAY_MS) *
                      pxPerDay;
                    const width =
                      ((end.getTime() - st.date.getTime()) / DAY_MS) * pxPerDay;
                    return (
                      <div
                        key={g.start.toISOString() + "-" + i}
                        className="absolute top-0 bottom-0 border-e border-ink-150 flex items-center justify-center text-[10px] text-ink-500"
                        style={{ insetInlineStart: left, width }}
                      >
                        <span className="truncate px-1">{st.label}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Body: grid background + bars + arrows */}
            <div
              className="relative"
              style={{ height: timelineHeight, width: timelineWidth }}
            >
              {/* Vertical tick lines */}
              {tickGroups.flatMap((g) =>
                g.subTicks.map((st) => {
                  const left =
                    ((st.date.getTime() - windowStart.getTime()) / DAY_MS) *
                    pxPerDay;
                  return (
                    <div
                      key={"v-" + g.start.toISOString() + "-" + st.date.toISOString()}
                      className="absolute top-0 bottom-0 border-e border-ink-150/70 pointer-events-none"
                      style={{ insetInlineStart: left }}
                    />
                  );
                })
              )}
              {/* Horizontal row lines */}
              {rows.map((r, i) => {
                const isCritical =
                  r.kind === "task" && !!r.task && criticalSet.has(r.task.id);
                return (
                  <div
                    key={r.id + "-row-line"}
                    className={cn(
                      "absolute inset-x-0 border-b border-ink-150",
                      isCritical && "bg-danger-500/5"
                    )}
                    style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
                  />
                );
              })}

              {/* Now line */}
              {nowLeft !== null && (
                <div
                  className="absolute top-0 bottom-0 pointer-events-none z-10"
                  style={{ insetInlineStart: nowLeft }}
                >
                  <div className="w-0.5 h-full bg-danger-500/80" />
                </div>
              )}

              {/* Bars */}
              {rows.map((r, i) => {
                const isCritical =
                  r.kind === "task" && !!r.task && criticalSet.has(r.task.id);
                return (
                  <div
                    key={r.id + "-bar"}
                    className="absolute inset-x-0"
                    style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
                  >
                    <GanttBar
                      row={r}
                      pxPerDay={pxPerDay}
                      origin={windowStart}
                      isCritical={isCritical}
                      onClick={() => onRowClick(r)}
                      onChange={(patch) => onBarChange(r, patch)}
                    />
                  </div>
                );
              })}

              {/* Dependency arrows */}
              <GanttDependencyArrows
                rows={rows}
                deps={deps}
                pxPerDay={pxPerDay}
                origin={windowStart}
                rowHeight={ROW_HEIGHT}
                totalWidth={timelineWidth}
                totalHeight={timelineHeight}
                criticalSet={criticalSet}
                isRtl={isRtl}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
