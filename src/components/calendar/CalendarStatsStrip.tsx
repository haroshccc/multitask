import { useMemo } from "react";
import { cn } from "@/lib/utils/cn";
import type { EventRow, Task, TimeEntry } from "@/lib/types/domain";
import { endOfWeek, startOfWeek } from "./calendar-utils";

interface Props {
  tasks: Task[];
  events: EventRow[];
  timeEntries: TimeEntry[];
  anchor: Date;
  className?: string;
}

/**
 * Summary strip above the calendar — counts the week around `anchor`.
 * Lightweight stand-in for the §12.1 DashboardGrid pass (see changelog).
 */
export function CalendarStatsStrip({
  tasks,
  events,
  timeEntries,
  anchor,
  className,
}: Props) {
  const stats = useMemo(() => {
    const weekStart = startOfWeek(anchor);
    const weekEnd = endOfWeek(anchor);
    const now = new Date();

    let hoursTracked = 0;
    for (const te of timeEntries) {
      const start = new Date(te.started_at);
      const end = te.ended_at ? new Date(te.ended_at) : now;
      if (end < weekStart || start > weekEnd) continue;
      const clampedStart = start < weekStart ? weekStart : start;
      const clampedEnd = end > weekEnd ? weekEnd : end;
      const ms = Math.max(0, clampedEnd.getTime() - clampedStart.getTime());
      hoursTracked += ms / 3_600_000;
    }

    const weekEvents = events.filter((e) => {
      const s = new Date(e.starts_at);
      return s >= weekStart && s <= weekEnd;
    }).length;

    const weekTasksScheduled = tasks.filter((t) => {
      if (!t.scheduled_at) return false;
      const s = new Date(t.scheduled_at);
      return s >= weekStart && s <= weekEnd;
    });
    const completedThisWeek = weekTasksScheduled.filter(
      (t) => t.completed_at
    ).length;
    const overdue = weekTasksScheduled.filter((t) => {
      if (t.completed_at) return false;
      if (!t.scheduled_at || !t.duration_minutes) {
        // No timing info → overdue if the day has passed.
        return !!t.scheduled_at && new Date(t.scheduled_at) < now;
      }
      const end = new Date(
        new Date(t.scheduled_at).getTime() + t.duration_minutes * 60_000
      );
      return end < now;
    }).length;

    return {
      hoursTracked: hoursTracked.toFixed(1),
      weekEvents,
      completedThisWeek,
      overdue,
    };
  }, [tasks, events, timeEntries, anchor]);

  return (
    <div
      className={cn(
        "card px-3 py-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs",
        className
      )}
    >
      <Cell label="שעות עבודה השבוע" value={`${stats.hoursTracked}h`} tone="accent" />
      <Cell label="אירועים השבוע" value={String(stats.weekEvents)} />
      <Cell label="משימות הושלמו" value={String(stats.completedThisWeek)} tone="success" />
      <Cell
        label="משימות באיחור"
        value={String(stats.overdue)}
        tone={stats.overdue > 0 ? "danger" : undefined}
      />
    </div>
  );
}

function Cell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "accent" | "success" | "danger";
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-ink-500 uppercase tracking-wider">
        {label}
      </span>
      <span
        className={cn(
          "text-base font-semibold tabular-nums",
          tone === "accent" && "text-primary-600",
          tone === "success" && "text-success-600",
          tone === "danger" && "text-danger-600",
          !tone && "text-ink-900"
        )}
      >
        {value}
      </span>
    </div>
  );
}
