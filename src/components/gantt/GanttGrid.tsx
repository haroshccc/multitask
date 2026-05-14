import { useEffect, useMemo, useRef } from "react";
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
  /** Click on empty timeline space → open the create picker pinned to
   *  the date under the click. The y-axis is rows so we don't bother
   *  with hour-level resolution; defaults to 09:00. */
  onCreateAt?: (start: Date) => void;
  /** Caller controls whether the task-name sidebar shows (collapsed mode
   *  gives the timeline full width). */
  sidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  /** When true, the internal sidebar is suppressed entirely — the parent
   *  is rendering an external `GanttTable` instead and only wants the
   *  timeline. */
  hideInternalSidebar?: boolean;
  /** Click on an unscheduled task's row in the timeline → schedule it at
   *  the clicked date (defaults to 09:00 on that day). */
  onScheduleTask?: (row: GanttRow, date: Date) => void;
  /** Baseline task map: taskId → { scheduled_at, duration_minutes }. When
   *  provided, a thin grey bar is drawn below each task's current bar to
   *  indicate the original planned schedule. */
  baselineMap?: Map<string, { scheduled_at: string | null; duration_minutes: number | null }>;
  /** Continuous zoom multiplier from the chrome's slider — multiplies the
   *  base pxPerDay so columns can be stretched/compressed without flipping
   *  zoom tiers. */
  zoomScale?: number;
  /** Called when user picks a new accent color for a phase from its hover card. */
  onPhaseColorChange?: (taskId: string, color: string) => void;
  /** Collapsed parent task ids — drives the chevron state in the sidebar. */
  collapsedIds?: Set<string>;
  /** Toggle a parent row's collapsed state. */
  onToggleCollapsed?: (taskId: string) => void;
  /** Register a scrollable element into the page-level vertical scroll-sync
   *  group so the grid stays row-aligned with the task table. Returns an
   *  unregister cleanup. */
  registerScroll?: (el: HTMLElement) => () => void;
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
  onCreateAt,
  sidebarCollapsed,
  onToggleSidebar,
  hideInternalSidebar,
  onScheduleTask,
  baselineMap,
  zoomScale = 1,
  onPhaseColorChange,
  collapsedIds,
  onToggleCollapsed,
  registerScroll,
}: GanttGridProps) {
  const pxPerDay = pxPerDayFn(zoom, zoomScale);
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

  // Flattened sub-ticks across all groups. Each sub-tick's rendered width
  // runs to the *next* sub-tick (regardless of group), so weeks that span a
  // month boundary aren't truncated at the boundary — which previously left
  // gaps / made adjacent week labels collide.
  const allSubTicks = useMemo(
    () => tickGroups.flatMap((g) => g.subTicks),
    [tickGroups]
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const sidebarScrollRef = useRef<HTMLDivElement>(null);

  // Vertical scroll-sync. When the page-level `registerScroll` group is
  // provided, both the sidebar and the timeline join it (so they stay
  // aligned with each other AND with the external task table). Without it,
  // we still sync the sidebar ↔ timeline pair internally.
  useEffect(() => {
    const sidebar = sidebarScrollRef.current;
    const timeline = scrollRef.current;
    const cleanups: Array<() => void> = [];
    if (registerScroll) {
      if (timeline) cleanups.push(registerScroll(timeline));
      if (sidebar) cleanups.push(registerScroll(sidebar));
    } else if (sidebar && timeline) {
      let lock = false;
      const mk = (from: HTMLElement, to: HTMLElement) => () => {
        if (lock) return;
        lock = true;
        if (to.scrollTop !== from.scrollTop) to.scrollTop = from.scrollTop;
        requestAnimationFrame(() => {
          lock = false;
        });
      };
      const a = mk(sidebar, timeline);
      const b = mk(timeline, sidebar);
      sidebar.addEventListener("scroll", a, { passive: true });
      timeline.addEventListener("scroll", b, { passive: true });
      cleanups.push(() => {
        sidebar.removeEventListener("scroll", a);
        timeline.removeEventListener("scroll", b);
      });
    }
    return () => {
      for (const c of cleanups) c();
    };
  }, [registerScroll, sidebarCollapsed, hideInternalSidebar]);

  // Mouse-drag panning on the timeline — MS-Project-style. Holding the
  // middle-button or shift+left-button anywhere in the empty timeline area
  // scrolls horizontally. Lets the user navigate long Gantts without
  // hunting for the scrollbar.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let dragging = false;
    let startX = 0;
    let startScroll = 0;
    const onPointerDown = (e: PointerEvent) => {
      // Only middle-click or shift+left-click → start drag pan; left-click
      // alone is reserved for bar drag and row click handlers below.
      const isPan =
        e.button === 1 ||
        (e.button === 0 && e.shiftKey) ||
        (e.button === 0 && (e.target as HTMLElement)?.dataset?.panDrag === "1");
      if (!isPan) return;
      dragging = true;
      startX = e.clientX;
      startScroll = el.scrollLeft;
      el.setPointerCapture(e.pointerId);
      el.style.cursor = "grabbing";
      e.preventDefault();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      // RTL: dragging right should scroll content left (and vice versa).
      const dir = document.documentElement.dir === "rtl" ? 1 : -1;
      el.scrollLeft = startScroll + dx * dir;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      try { el.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      el.style.cursor = "";
    };
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
    };
  }, []);

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
        <p className="text-base">אין משימות בהיקף הנבחר.</p>
        <p className="text-xs mt-2">
          שני את "מקור" בראש הדף או הוסיפי משימה חדשה.
        </p>
      </div>
    );
  }

  return (
    // The flex row is height-capped; the sidebar and the timeline each get
    // their own scroll. The timeline scrolls in BOTH axes so its horizontal
    // scrollbar sits on the bottom edge of the visible box — always reachable
    // without first scrolling to the end of the chart. Vertical scroll is
    // kept in lockstep across the panes via the scroll-sync group.
    <div className="card overflow-hidden">
      <div className="flex max-h-[calc(100vh-200px)] min-w-0">
        {/* Left column: task rows — can be collapsed to a thin strip.
            Suppressed entirely when the parent renders an external
            GanttTable (hideInternalSidebar=true). */}
        {hideInternalSidebar ? null : sidebarCollapsed ? (
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
          ref={sidebarScrollRef}
          className="shrink-0 border-e border-ink-200 bg-white overflow-y-auto scrollbar-thin"
          style={{ width: LEFT_COL_WIDTH }}
        >
          {/* Spacer for the 2-row header */}
          <div className="h-16 border-b border-ink-200 bg-ink-50/95 backdrop-blur-sm sticky top-0 z-10 flex items-end justify-between px-3 py-2">
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
                  : r.phaseId && r.accentColor
                  ? ({ borderInlineStartWidth: 2, borderInlineStartColor: r.accentColor } as React.CSSProperties)
                  : {}),
              }}
              type="button"
              title={r.title}
            >
              {r.kind === "task" && r.task && r.hasChildren ? (
                <span
                  onClick={(e) => { e.stopPropagation(); onToggleCollapsed?.(r.task!.id); }}
                  className="shrink-0 w-4 h-4 -ms-1 flex items-center justify-center text-[10px] text-ink-400 hover:text-ink-900 hover:bg-ink-150 rounded cursor-pointer"
                  title={collapsedIds?.has(r.task.id) ? "הרחב" : "כווץ"}
                >
                  {collapsedIds?.has(r.task.id) ? "◂" : "▾"}
                </span>
              ) : (
                <span className="shrink-0 w-4 h-4 -ms-1" aria-hidden />
              )}
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

        {/* Timeline scrollable area — scrolls in both axes. */}
        <div className="flex-1 min-w-0 overflow-auto scrollbar-thin" ref={scrollRef}>
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
                {allSubTicks.map((st, i) => {
                  const nextTick = allSubTicks[i + 1];
                  const end = nextTick ? nextTick.date : windowEnd;
                  const left =
                    ((st.date.getTime() - windowStart.getTime()) / DAY_MS) *
                    pxPerDay;
                  const width =
                    ((end.getTime() - st.date.getTime()) / DAY_MS) * pxPerDay;
                  return (
                    <div
                      key={st.date.toISOString() + "-" + i}
                      className="absolute top-0 bottom-0 border-e border-ink-150 flex items-center justify-center text-[10px] text-ink-500"
                      style={{ insetInlineStart: left, width }}
                    >
                      <span className="truncate px-1">{st.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Body: grid background + bars + arrows. Clicking an empty
                area → open the create picker pinned to that day's 09:00. */}
            <div
              className={cn(
                "relative",
                onCreateAt && "cursor-pointer"
              )}
              style={{ height: timelineHeight, width: timelineWidth }}
              onClick={(e) => {
                if (!onCreateAt) return;
                if (e.target !== e.currentTarget) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const isRtl =
                  typeof document !== "undefined" &&
                  document.documentElement.dir === "rtl";
                const x = isRtl ? rect.right - e.clientX : e.clientX - rect.left;
                const days = x / pxPerDay;
                const start = new Date(windowStart.getTime() + days * DAY_MS);
                start.setHours(9, 0, 0, 0);
                onCreateAt(start);
              }}
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
                const isUnscheduledTask =
                  r.kind === "task" && !!r.unscheduled && !!r.task;
                const canScheduleHere = isUnscheduledTask && !!onScheduleTask;
                return (
                  <div
                    key={r.id + "-row-line"}
                    className={cn(
                      "absolute inset-x-0 border-b border-ink-150",
                      isCritical && "bg-danger-500/5",
                      canScheduleHere && "cursor-pointer hover:bg-primary-500/5"
                    )}
                    style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
                    onClick={canScheduleHere ? (e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = isRtl ? rect.right - e.clientX : e.clientX - rect.left;
                      const days = x / pxPerDay;
                      const date = new Date(windowStart.getTime() + days * DAY_MS);
                      date.setHours(9, 0, 0, 0);
                      onScheduleTask!(r, date);
                    } : undefined}
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

              {/* Bars — unscheduled rows occupy their slot but render no
                  bar (nothing to position). The editable table is where
                  the user assigns a schedule for those. */}
              {rows.map((r, i) => {
                const isCritical =
                  r.kind === "task" && !!r.task && criticalSet.has(r.task.id);
                if (r.unscheduled) return null;
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
                      onColorChange={
                        r.isPhase && r.task && onPhaseColorChange
                          ? (color) => onPhaseColorChange(r.task!.id, color)
                          : undefined
                      }
                    />
                  </div>
                );
              })}

              {/* Baseline bars — thin strip below each task bar showing original plan */}
              {baselineMap && rows.map((r, i) => {
                if (r.kind !== "task" || !r.task) return null;
                const bl = baselineMap.get(r.task.id);
                if (!bl?.scheduled_at || bl.duration_minutes == null) return null;
                const blStart = new Date(bl.scheduled_at);
                const blEnd = new Date(blStart.getTime() + bl.duration_minutes * 60_000);
                const left = ((blStart.getTime() - windowStart.getTime()) / DAY_MS) * pxPerDay;
                const width = Math.max(4, ((blEnd.getTime() - blStart.getTime()) / DAY_MS) * pxPerDay);
                if (left + width < 0 || left > timelineWidth) return null;
                return (
                  <div
                    key={r.id + "-baseline"}
                    className="absolute pointer-events-none"
                    style={{
                      top: i * ROW_HEIGHT + ROW_HEIGHT - 6,
                      height: 4,
                      insetInlineStart: left,
                      width,
                      backgroundColor: "#94a3b8",
                      borderRadius: 2,
                      opacity: 0.7,
                    }}
                    title={`בסיס: ${blStart.toLocaleDateString("he-IL")} – ${blEnd.toLocaleDateString("he-IL")}`}
                  />
                );
              })}

              {/* Deadline markers — a diamond on each task's row at its
                  deadline date. Turns red when the bar runs past it. */}
              {rows.map((r, i) => {
                if (r.kind !== "task" || !r.task?.deadline_at) return null;
                const dl = new Date(r.task.deadline_at);
                const left =
                  ((dl.getTime() - windowStart.getTime()) / DAY_MS) * pxPerDay;
                if (left < 0 || left > timelineWidth) return null;
                const overdue = r.end.getTime() > dl.getTime();
                const color = overdue ? "#ef4444" : "#f59e0b";
                return (
                  <div
                    key={r.id + "-deadline"}
                    className="absolute z-10"
                    style={{
                      insetInlineStart: left,
                      top: i * ROW_HEIGHT,
                      height: ROW_HEIGHT,
                    }}
                  >
                    <div
                      className="absolute top-1 bottom-1 w-px pointer-events-none"
                      style={{ backgroundColor: color, insetInlineStart: -0.5 }}
                    />
                    <div
                      className="absolute w-2 h-2 rotate-45"
                      style={{
                        insetInlineStart: -4,
                        top: ROW_HEIGHT / 2 - 4,
                        backgroundColor: color,
                        boxShadow: "0 0 0 1px white",
                      }}
                      title={`דד-ליין: ${dl.toLocaleDateString("he-IL")}${
                        overdue ? " (חריגה)" : ""
                      }`}
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
