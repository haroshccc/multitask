import { cn } from "@/lib/utils/cn";
import { AlertTriangle } from "lucide-react";

interface Props {
  /** Estimated work in seconds. If null/0, no plan → just show actual time. */
  estimatedSeconds: number | null | undefined;
  /** Accumulated actual work in seconds. */
  actualSeconds: number;
  className?: string;
  /** Compact mode (one line, smaller text). */
  compact?: boolean;
}

/**
 * Progress bar showing actual-vs-estimated work time. Fills with the brand
 * gradient up to 100%; anything beyond 100% (overage) renders in danger-red
 * and is appended as a right-side bleed. Percentage label on the right.
 *
 * Used in:
 *   - `TaskEditModal` Time tab (full bar).
 *   - Inline row stopper in the tasks columns (compact version).
 */
export function PlanVsActualBar({
  estimatedSeconds,
  actualSeconds,
  className,
  compact = false,
}: Props) {
  const hasPlan = !!estimatedSeconds && estimatedSeconds > 0;

  // Clamp the visible fill to 100%; overage renders separately on the right.
  const pct = hasPlan ? (actualSeconds / estimatedSeconds!) * 100 : 0;
  const underPct = Math.min(100, pct);
  const overPct = Math.max(0, pct - 100);

  const label = hasPlan
    ? `${Math.round(pct)}%`
    : actualSeconds > 0
    ? "אין הערכה"
    : "—";

  const over = hasPlan && actualSeconds > estimatedSeconds!;
  const remaining = hasPlan
    ? Math.max(0, estimatedSeconds! - actualSeconds)
    : 0;

  return (
    <div className={cn("flex items-center gap-2", compact && "gap-1.5", className)}>
      {/* Bar */}
      <div
        className={cn(
          "relative flex-1 rounded-full bg-ink-100 overflow-hidden",
          compact ? "h-1.5" : "h-2.5"
        )}
        title={
          hasPlan
            ? `עבדת ${formatShort(actualSeconds)} מתוך ${formatShort(estimatedSeconds!)} (${label})`
            : `עבדת ${formatShort(actualSeconds)} (ללא הערכה)`
        }
      >
        <div
          className={cn(
            "h-full transition-all",
            over
              ? "bg-gradient-to-r from-primary-500 to-danger-500"
              : "bg-gradient-to-r from-primary-400 to-primary-600"
          )}
          style={{ width: `${underPct}%` }}
        />
        {overPct > 0 && (
          <div
            className="absolute inset-y-0 bg-danger-500/80"
            style={{
              insetInlineStart: "100%",
              width: `${Math.min(overPct, 30)}%`,
            }}
          />
        )}
      </div>

      {/* Label */}
      <div
        className={cn(
          "shrink-0 tabular-nums font-mono font-medium",
          compact ? "text-[10px]" : "text-xs",
          over ? "text-danger-600" : hasPlan ? "text-ink-700" : "text-ink-400"
        )}
      >
        {over && <AlertTriangle className={cn("inline w-3 h-3 -mt-0.5 me-0.5", compact && "w-2.5 h-2.5")} />}
        {label}
      </div>

      {/* Remaining / overage hint — only in full mode */}
      {!compact && hasPlan && (
        <div className="shrink-0 text-[10px] text-ink-500 tabular-nums">
          {over
            ? `חריגה של ${formatShort(actualSeconds - estimatedSeconds!)}`
            : `נותרו ${formatShort(remaining)}`}
        </div>
      )}
    </div>
  );
}

function formatShort(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}ש`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} דק׳`;
  const hours = minutes / 60;
  if (hours < 10) return `${hours.toFixed(1)} ש׳`;
  return `${Math.round(hours)} ש׳`;
}
