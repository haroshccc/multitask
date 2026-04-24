import { useState, useEffect, useRef } from "react";
import { Pencil } from "lucide-react";
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
 * - Click the body → open the edit modal (via `onClick`).
 * - Drag the body (>4px) → moves the whole bar (changes scheduled_at).
 * - Drag the trailing edge → resizes (changes duration_minutes).
 *
 * On hover, a small info card floats above the bar with the title, date
 * range, and a pencil button that also fires `onClick`. Redundant with the
 * whole-bar click, but gives the user a visible, obvious "edit" affordance.
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
  const [hover, setHover] = useState(false);

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
    const DRAG_THRESHOLD_PX = 4;

    const onMove = (e: PointerEvent) => {
      const deltaPx = e.clientX - drag.anchorX;
      // Only treat this as a real drag once the pointer has moved past the
      // threshold — prevents a single click from being mis-classified as a
      // drag and swallowing the click-to-edit handler.
      if (Math.abs(deltaPx) < DRAG_THRESHOLD_PX) return;

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
      const changed =
        startMs !== drag.origStart.getTime() || endMs !== drag.origEnd.getTime();
      if (changed) {
        onChange({
          scheduled_at: drag.currentStart.toISOString(),
          duration_minutes: durMin,
        });
      }
      setDrag(null);
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

  // ---------------------------------------------------------------------------
  // Hover info card — floats above the bar with a pencil-edit shortcut.

  const hoverCard = hover && !drag ? (
    <div
      className="absolute z-30 card shadow-lift p-2 min-w-[180px] max-w-[280px] pointer-events-auto"
      style={{
        insetInlineStart: Math.max(0, leftPx),
        bottom: "100%",
        marginBottom: 6,
      }}
      // Keep the card open while hovering it.
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-[11px] font-semibold text-ink-900 truncate">
          {isPhase ? "שלב · " : isEvent ? "אירוע · " : ""}
          {row.title || <span className="italic text-ink-400">ללא כותרת</span>}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="shrink-0 p-1 rounded-md text-ink-500 hover:text-primary-600 hover:bg-ink-100"
          title="ערוך"
          type="button"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="text-[10px] text-ink-500 tabular-nums leading-tight">
        {row.start.toLocaleString("he-IL", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
        {" → "}
        {row.end.toLocaleString("he-IL", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
      {isPhase && row.childrenEnd && row.childrenEnd > row.end && (
        <div className="mt-1 text-[10px] text-danger-600 font-medium">
          חריגה עד{" "}
          {row.childrenEnd.toLocaleDateString("he-IL", {
            day: "numeric",
            month: "short",
          })}
        </div>
      )}
      {isCritical && (
        <div className="mt-1 text-[10px] text-danger-600 font-medium">
          בנתיב קריטי
        </div>
      )}
    </div>
  ) : null;

  // ---------------------------------------------------------------------------
  // Phase rendering — SPEC §17 option C: planned + dashed-red overage.

  if (isPhase && row.task) {
    const plannedWidthPx = widthDays * pxPerDay;
    const overageDays =
      row.childrenEnd && row.childrenEnd > displayEnd
        ? (row.childrenEnd.getTime() - displayEnd.getTime()) / DAY_MS
        : 0;
    const overagePx = overageDays * pxPerDay;
    const accent = row.accentColor ?? "#6b6b80";

    return (
      <>
        <div
          data-row-id={row.id}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 h-7 rounded-md flex items-center text-[11px] font-bold text-white select-none cursor-pointer shadow-soft overflow-hidden",
            drag && "cursor-grabbing shadow-lift z-20",
            done && "opacity-60"
          )}
          style={{
            insetInlineStart: leftPx,
            width: Math.max(plannedWidthPx + overagePx, 16),
          }}
          onPointerDown={beginDrag("move")}
          onClick={handleClick}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          title={`שלב: ${row.title}`}
        >
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
          {overagePx > 0 && (
            <div
              className="h-full shrink-0 bg-[repeating-linear-gradient(45deg,rgba(239,68,68,0.85),rgba(239,68,68,0.85)_6px,rgba(239,68,68,0.6)_6px,rgba(239,68,68,0.6)_12px)]"
              style={{ width: overagePx }}
              title="חריגה מהתכנון של השלב"
            />
          )}
          <span
            onPointerDown={beginDrag("resize")}
            className="absolute inset-y-0 cursor-ew-resize flex items-center justify-center opacity-0 hover:opacity-100 bg-black/20 w-2"
            style={{ insetInlineStart: plannedWidthPx - 8 }}
            aria-label="שנה משך מתוכנן"
          >
            <span className="w-0.5 h-3 bg-white/90 rounded-full" />
          </span>
        </div>
        {hoverCard}
      </>
    );
  }

  return (
    <>
      <div
        data-row-id={row.id}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 h-6 rounded-md flex items-center text-[11px] font-medium text-white select-none cursor-pointer shadow-soft",
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
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title={row.title}
      >
        <span className="truncate px-2 pointer-events-none">
          {done ? "✓ " : ""}
          {isEvent ? "● " : ""}
          {row.title}
        </span>
        <span
          onPointerDown={beginDrag("resize")}
          className="absolute inset-y-0 end-0 w-2 cursor-ew-resize flex items-center justify-center opacity-0 hover:opacity-100 bg-black/20 rounded-e-md"
          aria-label="שנה משך"
        >
          <span className="w-0.5 h-3 bg-white/90 rounded-full" />
        </span>
      </div>
      {hoverCard}
    </>
  );
}
