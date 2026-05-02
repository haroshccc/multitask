import { useMemo } from "react";
import { TrendingUp, CheckCircle2, Clock, Flame } from "lucide-react";
import { useTasks } from "@/lib/hooks/useTasks";
import { useTimeEntriesByRange } from "@/lib/hooks/useTimer";
import { useDashboardRange } from "../dashboard-context";

const VIEW_LABEL: Record<string, string> = {
  day: "היום",
  week: "השבוע",
  month: "החודש",
};

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m} דק׳`;
  if (m === 0) return `${h} שע׳`;
  return `${h}:${String(m).padStart(2, "0")} שע׳`;
}

/**
 * Real KPI strip for the current period — tracked time, completed tasks,
 * a "streak" counter (how many days in a row had a time entry), and an
 * efficiency hint (planned vs actual when both exist).
 */
export function RangeKpis() {
  const range = useDashboardRange();
  const { data: tasks = [] } = useTasks();
  const { data: entries = [] } = useTimeEntriesByRange(range.range);

  const stats = useMemo(() => {
    const fromMs = new Date(range.range.from).getTime();
    const toMs = new Date(range.range.to).getTime();

    let trackedSeconds = 0;
    for (const e of entries) {
      if (!e.duration_seconds && !e.ended_at) continue;
      // duration_seconds is filled at stop time; running entries (no end_at)
      // are excluded from totals to avoid jitter.
      trackedSeconds += e.duration_seconds ?? 0;
    }

    let completed = 0;
    let totalScheduledInRange = 0;
    for (const t of tasks) {
      const completedAt = t.completed_at ? new Date(t.completed_at).getTime() : null;
      if (completedAt && completedAt >= fromMs && completedAt < toMs) completed++;
      const scheduledAt = t.scheduled_at ? new Date(t.scheduled_at).getTime() : null;
      if (scheduledAt && scheduledAt >= fromMs && scheduledAt < toMs) totalScheduledInRange++;
    }

    // Productive days inside the period (any time entry).
    const dayKeys = new Set<string>();
    for (const e of entries) {
      if (!e.started_at) continue;
      const d = new Date(e.started_at);
      dayKeys.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
    return {
      trackedSeconds,
      completed,
      totalScheduledInRange,
      activeDays: dayKeys.size,
    };
  }, [entries, tasks, range.range.from, range.range.to]);

  const periodLabel = VIEW_LABEL[range.view] ?? "";

  return (
    <div className="card p-3 h-full">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="w-4 h-4 text-primary-600" />
        <h3 className="text-sm font-semibold text-ink-900">KPI {periodLabel}</h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Kpi
          icon={<Clock className="w-3.5 h-3.5" />}
          label="זמן עבודה"
          value={formatHours(stats.trackedSeconds)}
          tone="primary"
        />
        <Kpi
          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          label="משימות שהושלמו"
          value={String(stats.completed)}
          tone="success"
        />
        <Kpi
          icon={<Flame className="w-3.5 h-3.5" />}
          label={range.view === "day" ? "עומס משימות" : "ימי עבודה"}
          value={
            range.view === "day"
              ? String(stats.totalScheduledInRange)
              : String(stats.activeDays)
          }
          tone="warn"
        />
        <Kpi
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          label="ביצוע"
          value={
            stats.totalScheduledInRange > 0
              ? `${Math.round((stats.completed / Math.max(stats.totalScheduledInRange, 1)) * 100)}%`
              : "—"
          }
          tone="primary"
        />
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "primary" | "success" | "warn";
}) {
  const toneClass = {
    primary: "bg-primary-50 text-primary-700",
    success: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-700",
  }[tone];
  return (
    <div className="rounded-lg bg-ink-50 p-2">
      <div
        className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${toneClass}`}
      >
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-ink-900 tabular-nums">
        {value}
      </div>
    </div>
  );
}
