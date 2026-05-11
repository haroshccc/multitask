import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type DurationUnit = "hhmm" | "days";

/**
 * Masked HH:MM duration input with optional unit toggle (שע / ימ).
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
  /** Show a toggle button to switch between HH:MM and days modes */
  showUnitToggle?: boolean;
}

export function DurationInput({
  value,
  onChange,
  className,
  placeholder = "00:00",
  disabled,
  ariaLabel,
  showUnitToggle = false,
}: DurationInputProps) {
  const [unit, setUnit] = useState<DurationUnit>("hhmm");
  const [draft, setDraft] = useState<string>(toDisplay(value, unit));
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  // Re-sync on external value change (avoid clobbering while user is typing).
  useEffect(() => {
    if (!focused) setDraft(toDisplay(value, unit));
  }, [value, focused, unit]);

  const commit = () => {
    const next = parseDraft(draft, unit);
    onChange(next);
    setDraft(toDisplay(next, unit));
  };

  const toggleUnit = () => {
    const committed = parseDraft(draft, unit);
    onChange(committed);
    const next: DurationUnit = unit === "hhmm" ? "days" : "hhmm";
    setUnit(next);
    setDraft(toDisplay(committed ?? value, next));
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
        onChange={(e) =>
          setDraft(
            unit === "hhmm"
              ? formatWhileTyping(e.target.value)
              : e.target.value.replace(/[^\d.]/g, "")
          )
        }
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
            ref.current?.blur();
          }
        }}
        placeholder={unit === "hhmm" ? placeholder : "0"}
        className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm font-mono tabular-nums text-end"
        dir="ltr"
      />
      {showUnitToggle && (
        <button
          type="button"
          onClick={toggleUnit}
          disabled={disabled}
          title={unit === "hhmm" ? "עבור לימים" : "עבור לשעות:דקות"}
          className="shrink-0 text-[10px] font-semibold text-ink-500 hover:text-primary-600 border border-ink-200 hover:border-primary-400 rounded px-1.5 py-0.5 leading-none transition-colors"
        >
          {unit === "hhmm" ? "שע" : "ימ"}
        </button>
      )}
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

function parseDraft(s: string, unit: DurationUnit): number | null {
  if (unit === "days") {
    const trimmed = s.trim();
    if (!trimmed) return null;
    const days = Number(trimmed);
    if (Number.isNaN(days) || days <= 0) return null;
    return Math.round(days * 1440);
  }
  return parseMask(s);
}

function toDisplay(totalMinutes: number | null | undefined, unit: DurationUnit): string {
  if (!totalMinutes || totalMinutes <= 0) return "";
  if (unit === "days") {
    const days = totalMinutes / 1440;
    return days % 1 === 0 ? String(days) : parseFloat(days.toFixed(2)).toString();
  }
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
