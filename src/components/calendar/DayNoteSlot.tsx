import { cn } from "@/lib/utils/cn";

interface DayNoteSlotProps {
  /** The note's body. When falsy / empty, nothing is rendered. */
  body: string | undefined;
  /**
   * Container variant — controls whether the slot expands to fill the
   * available row, or stays inline at its content width. Truncation is
   * always on, and the full body is revealed in a hover popover.
   */
  variant?: "block" | "inline";
  className?: string;
}

/**
 * Tiny renderer for the per-day note next to the date number. Truncated
 * by default; on hover, a small floating bubble shows the full body
 * (CSS-only — no portal, scoped via `group-hover` to the slot itself).
 *
 * Visual is intentionally muted (small, ink-500) — the note is
 * metadata, the date number is what the user reads first.
 */
export function DayNoteSlot({ body, variant = "block", className }: DayNoteSlotProps) {
  const text = (body ?? "").trim();
  if (!text) return null;
  return (
    <span
      className={cn(
        "group relative inline-block min-w-0",
        variant === "block" ? "w-full" : "max-w-full",
        className
      )}
    >
      <span className="block text-[10px] text-ink-500 truncate select-none">
        {text}
      </span>

      {/* Hover bubble — appears below the slot, anchored to its end side
          (left in RTL) so it doesn't collide with neighbouring date
          digits. CSS-only via `group-hover`. */}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-40 top-full mt-1 max-w-xs",
          // RTL: anchor to logical end (= left visually).
          "end-0",
          "rounded-md bg-ink-900 text-white text-[11px] leading-snug px-2 py-1.5 shadow-lift",
          "whitespace-pre-wrap break-words",
          "opacity-0 invisible transition-opacity duration-100",
          "group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible"
        )}
      >
        {text}
      </span>
    </span>
  );
}
