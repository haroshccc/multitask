import { useMemo, useState } from "react";
import { Plus, Trash2, Link2, ArrowRight, ChevronDown, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  useTaskDependencies,
  useCreateTaskDependency,
  useDeleteTaskDependency,
  useUpdateTaskDependency,
  useTasks,
} from "@/lib/hooks/useTasks";
import { pushUndo } from "@/lib/undo/store";
import type { DependencyRelation, Task, TaskDependency } from "@/lib/types/domain";

interface TaskDependenciesSectionProps {
  taskId: string;
}

const RELATION_OPTIONS: {
  value: DependencyRelation;
  short: string;
  label: string;
  hint: string;
}[] = [
  {
    value: "finish_to_start",
    short: "FS",
    label: "סיום → התחלה",
    hint: "המשימה הזו תתחיל רק כשהקודמת תסתיים (ברירת מחדל של MSProject)",
  },
  {
    value: "start_to_start",
    short: "SS",
    label: "התחלה → התחלה",
    hint: "שתי המשימות יתחילו יחד",
  },
  {
    value: "finish_to_finish",
    short: "FF",
    label: "סיום → סיום",
    hint: "שתי המשימות יסתיימו יחד",
  },
  {
    value: "start_to_finish",
    short: "SF",
    label: "התחלה → סיום",
    hint: "המשימה הזו תסתיים רק כשהקודמת תתחיל (נדיר)",
  },
];

/**
 * Reusable dependencies editor — plug into TaskEditModal's Schedule tab, a
 * Gantt row popover, or anywhere else that needs to wire predecessors &
 * successors for a task.
 *
 * Data comes from useTaskDependencies (both directions). We split them:
 *   predecessors — rows where `task_id === taskId`  (this task depends on …)
 *   successors   — rows where `depends_on_task_id === taskId`  (… depends on this)
 *
 * Adds default to FS (finish-to-start) with 0 lag, matching MSProject.
 * The DB trigger `check_no_dependency_cycle` rejects cycles server-side.
 */
