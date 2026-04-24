import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Shared chrome-bar building blocks used by `CalendarChrome`,
 * `TasksChrome`, `GanttChrome`. Per SPEC §12.8 these render as:
 *
 *   - Compact icon + label (icon-only on mobile, icon+label on md+).
 *   - `start-0` popover positioning so the popover opens toward the
 *     layout-end (away from the screen-right in RTL) and stays in
 *     the viewport. `max-w-[calc(100vw-1rem)]` guards the overflow.
 *
 * Any new screen that needs a chrome should use these, not reimplement.
 */

interface ToggleButtonProps {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  badge?: string;
}

export function ToggleButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: ToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium border transition-colors",
        active
          ? "bg-ink-900 border-ink-900 text-white"
          : "bg-white border-ink-200 text-ink-700 hover:bg-ink-50"
      )}
      type="button"
      title={label}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
      {badge && (
        <span
          className={cn(
            "inline-flex items-center justify-center min-w-[16px] h-[16px] rounded-full text-[9px] font-semibold px-1",
            active ? "bg-white text-ink-900" : "bg-primary-500 text-white"
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

interface PopoverButtonProps {
  icon: ReactNode;
  label: string;
  title?: string;
  badge?: string;
  /** Wider popover (260px min) for richer content like list pickers. */
  wide?: boolean;
  children: (close: () => void) => ReactNode;
}

export function PopoverButton({
  icon,
  label,
  title,
  badge,
  wide,
  children,
}: PopoverButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium border transition-colors",
          open
            ? "bg-ink-100 border-ink-300 text-ink-900"
            : "bg-white border-ink-200 text-ink-700 hover:bg-ink-50"
        )}
        type="button"
        title={title}
      >
        {icon}
        <span className="hidden md:inline">{label}</span>
        {badge && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] rounded-full text-[9px] font-semibold px-1 bg-primary-500 text-white">
            {badge}
          </span>
        )}
        <ChevronDown
          className={cn("w-3 h-3 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div
          className={cn(
            "absolute top-full start-0 mt-1 z-30 bg-white border border-ink-200 rounded-lg shadow-lift max-w-[calc(100vw-1rem)]",
            wide ? "min-w-[260px]" : "min-w-[180px]"
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
