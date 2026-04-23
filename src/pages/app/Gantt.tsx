import { useMemo, useState } from "react";
import { addDays, differenceInDays, format, startOfDay } from "date-fns";
import { he } from "date-fns/locale";
import { BarChart3, Info, Loader2, ZoomIn, ZoomOut } from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { TaskDetailDrawer } from "@/components/tasks/TaskDetailDrawer";
import { useAuth } from "@/lib/auth/AuthContext";
import { useTasksInRange } from "@/lib/queries/tasks";
import { useAllDependencies } from "@/lib/queries/dependencies";
import type { Task } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";

type Zoom = "day" | "week" | "month";

const ZOOM_PIXELS: Record<Zoom, number> = {
  day: 50,
  week: 14,
  month: 6,
};

const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 28;
const BAR_OFFSET_Y = 8;
const BAR_HEIGHT = ROW_HEIGHT - 2 * BAR_OFFSET_Y;

interface BarLayout {
  taskId: string;
  rowIndex: number;
  startX: number;
  width: number;
  endX: number;
}

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
  const dependencies = useAllDependencies(activeOrganizationId);

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

  // Compute the critical path using a longest-path DAG algorithm with task
  // duration as edge weight. Only finish_to_start dependencies count for the
  // basic version — other relations would need a richer time model.
  const criticalSet = useMemo(
    () => computeCriticalPath(scheduledTasks, dependencies.data ?? []),
    [scheduledTasks, dependencies.data]
  );

  const layouts = useMemo<BarLayout[]>(() => {
    return scheduledTasks.map((task, rowIndex) => {
      const scheduled = new Date(task.scheduled_at!);
      const offsetDays = differenceInDays(scheduled, startDate);
      const durationDays = Math.max(
        1,
        Math.ceil((task.duration_minutes ?? 60) / (60 * 24))
      );
      const startX = offsetDays * pxPerDay;
      const width = durationDays * pxPerDay - 2;
      return {
        taskId: task.id,
        rowIndex,
        startX,
        width,
        endX: startX + width,
      };
    });
  }, [scheduledTasks, startDate, pxPerDay]);

  const layoutById = useMemo(() => {
    const map = new Map<string, BarLayout>();
    layouts.forEach((l) => map.set(l.taskId, l));
    return map;
  }, [layouts]);

  const arrows = useMemo(() => {
    const out: { from: BarLayout; to: BarLayout; critical: boolean }[] = [];
    for (const dep of dependencies.data ?? []) {
      if (dep.relation !== "finish_to_start") continue;
      const fromLayout = layoutById.get(dep.depends_on_task_id);
      const toLayout = layoutById.get(dep.task_id);
      if (!fromLayout || !toLayout) continue;
      const critical =
        criticalSet.has(dep.depends_on_task_id) && criticalSet.has(dep.task_id);
      out.push({ from: fromLayout, to: toLayout, critical });
    }
    return out;
  }, [dependencies.data, layoutById, criticalSet]);

  const totalRows = scheduledTasks.length;
  const svgHeight = HEADER_HEIGHT + totalRows * ROW_HEIGHT;

  return (
    <ScreenScaffold
      title="Gantt"
      subtitle="ציר זמן עם תלויות ו-Critical Path"
      actions={
        <div className="flex items-center gap-1">
          <button
            onClick={() =>
              setZoom(zoom === "day" ? "day" : zoom === "week" ? "day" : "week")
            }
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
            onClick={() =>
              setZoom(
                zoom === "month" ? "month" : zoom === "week" ? "month" : "week"
              )
            }
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
        <div className="text-xs text-ink-700 leading-relaxed">
          90 יום קדימה משבוע שעבר. חיצים בין ברים = תלויות
          <code className="font-mono mx-1">finish_to_start</code>. ברים אדומים
          על המסלול הקריטי. הוסיפי תלויות בפרטי המשימה (drawer).
        </div>
      </div>

      {tasks.isLoading ? (
        <div className="card p-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-ink-400" />
        </div>
      ) : scheduledTasks.length === 0 ? (
        <div className="card p-8 md:p-12 text-center">
          <BarChart3 className="w-10 h-10 text-ink-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-ink-900 mb-1">
            אין משימות מתוזמנות
          </h2>
          <p className="text-sm text-ink-600">
            כדי שמשימות יופיעו כאן, תקבעי להן מועד ב"פרטי משימה".
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-auto scrollbar-thin">
            <div
              className="relative"
              style={{ width: totalWidth, minWidth: "100%", height: svgHeight }}
            >
              {/* Header */}
              <div
                className="flex border-b border-ink-200 bg-ink-50 sticky top-0 z-10"
                style={{ width: totalWidth, height: HEADER_HEIGHT }}
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

              {/* SVG layer for arrows + bars */}
              <svg
                className="absolute pointer-events-none"
                style={{
                  top: HEADER_HEIGHT,
                  insetInlineStart: 0,
                  width: totalWidth,
                  height: totalRows * ROW_HEIGHT,
                }}
              >
                <defs>
                  <marker
                    id="arrow"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#6b6b80" />
                  </marker>
                  <marker
                    id="arrow-critical"
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
                  </marker>
                </defs>
                {arrows.map((a, i) => {
                  const fromX = a.from.endX;
                  const fromY = a.from.rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const toX = a.to.startX;
                  const toY = a.to.rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
                  // Right-angle path: out from end, down/up, into start
                  const midX = (fromX + toX) / 2;
                  const path = `M ${fromX} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toX} ${toY}`;
                  return (
                    <path
                      key={i}
                      d={path}
                      stroke={a.critical ? "#dc2626" : "#6b6b80"}
                      strokeWidth={a.critical ? 1.5 : 1}
                      fill="none"
                      markerEnd={a.critical ? "url(#arrow-critical)" : "url(#arrow)"}
                    />
                  );
                })}
              </svg>

              {/* Rows + bars */}
              <div style={{ position: "absolute", top: HEADER_HEIGHT, insetInlineStart: 0 }}>
                {scheduledTasks.map((task, i) => {
                  const layout = layouts[i]!;
                  const done = task.status === "done";
                  const critical = criticalSet.has(task.id);
                  return (
                    <div
                      key={task.id}
                      className="relative border-b border-ink-200"
                      style={{ height: ROW_HEIGHT, width: totalWidth }}
                    >
                      <button
                        onClick={() => setOpenTask(task)}
                        className={cn(
                          "absolute rounded-lg px-2 text-[11px] text-white truncate flex items-center shadow-soft hover:shadow transition-shadow",
                          done
                            ? "bg-ink-400"
                            : critical
                              ? "bg-gradient-to-r from-danger-500 to-danger-600"
                              : task.urgency >= 4
                                ? "bg-gradient-to-r from-danger-500/80 to-danger-600/80"
                                : "bg-gradient-to-r from-primary-500 to-primary-600"
                        )}
                        style={{
                          top: BAR_OFFSET_Y,
                          height: BAR_HEIGHT,
                          insetInlineStart: layout.startX,
                          width: layout.width,
                          maxWidth: totalWidth - layout.startX - 4,
                        }}
                        title={`${task.title}${critical ? " · קריטית" : ""}`}
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

// ============================================================ Critical Path

// Computes the set of task ids on the critical path of the given task subgraph
// and dependencies. Uses the classic "longest path on a DAG" approach with
// task duration (in minutes) as the node weight.
function computeCriticalPath(
  tasks: Task[],
  deps: { task_id: string; depends_on_task_id: string; relation: string }[]
): Set<string> {
  if (tasks.length === 0) return new Set();
  const ids = new Set(tasks.map((t) => t.id));
  // Filter to FS deps that connect tasks we have
  const relevantDeps = deps.filter(
    (d) =>
      d.relation === "finish_to_start" &&
      ids.has(d.task_id) &&
      ids.has(d.depends_on_task_id)
  );

  const duration = new Map<string, number>();
  for (const t of tasks) {
    duration.set(t.id, Math.max(1, t.duration_minutes ?? 60));
  }

  // Build adjacency: predecessors[task] = [tasks it depends on]
  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();
  for (const id of ids) {
    predecessors.set(id, []);
    successors.set(id, []);
  }
  for (const d of relevantDeps) {
    predecessors.get(d.task_id)!.push(d.depends_on_task_id);
    successors.get(d.depends_on_task_id)!.push(d.task_id);
  }

  // Topological sort
  const inDegree = new Map<string, number>();
  for (const id of ids) inDegree.set(id, predecessors.get(id)!.length);
  const queue: string[] = [];
  for (const [id, deg] of inDegree) if (deg === 0) queue.push(id);
  const topo: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    topo.push(node);
    for (const succ of successors.get(node)!) {
      inDegree.set(succ, inDegree.get(succ)! - 1);
      if (inDegree.get(succ) === 0) queue.push(succ);
    }
  }
  if (topo.length !== ids.size) return new Set(); // cycle — bail out

  // Longest path ending at each node
  const longest = new Map<string, number>();
  const cameFrom = new Map<string, string | null>();
  for (const id of topo) {
    let best = duration.get(id)!;
    let from: string | null = null;
    for (const pred of predecessors.get(id)!) {
      const candidate = longest.get(pred)! + duration.get(id)!;
      if (candidate > best) {
        best = candidate;
        from = pred;
      }
    }
    longest.set(id, best);
    cameFrom.set(id, from);
  }

  // Find max endpoint
  let maxNode: string | null = null;
  let maxLen = -Infinity;
  for (const [id, len] of longest) {
    if (len > maxLen) {
      maxLen = len;
      maxNode = id;
    }
  }
  if (!maxNode) return new Set();

  // Trace back
  const critical = new Set<string>();
  let cursor: string | null = maxNode;
  while (cursor) {
    critical.add(cursor);
    cursor = cameFrom.get(cursor) ?? null;
  }
  return critical;
}
