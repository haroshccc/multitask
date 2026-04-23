import { useMemo } from "react";
import { ChevronUp, ChevronDown, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useTimeUnit, formatSeconds } from "@/lib/hooks/useTimeUnit";
import type { Task, TaskList } from "@/lib/types/domain";
import { ListIcon } from "./list-icons";

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
 * Wide, short stats strip that sits above the FilterBar. Each list shows up
 * as a slim row: name → percent → counts → time. Toggle collapses it to a
 * single header line.
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
        (s, t) => s + Number(t.estimated_hours ?? 0) * 3600,
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
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-ink-50"
        title={open ? "סגור סטטיסטיקות" : "פתח סטטיסטיקות"}
      >
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-700">
          <BarChart3 className="w-3.5 h-3.5" />
          סטטיסטיקות
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-ink-500" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-ink-500" />
        )}
      </button>
      {open && (
        <div className="overflow-x-auto scrollbar-thin border-t border-ink-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-ink-400 bg-ink-50/60">
                <th className="text-start font-medium px-3 py-1.5">רשימה</th>
                <th className="font-medium px-2 py-1.5 w-28">התקדמות</th>
                <th className="font-medium px-2 py-1.5 w-16">פתוחות</th>
                <th className="font-medium px-2 py-1.5 w-16">הושלמו</th>
                <th className="font-medium px-2 py-1.5 w-24">בפועל</th>
                <th className="font-medium px-2 py-1.5 w-24">הוקצה</th>
                <th className="font-medium px-2 py-1.5 w-24">פער</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <ListStatsRow
                  key={s.listId ?? UNASSIGNED_KEY}
                  stats={s}
                  timeUnit={timeUnit}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
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
  const color = list?.color ?? "#a8a8bc";
  const label = list?.name ?? "לא משויכות";
  const overBudget = stats.estimatedSeconds > 0 && stats.actualSeconds > stats.estimatedSeconds;
  const delta = stats.actualSeconds - stats.estimatedSeconds;

  return (
    <tr className="border-t border-ink-100 hover:bg-ink-50/50">
      <td className="px-3 py-1.5">
        <span className="inline-flex items-center gap-1.5 text-ink-900">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          {list?.emoji && (
            <span className="text-ink-700 leading-none">
              <ListIcon emoji={list.emoji} className="w-3.5 h-3.5" />
            </span>
          )}
          <span className="font-medium truncate">{label}</span>
        </span>
      </td>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-1.5 rounded-full bg-ink-100 overflow-hidden min-w-[40px]">
            <div
              className="h-full"
              style={{ width: `${stats.pct}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-ink-600 font-mono tabular-nums text-[10px] w-7 text-end">
            {stats.pct}%
          </span>
        </div>
      </td>
      <td className="px-2 py-1.5 text-center text-ink-700 font-mono tabular-nums">
        {stats.open}
      </td>
      <td className="px-2 py-1.5 text-center text-ink-700 font-mono tabular-nums">
        {stats.done}
      </td>
      <td className="px-2 py-1.5 text-center text-ink-700 font-mono tabular-nums">
        {stats.actualSeconds > 0
          ? formatSeconds(stats.actualSeconds, timeUnit)
          : "—"}
      </td>
      <td className="px-2 py-1.5 text-center text-ink-700 font-mono tabular-nums">
        {stats.estimatedSeconds > 0
          ? formatSeconds(stats.estimatedSeconds, timeUnit)
          : "—"}
      </td>
      <td className="px-2 py-1.5 text-center">
        {stats.estimatedSeconds === 0 ? (
          <span className="text-ink-400">—</span>
        ) : (
          <span
            className={cn(
              "inline-block rounded-md px-1.5 py-0.5 font-mono tabular-nums text-[10px]",
              overBudget
                ? "bg-danger/10 text-danger-600"
                : "bg-success/10 text-success-600"
            )}
          >
            {overBudget
              ? `+${formatSeconds(delta, timeUnit)}`
              : formatSeconds(-delta, timeUnit)}
          </span>
        )}
      </td>
    </tr>
  );
}
