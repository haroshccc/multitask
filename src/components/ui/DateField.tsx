import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { he } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DateTimePicker, PortalPopover } from "./DateTimePicker";

// =============================================================================
// DateField — a designed, RTL-native replacement for `<input type="date">`.
//
// Drop-in by contract: value is "yyyy-MM-dd" or "" and onChange receives the
// same, so call sites that fed a native input keep their state logic as-is.
// The popover is the same visual language as DateTimePicker (Hebrew month
// grid, brand selection, portal positioning) plus quick chips (היום/מחר/
// עוד שבוע) and min/max support.
// =============================================================================

interface DateFieldProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** "yyyy-MM-dd" bounds — days outside are not selectable. */
  min?: string;
  max?: string;
  /** Hide the clear (×) affordance for required fields. */
  required?: boolean;
  /** aria-label for the trigger button. */
  label?: string;
  /** "ghost" renders a borderless inline trigger for dense table cells. */
  variant?: "field" | "ghost";
}

const WEEKDAY_LABELS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

function parseIso(d: string): Date | null {
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(date.getTime()) ? null : date;
}

function toIso(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

export function DateField({
  value,
  onChange,
  placeholder = "בחרי תאריך",
  className,
  disabled,
  min,
  max,
  required,
  label,
  variant = "field",
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const current = useMemo(() => (value ? parseIso(value) : null), [value]);
  const minDate = useMemo(() => (min ? parseIso(min) : null), [min]);
  const maxDate = useMemo(() => (max ? parseIso(max) : null), [max]);
  const [viewMonth, setViewMonth] = useState<Date>(current ?? new Date());

  useEffect(() => {
    if (open) setViewMonth(current ?? new Date());
  }, [open, current]);

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

  const outOfRange = (d: Date) =>
    (minDate !== null && d < minDate) || (maxDate !== null && d > maxDate);

  const pick = (d: Date) => {
    if (outOfRange(d)) return;
    onChange(toIso(d));
    setOpen(false);
  };

  const display = current
    ? format(current, "EEEE, d בMMMM yyyy", { locale: he })
    : "";
  const displayShort = current ? format(current, "dd/MM/yyyy") : "";

  const quickChips: { label: string; date: Date }[] = useMemo(() => {
    const today = new Date();
    return [
      { label: "היום", date: today },
      { label: "מחר", date: addDays(today, 1) },
      { label: "עוד שבוע", date: addDays(today, 7) },
    ].filter((c) => !outOfRange(c.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max, open]);

  return (
    <div className={cn("relative", className)}>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-expanded={open}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center text-start transition-all",
          variant === "field" &&
            "gap-2 rounded-xl border bg-white px-3 py-2.5 text-sm",
          variant === "field" &&
            (open
              ? "border-primary-500 ring-2 ring-primary-500/25"
              : "border-ink-300 hover:border-ink-400"),
          variant === "field" && disabled && "bg-ink-100 text-ink-500 cursor-not-allowed",
          variant === "ghost" &&
            "gap-1 rounded-sm border bg-transparent px-1 py-0.5 text-[11px]",
          variant === "ghost" &&
            (open
              ? "border-primary-400"
              : "border-transparent hover:border-ink-200"),
          variant === "ghost" && disabled && "text-ink-400 cursor-not-allowed",
          !value && "text-ink-400",
        )}
        title={display || undefined}
      >
        <CalendarIcon
          className={cn(
            "shrink-0 text-ink-500",
            variant === "field" ? "w-4 h-4" : "w-3 h-3",
          )}
          aria-hidden="true"
        />
        <span className="flex-1 truncate">{displayShort || placeholder}</span>
        {value && !disabled && !required && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                e.preventDefault();
                onChange("");
              }
            }}
            className="p-0.5 rounded-md text-ink-400 hover:text-danger-500 hover:bg-ink-100 cursor-pointer"
            aria-label="נקה תאריך"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      {open &&
        anchorRect &&
        typeof document !== "undefined" &&
        createPortal(
          <PortalPopover ref={popoverRef} anchorRect={anchorRect}>
            <div className="p-3 w-[min(272px,calc(100vw-1.5rem))]">
              {/* Quick chips */}
              {quickChips.length > 0 && (
                <div className="flex items-center gap-1.5 mb-2">
                  {quickChips.map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => pick(c.date)}
                      className={cn(
                        "flex-1 text-xs font-medium px-2 py-1.5 rounded-lg border transition-colors",
                        current && isSameDay(c.date, current)
                          ? "bg-primary-500 text-white border-primary-500"
                          : "bg-white text-ink-700 border-ink-200 hover:border-primary-300 hover:bg-primary-50",
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Month header */}
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
                  title="חזרה לחודש הנוכחי"
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
                  start: startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 0 }),
                  end: endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 0 }),
                }).map((day) => {
                  const inMonth = isSameMonth(day, viewMonth);
                  const selected = current !== null && isSameDay(day, current);
                  const today = isToday(day);
                  const blocked = outOfRange(day);
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      disabled={blocked}
                      onClick={() => pick(day)}
                      className={cn(
                        "aspect-square rounded-lg text-xs font-medium transition-colors",
                        blocked && "text-ink-200 cursor-not-allowed",
                        !blocked && !inMonth && "text-ink-300 hover:bg-ink-100",
                        !blocked &&
                          inMonth &&
                          !selected &&
                          !today &&
                          "text-ink-700 hover:bg-ink-100",
                        !blocked &&
                          today &&
                          !selected &&
                          "bg-primary-100 text-primary-800 ring-1 ring-primary-300",
                        selected && "bg-primary-500 text-white shadow-accent",
                      )}
                    >
                      {format(day, "d")}
                    </button>
                  );
                })}
              </div>
            </div>
          </PortalPopover>,
          document.body,
        )}
    </div>
  );
}

// =============================================================================
// DateTimeField — `<input type="datetime-local">` replacement. Wraps the
// existing DateTimePicker with the native value contract
// ("yyyy-MM-ddTHH:mm" or "") so call sites keep their state format.
// =============================================================================

function toDtLocal(d: Date): string {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export function DateTimeField({
  value,
  onChange,
  className,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  const iso = useMemo(() => {
    if (!value) return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }, [value]);
  return (
    <DateTimePicker
      value={iso}
      onChange={(next) => onChange(next ? toDtLocal(new Date(next)) : "")}
      className={className}
      disabled={disabled}
      placeholder={placeholder ?? "תאריך ושעה"}
    />
  );
}
