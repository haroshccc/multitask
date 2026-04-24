import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import { type GanttRow, DAY_MS } from "./gantt-utils";

interface GanttBarProps {
  row: GanttRow;
  /** Pixels per day — derived from zoom. */
  pxPerDay: number;
  /** Timeline origin (day 0 = this date). */
  origin: Date;
  /** Row is on the critical path — styles the bar with the danger gradient. */
  isCritical: boolean;
  onClick: () => void;
  /** Commit a new scheduled_at + duration in ISO/minutes. */
  onChange: (patch: { scheduled_at: string; duration_minutes: number }) => void;
}

/**
 * A single horizontal bar. Two interaction modes:
 * - Drag the body → moves the whole bar (changes scheduled_at).
 * - Drag the trailing edge → resizes (changes duration_minutes).
 *
 * We use raw pointer events rather than @dnd-kit here because the coordinates
 * we care about are continuous pixels, not discrete drop zones.
 */
export function GanttBar({
  row,
  pxPerDay,
  origin,
  isCritical,
  onClick,
  onChange,
}: GanttBarProps) {
  const [drag, setDrag] = useState<{
    kind: "move" | "resize";
    anchorX: number;
    origStart: Date;
    origEnd: Date;
    currentStart: Date;
    currentEnd: Date;
  } | null>(null);

  const lastClickWasDragRef = useRef(false);

  const displayStart = drag?.currentStart ?? row.start;
  const displayEnd = drag?.currentEnd ?? row.end;

  const leftDays = (displayStart.getTime() - origin.getTime()) / DAY_MS;
  const widthDays = Math.max(
    (displayEnd.getTime() - displayStart.getTime()) / DAY_MS,
    0.1 // guarantee a visible sliver
  );

  const leftPx = leftDays * pxPerDay;
  const widthPx = widthDays * pxPerDay;

  useEffect(() => {
    if (!drag) return;
    const minuteStep = pxPerDay >= 40 ? 15 : pxPerDay >= 15 ? 60 : pxPerDay >= 5 ? 4 * 60 : 24 * 60;
    const msStep = minuteStep * 60_000;

    const onMove = (e: PointerEvent) => {
      const deltaPx = e.clientX - drag.anchorX;
      // RTL reverses the horizontal meaning of "right arrow = later".
      // Detect via bar's computed style — right-to-left means positive clientX
      // delta moves the bar toward the past. Easier: use inline-start as pivot
      // and just track raw delta in logical direction. We pick: "rightward
      // mouse movement" in LTR = forward time, in RTL = backward time.
      const isRtl =
        typeof document !== "undefined" && document.documentElement.dir === "rtl";
      const logicalDelta = isRtl ? -deltaPx : deltaPx;
      const deltaMs = (logicalDelta / pxPerDay) * DAY_MS;
      const snappedMs = Math.round(deltaMs / msStep) * msStep;

      if (drag.kind === "move") {
        const newStart = new Date(drag.origStart.getTime() + snappedMs);
        const dur = drag.origEnd.getTime() - drag.origStart.getTime();
        setDrag({
          ...drag,
          currentStart: newStart,
          currentEnd: new Date(newStart.getTime() + dur),
        });
      } else {
        // Resize: move only the end. Floor at a 15-min minimum.
        const newEnd = new Date(drag.origEnd.getTime() + snappedMs);
        const minEndMs = drag.origStart.getTime() + 15 * 60_000;
        const safeEnd = new Date(Math.max(newEnd.getTime(), minEndMs));
        setDrag({ ...drag, currentEnd: safeEnd });
      }
      lastClickWasDragRef.current = true;
    };

    const onUp = () => {
      const startMs = drag.currentStart.getTime();
      const endMs = drag.currentEnd.getTime();
      const durMin = Math.max(15, Math.round((endMs - startMs) / 60_000));
      // Only commit if something actually changed.
      const changed =
        startMs !== drag.origStart.getTime() || endMs !== drag.origEnd.getTime();
      if (changed) {
        onChange({
          scheduled_at: drag.currentStart.toISOString(),
          duration_minutes: durMin,
        });
      }
      setDrag(null);
      // Block the click that fires immediately after a drag release.
      setTimeout(() => (lastClickWasDragRef.current = false), 50);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, pxPerDay, onChange]);

  const beginDrag = (kind: "move" | "resize") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({
      kind,
      anchorX: e.clientX,
      origStart: row.start,
      origEnd: row.end,
      currentStart: row.start,
      currentEnd: row.end,
    });
  };

  const handleClick = () => {
    if (lastClickWasDragRef.current) return;
    onClick();
  };

  const done = row.completed;
  const isEvent = row.kind === "event";
  const isPhase = !!row.isPhase;
  const highlight =
    isCritical ||
    (row.kind === "task" && row.task ? row.task.urgency >= 4 : false);

  // Phase rendering: the bar shows (1) a planned segment colored in a
  // shade of the list, and (2) an overage segment (start=end of planned,
  // end=latest child end) in danger-red when children slip past the
  // planned end. SPEC §17 "option C" — planned + overage visualized.
  if (isPhase && row.task) {
    const plannedWidthDays = widthDays;
    const plannedWidthPx = plannedWidthDays * pxPerDay;
    const overageDays =
      row.childrenEnd && row.childrenEnd > displayEnd
        ? (row.childrenEnd.getTime() - displayEnd.getTime()) / DAY_MS
        : 0;
    const overagePx = overageDays * pxPerDay;
    const accent = row.accentColor ?? "#6b6b80";
    return (
      <div
        data-row-id={row.id}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 h-7 rounded-md flex items-center text-[11px] font-bold text-white select-none cursor-grab shadow-soft overflow-hidden",
          drag && "cursor-grabbing shadow-lift z-20",
          done && "opacity-60"
        )}
        style={{
          insetInlineStart: leftPx,
          width: Math.max(plannedWidthPx + overagePx, 16),
        }}
        onPointerDown={beginDrag("move")}
        onClick={handleClick}
        title={`שלב: ${row.title}
מתוכנן ${row.start.toLocaleDateString("he-IL")} → ${row.end.toLocaleDateString("he-IL")}${
          overageDays > 0 && row.childrenEnd
            ? `\nחריגה ${row.end.toLocaleDateString("he-IL")} → ${row.childrenEnd.toLocaleDateString("he-IL")}`
            : ""
        }`}
      >
        {/* Planned segment — shade of the list color */}
        <div
          className="h-full flex items-center px-2 shrink-0"
          style={{
            width: Math.max(plannedWidthPx, 16),
            backgroundColor: accent,
          }}
        >
          <span className="truncate pointer-events-none">
            שלב · {row.title}
          </span>
        </div>
        {/* Overage segment — danger-red bleed past the planned end */}
        {overagePx > 0 && (
          <div
            className="h-full shrink-0 bg-[repeating-linear-gradient(45deg,rgba(239,68,68,0.85),rgba(239,68,68,0.85)_6px,rgba(239,68,68,0.6)_6px,rgba(239,68,68,0.6)_12px)]"
            style={{ width: overagePx }}
            title="חריגה מהתכנון של השלב"
          />
        )}
        {/* Resize handle on the planned end boundary */}
        <span
          onPointerDown={beginDrag("resize")}
          className="absolute inset-y-0 cursor-ew-resize flex items-center justify-center opacity-0 hover:opacity-100 bg-black/20 w-2"
          style={{
            // sits at the end of the planned segment, before any overage
            insetInlineStart: plannedWidthPx - 8,
          }}
          aria-label="שנה משך מתוכנן"
        >
          <span className="w-0.5 h-3 bg-white/90 rounded-full" />
        </span>
      </div>
    );
  }

  return (
    <div
      data-row-id={row.id}
      className={cn(
        "absolute top-1/2 -translate-y-1/2 h-6 rounded-md flex items-center text-[11px] font-medium text-white select-none cursor-grab shadow-soft",
        drag && "cursor-grabbing shadow-lift z-20",
        done && "opacity-60",
        isEvent
          ? "bg-gradient-to-l from-primary-600 to-primary-400 border border-primary-700"
          : highlight
          ? "bg-gradient-to-l from-danger-500 to-primary-500"
          : "bg-gradient-to-l from-primary-500 to-primary-400"
      )}
      style={{
        insetInlineStart: leftPx,
        width: Math.max(widthPx, 16),
      }}
      onPointerDown={beginDrag("move")}
      onClick={handleClick}
      title={`${row.title}
${row.start.toLocaleString("he-IL")} → ${row.end.toLocaleString("he-IL")}`}
    >
      <span className="truncate px-2 pointer-events-none">
        {done ? "✓ " : ""}
        {isEvent ? "● " : ""}
        {row.title}
      </span>
      {/* Resize handle — on the trailing edge (end). In RTL that's the LEFT
          visual edge; in LTR it's the RIGHT edge. We use inline-end for both. */}
      <span
        onPointerDown={beginDrag("resize")}
        className="absolute inset-y-0 end-0 w-2 cursor-ew-resize flex items-center justify-center opacity-0 hover:opacity-100 bg-black/20 rounded-e-md"
        aria-label="שנה משך"
      >
        <span className="w-0.5 h-3 bg-white/90 rounded-full" />
      </span>
    </div>
  );
}
