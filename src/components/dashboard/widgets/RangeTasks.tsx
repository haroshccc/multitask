import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CheckSquare, Calendar as CalendarIcon, AlertCircle } from "lucide-react";
import { useTasks } from "@/lib/hooks/useTasks";
import { useTaskLists } from "@/lib/hooks/useTaskLists";
import { ListIcon } from "@/components/tasks/list-icons";
import { useDashboardRange } from "../dashboard-context";
import { cn } from "@/lib/utils/cn";
import type { Task, TaskList } from "@/lib/types/domain";

const VIEW_LABEL: Record<string, string> = {
  day: "להיום",
  week: "לשבוע",
  month: "לחודש",
};

interface RowProps {
  task: Task;
  listMap: Map<string, TaskList>;
  showTime?: boolean;
}

function TaskItem({ task, listMap, showTime }: RowProps) {
  const navigate = useNavigate();
  const list = task.task_list_id ? listMap.get(task.task_list_id) : undefined;
  const overdue =
    !!task.scheduled_at &&
    !task.completed_at &&
    new Date(task.scheduled_at).getTime() < Date.now();
  const time = task.scheduled_at
    ? new Date(task.scheduled_at).toLocaleTimeString("he-IL", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  return (
    <button
      type="button"
      onClick={() => navigate("/app/tasks")}
      className={cn(
        "w-full text-start rounded-lg border px-2.5 py-1.5 text-xs",
        "transition-colors",
        task.completed_at
          ? "border-ink-200 bg-ink-50 text-ink-500 line-through"
          : "border-ink-200 bg-white text-ink-800 hover:border-primary-300 hover:bg-primary-50/40",
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {showTime && time && (
          <span className="shrink-0 font-mono tabular-nums text-[10px] text-ink-500">
            {time}
          </span>
        )}
        <span className="flex-1 min-w-0 truncate font-medium">
          {task.title?.trim() || "ללא כותרת"}
        </span>
        {overdue && (
          <AlertCircle
            className="w-3 h-3 text-danger-600 shrink-0"
            aria-label="חרגה מתאריך יעד"
          />
        )}
        {list && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] text-ink-500">
            <ListIcon emoji={list.emoji} className="w-3 h-3" />
            <span className="truncate max-w-[80px]">{list.name}</span>
          </span>
        )}
      </div>
    </button>
  );
}

/**
 * Tasks relevant to the dashboard period — items due in range, scheduled
 * in range, or completed in range. Sorted: overdue first, then scheduled
 * (by time), then unscheduled, then completed last.
 */
export function RangeTasks() {
  const range = useDashboardRange();
  const { data: tasks = [] } = useTasks();
  const { data: lists = [] } = useTaskLists();

  const listMap = useMemo(
    () => new Map(lists.map((l) => [l.id, l] as const)),
    [lists],
  );

  const grouped = useMemo(() => {
    const fromMs = new Date(range.range.from).getTime();
    const toMs = new Date(range.range.to).getTime();
    const inRange = (iso: string | null | undefined) => {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return t >= fromMs && t < toMs;
    };

    const relevant: Task[] = tasks.filter(
      (t) =>
        inRange(t.scheduled_at) ||
        inRange(t.completed_at),
    );

    const overdue: Task[] = [];
    const scheduled: Task[] = [];
    const done: Task[] = [];
    for (const t of relevant) {
      if (t.completed_at) {
        done.push(t);
        continue;
      }
      if (t.scheduled_at && new Date(t.scheduled_at).getTime() < Date.now()) {
        overdue.push(t);
        continue;
      }
      scheduled.push(t);
    }
    scheduled.sort(
      (a, b) =>
        new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime(),
    );
    return { overdue, scheduled, done };
  }, [tasks, range.range.from, range.range.to]);

  const totalActive = grouped.overdue.length + grouped.scheduled.length;

  return (
    <div className="card p-3 h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <CheckSquare className="w-4 h-4 text-primary-600" />
        <h3 className="text-sm font-semibold text-ink-900">
          משימות {VIEW_LABEL[range.view]}
        </h3>
        <span className="ms-auto text-[10px] text-ink-500 tabular-nums">
          {totalActive} פעילות · {grouped.done.length} בוצעו
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto space-y-2 pe-1 scrollbar-thin">
        {totalActive === 0 && grouped.done.length === 0 ? (
          <p className="text-center text-xs text-ink-500 py-4">
            אין משימות בטווח הזה
          </p>
        ) : null}

        {grouped.overdue.length > 0 && (
          <Section title="באיחור" tone="danger">
            {grouped.overdue.map((t) => (
              <TaskItem key={t.id} task={t} listMap={listMap} />
            ))}
          </Section>
        )}

        {grouped.scheduled.length > 0 && (
          <Section
            title="מתוזמנות"
            icon={<CalendarIcon className="w-3 h-3" />}
          >
            {grouped.scheduled.map((t) => (
              <TaskItem key={t.id} task={t} listMap={listMap} showTime />
            ))}
          </Section>
        )}

        {grouped.done.length > 0 && (
          <Section title="בוצעו">
            {grouped.done.map((t) => (
              <TaskItem key={t.id} task={t} listMap={listMap} />
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  tone,
  icon,
  children,
}: {
  title: string;
  tone?: "danger";
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className={cn(
          "text-[10px] uppercase tracking-wider mb-1 inline-flex items-center gap-1",
          tone === "danger" ? "text-danger-600" : "text-ink-500",
        )}
      >
        {icon}
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
