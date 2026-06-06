import { useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  Plus,
  Trash2,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  buildPlanTree,
  stageProgress,
  type PlanTask,
} from "@/lib/types/plans";
import {
  useCreateStage,
  useCreatePlanTask,
  useUpdatePlanRow,
  useDeletePlanRow,
} from "@/lib/hooks/usePlans";
import type { PlanRowPatch } from "@/lib/services/plans";
import { PlanInlineText, PlanStatusChip } from "./plan-bits";

const COLS = "minmax(9rem,1.4fr) minmax(9rem,1.4fr) minmax(5rem,0.8fr) minmax(7rem,1.1fr) minmax(6rem,0.9fr) auto auto";

const COL_LABELS = ["שם", "יעד / שאיפה", "טווח זמן", "מדד הצלחה", "יעד כמותי", "סטטוס", ""];

export function PlanTasksTable({
  planId,
  tasks,
  canEdit,
}: {
  planId: string;
  tasks: PlanTask[];
  canEdit: boolean;
}) {
  const stages = buildPlanTree(tasks);
  const createStage = useCreateStage();
  const [newStage, setNewStage] = useState("");

  const addStage = () => {
    const title = newStage.trim();
    if (!title) return;
    createStage.mutate({ planId, title });
    setNewStage("");
  };

  return (
    <div className="space-y-4">
      {stages.map((stage) => (
        <StageBlock key={stage.id} planId={planId} stage={stage} canEdit={canEdit} />
      ))}

      {stages.length === 0 && (
        <div className="card p-6 text-center text-ink-500 text-sm">
          עדיין אין שלבים בתוכנית. הוסיפי שלב ראשון למטה.
        </div>
      )}

      {canEdit && (
        <div className="flex items-center gap-2">
          <input
            value={newStage}
            onChange={(e) => setNewStage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addStage()}
            placeholder="שם שלב חדש…"
            className="field text-sm py-1.5 max-w-xs"
          />
          <button
            type="button"
            onClick={addStage}
            disabled={!newStage.trim()}
            className="btn-primary flex items-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            הוסף שלב
          </button>
        </div>
      )}
    </div>
  );
}

