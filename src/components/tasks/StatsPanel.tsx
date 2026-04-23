import { useMemo } from "react";
import { ChevronLeft, ChevronRight, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useTimeUnit, formatSeconds } from "@/lib/hooks/useTimeUnit";
import type { Task, TaskList } from "@/lib/types/domain";

interface StatsPanelProps {
  /** Visible task lists to compute stats for */
  lists: TaskList[];
  /** Tasks scoped to the visible lists (any list_id) */
  tasks: Task[];
  open: boolean;
  onToggle: () => void;
}

interface ListStats {
  listId: string | null;
  list: TaskList | null;
  open: number;
  done: number;
  total: number;
  pct: number;
  estimatedSeconds: number;
  actualSeconds: number;
}

const UNASSIGNED_KEY = "__unassigned__";

/**
 * Side panel with per-list metrics. Lives to the trailing edge of the
 * filter bar and toggles open/closed via a small handle.
 */
export function StatsPanel({ lists, tasks, open, onToggle }: StatsPanelProps) {
  const [timeUnit] = useTimeUnit();

  const stats: ListStats[] = useMemo(() => {
    const groups = new Map<string, Task[]>();
    for (const t of tasks) {
      const key = t.task_list_id ?? UNASSIGNED_KEY;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }

    const buildStats = (
      key: string,
      list: TaskList | null,
      arr: Task[]
    ): ListStats => {
      const done = arr.filter((t) => !!t.completed_at).length;
      const open = arr.length - done;
      const total = arr.length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;
      const estimatedSeconds = arr.reduce(
        (s, t) => s + (Number(t.estimated_hours ?? 0) * 3600),
        0
      );
      const actualSeconds = arr.reduce((s, t) => s + (t.actual_seconds ?? 0), 0);
      return {
        listId: key === UNASSIGNED_KEY ? null : key,
        list,
        open,
        done,
        total,
        pct,
        estimatedSeconds,
        actualSeconds,
      };
    };

    const out: ListStats[] = [];
    out.push(buildStats(UNASSIGNED_KEY, null, groups.get(UNASSIGNED_KEY) ?? []));
    for (const l of lists) {
      out.push(buildStats(l.id, l, groups.get(l.id) ?? []));
    }
    return out;
  }, [lists, tasks]);

  return (
    <aside
      className={cn(
        "card flex-shrink-0 transition-all overflow-hidden",
        open ? "w-72" : "w-10"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-2 py-2 border-b border-ink-200 hover:bg-ink-50"
        title={open ? "סגור סטטיסטיקות" : "פתח סטטיסטיקות"}
      >
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-700">
          <BarChart3 className="w-3.5 h-3.5" />
          {open && <span>סטטיסטיקות</span>}
        </span>
        {open ? (
          <ChevronRight className="w-3.5 h-3.5 text-ink-500" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5 text-ink-500" />
        )}
      </button>
      {open && (
        <div className="p-2 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-thin">
          {stats.map((s) => (
            <ListStatsRow key={s.listId ?? UNASSIGNED_KEY} stats={s} timeUnit={timeUnit} />
          ))}
        </div>
      )}
    </aside>
  );
}

function ListStatsRow({
  stats,
  timeUnit,
}: {
  stats: ListStats;
  timeUnit: ReturnType<typeof useTimeUnit>[0];
}) {
  const { list } = stats;
  const color = list?.color ?? null;
  const label = list?.name ?? "לא משויכות";
  const overBudget = stats.estimatedSeconds > 0 && stats.actualSeconds > stats.estimatedSeconds;
  return (
    <div
      className="rounded-xl border border-ink-200 bg-white p-2.5 space-y-1.5"
      style={
        color
          ? { borderInlineStartWidth: 3, borderInlineStartColor: color }
          : undefined
      }
    >
      <div className="flex items-center gap-1.5">
        {list?.emoji && <span className="text-sm">{list.emoji}</span>}
        <span className="text-xs font-semibold text-ink-900 truncate flex-1">{label}</span>
        <span className="text-[10px] text-ink-500 tabular-nums">{stats.pct}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
        <div
          className="h-full"
          style={{
            width: `${stats.pct}%`,
            backgroundColor: color ?? "#10b981",
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        <Stat label="פתוחות" value={stats.open} />
        <Stat label="הושלמו" value={stats.done} />
      </div>

      {(stats.estimatedSeconds > 0 || stats.actualSeconds > 0) && (
        <div className="text-[10px] text-ink-600 space-y-0.5 pt-1 border-t border-ink-100">
          <div className="flex items-center justify-between">
            <span>בפועל:</span>
            <span className="font-mono tabular-nums">
              {formatSeconds(stats.actualSeconds, timeUnit)}
            </span>
          </div>
          {stats.estimatedSeconds > 0 && (
            <>
              <div className="flex items-center justify-between">
                <span>מתוך:</span>
                <span className="font-mono tabular-nums">
                  {formatSeconds(stats.estimatedSeconds, timeUnit)}
                </span>
              </div>
              <div
                className={cn(
                  "text-[10px] text-center rounded-md px-1 py-0.5",
                  overBudget
                    ? "bg-danger/10 text-danger-600"
                    : "bg-success/10 text-success-600"
                )}
              >
                {overBudget
                  ? `חריגה ${formatSeconds(
                      stats.actualSeconds - stats.estimatedSeconds,
                      timeUnit
                    )}`
                  : `נותר ${formatSeconds(
                      stats.estimatedSeconds - stats.actualSeconds,
                      timeUnit
                    )}`}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-ink-50 px-1.5 py-1 text-center">
      <div className="text-ink-500">{label}</div>
      <div className="text-ink-900 font-semibold tabular-nums text-xs">{value}</div>
    </div>
  );
}
