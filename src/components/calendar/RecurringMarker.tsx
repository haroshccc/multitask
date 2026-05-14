import { Repeat } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { type CalendarItem, formatHour, itemTooltip } from "./calendar-utils";

/**
 * Flat, deadline-style rendering for a recurring task occurrence — used by
 * the Gantt calendar view (opt-in via `recurringAsMarker`). No border, no
 * background block: a repeat glyph on the leading edge (right in RTL), the
 * start time only (no end time), the title, and a coloured underline.
 */
export function RecurringMarker({
  item,
  accent,
  onClick,
  tz,
  className,
}: {
  item: CalendarItem;
  accent: string;
  onClick: () => void;
  tz?: string;
  className?: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "w-full text-start cursor-pointer px-1.5 rounded-sm hover:bg-ink-50",
        className
      )}
      title={itemTooltip(item)}
    >
      <div className="flex items-center gap-1 text-[10px]">
        <Repeat className="w-2.5 h-2.5 shrink-0 text-ink-600" />
        {!item.allDay && (
          <span className="shrink-0 tabular-nums text-ink-500">
            {formatHour(item.start, tz)}
          </span>
        )}
        <span
          className={cn(
            "truncate font-medium text-ink-900",
            item.completed && "line-through"
          )}
        >
          {item.title}
        </span>
      </div>
      <div
        className="h-[2px] mt-0.5 rounded-full"
        style={{ backgroundColor: accent }}
      />
    </div>
  );
}
