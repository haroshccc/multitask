import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Masked HH:MM duration input.
 *
 * Stores internally as total minutes; parent decides how to persist it
 * (duration_minutes = int; estimated_hours = decimal hours — see helpers).
 */
interface DurationInputProps {
  /** total minutes */
  value: number | null;
  onChange: (totalMinutes: number | null) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export function DurationInput({
  value,
  onChange,
  className,
  placeholder = "00:00",
  disabled,
  ariaLabel,
}: DurationInputProps) {
  const [draft, setDraft] = useState<string>(toDisplay(value));
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  // Re-sync on external value change (avoid clobbering while user is typing).
  useEffect(() => {
    if (!focused) setDraft(toDisplay(value));
  }, [value, focused]);

  const commit = () => {
    const next = parseMask(draft);
    onChange(next);
    setDraft(toDisplay(next));
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5 text-sm transition-all",
        focused
          ? "border-primary-500 ring-2 ring-primary-500/25"
          : "border-ink-300 hover:border-ink-400",
        disabled && "bg-ink-100 text-ink-500 cursor-not-allowed",
        className
      )}
    >
      <Clock className="w-4 h-4 shrink-0 text-ink-500" />
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={draft}
        aria-label={ariaLabel}
        onFocus={(e) => {
          setFocused(true);
          e.currentTarget.select();
        }}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onChange={(e) => setDraft(formatWhileTyping(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
            ref.current?.blur();
          }
        }}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm font-mono tabular-nums text-end"
        dir="ltr"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Keep only digits, group as HH:MM. Always returns at most HH:MM format. */
function formatWhileTyping(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/** Parse a mask to total minutes. Accepts "HH:MM", "H:MM", "HH", "MM" forms. */
function parseMask(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const [hStr, mStr] = trimmed.split(":");
  const h = Number(hStr ?? "0");
  const m = Number(mStr ?? "0");
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const total = h * 60 + m;
  return total > 0 ? total : 0;
}

function toDisplay(totalMinutes: number | null | undefined): string {
  if (!totalMinutes || totalMinutes <= 0) return "";
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// --- Helpers for callers converting to/from db units -----------------------

/** Decimal hours <-> total minutes (for tasks.estimated_hours). */
export function hoursToMinutes(hours: number | null | undefined): number | null {
  if (hours === null || hours === undefined) return null;
  return Math.round(hours * 60);
}

export function minutesToHours(minutes: number | null | undefined): number | null {
  if (minutes === null || minutes === undefined) return null;
  return Number((minutes / 60).toFixed(2));
}