function StageBlock({
  planId,
  stage,
  canEdit,
}: {
  planId: string;
  stage: ReturnType<typeof buildPlanTree>[number];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [newTask, setNewTask] = useState("");
  const createTask = useCreatePlanTask();
  const updateRow = useUpdatePlanRow();
  const deleteRow = useDeletePlanRow();
  const pct = Math.round(stageProgress(stage) * 100);

  const patch = (taskId: string, p: PlanRowPatch) =>
    updateRow.mutate({ planId, taskId, patch: p });

  const addTask = () => {
    const title = newTask.trim();
    if (!title) return;
    createTask.mutate({ planId, stageId: stage.id, title });
    setNewTask("");
  };

  return (
    <div className="card overflow-hidden">
      {/* Stage header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-ink-50/60 border-b border-ink-100">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="p-1 rounded hover:bg-ink-100 text-ink-500 shrink-0"
          aria-label={open ? "כווץ" : "הרחב"}
        >
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        <Layers className="w-4 h-4 text-primary-600 shrink-0" />
        <div className="min-w-0 flex-1">
          <PlanInlineText
            value={stage.title}
            disabled={!canEdit}
            onCommit={(v) => patch(stage.id, { title: v })}
            placeholder="שם השלב"
            className="font-semibold text-ink-900"
          />
        </div>

        {/* priority stepper (urgency 0-3) */}
        <div className="hidden sm:flex items-center gap-1 shrink-0" title="תיעדוף">
          <span className="text-[11px] text-ink-400">תיעדוף</span>
          <UrgencyDots
            value={stage.urgency ?? 0}
            disabled={!canEdit}
            onChange={(v) => patch(stage.id, { urgency: v })}
          />
        </div>

        {/* progress */}
        <div className="hidden md:flex items-center gap-2 w-32 shrink-0">
          <div className="h-2 flex-1 rounded-full bg-ink-100 overflow-hidden">
            <div
              className={cn("h-full rounded-full", pct === 100 ? "bg-success-500" : "bg-primary-500")}
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[11px] text-ink-500 tabular-nums w-8 text-end">{pct}%</span>
        </div>

        <PlanStatusChip
          value={stage.plan_status}
          disabled={!canEdit}
          onChange={(v) => patch(stage.id, { plan_status: v })}
        />

        {canEdit && (
          <button
            type="button"
            onClick={() => {
              if (confirm(`למחוק את השלב "${stage.title}" וכל המשימות שתחתיו?`)) {
                deleteRow.mutate({ planId, taskId: stage.id });
              }
            }}
            className="p-1.5 rounded-md hover:bg-rose-50 text-ink-400 hover:text-rose-600 shrink-0"
            title="מחק שלב"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div>
          {/* Desktop table */}
          <div className="hidden sm:block">
            {stage.children.length > 0 && (
              <div
                className="grid items-center gap-x-2 px-3 py-1.5 text-[11px] font-medium text-ink-400 border-b border-ink-100"
                style={{ gridTemplateColumns: COLS }}
              >
                {COL_LABELS.map((l, i) => (
                  <span key={i} className={i >= 5 ? "text-center" : ""}>{l}</span>
                ))}
              </div>
            )}
            {stage.children.map((task) => (
              <div
                key={task.id}
                className="grid items-center gap-x-2 px-3 py-1 border-b border-ink-50 last:border-b-0 hover:bg-ink-50/40"
                style={{ gridTemplateColumns: COLS }}
              >
                <PlanInlineText value={task.title} disabled={!canEdit} onCommit={(v) => patch(task.id, { title: v })} placeholder="שם המשימה" className="text-ink-800" />
                <PlanInlineText value={task.description ?? ""} disabled={!canEdit} onCommit={(v) => patch(task.id, { description: v })} placeholder="—" />
                <PlanInlineText value={task.plan_time_range ?? ""} disabled={!canEdit} onCommit={(v) => patch(task.id, { plan_time_range: v })} placeholder="—" />
                <PlanInlineText value={task.plan_success_metric ?? ""} disabled={!canEdit} onCommit={(v) => patch(task.id, { plan_success_metric: v })} placeholder="—" />
                <PlanInlineText value={task.plan_quant_target ?? ""} disabled={!canEdit} onCommit={(v) => patch(task.id, { plan_quant_target: v })} placeholder="—" />
                <div className="flex justify-center">
                  <PlanStatusChip value={task.plan_status} disabled={!canEdit} onChange={(v) => patch(task.id, { plan_status: v })} />
                </div>
                {canEdit ? (
                  <button type="button" onClick={() => deleteRow.mutate({ planId, taskId: task.id })} className="p-1 rounded hover:bg-rose-50 text-ink-300 hover:text-rose-600" title="מחק משימה">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                ) : <span />}
              </div>
            ))}
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden divide-y divide-ink-50">
            {stage.children.map((task) => (
              <MobileTaskCard key={task.id} task={task} canEdit={canEdit} onPatch={(p) => patch(task.id, p)} onDelete={() => deleteRow.mutate({ planId, taskId: task.id })} />
            ))}
          </div>

          {canEdit && (
            <div className="flex items-center gap-2 px-3 py-2">
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                placeholder="הוסף משימה…"
                className="field text-sm py-1 flex-1 max-w-sm"
              />
              <button type="button" onClick={addTask} disabled={!newTask.trim()} className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 disabled:opacity-40">
                <Plus className="w-4 h-4" />
                הוסף
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MobileTaskCard({
  task,
  canEdit,
  onPatch,
  onDelete,
}: {
  task: PlanTask;
  canEdit: boolean;
  onPatch: (p: PlanRowPatch) => void;
  onDelete: () => void;
}) {
  const Field = ({ label, value, onCommit, placeholder }: { label: string; value: string; onCommit: (v: string) => void; placeholder?: string }) => (
    <div className="flex items-baseline gap-2">
      <span className="text-[11px] text-ink-400 w-20 shrink-0">{label}</span>
      <div className="flex-1 min-w-0">
        <PlanInlineText value={value} disabled={!canEdit} onCommit={onCommit} placeholder={placeholder ?? "—"} />
      </div>
    </div>
  );
  return (
    <div className="p-3 space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <PlanInlineText value={task.title} disabled={!canEdit} onCommit={(v) => onPatch({ title: v })} placeholder="שם המשימה" className="font-medium text-ink-900" />
        </div>
        <PlanStatusChip value={task.plan_status} disabled={!canEdit} onChange={(v) => onPatch({ plan_status: v })} />
        {canEdit && (
          <button type="button" onClick={onDelete} className="p-1 rounded hover:bg-rose-50 text-ink-300 hover:text-rose-600">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <Field label="יעד / שאיפה" value={task.description ?? ""} onCommit={(v) => onPatch({ description: v })} />
      <Field label="טווח זמן" value={task.plan_time_range ?? ""} onCommit={(v) => onPatch({ plan_time_range: v })} />
      <Field label="מדד הצלחה" value={task.plan_success_metric ?? ""} onCommit={(v) => onPatch({ plan_success_metric: v })} />
      <Field label="יעד כמותי" value={task.plan_quant_target ?? ""} onCommit={(v) => onPatch({ plan_quant_target: v })} />
    </div>
  );
}

function UrgencyDots({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(value === n ? 0 : n)}
          className={cn(
            "w-2.5 h-2.5 rounded-full transition-colors",
            n <= value ? "bg-primary-500" : "bg-ink-200",
            !disabled && "hover:bg-primary-400"
          )}
          aria-label={`תיעדוף ${n}`}
        />
      ))}
    </div>
  );
}
