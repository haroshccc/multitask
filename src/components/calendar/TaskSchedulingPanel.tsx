import { useMemo } from "react";
import { Clock, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Task, TaskList } from "@/lib/types/domain";
import type { CalendarItem } from "./calendar-utils";
import {
  type ItemDropHandler,
  beginDrag,
  endDrag,
  startPointerMove,
} from "./calendar-drag";

/**
 * Scheduling mode side-panel. Lists tasks from one or more chosen task lists
 * (stacked) and lets the user drag a task onto the calendar grid to schedule
 * it. Already-scheduled tasks stay visible but dimmed so the unscheduled ones
 * stand out. A drag carries a synthetic `isUnscheduledDraft` CalendarItem, so
 * the calendar's existing drop targets (mouse) and startPointerMove (touch /
 * pen) both route through the page's onItemDrop, which schedules the task.
 */
export function TaskSchedulingPanel({
  tasks,
  taskLists,
  hiddenListIds,
  onItemDrop,
  onOpenTask,
  onContextMenu,
  onClose,
}: {
  tasks: Task[];
  taskLists: TaskList[];
  /** Lists hidden from the calendar — the panel mirrors the SAME visibility,
   *  so it shows exactly the lists currently displayed on the calendar.
   *  Visibility is changed from the calendar's "רשימות" toolbar control. */
  hiddenListIds: Set<string>;
  onItemDrop: ItemDropHandler;
  /** Double-click a task → open it for editing. */
  onOpenTask: (taskId: string) => void;
  /** Right-click a task → open the actions menu at the cursor. */
  onContextMenu: (task: Task, x: number, y: number) => void;
  onClose: () => void;
}) {
  // Schedulable tasks: open (not completed) and not phases (phases are
  // background bands, not time blocks), grouped by their list.
  const tasksByList = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) {
      if (t.completed_at || t.is_phase) continue;
      const key = t.task_list_id ?? "";
      const arr = m.get(key) ?? [];
      arr.push(t);
      m.set(key, arr);
    }
    return m;
  }, [tasks]);

  // Visible (= not hidden from the calendar) lists, in list order.
  const visibleLists = taskLists.filter((l) => !hiddenListIds.has(l.id));

  return (
    <aside className="w-72 shrink-0 card overflow-hidden flex flex-col max-h-[calc(100vh-220px)]">
      <header className="px-3 py-2 border-b border-ink-200 flex items-center justify-between bg-ink-50/60">
        <span className="text-sm font-semibold text-ink-900">שיבוץ משימות</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-ink-500 hover:bg-ink-100"
          title="סגירה"
        >
          <X className="w-4 h-4" />
        </button>
      </header>

      {/* Stacked task lists — only the lists currently visible on the
          calendar (kept in sync via the toolbar's "רשימות" control). */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
        {visibleLists.length === 0 ? (
          <p className="text-xs text-ink-400 text-center py-6">
            כל הרשימות מוסתרות מהיומן. הציגי רשימה (למעלה או בסרגל היומן) כדי
            לגרור ממנה משימות.
          </p>
        ) : (
          visibleLists.map((list) => {
            const listTasks = tasksByList.get(list.id) ?? [];
            return (
              <section key={list.id}>
                <h4 className="flex items-center gap-1.5 px-1 mb-1 text-[11px] font-semibold text-ink-500">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: list.color ?? "#6b6b80" }}
                  />
                  <span className="truncate">{list.name}</span>
                  <span className="text-ink-300 font-normal">
                    ({listTasks.length})
                  </span>
                </h4>
                {listTasks.length === 0 ? (
                  <p className="text-[11px] text-ink-300 px-1 py-1">
                    אין משימות פתוחות
                  </p>
                ) : (
                  <div className="space-y-1">
                    {listTasks.map((t) => (
                      <PanelTaskItem
                        key={t.id}
                        task={t}
                        listColor={list.color ?? null}
                        onItemDrop={onItemDrop}
                        onOpenTask={onOpenTask}
                        onContextMenu={onContextMenu}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>
    </aside>
  );
}

function buildDraftItem(t: Task, listColor: string | null): CalendarItem {
  // start/end are placeholders; the drop only reads the task id + duration.
  // Keeping end = start + real duration lets the live hover-pill preview the
  // block the task will occupy (a single time when it has no duration).
  const start = new Date();
  const durMin = t.duration_minutes ?? 0;
  return {
    id: `task:${t.id}`,
    kind: "task",
    title: t.title,
    description: t.description ?? null,
    start,
    end: new Date(start.getTime() + durMin * 60_000),
    allDay: false,
    color: listColor,
    listId: t.task_list_id,
    completed: !!t.completed_at,
    source: t,
    isUnscheduledDraft: true,
  };
}

function formatDur(min: number): string {
  if (min < 60) return `${min}ד׳`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}ש׳` : `${h}:${String(m).padStart(2, "0")}`;
}

function PanelTaskItem({
  task,
  listColor,
  onItemDrop,
  onOpenTask,
  onContextMenu,
}: {
  task: Task;
  listColor: string | null;
  onItemDrop: ItemDropHandler;
  onOpenTask: (taskId: string) => void;
  onContextMenu: (task: Task, x: number, y: number) => void;
}) {
  const draft = useMemo(
    () => buildDraftItem(task, listColor),
    [task, listColor]
  );
  const scheduled = !!task.scheduled_at;

  return (
    <div
      draggable
      onDragStart={(e) => {
        beginDrag(draft, 0, "move");
        e.dataTransfer.effectAllowed = "move";
        try {
          e.dataTransfer.setData("text/plain", task.id);
        } catch {
          /* ignore */
        }
      }}
      onDragEnd={() => endDrag()}
      onDoubleClick={() => onOpenTask(task.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(task, e.clientX, e.clientY);
      }}
      onPointerDown={(e) => {
        if (e.pointerType === "mouse") return;
        startPointerMove(draft, e, 0, { onItemDrop });
      }}
      style={{ touchAction: "none" }}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs border bg-white",
        "cursor-grab active:cursor-grabbing hover:bg-ink-50 border-ink-150",
        scheduled && "opacity-45"
      )}
      title={
        scheduled
          ? "כבר משובצת — אפשר לגרור לזמן אחר"
          : "גררי אל היומן כדי לשבץ"
      }
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: listColor ?? "#6b6b80" }}
      />
      <span className="truncate flex-1 text-ink-800">
        {task.title || "ללא כותרת"}
      </span>
      {task.duration_minutes ? (
        <span className="text-[10px] text-ink-400 tabular-nums shrink-0">
          {formatDur(task.duration_minutes)}
        </span>
      ) : null}
      {scheduled && <Clock className="w-3 h-3 text-ink-300 shrink-0" />}
    </div>
  );
}
