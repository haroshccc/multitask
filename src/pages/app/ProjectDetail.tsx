import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  Archive,
  ArchiveRestore,
  CheckSquare,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { TaskDetailDrawer } from "@/components/tasks/TaskDetailDrawer";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  useDeleteProject,
  useProject,
  useProjectTasks,
  useUpdateProject,
} from "@/lib/queries/projects";
import { useUpdateTaskStatus } from "@/lib/queries/tasks";
import { supabase } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { ProjectPricingMode, Task } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user, activeOrganizationId } = useAuth();

  const project = useProject(projectId ?? null);
  const tasks = useProjectTasks(projectId ?? null);
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const updateStatus = useUpdateTaskStatus();
  const qc = useQueryClient();

  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  if (project.isLoading) {
    return (
      <ScreenScaffold title="...">
        <div className="card p-12 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-ink-400" />
        </div>
      </ScreenScaffold>
    );
  }

  if (!project.data) {
    return (
      <ScreenScaffold title="לא נמצא">
        <div className="card p-8 text-center">
          <p className="text-ink-600 mb-4">הפרויקט לא נמצא או שאין לך הרשאה לצפות בו.</p>
          <button onClick={() => navigate("/app/projects")} className="btn-accent">
            חזרה לפרויקטים
          </button>
        </div>
      </ScreenScaffold>
    );
  }

  const p = project.data;
  const hourlyRate = p.hourly_rate_cents ? p.hourly_rate_cents / 100 : 0;
  const actualSeconds = (tasks.data ?? []).reduce(
    (sum, t) => sum + (t.actual_seconds ?? 0),
    0
  );
  const actualHours = actualSeconds / 3600;
  const estimatedHours = (tasks.data ?? []).reduce(
    (sum, t) => sum + Number(t.estimated_hours ?? 0),
    0
  );
  const actualRevenue =
    p.pricing_mode === "hourly"
      ? actualHours * hourlyRate
      : p.pricing_mode === "fixed_price" && p.total_price_cents
        ? p.total_price_cents / 100
        : 0;

  const doneCount = (tasks.data ?? []).filter((t) => t.status === "done").length;
  const totalCount = tasks.data?.length ?? 0;

  const handleAddTask = async () => {
    const title = newTaskTitle.trim();
    if (!title || !user || !activeOrganizationId) return;
    setAddingTask(true);
    try {
      const { data: list, error: listErr } = await supabase
        .from("task_lists")
        .select("id")
        .eq("project_id", p.id)
        .maybeSingle();
      if (listErr) throw listErr;
      const { error } = await supabase.from("tasks").insert({
        organization_id: activeOrganizationId,
        owner_id: user.id,
        title,
        task_list_id: list?.id ?? null,
        status: "todo",
      });
      if (error) throw error;
      setNewTaskTitle("");
      qc.invalidateQueries({ queryKey: ["projects", "tasks"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    } finally {
      setAddingTask(false);
    }
  };

  return (
    <ScreenScaffold
      title={p.name}
      subtitle={p.description ?? undefined}
      actions={
        <button
          onClick={() => navigate("/app/projects")}
          className="btn-ghost"
        >
          <ArrowRight className="w-4 h-4" />
          חזרה
        </button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label="משימות" value={`${doneCount}/${totalCount}`} />
            <Stat
              label="שעות בוצעו"
              value={actualHours.toFixed(1)}
              hint={`(${estimatedHours.toFixed(1)} מוערכות)`}
            />
            <Stat
              label="הכנסה חזויה"
              value={`₪${actualRevenue.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}`}
            />
            <Stat
              label="סטטוס"
              value={
                p.status === "active"
                  ? "פעיל"
                  : p.status === "paused"
                    ? "מושהה"
                    : "הושלם"
              }
            />
          </div>

          {/* Tasks list */}
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckSquare className="w-4 h-4 text-ink-500" />
              <h3 className="text-sm font-semibold text-ink-900 flex-1">משימות</h3>
              {totalCount > 0 && (
                <span className="chip">
                  {doneCount}/{totalCount}
                </span>
              )}
            </div>

            {user && activeOrganizationId && (
              <div className="flex items-center gap-2 mb-3">
                <input
                  className="field text-sm"
                  placeholder="משימה חדשה בפרויקט"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTask();
                    }
                  }}
                />
                <button
                  onClick={handleAddTask}
                  disabled={!newTaskTitle.trim() || addingTask}
                  className="btn-accent shrink-0"
                >
                  {addingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : "הוסיפי"}
                </button>
              </div>
            )}

            {tasks.isLoading ? (
              <div className="py-6 flex items-center justify-center text-ink-400">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            ) : !tasks.data || tasks.data.length === 0 ? (
              <div className="py-6 text-center text-sm text-ink-500">
                אין עדיין משימות בפרויקט.
              </div>
            ) : (
              <ul className="space-y-1.5">
                {tasks.data.map((task) => {
                  const done = task.status === "done";
                  return (
                    <li
                      key={task.id}
                      className={cn(
                        "flex items-center gap-3 py-2 border-b border-ink-200 last:border-0 cursor-pointer hover:bg-ink-50 rounded-lg px-2",
                        done && "opacity-60"
                      )}
                      onClick={() => setOpenTask(task)}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateStatus.mutate({
                            id: task.id,
                            status: done ? "todo" : "done",
                          });
                        }}
                        className={cn(
                          "w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center",
                          done
                            ? "bg-success-500 border-success-500 text-white"
                            : "border-ink-300 hover:border-primary-500"
                        )}
                        aria-label={done ? "בטל" : "סמן כבוצעה"}
                      >
                        {done && <CheckSquare className="w-3 h-3" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div
                          className={cn(
                            "text-sm break-words",
                            done ? "line-through text-ink-500" : "text-ink-900"
                          )}
                        >
                          {task.title}
                        </div>
                      </div>
                      {task.actual_seconds > 0 && (
                        <span className="text-xs text-ink-500 tabular-nums shrink-0">
                          {(task.actual_seconds / 3600).toFixed(1)}ש
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Side: pricing + actions */}
        <div className="space-y-3">
          <PricingPanel
            pricingMode={p.pricing_mode}
            hourlyRateCents={p.hourly_rate_cents}
            totalPriceCents={p.total_price_cents}
            currency={p.currency}
            onSave={(patch) =>
              updateProject.mutateAsync({ id: p.id, patch })
            }
            saving={updateProject.isPending}
          />

          <div className="card p-4 space-y-2">
            <button
              onClick={() =>
                updateProject.mutate({
                  id: p.id,
                  patch: { is_archived: !p.is_archived },
                })
              }
              className="btn-outline w-full"
              disabled={updateProject.isPending}
            >
              {p.is_archived ? (
                <>
                  <ArchiveRestore className="w-4 h-4" />
                  שחזרי מארכיון
                </>
              ) : (
                <>
                  <Archive className="w-4 h-4" />
                  העבירי לארכיון
                </>
              )}
            </button>
            <button
              onClick={async () => {
                if (!confirm(`למחוק את הפרויקט "${p.name}"? זה ימחק גם את כל המשימות שלו.`))
                  return;
                await deleteProject.mutateAsync(p.id);
                navigate("/app/projects");
              }}
              className="btn-outline w-full text-danger-600 hover:bg-danger-500/10"
              disabled={deleteProject.isPending}
            >
              <Trash2 className="w-4 h-4" />
              מחיקת הפרויקט
            </button>
          </div>
        </div>
      </div>

      {openTask && (
        <TaskDetailDrawer task={openTask} onClose={() => setOpenTask(null)} />
      )}
    </ScreenScaffold>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card p-3">
      <div className="text-xs text-ink-500">{label}</div>
      <div className="text-xl font-bold text-ink-900 tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-ink-400 mt-0.5">{hint}</div>}
    </div>
  );
}

interface PricingPanelProps {
  pricingMode: ProjectPricingMode;
  hourlyRateCents: number | null;
  totalPriceCents: number | null;
  currency: string;
  onSave: (patch: {
    pricing_mode?: ProjectPricingMode;
    hourly_rate_cents?: number | null;
    total_price_cents?: number | null;
  }) => Promise<unknown>;
  saving: boolean;
}

function PricingPanel({
  pricingMode,
  hourlyRateCents,
  totalPriceCents,
  currency,
  onSave,
  saving,
}: PricingPanelProps) {
  const [mode, setMode] = useState<ProjectPricingMode>(pricingMode);
  const [rate, setRate] = useState(
    hourlyRateCents != null ? String(hourlyRateCents / 100) : ""
  );
  const [total, setTotal] = useState(
    totalPriceCents != null ? String(totalPriceCents / 100) : ""
  );
  const [dirty, setDirty] = useState(false);

  return (
    <div className="card p-4 space-y-3">
      <h3 className="text-sm font-semibold text-ink-900">תמחור</h3>
      <label className="block">
        <span className="text-xs font-medium text-ink-700 mb-1 block">סוג תמחור</span>
        <select
          className="field"
          value={mode}
          onChange={(e) => {
            setMode(e.target.value as ProjectPricingMode);
            setDirty(true);
          }}
        >
          <option value="hourly">שעתי</option>
          <option value="fixed_price">מחיר קבוע</option>
          <option value="quote">הצעה</option>
        </select>
      </label>
      {mode === "hourly" && (
        <label className="block">
          <span className="text-xs font-medium text-ink-700 mb-1 block">
            תעריף שעתי ({currency})
          </span>
          <input
            type="number"
            min="0"
            className="field"
            value={rate}
            onChange={(e) => {
              setRate(e.target.value);
              setDirty(true);
            }}
          />
        </label>
      )}
      {mode === "fixed_price" && (
        <label className="block">
          <span className="text-xs font-medium text-ink-700 mb-1 block">
            מחיר כולל ({currency})
          </span>
          <input
            type="number"
            min="0"
            className="field"
            value={total}
            onChange={(e) => {
              setTotal(e.target.value);
              setDirty(true);
            }}
          />
        </label>
      )}
      <button
        onClick={async () => {
          await onSave({
            pricing_mode: mode,
            hourly_rate_cents:
              mode === "hourly" && rate ? Math.round(Number(rate) * 100) : null,
            total_price_cents:
              mode === "fixed_price" && total
                ? Math.round(Number(total) * 100)
                : null,
          });
          setDirty(false);
        }}
        disabled={!dirty || saving}
        className="btn-accent w-full"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        שמרי תמחור
      </button>
    </div>
  );
}

