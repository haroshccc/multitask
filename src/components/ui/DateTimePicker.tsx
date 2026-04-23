import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { he } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronDown, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface DateTimePickerProps {
  value: string | null;               // ISO timestamp or null
  onChange: (next: string | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** When true, time pickers are hidden and the picker is date-only */
  dateOnly?: boolean;
}

const WEEKDAY_LABELS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

export function DateTimePicker({
  value,
  onChange,
  placeholder = "—",
  className,
  disabled,
  dateOnly,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const current = value ? new Date(value) : null;
  const [viewMonth, setViewMonth] = useState<Date>(current ?? new Date());

  // Re-compute anchor position on open and on window scroll/resize so the
  // portaled popover tracks the trigger button.
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (anchorRef.current) {
        setAnchorRect(anchorRef.current.getBoundingClientRect());
      }
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        popoverRef.current?.contains(e.target as Node) ||
        anchorRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const display = useMemo(() => {
    if (!current) return "";
    return dateOnly
      ? format(current, "dd/MM/yyyy")
      : format(current, "dd/MM/yyyy · HH:mm");
  }, [current, dateOnly]);

  const setDateKeepTime = (day: Date) => {
    const next = new Date(day);
    if (current) {
      next.setHours(current.getHours(), current.getMinutes(), 0, 0);
    } else {
      next.setHours(9, 0, 0, 0);
    }
    onChange(next.toISOString());
  };

  const chooseToday = () => {
    const now = new Date();
    onChange(now.toISOString());
    setViewMonth(now);
  };

  const clear = () => {
    onChange(null);
    setOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 text-sm text-start transition-all",
          open
            ? "border-primary-500 ring-2 ring-primary-500/25"
            : "border-ink-300 hover:border-ink-400",
          disabled && "bg-ink-100 text-ink-500 cursor-not-allowed",
          !display && "text-ink-400"
        )}
      >
        <CalendarIcon className="w-4 h-4 shrink-0 text-ink-500" />
        <span className="flex-1 truncate">{display || placeholder}</span>
        {value && !disabled && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                e.preventDefault();
                clear();
              }
            }}
            className="p-0.5 rounded-md text-ink-400 hover:text-danger-500 hover:bg-ink-100 cursor-pointer"
            aria-label="נקה"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      {open && anchorRect && typeof document !== "undefined" &&
        createPortal(
          <PortalPopover
            ref={popoverRef}
            anchorRect={anchorRect}
          >
          <div className="flex flex-col sm:flex-row items-stretch">
            {/* Calendar */}
            <div className="p-3 w-full sm:w-auto sm:min-w-[260px]">
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => setViewMonth((m) => addMonths(m, -1))}
                  className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-600"
                  aria-label="חודש קודם"
                >
                  <ChevronDown className="w-4 h-4 -rotate-90" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMonth(new Date())}
                  className="text-sm font-semibold text-ink-900 px-2 py-1 rounded-md hover:bg-ink-100"
                  title="חזור להיום"
                >
                  {format(viewMonth, "MMMM yyyy", { locale: he })}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMonth((m) => addMonths(m, 1))}
                  className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-600"
                  aria-label="חודש הבא"
                >
                  <ChevronDown className="w-4 h-4 rotate-90" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-0.5 text-[10px] text-ink-400 font-medium mb-1">
                {WEEKDAY_LABELS.map((w) => (
                  <div key={w} className="text-center py-1">
                    {w}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {eachDayOfInterval({
                  start: startOfWeek(startOfMonth(viewMonth), {
                    weekStartsOn: 0,
                  }),
                  end: endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 0 }),
                }).map((day) => {
                  const inMonth = isSameMonth(day, viewMonth);
                  const selected = current && isSameDay(day, current);
                  const today = isToday(day);
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      onClick={() => setDateKeepTime(day)}
                      className={cn(
                        "aspect-square rounded-lg text-xs font-medium transition-colors",
                        !inMonth && "text-ink-300",
                        inMonth && !selected && !today && "text-ink-700 hover:bg-ink-100",
                        today && !selected && "bg-primary-100 text-primary-800 ring-1 ring-primary-300",
                        selected && "bg-primary-500 text-white shadow-accent"
                      )}
                    >
                      {format(day, "d")}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time — native <input type="time"> gives the OS-level picker
                on iOS / Android / desktop, matching the one used by the
                Timer-entry manual fields and avoiding the tall scroll columns
                that squeezed the popover on mobile. */}
            {!dateOnly && (
              <div className="flex items-center gap-2 p-3 bg-ink-50 border-t sm:border-t-0 sm:border-s border-ink-200">
                <Clock className="w-4 h-4 text-ink-500 shrink-0" />
                <input
                  type="time"
                  dir="ltr"
                  value={
                    current
                      ? `${String(current.getHours()).padStart(2, "0")}:${String(
                          current.getMinutes()
                        ).padStart(2, "0")}`
                      : ""
                  }
                  onChange={(e) => {
                    const [hh, mm] = e.target.value.split(":").map(Number);
                    if (Number.isNaN(hh) || Number.isNaN(mm)) return;
                    const base = current ?? new Date();
                    const next = new Date(base);
                    next.setHours(hh, mm, 0, 0);
                    onChange(next.toISOString());
                  }}
                  className="field text-sm font-mono tabular-nums text-center flex-1 min-w-0"
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-ink-200 bg-white">
            <button
              type="button"
              onClick={clear}
              className="text-xs text-ink-500 hover:text-danger-500 px-2 py-1 rounded-md"
            >
              ניקוי
            </button>
            <button
              type="button"
              onClick={chooseToday}
              className="text-xs font-medium text-primary-700 hover:bg-primary-50 px-2 py-1 rounded-md"
            >
              היום
            </button>
          </div>
          </PortalPopover>,
          document.body
        )}
    </div>
  );
}

const PortalPopover = forwardRef<
  HTMLDivElement,
  {
    anchorRect: DOMRect;
    children: React.ReactNode;
  }
>(function PortalPopover({ anchorRect, children }, ref) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const isMobile = vw < 640;
  const isRtl = document.documentElement.dir === "rtl";

  // Height guess — the stacked mobile layout is taller than the side-by-side
  // desktop one because time columns land under the calendar.
  const estimatedHeight = isMobile ? 540 : 340;
  const preferBelow =
    anchorRect.bottom + estimatedHeight <= vh || anchorRect.top < estimatedHeight;
  const top = preferBelow
    ? anchorRect.bottom + 4
    : Math.max(8, anchorRect.top - estimatedHeight - 4);

  const style: React.CSSProperties = {
    position: "fixed",
    top,
    zIndex: 1000,
    maxWidth: "calc(100vw - 16px)",
  };

  if (isMobile) {
    // On mobile pin to both edges with an 8px margin so it's centred and
    // always inside the viewport.
    style.left = 8;
    style.right = 8;
  } else if (isRtl) {
    // Align leading edge (right in RTL) to the trigger's leading edge, but
    // clamp so we never spill off the left side of the viewport either.
    const preferredRight = vw - anchorRect.right;
    style.right = Math.max(8, Math.min(preferredRight, vw - 16 - 260));
  } else {
    style.left = Math.max(8, Math.min(anchorRect.left, vw - 16 - 260));
  }

  return (
    <div
      ref={ref}
      style={style}
      className="bg-white rounded-2xl border border-ink-200 shadow-lift overflow-hidden"
    >
      {children}
    </div>
  );
});

// Utility exports — useful for other places that need ISO <-> display parsing.
export function parseDateTimeLocal(display: string): Date | null {
  try {
    const parsed = parse(display, "dd/MM/yyyy HH:mm", new Date());
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  } catch {
    return null;
  }
}
