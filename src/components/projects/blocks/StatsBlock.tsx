import { useMemo } from "react";
import { Loader2, Clock, TrendingUp, CheckSquare, Sparkles } from "lucide-react";
import { useProject, useTasksByProject } from "@/lib/hooks";
import { computeHourlyBreakdown, formatMoney, type Currency } from "@/lib/utils/pricing";

/**
 * Project KPIs — derived from tasks (estimated + actual) and project pricing.
 *
 *  - ביצוע זמן %: actual / estimated  ·  green ≤100%, red >100%
 *  - רווח שעתי ₪: effective hourly rate (rate × (1 + profit%))
 *  - משימות שהושלמו: done / total
 *  - שעות שנחסכו: Σ max(0, est-actual) on completed tasks
 */
export function StatsBlock({ scopeId }: { scopeId?: string | null }) {
  const projectId = scopeId ?? null;
  const { data: project } = useProject(projectId);
  const { data: tasks = [], isLoading } = useTasksByProject(projectId);

  const stats = useMemo(() => {
    let estimatedH = 0;
    let actualSec = 0;
    let doneCount = 0;
    let savedH = 0;
    for (const t of tasks) {
      const est = t.estimated_hours ?? 0;
      const act = (t.actual_seconds ?? 0) / 3600;
      estimatedH += est;
      actualSec += t.actual_seconds ?? 0;
      const isDone = t.status === "done" || !!t.completed_at;
      if (isDone) {
        doneCount += 1;
        if (est > 0 && act < est) savedH += est - act;
      }
    }
    const actualH = actualSec / 3600;
    const timePct = estimatedH > 0 ? (actualH / estimatedH) * 100 : 0;
    return {
      estimatedH,
      actualH,
      timePct,
      doneCount,
      totalCount: tasks.length,
      savedH,
    };
  }, [tasks]);

  if (!project || isLoading) {
    return (
      <div className="text-xs text-ink-500 text-center py-6">
        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
      </div>
    );
  }

  const currency: Currency = (project.currency as Currency) ?? "ILS";
  const hourlyBreakdown =
    project.pricing_mode === "hourly" && project.hourly_rate_cents
      ? computeHourlyBreakdown({
          hourlyRateCents: project.hourly_rate_cents,
          profitPercentage: project.profit_percentage ?? 0,
          spareMode:
            (project.spare_mode as "percent" | "hours" | null) ?? "percent",
          spareValue: 0,
          vatPercentage: 0,
        })
      : null;

  const donePct =
    stats.totalCount > 0
      ? Math.round((stats.doneCount / stats.totalCount) * 100)
      : 0;
  const timePctRounded = Math.round(stats.timePct);
  const timeOver = stats.timePct > 100;

  return (
    <div className="grid grid-cols-2 gap-2 h-full">
      <Kpi
        icon={<Clock className="w-3.5 h-3.5" />}
        label="ביצוע זמן %"
        value={`${timePctRounded}%`}
        sub={
          stats.estimatedH > 0
            ? `${stats.actualH.toFixed(1)} / ${stats.estimatedH.toFixed(1)} ש`
            : "אין הערכה"
        }
        accent={timeOver ? "danger" : "success"}
      />
      <Kpi
        icon={<TrendingUp className="w-3.5 h-3.5" />}
        label="רווח שעתי"
        value={
          hourlyBreakdown
            ? formatMoney(hourlyBreakdown.subtotalCents, currency)
            : "—"
        }
        sub={hourlyBreakdown ? "ללקוח לשעה" : "מצב לא-שעתי"}
        accent="primary"
      />
      <Kpi
        icon={<CheckSquare className="w-3.5 h-3.5" />}
        label="משימות הושלמו"
        value={`${stats.doneCount}/${stats.totalCount}`}
        sub={`${donePct}% הושלמו`}
        accent="success"
      />
      <Kpi
        icon={<Sparkles className="w-3.5 h-3.5" />}
        label="שעות שנחסכו"
        value={`${stats.savedH.toFixed(1)} ש`}
        sub="במשימות שנגמרו לפני הזמן"
        accent="primary"
      />
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  accent: "primary" | "success" | "danger";
}) {
  const accentClass =
    accent === "danger"
      ? "text-danger"
      : accent === "success"
      ? "text-success"
      : "text-primary-600";
  return (
    <div className="rounded-md border border-ink-200 bg-white p-2.5 flex flex-col">
      <div className={"inline-flex items-center gap-1 text-[10px] " + accentClass}>
        {icon}
        <span className="font-medium">{label}</span>
      </div>
      <div className="text-lg font-bold text-ink-900 mt-0.5 tabular-nums leading-tight">
        {value}
      </div>
      <div className="text-[10px] text-ink-400 mt-auto">{sub}</div>
    </div>
  );
}
