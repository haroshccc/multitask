import { cn } from "@/lib/utils/cn";

interface DayNoteSlotProps {
  /** The note's body. When falsy / empty, nothing is rendered. */
  body: string | undefined;
  /**
   * Container variant — controls whether the slot expands to fill the
   * available row, or stays inline at its content width. Truncation is
   * always on, with the full body visible via the native browser tooltip
   * on hover.
   */
  variant?: "block" | "inline";
  className?: string;
}

/**
 * Tiny renderer for the per-day note next to the date number. Truncated
 * by default; the full body is in the `title` so hovering reveals it.
 *
 * Visual is intentionally muted (small, ink-500) — the note is metadata,
 * the date number is what the user reads first.
 */
export function DayNoteSlot({ body, variant = "block", className }: DayNoteSlotProps) {
  const text = (body ?? "").trim();
  if (!text) return null;
  return (
    <span
      title={text}
      className={cn(
        "text-[10px] text-ink-500 truncate select-none",
        variant === "block" ? "block min-w-0" : "inline-block max-w-full",
        className
      )}
    >
      {text}
    </span>
  );
}