export function TaskDependenciesSection({ taskId }: TaskDependenciesSectionProps) {
  const { data: deps = [] } = useTaskDependencies(taskId);
  const { data: allTasks = [] } = useTasks();
  const createDep = useCreateTaskDependency();
  const deleteDep = useDeleteTaskDependency();
  const updateDep = useUpdateTaskDependency();

  const tasksById = useMemo(() => {
    const m = new Map<string, Task>();
    allTasks.forEach((t) => m.set(t.id, t));
    return m;
  }, [allTasks]);

  const predecessors = deps.filter((d) => d.task_id === taskId);
  const successors = deps.filter((d) => d.depends_on_task_id === taskId);

  // Exclude self + already-linked predecessors from the picker suggestions.
  const existingPredIds = new Set(predecessors.map((d) => d.depends_on_task_id));
  const candidateTasks = useMemo(
    () =>
      allTasks.filter(
        (t) => t.id !== taskId && !existingPredIds.has(t.id)
      ),
    [allTasks, taskId, existingPredIds]
  );

  // Add-predecessor form state
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [relation, setRelation] = useState<DependencyRelation>("finish_to_start");
  const [lagDays, setLagDays] = useState<number>(0);

  const filteredCandidates = useMemo(() => {
    if (!query.trim()) return candidateTasks.slice(0, 8);
    const q = query.trim().toLowerCase();
    return candidateTasks
      .filter((t) => t.title.toLowerCase().includes(q))
      .slice(0, 12);
  }, [candidateTasks, query]);

  const commitAdd = async (dependsOnTaskId: string) => {
    const dep = await createDep.mutateAsync({
      taskId,
      dependsOnTaskId,
      relation,
      lagDays,
    });
    const depId = (dep as { id: string }).id;
    setQuery("");
    setRelation("finish_to_start");
    setLagDays(0);
    setAdding(false);
    pushUndo({
      description: "הוספת תלות",
      undo: () => deleteDep.mutate(depId),
      redo: () =>
        createDep.mutate({ taskId, dependsOnTaskId, relation, lagDays }),
    });
  };

  const removeDep = (depId: string, snapshot: { task: string; depOn: string; relation: DependencyRelation; lag: number }) => {
    deleteDep.mutate(depId);
    pushUndo({
      description: "מחיקת תלות",
      undo: () =>
        createDep.mutate({
          taskId: snapshot.task,
          dependsOnTaskId: snapshot.depOn,
          relation: snapshot.relation,
          lagDays: snapshot.lag,
        }),
      redo: () => deleteDep.mutate(depId),
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-ink-900">
          <Link2 className="w-4 h-4 inline-block -mt-0.5 me-1 text-ink-500" />
          תלויות
        </h4>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="btn-ghost text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            הוסף תלות
          </button>
        )}
      </div>

      {/* Predecessors */}
      <div>
        <div className="eyebrow mb-1">
          תלויה ב-{predecessors.length > 0 && `(${predecessors.length})`}
        </div>
        {predecessors.length === 0 ? (
          <p className="text-xs text-ink-400">
            המשימה הזו לא תלויה באף משימה אחרת.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {predecessors.map((dep) => {
              const dependsOn = tasksById.get(dep.depends_on_task_id);
              const title = dependsOn?.title ?? "משימה לא נגישה";
              return (
                <PredecessorRow
                  key={dep.id}
                  dep={dep}
                  title={title}
                  onSave={(patch) => {
                    const prev = { relation: dep.relation, lag_days: dep.lag_days };
                    updateDep.mutate({ depId: dep.id, patch });
                    pushUndo({
                      description: "עריכת תלות",
                      undo: () =>
                        updateDep.mutate({ depId: dep.id, patch: prev }),
                      redo: () => updateDep.mutate({ depId: dep.id, patch }),
                    });
                  }}
                  onDelete={() =>
                    removeDep(dep.id, {
                      task: dep.task_id,
                      depOn: dep.depends_on_task_id,
                      relation: dep.relation,
                      lag: dep.lag_days,
                    })
                  }
                />
              );
            })}
          </ul>
        )}
      </div>

      {/* Successors (read-only summary) */}
      {successors.length > 0 && (
        <div>
          <div className="eyebrow mb-1">תלויות בה ({successors.length})</div>
          <ul className="space-y-1">
            {successors.map((dep) => {
              const dependent = tasksById.get(dep.task_id);
              return (
                <li
                  key={dep.id}
                  className="flex items-center gap-2 text-xs text-ink-600 px-3 py-1 rounded-md bg-ink-50"
                >
                  <ArrowRight className="w-3 h-3 text-ink-400 rotate-180" />
                  <span className="flex-1 min-w-0 truncate">
                    {dependent?.title ?? "משימה לא נגישה"}
                  </span>
                  <RelationChip value={dep.relation} size="sm" />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="card p-3 space-y-2 bg-ink-50/60">
          <div className="flex items-center gap-2">
            <label className="eyebrow shrink-0">סוג:</label>
            <RelationSelect value={relation} onChange={setRelation} />
            <label className="eyebrow shrink-0 ms-2">פער:</label>
            <input
              type="number"
              value={lagDays}
              onChange={(e) => setLagDays(Number(e.target.value) || 0)}
              className="field text-sm w-20"
              placeholder="ימים"
            />
          </div>

          <div>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חפש משימה לקשר אליה..."
              className="field text-sm"
            />
            {filteredCandidates.length === 0 ? (
              <p className="text-xs text-ink-400 mt-1.5 text-center py-2">
                אין תוצאות. נסי מילת חיפוש אחרת.
              </p>
            ) : (
              <ul className="mt-1.5 max-h-48 overflow-y-auto scrollbar-thin border border-ink-200 rounded-xl bg-white">
                {filteredCandidates.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => commitAdd(t.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-ink-900 hover:bg-ink-100 text-start"
                    >
                      {t.title}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setQuery("");
              }}
              className="btn-ghost text-xs"
            >
              בטל
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PredecessorRow({
  dep,
  title,
  onSave,
  onDelete,
}: {
  dep: TaskDependency;
  title: string;
  onSave: (patch: { relation?: DependencyRelation; lag_days?: number }) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [relation, setRelation] = useState<DependencyRelation>(dep.relation);
  const [lagDays, setLagDays] = useState<number>(dep.lag_days);

  const cancel = () => {
    setRelation(dep.relation);
    setLagDays(dep.lag_days);
    setEditing(false);
  };

  const save = () => {
    const patch: { relation?: DependencyRelation; lag_days?: number } = {};
    if (relation !== dep.relation) patch.relation = relation;
    if (lagDays !== dep.lag_days) patch.lag_days = lagDays;
    if (Object.keys(patch).length > 0) onSave(patch);
    setEditing(false);
  };

  if (editing) {
    return (
      <li className="rounded-xl border border-primary-300 bg-primary-50/40 px-3 py-2 space-y-2 text-sm">
        <div className="text-ink-900 font-medium truncate">{title}</div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="eyebrow shrink-0">סוג:</label>
          <RelationSelect value={relation} onChange={setRelation} />
          <label className="eyebrow shrink-0 ms-2">פער:</label>
          <input
            type="number"
            value={lagDays}
            onChange={(e) => setLagDays(Number(e.target.value) || 0)}
            className="field text-sm w-20 py-1"
            placeholder="ימים"
          />
          <span className="text-[10px] text-ink-500">ימים (יכול להיות שלילי)</span>
        </div>
        <div className="flex items-center gap-1 justify-end">
          <button
            type="button"
            onClick={cancel}
            className="btn-ghost text-xs"
            title="בטל"
          >
            <X className="w-3.5 h-3.5" />
            בטל
          </button>
          <button
            type="button"
            onClick={save}
            className="btn-accent text-xs"
            title="שמור שינוי"
          >
            <Check className="w-3.5 h-3.5" />
            שמור
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-sm">
      <span className="flex-1 min-w-0 truncate text-ink-900">{title}</span>
      <RelationChip value={dep.relation} />
      {dep.lag_days !== 0 && (
        <span className="text-[10px] font-mono tabular-nums text-ink-500 px-1.5 py-0.5 rounded-md bg-ink-100">
          {dep.lag_days > 0 ? `+${dep.lag_days}י` : `${dep.lag_days}י`}
        </span>
      )}
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="p-1 text-ink-400 hover:text-primary-600"
        title="ערוך תלות"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="p-1 text-ink-400 hover:text-danger-500"
        title="מחק תלות"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </li>
  );
}

function RelationChip({
  value,
  size = "md",
}: {
  value: DependencyRelation;
  size?: "sm" | "md";
}) {
  const opt = RELATION_OPTIONS.find((o) => o.value === value);
  return (
    <span
      className={cn(
        "inline-flex items-center font-mono font-semibold rounded-md bg-primary-50 text-primary-800 border border-primary-200",
        size === "md" ? "text-[10px] px-1.5 py-0.5" : "text-[9px] px-1 py-0"
      )}
      title={opt?.label ?? value}
    >
      {opt?.short ?? value}
    </span>
  );
}

function RelationSelect({
  value,
  onChange,
}: {
  value: DependencyRelation;
  onChange: (v: DependencyRelation) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = RELATION_OPTIONS.find((o) => o.value === value);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-lg border border-ink-300 bg-white px-2 py-1 text-xs hover:border-ink-400"
      >
        <span className="font-mono font-semibold">{current?.short}</span>
        <span className="text-ink-600">{current?.label}</span>
        <ChevronDown className="w-3 h-3 text-ink-500" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute start-0 mt-1 z-20 bg-white border border-ink-200 rounded-xl shadow-lift py-1 w-[240px]">
            {RELATION_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  "w-full flex flex-col items-start gap-0.5 px-3 py-1.5 text-start hover:bg-ink-100",
                  o.value === value && "bg-primary-50"
                )}
              >
                <span className="text-sm text-ink-900">
                  <span className="font-mono font-semibold text-primary-700 me-1">
                    {o.short}
                  </span>
                  {o.label}
                </span>
                <span className="text-[10px] text-ink-500">{o.hint}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
