import { useMemo } from "react";
import { useTasksByProject } from "@/lib/hooks/useTasks";
import { formatMoney, type Currency } from "@/lib/utils/pricing";
import { cn } from "@/lib/utils/cn";
import type { Project } from "@/lib/types/domain";

/**
 * Always-open live stats for a project, shown in the header (next to the name)
 * on every project screen:
 *  - time worked so far (Σ actual_seconds)
 *  - hours remaining = Σ estimated_hours of tasks not yet checked done
 *  - the project price
 *  - expected profit/hour, using ACTUAL time for done tasks and ESTIMATED time
 *    for not-yet-done tasks (blended) — recomputes live from the task cache.
 */
export function ProjectStatsBanner({ project }: { project: Project }) {
  const { data: tasks = [] } = useTasksByProject(project.id);
  const currency = ((project.currency as Currency) ?? "ILS") as Currency;

  const m = useMemo(() => {
    let workedH = 0;
    let remainingEstH = 0;
    let blendedH = 0;
    for (const t of tasks) {
      if (t.is_phase) continue; // phases are roll-ups, not real work
      const done = !!t.completed_at;
      const actualH = (t.actual_seconds ?? 0) / 3600;
      const estH = t.estimated_hours ?? 0;
      workedH += actualH;
      if (!done) remainingEstH += estH;
      blendedH += done ? actualH : estH;
    }
    const priceCents = project.total_price_cents ?? 0;
    const profitPerHour = blendedH > 0 ? Math.round(priceCents / blendedH) : null;
    return { workedH, remainingEstH, priceCents, profitPerHour };
  }, [tasks, project.total_price_cents]);

  return (
    <div className="shrink-0 rounded-xl border border-ink-200 bg-white/80 shadow-soft px-3 py-2 grid grid-cols-2 gap-x-5 gap-y-1.5">
      <Stat label="עבדתי עד כה" value={`${round1(m.workedH)} ש׳`} />
      <Stat label="נותר (הערכה)" value={`${round1(m.remainingEstH)} ש׳`} />
      <Stat label="מחיר הפרויקט" value={formatMoney(m.priceCents, currency)} />
      <Stat
        label="רווח לשעה (צפוי)"
        value={m.profitPerHour == null ? "—" : formatMoney(m.profitPerHour, currency)}
        highlight
      />
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-[6.5rem]">
      <div className="text-[10px] text-ink-400 leading-tight">{label}</div>
      <div
        className={cn(
          "text-sm font-semibold tabular-nums",
          highlight ? "text-primary-700" : "text-ink-900"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
