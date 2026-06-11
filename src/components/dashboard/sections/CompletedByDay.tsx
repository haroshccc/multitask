import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useTasks } from "@/lib/hooks/useTasks";
import { SectionCard, CountBadge } from "./SectionCard";
import type { Task } from "@/lib/types/domain";

// =============================================================================
// Weekly review — what actually got done, day by day: a 7-column mini
// chart (Sun→Sat) on top, then the completed tasks grouped per day.
// =============================================================================

interface CompletedByDayProps {
  weekFrom: Date;
  weekTo: Date;
}

const HE_DAY_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

export function CompletedByDay({ weekFrom, weekTo }: CompletedByDayProps) {
  const navigate = useNavigate();
  const { data: tasks = [] } = useTasks();

  const { byDay, total } = useMemo(() => {
    const fromMs = weekFrom.getTime();
    const toMs = weekTo.getTime();
    const byDay: Task[][] = Array.from({ length: 7 }, () => []);
    let total = 0;
    for (const t of tasks) {
      if (!t.completed_at) continue;
      const ms = new Date(t.completed_at).getTime();
      if (isNaN(ms) || ms < fromMs || ms >= toMs) continue;
      const dayIdx = Math.min(
        6,
        Math.floor((ms - fromMs) / (24 * 60 * 60 * 1000)),
      );
      byDay[dayIdx].push(t);
      total += 1;
    }
    for (const list of byDay) {
      list.sort(
        (a, b) =>
          new Date(a.completed_at!).getTime() -
          new Date(b.completed_at!).getTime(),
      );
    }
    return { byDay, total };
  }, [tasks, weekFrom, weekTo]);

  const maxPerDay = Math.max(1, ...byDay.map((d) => d.length));

  return (
    <SectionCard
      icon={<CheckSquare className="w-4 h-4" />}
      title="מה בוצע השבוע"
      badge={<CountBadge count={total} />}
    >
      {total === 0 ? (
        <p className="text-xs text-ink-500 py-4 text-center">
          לא סומנו משימות כבוצעו בשבוע הזה.
        </p>
      ) : (
        <>
          {/* Mini bar chart — one column per day. */}
          <div
            className="grid grid-cols-7 gap-1.5 items-end h-16 mb-3"
            aria-hidden="true"
          >
            {byDay.map((list, i) => (
              <div key={i} className="flex flex-col items-center gap-1 h-full justify-end">
                {list.length > 0 && (
                  <span className="text-[9px] tabular-nums text-ink-500">
                    {list.length}
                  </span>
                )}
                <div
                  className={cn(
                    "w-full rounded-t-sm",
                    list.length > 0 ? "bg-success-400" : "bg-ink-100",
                  )}
                  style={{
                    height: `${Math.max(8, (list.length / maxPerDay) * 100)}%`,
                  }}
                />
                <span className="text-[9px] text-ink-500">
                  {HE_DAY_SHORT[i]}
                </span>
              </div>
            ))}
          </div>

          {/* Per-day task lists (skip empty days). */}
          <div className="space-y-2 max-h-72 overflow-y-auto pe-1 scrollbar-thin">
            {byDay.map((list, i) =>
              list.length === 0 ? null : (
                <div key={i}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-500 mb-1">
                    יום {HE_DAY_SHORT[i]}
                  </div>
                  <ul className="space-y-1">
                    {list.map((t) => (
                      <li key={t.id}>
                        <button
                          type="button"
                          onClick={() => navigate(`/app/tasks?edit=${t.id}`)}
                          className="w-full flex items-center gap-2 rounded-md px-2 py-1 text-start hover:bg-ink-50 transition-colors"
                        >
                          <CheckSquare
                            className="w-3 h-3 text-success-500 shrink-0"
                            aria-hidden="true"
                          />
                          <span className="flex-1 min-w-0 truncate text-xs text-ink-700">
                            {t.title?.trim() || "ללא כותרת"}
                          </span>
                          <span className="shrink-0 font-mono tabular-nums text-[10px] text-ink-400">
                            {new Date(t.completed_at!).toLocaleTimeString(
                              "he-IL",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )}
          </div>
        </>
      )}
    </SectionCard>
  );
}
