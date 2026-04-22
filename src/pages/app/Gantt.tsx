import { useMemo, useState } from "react";
import { addDays, differenceInDays, format, startOfDay } from "date-fns";
import { he } from "date-fns/locale";
import { BarChart3, Info, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { TaskDetailDrawer } from "@/components/tasks/TaskDetailDrawer";
import { useAuth } from "@/lib/auth/AuthContext";
import { useTasksInRange } from "@/lib/queries/tasks";
import type { Task } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";

type Zoom = "day" | "week" | "month";

const ZOOM_PIXELS: Record<Zoom, number> = {
  day: 50,
  week: 14,
  month: 6,
};

export function Gantt() {
  const { activeOrganizationId } = useAuth();
  const [zoom, setZoom] = useState<Zoom>("week");
  const [openTask, setOpenTask] = useState<Task | null>(null);

  const { from, to, days } = useMemo(() => {
    const start = startOfDay(new Date());
    start.setDate(start.getDate() - 7);
    const end = addDays(start, 90);
    return {
      from: start.toISOString(),
      to: end.toISOString(),
      days: differenceInDays(end, start),
    };
  }, []);

  const tasks = useTasksInRange(activeOrganizationId, from, to);

  const pxPerDay = ZOOM_PIXELS[zoom];
  const totalWidth = days * pxPerDay;
  const startDate = useMemo(() => new Date(from), [from]);

  const scheduledTasks = useMemo(() => {
    return (tasks.data ?? [])
      .filter((t) => t.scheduled_at)
      .sort((a, b) => {
        const ad = new Date(a.scheduled_at!).getTime();
        const bd = new Date(b.scheduled_at!).getTime();
        return ad - bd;
      });
  }, [tasks.data]);

  return (
    <ScreenScaffold
      title="Gantt"
      subtitle="ציר זמן אופקי של משימות מתוזמנות"
      actions={
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(zoom === "day" ? "day" : zoom === "week" ? "day" : "week")}
            disabled={zoom === "day"}
            className="p-2 rounded-xl hover:bg-ink-100 disabled:opacity-40"
            aria-label="הגדלה"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <div className="text-xs text-ink-500 min-w-[64px] text-center">
            {zoom === "day" ? "יום" : zoom === "week" ? "שבוע" : "חודש"}
          </div>
          <button
            onClick={() => setZoom(zoom === "month" ? "month" : zoom === "week" ? "month" : "week")}
            disabled={zoom === "month"}
            className="p-2 rounded-xl hover:bg-ink-100 disabled:opacity-40"
            aria-label="הקטנה"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      }
    >
      <div className="card p-3 mb-3 flex items-start gap-3 bg-primary-50/40 border-primary-200">
        <Info className="w-4 h-4 text-primary-700 mt-0.5 shrink-0" />
        <p className="text-xs text-ink-700 leading-relaxed">
          תצוגה בסיסית — כל משימה מתוזמנת מוצגת כבר על הציר (90 יום קדימה
          משבוע שעבר). Critical Path וחיצי תלויות מגיעים בגל הבא. לחיצה על
          משימה פותחת עריכה.
        </p>
      </div>

      {tasks.isLoading ? (
        <div className="card p-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-ink-400" />
        </div>
      ) : scheduledTasks.length === 0 ? (
        <div className="card p-8 md:p-12 text-center">
          <BarChart3 className="w-10 h-10 text-ink-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-ink-900 mb-1">אין משימות מתוזמנות</h2>
          <p className="text-sm text-ink-600">
            כדי שמשימות יופיעו כאן, תקבעי להן מועד ב-"פרטי משימה" (לחיצה על
            משימה ברשימה).
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-auto scrollbar-thin">
            <div style={{ width: totalWidth, minWidth: "100%" }}>
              {/* Timeline header */}
              <div
                className="flex border-b border-ink-200 bg-ink-50 sticky top-0 z-10"
                style={{ width: totalWidth }}
              >
                {Array.from({ length: days }).map((_, i) => {
                  const d = addDays(startDate, i);
                  const isMonthStart = d.getDate() === 1;
                  const isWeekStart = d.getDay() === 0;
                  const showLabel =
                    zoom === "day" ||
                    (zoom === "week" && isWeekStart) ||
                    (zoom === "month" && isMonthStart);
                  return (
                    <div
                      key={i}
                      style={{ width: pxPerDay }}
                      className={cn(
                        "shrink-0 border-e border-ink-200 py-1 text-center",
                        isMonthStart && "bg-ink-100",
                        d.toDateString() === new Date().toDateString() && "bg-primary-100"
                      )}
                    >
                      {showLabel && (
                        <div className="text-[10px] text-ink-600 tabular-nums">
                          {zoom === "month"
                            ? format(d, "MMM", { locale: he })
                            : zoom === "week"
                              ? format(d, "d/M")
                              : format(d, "d")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Rows */}
              <div>
                {scheduledTasks.map((task) => {
                  const scheduled = new Date(task.scheduled_at!);
                  const offsetDays = differenceInDays(scheduled, startDate);
                  const durationDays = Math.max(
                    1,
                    Math.ceil((task.duration_minutes ?? 60) / (60 * 24))
                  );
                  const left = offsetDays * pxPerDay;
                  const width = durationDays * pxPerDay - 2;
                  const done = task.status === "done";

                  return (
                    <div
                      key={task.id}
                      className="relative h-10 border-b border-ink-200 hover:bg-ink-50"
                    >
                      <button
                        onClick={() => setOpenTask(task)}
                        className={cn(
                          "absolute top-1 bottom-1 rounded-lg px-2 text-[11px] text-white truncate flex items-center shadow-soft hover:shadow transition-shadow",
                          done
                            ? "bg-ink-400"
                            : task.urgency >= 4
                              ? "bg-gradient-to-r from-danger-500 to-danger-600"
                              : "bg-gradient-to-r from-primary-500 to-primary-600"
                        )}
                        style={{ left, width, maxWidth: totalWidth - left - 4 }}
                        title={task.title}
                      >
                        {task.title}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {openTask && (
        <TaskDetailDrawer task={openTask} onClose={() => setOpenTask(null)} />
      )}
    </ScreenScaffold>
  );
}
