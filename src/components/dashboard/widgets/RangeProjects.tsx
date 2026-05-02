import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase } from "lucide-react";
import { useProjects } from "@/lib/hooks/useProjects";
import { useTasks } from "@/lib/hooks/useTasks";
import { useTaskLists } from "@/lib/hooks/useTaskLists";

/**
 * Active projects (status='active') with a small progress bar based on
 * completed-vs-total tasks attached to that project (via task_lists).
 */
export function RangeProjects() {
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const { data: lists = [] } = useTaskLists();
  const navigate = useNavigate();

  const rows = useMemo(() => {
    const active = projects.filter((p) => p.status === "active");

    // task → list → project. Build the list→project map first.
    const listToProject = new Map<string, string>();
    for (const l of lists) {
      if (l.project_id) listToProject.set(l.id, l.project_id);
    }

    const projectTaskTotal = new Map<string, number>();
    const projectTaskDone = new Map<string, number>();
    for (const t of tasks) {
      const pid = t.task_list_id ? listToProject.get(t.task_list_id) : null;
      if (!pid) continue;
      projectTaskTotal.set(pid, (projectTaskTotal.get(pid) ?? 0) + 1);
      if (t.completed_at) {
        projectTaskDone.set(pid, (projectTaskDone.get(pid) ?? 0) + 1);
      }
    }

    return active
      .map((p) => {
        const total = projectTaskTotal.get(p.id) ?? 0;
        const done = projectTaskDone.get(p.id) ?? 0;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        return { project: p, total, done, pct };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [projects, tasks, lists]);

  return (
    <div className="card p-3 h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 mb-2 shrink-0">
        <Briefcase className="w-4 h-4 text-primary-600" />
        <h3 className="text-sm font-semibold text-ink-900">פרויקטים פעילים</h3>
        <span className="ms-auto text-[10px] text-ink-500 tabular-nums">
          {rows.length}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto space-y-2 pe-1 scrollbar-thin">
        {rows.length === 0 ? (
          <p className="text-center text-xs text-ink-500 py-4">
            אין פרויקטים פעילים
          </p>
        ) : (
          rows.map(({ project, total, done, pct }) => (
            <button
              key={project.id}
              type="button"
              onClick={() => navigate(`/app/projects/${project.id}`)}
              className="w-full text-start rounded-lg border border-ink-200 bg-white p-2 hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
            >
              <div className="flex items-baseline gap-2 mb-1">
                <span className="flex-1 min-w-0 truncate text-xs font-semibold text-ink-900">
                  {project.name}
                </span>
                <span className="text-[10px] tabular-nums text-ink-500 shrink-0">
                  {done}/{total}
                </span>
              </div>
              <div className="h-1 rounded-full bg-ink-100 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
