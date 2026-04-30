import { useMemo } from "react";
import { Loader2, Clock, TrendingUp, CheckSquare, Sparkles } from "lucide-react";
import { useProject, useTasksByProject, useTaskLists } from "@/lib/hooks";
import { computeHourlyBreakdown, formatMoney, type Currency } from "@/lib/utils/pricing";
import type { Task } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";

/**
 * Project KPIs — 4 cards in a single row + per-list progress bars below.
 * The KPIs derive from tasks (estimated + actual) and project pricing.
 *
 *  - ביצוע זמן %: actual / estimated  ·  green ≤100%, red >100%
 *  - רווח שעתי ₪: effective hourly rate (rate × (1 + profit%))
 *  - משימות שהושלמו: done / total
 *  - שעות שנחסכו: Σ max(0, est-actual) on completed tasks
 *
 * Per-list section breaks down tasks by `task_list_id` so the user sees
 * which areas of the project (e.g. "מחקר משתמשים", "עיצוב UI") are
 * progressing. Each list shows actual-vs-estimated hours and a status pill.
 */
export function StatsBlock({ scopeId }: { scopeId?: string | null }) {
  const projectId = scopeId ?? null;
  const { data: project } = useProject(projectId);
  const { data: tasks = [], isLoading } = useTasksByProject(projectId);
  const { data: allLists = [] } = useTaskLists();

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

  const listBreakdown = useMemo(
    () => groupByList(tasks, allLists),
    [tasks, allLists],
  );

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
    <div className="flex flex-col gap-3 h-full">
      {/* KPI row — 4 compact cards in a single line. On very narrow widgets
          (project page card sized w=4 in 12-cols ≈ 350px) this stacks to
          2x2 via the responsive grid breakpoints. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 shrink-0">
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
          sub="לפני הזמן"
          accent="primary"
        />
      </div>

      {/* Per-list progress section */}
      {listBreakdown.length > 0 && (
        <div className="flex-1 min-h-0 overflow-auto scrollbar-thin space-y-1.5 pe-1">
          {listBreakdown.map((row) => (
            <ListProgressRow key={row.key} row={row} />
          ))}
        </div>
      )}
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

interface ListRow {
  key: string;
  name: string;
  color: string | null;
  estimatedH: number;
  actualH: number;
  total: number;
  done: number;
}

function groupByList(
  tasks: Task[],
  allLists: { id: string; name: string; color: string | null }[],
): ListRow[] {
  const listById = new Map(allLists.map((l) => [l.id, l]));
  const buckets = new Map<string, ListRow>();
  const NONE_KEY = "__none__";

  const ensure = (key: string, name: string, color: string | null): ListRow => {
    let b = buckets.get(key);
    if (!b) {
      b = { key, name, color, estimatedH: 0, actualH: 0, total: 0, done: 0 };
      buckets.set(key, b);
    }
    return b;
  };

  for (const t of tasks) {
    const id = t.task_list_id;
    const list = id ? listById.get(id) : null;
    const bucket = id
      ? ensure(id, list?.name ?? "רשימה לא ידועה", list?.color ?? null)
      : ensure(NONE_KEY, "ללא רשימה", null);
    bucket.estimatedH += t.estimated_hours ?? 0;
    bucket.actualH += (t.actual_seconds ?? 0) / 3600;
    bucket.total += 1;
    if (t.status === "done" || !!t.completed_at) bucket.done += 1;
  }

  return [...buckets.values()].sort((a, b) => b.total - a.total);
}

function ListProgressRow({ row }: { row: ListRow }) {
  const pct = row.estimatedH > 0
    ? Math.min(100, Math.round((row.actualH / row.estimatedH) * 100))
    : 0;
  const status = row.done === row.total && row.total > 0
    ? "הושלמה"
    : row.actualH > 0
    ? "בפעיל"
    : "טרם החל";
  const statusClass = status === "הושלמה"
    ? "text-success-700"
    : status === "בפעיל"
    ? "text-primary-700"
    : "text-ink-500";
  const fillClass = status === "הושלמה"
    ? "bg-success-500"
    : "bg-gradient-to-r from-primary-400 to-primary-600";

  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-0.5">
        <span className="font-medium text-ink-800 truncate" title={row.name}>
          {row.name}
        </span>
        <span className={cn("shrink-0 ms-1", statusClass)}>{status}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-ink-100 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", fillClass)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] text-ink-500 tabular-nums shrink-0">
          {row.actualH.toFixed(0)}ש׳ / {row.estimatedH.toFixed(0)}ש׳
        </span>
      </div>
    </div>
  );
}
