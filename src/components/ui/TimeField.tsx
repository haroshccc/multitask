import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { PortalPopover, TimeSpinner } from "./DateTimePicker";

// =============================================================================
// TimeField — a designed, RTL-native replacement for `<input type="time">`.
//
// Drop-in by contract: value is "HH:mm" or "" and onChange receives the
// same. The popover reuses DateTimePicker's hour/minute spinner and adds a
// grid of common time slots for one-tap picks.
// =============================================================================

interface TimeFieldProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Hide the clear (×) affordance for required fields. */
  required?: boolean;
  label?: string;
  /** "ghost" renders a borderless inline trigger for dense table cells. */
  variant?: "field" | "ghost";
}

const COMMON_SLOTS = ["08:00", "09:00", "12:00", "14:00", "16:00", "18:00", "20:00", "21:00"];

function parseTime(v: string): { h: number; m: number } | null {
  const m = v.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}

function fmt(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function TimeField({
  value,
  onChange,
  placeholder = "שעה",
  className,
  disabled,
  required,
  label,
  variant = "field",
}: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const parsed = value ? parseTime(value) : null;

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
      >
        <Clock
          className={cn(
            "shrink-0 text-ink-500",
            variant === "field" ? "w-4 h-4" : "w-3 h-3",
          )}
          aria-hidden="true"
        />
        <span className="flex-1 truncate tabular-nums" dir="ltr">
          {value || placeholder}
        </span>
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
            className="p-1 rounded-md text-ink-400 hover:text-danger-500 hover:bg-ink-100 cursor-pointer"
            aria-label="נקה שעה"
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
            <div className="p-3 w-[min(228px,calc(100vw-1.5rem))] space-y-3">
              <div className="flex items-center justify-center">
                <TimeSpinner
                  hours={parsed?.h ?? 9}
                  minutes={parsed?.m ?? 0}
                  onChange={(h, m) => onChange(fmt(h, m))}
                />
              </div>
              <div className="grid grid-cols-4 gap-1">
                {COMMON_SLOTS.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => {
                      onChange(slot);
                      setOpen(false);
                    }}
                    className={cn(
                      "px-1 py-1.5 rounded-lg text-xs font-mono tabular-nums border transition-colors",
                      value === slot
                        ? "bg-primary-500 text-white border-primary-500"
                        : "bg-white text-ink-700 border-ink-200 hover:border-primary-300 hover:bg-primary-50",
                    )}
                    dir="ltr"
                  >
                    {slot}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 px-4 py-1.5 rounded-lg shadow-accent"
              >
                שמור
              </button>
            </div>
          </PortalPopover>,
          document.body,
        )}
    </div>
  );
}
