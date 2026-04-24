import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Shared chrome-bar building blocks used by `CalendarChrome`,
 * `TasksChrome`, `GanttChrome`. Per SPEC §12.8.
 *
 * Popovers use a **React portal + position: fixed** so they escape any
 * overflow / transform context of the chrome card and clamp to the
 * viewport. This avoids the "opens too far left / right" bugs that
 * absolute-positioned popovers suffer when the trigger sits near an
 * edge of the chrome.
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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Close on outside click / escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  // Compute popover position whenever it opens (or viewport changes).
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !popoverRef.current) {
      if (!open && pos) setPos(null);
      return;
    }
    const compute = () => {
      const trig = triggerRef.current;
      const pop = popoverRef.current;
      if (!trig || !pop) return;
      const trigRect = trig.getBoundingClientRect();
      const popRect = pop.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const PAD = 8;

      // Prefer below the trigger.
      let top = trigRect.bottom + 4;
      if (top + popRect.height > vh - PAD) {
        const above = trigRect.top - popRect.height - 4;
        if (above >= PAD) top = above;
      }

      // Align: start the popover's right edge with the trigger's right edge
      // in RTL (the "chevron down" direction). In LTR, align lefts.
      const isRtl =
        typeof document !== "undefined" &&
        document.documentElement.dir === "rtl";
      let left: number;
      if (isRtl) {
        left = trigRect.right - popRect.width;
      } else {
        left = trigRect.left;
      }
      // Clamp horizontally.
      if (left < PAD) left = PAD;
      if (left + popRect.width > vw - PAD) left = vw - PAD - popRect.width;

      setPos({ top, left });
    };
    compute();
    const onResize = () => compute();
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
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
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={popoverRef}
            className={cn(
              "fixed z-50 bg-white border border-ink-200 rounded-lg shadow-lift",
              wide ? "min-w-[260px]" : "min-w-[180px]",
              "max-w-[calc(100vw-16px)]"
            )}
            style={
              pos
                ? { top: pos.top, left: pos.left }
                : // First render: place off-screen for measurement.
                  { top: -9999, left: -9999 }
            }
          >
            {children(() => setOpen(false))}
          </div>,
          document.body
        )}
    </>
  );
}
