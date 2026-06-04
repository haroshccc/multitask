import { Check, X, Repeat } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { FrameworkBlockOccurrenceView } from "@/lib/types/frameworks";

/**
 * Inline (relative-positioned) framework occurrence chip for the all-day strip,
 * month cells and agenda — anywhere there's no time axis. Faded dashed pill,
 * left-click cycles check state. Shows a tiny time label for timed occurrences.
 */
export function FrameworkInlineChip({
  occ,
  showTime,
  onClick,
}: {
  occ: FrameworkBlockOccurrenceView;
  /** Show the start time before the title (for timed occurrences in agenda). */
  showTime?: boolean;
  onClick?: (occ: FrameworkBlockOccurrenceView) => void;
}) {
  const accent = occ.color ?? "#6366f1";
  const done = occ.status === "done";
  const skipped = occ.status === "skipped";
  const isPast = occ.end.getTime() < Date.now();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(occ);
      }}
      className={cn(
        "w-full inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-start text-[10px] transition-opacity",
        isPast ? "opacity-30" : skipped && "opacity-50"
      )}
      style={{
        backgroundColor: hexToRgba(accent, done ? 0.22 : 0.1),
        border: `1px dashed ${hexToRgba(accent, 0.55)}`,
        color: accent,
      }}
      title={`מסגרת · ${occ.title}`}
    >
      {done && <Check className="w-2.5 h-2.5 shrink-0" />}
      {skipped && <X className="w-2.5 h-2.5 shrink-0" />}
      {showTime && !occ.allDay && (
        <span className="tabular-nums shrink-0 opacity-80">
          {String(occ.start.getHours()).padStart(2, "0")}:
          {String(occ.start.getMinutes()).padStart(2, "0")}
        </span>
      )}
      <span className={cn("truncate flex-1 min-w-0", skipped && "line-through")}>
        {occ.title || "מסגרת"}
      </span>
      <Repeat className="w-2.5 h-2.5 shrink-0 opacity-50" />
    </button>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length < 6) return hex;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * A framework time-block as it appears on the calendar: a faded, dashed
 * background block (like a fixed recurring event), positioned by the host view.
 * Left-click cycles its check state (none → done → skipped → none). Right-click
 * is reserved for the move gesture (handled by the host).
 *
 * Rendered BEFORE the regular task/event blocks in the column so it sits behind
 * them.
 */
export function FrameworkBlockChip({
  occ,
  top,
  height,
  onClick,
  onContextMenu,
}: {
  occ: FrameworkBlockOccurrenceView;
  /** Percent offset from the top of the day column. */
  top: number;
  /** Percent height within the day column. */
  height: number;
  onClick?: (occ: FrameworkBlockOccurrenceView) => void;
  onContextMenu?: (occ: FrameworkBlockOccurrenceView, x: number, y: number) => void;
}) {
  const accent = occ.color ?? "#6366f1";
  const done = occ.status === "done";
  const skipped = occ.status === "skipped";
  // Past occurrences (whole past days, and earlier hours today) fade much more
  // so they don't read like a slightly-dimmed regular past event.
  const isPast = occ.end.getTime() < Date.now();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(occ);
      }}
      onContextMenu={
        onContextMenu
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onContextMenu(occ, e.clientX, e.clientY);
            }
          : undefined
      }
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(occ);
        }
      }}
      className={cn(
        "absolute rounded-md px-1.5 py-0.5 text-start overflow-hidden cursor-pointer transition-opacity",
        // Past framework occurrences fade hard (~70%) regardless of done/skipped
        // so the pink clearly recedes vs a regular dimmed past event.
        isPast ? "opacity-30" : skipped && "opacity-50"
      )}
      style={{
        top: `${top}%`,
        height: `${Math.max(height, 1.5)}%`,
        insetInlineStart: "2px",
        insetInlineEnd: "2px",
        backgroundColor: hexToRgba(accent, done ? 0.22 : 0.1),
        border: `1px dashed ${hexToRgba(accent, 0.55)}`,
        color: accent,
      }}
      title={`מסגרת · ${occ.title}`}
    >
      <div className="flex items-center gap-1 leading-none">
        {done && <Check className="w-2.5 h-2.5 shrink-0" />}
        {skipped && <X className="w-2.5 h-2.5 shrink-0" />}
        <span
          className={cn(
            "text-[10px] font-medium truncate flex-1 min-w-0",
            skipped && "line-through"
          )}
        >
          {occ.title || "מסגרת"}
        </span>
      </div>
    </div>
  );
}
