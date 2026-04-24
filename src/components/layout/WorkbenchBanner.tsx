import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface WorkbenchBannerProps {
  /** Right side in RTL (visually); typically FilterBar. */
  filters: ReactNode;
  /** Left side in RTL (visually); typically StatsPanel / CalendarStatsStrip. */
  stats: ReactNode;
  className?: string;
}

/**
 * Shared banner used by Tasks and Calendar — a single wide card split in the
 * middle. Filters live on the leading edge (right in RTL), stats on the
 * trailing edge (left in RTL). On narrow screens the two stack vertically.
 *
 * Each child can manage its own collapse/expand state (the banner itself
 * doesn't collapse; the inner sections do).
 */
export function WorkbenchBanner({ filters, stats, className }: WorkbenchBannerProps) {
  return (
    <div
      className={cn(
        "card flex flex-col md:flex-row md:items-stretch divide-y md:divide-y-0 md:divide-s divide-ink-200",
        className
      )}
    >
      <div className="flex-1 min-w-0">{filters}</div>
      <div className="flex-1 min-w-0">{stats}</div>
    </div>
  );
}
