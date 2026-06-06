import { useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  Plus,
  Trash2,
  Layers,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  buildPlanTree,
  stageProgress,
  type PlanTask,
  type PlanGoalNode,
  type PlanStageNode,
} from "@/lib/types/plans";
import {
  useCreateStage,
  useCreatePlanTask,
  useUpdatePlanRow,
  useDeletePlanRow,
  useAssignTaskToStage,
} from "@/lib/hooks/usePlans";
import type { PlanRowPatch } from "@/lib/services/plans";
import { PlanInlineText, PlanStatusChip } from "./plan-bits";
import { PLAN_ITEM_DND } from "./ImportantThingsBanner";

// columns shared by goal + task rows: [name] [time] [metric] [quant] [status] [actions]
const COLS =
  "minmax(11rem,2fr) minmax(5rem,0.8fr) minmax(7rem,1.1fr) minmax(6rem,0.9fr) auto auto";
const COL_LABELS = ["שם", "טווח זמן", "מדד הצלחה", "יעד כמותי", "סטטוס", ""];

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
          עדיין אין שלבים בתוכנית. הוסיפי שלב ראשון למטה, ואז כתבי תחתיו יעדים/שאיפות.
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

// ─── Stage (שלב) ─────────────────────────────────────────────────────────────

function StageBlock({
  planId,
  stage,
  canEdit,
}: {
  planId: string;
  stage: PlanStageNode;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [newGoal, setNewGoal] = useState("");
  const [dropActive, setDropActive] = useState(false);
  const createGoal = useCreatePlanTask();
  const updateRow = useUpdatePlanRow();
  const deleteRow = useDeletePlanRow();
  const assign = useAssignTaskToStage();
  const pct = Math.round(stageProgress(stage) * 100);

  const patch = (taskId: string, p: PlanRowPatch) =>
    updateRow.mutate({ planId, taskId, patch: p });

  const addGoal = () => {
    const title = newGoal.trim();
    if (!title) return;
    createGoal.mutate({ planId, parentId: stage.id, title });
    setNewGoal("");
  };

  return (
    <div className={cn("card overflow-hidden", dropActive && "ring-2 ring-amber-400")}>
      {/* Stage header — drop target: banner item → becomes a goal under this stage */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 border-b border-ink-100 transition-colors",
          dropActive ? "bg-amber-100" : "bg-ink-50/60"
        )}
        onDragOver={(e) => {
          if (!canEdit || !e.dataTransfer.types.includes(PLAN_ITEM_DND)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDropActive(true);
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(e) => {
          setDropActive(false);
          const id = e.dataTransfer.getData(PLAN_ITEM_DND);
          if (id) {
            e.preventDefault();
            assign.mutate({ planId, taskId: id, stageId: stage.id });
          }
        }}
      >
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

        <div className="hidden sm:flex items-center gap-1 shrink-0" title="תיעדוף">
          <span className="text-[11px] text-ink-400">תיעדוף</span>
          <UrgencyDots value={stage.urgency ?? 0} disabled={!canEdit} onChange={(v) => patch(stage.id, { urgency: v })} />
        </div>

        <div className="hidden md:flex items-center gap-2 w-32 shrink-0">
          <div className="h-2 flex-1 rounded-full bg-ink-100 overflow-hidden">
            <div className={cn("h-full rounded-full", pct === 100 ? "bg-success-500" : "bg-primary-500")} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11px] text-ink-500 tabular-nums w-8 text-end">{pct}%</span>
        </div>

        <PlanStatusChip value={stage.plan_status} disabled={!canEdit} onChange={(v) => patch(stage.id, { plan_status: v })} />

        {canEdit && (
          <button
            type="button"
            onClick={() => {
              if (confirm(`למחוק את השלב "${stage.title}" וכל היעדים והמשימות שתחתיו?`)) {
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
        <div className="overflow-x-auto">
          {stage.goals.length > 0 && (
            <div
              className="grid items-center gap-x-2 px-3 py-1.5 text-[11px] font-medium text-ink-400 border-b border-ink-100 min-w-[40rem]"
              style={{ gridTemplateColumns: COLS }}
            >
              {COL_LABELS.map((l, i) => (
                <span key={i} className={i === 4 ? "text-center" : ""}>{l}</span>
              ))}
            </div>
          )}

          {stage.goals.map((goal) => (
            <GoalBlock key={goal.id} planId={planId} goal={goal} canEdit={canEdit} />
          ))}

          {canEdit && (
            <div className="flex items-center gap-2 px-3 py-2">
              <input
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addGoal()}
                placeholder="הוסף יעד / שאיפה…"
                className="field text-sm py-1 flex-1 max-w-sm"
              />
              <button type="button" onClick={addGoal} disabled={!newGoal.trim()} className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 disabled:opacity-40">
                <Plus className="w-4 h-4" />
                הוסף יעד
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Goal / aspiration (יעד/שאיפה) ───────────────────────────────────────────

function GoalBlock({
  planId,
  goal,
  canEdit,
}: {
  planId: string;
  goal: PlanGoalNode;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [newTask, setNewTask] = useState("");
  const [dropActive, setDropActive] = useState(false);
  const createTask = useCreatePlanTask();
  const updateRow = useUpdatePlanRow();
  const deleteRow = useDeletePlanRow();
  const assign = useAssignTaskToStage();

  const patch = (taskId: string, p: PlanRowPatch) =>
    updateRow.mutate({ planId, taskId, patch: p });

  const addTask = () => {
    const title = newTask.trim();
    if (!title) return;
    createTask.mutate({ planId, parentId: goal.id, title });
    setNewTask("");
  };

  return (
    <div className={cn("border-b border-ink-50 last:border-b-0", dropActive && "bg-amber-50")}>
      {/* Goal row — drop target: banner item → becomes a task under this goal */}
      <div
        className="grid items-center gap-x-2 px-3 py-1 hover:bg-ink-50/40 min-w-[40rem]"
        style={{ gridTemplateColumns: COLS }}
        onDragOver={(e) => {
          if (!canEdit || !e.dataTransfer.types.includes(PLAN_ITEM_DND)) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDropActive(true);
        }}
        onDragLeave={() => setDropActive(false)}
        onDrop={(e) => {
          setDropActive(false);
          const id = e.dataTransfer.getData(PLAN_ITEM_DND);
          if (id) {
            e.preventDefault();
            assign.mutate({ planId, taskId: id, stageId: goal.id });
          }
        }}
      >
        <div className="flex items-center gap-1 min-w-0">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="p-0.5 rounded hover:bg-ink-100 text-ink-400 shrink-0"
            aria-label={open ? "כווץ" : "הרחב"}
          >
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
          <Target className="w-3.5 h-3.5 text-primary-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <PlanInlineText value={goal.title} disabled={!canEdit} onCommit={(v) => patch(goal.id, { title: v })} placeholder="יעד / שאיפה" className="font-medium text-ink-900" />
          </div>
        </div>
        <PlanInlineText value={goal.plan_time_range ?? ""} disabled={!canEdit} onCommit={(v) => patch(goal.id, { plan_time_range: v })} placeholder="—" />
        <PlanInlineText value={goal.plan_success_metric ?? ""} disabled={!canEdit} onCommit={(v) => patch(goal.id, { plan_success_metric: v })} placeholder="—" />
        <PlanInlineText value={goal.plan_quant_target ?? ""} disabled={!canEdit} onCommit={(v) => patch(goal.id, { plan_quant_target: v })} placeholder="—" />
        <div className="flex justify-center">
          <PlanStatusChip value={goal.plan_status} disabled={!canEdit} onChange={(v) => patch(goal.id, { plan_status: v })} />
        </div>
        {canEdit ? (
          <button type="button" onClick={() => deleteRow.mutate({ planId, taskId: goal.id })} className="p-1 rounded hover:bg-rose-50 text-ink-300 hover:text-rose-600" title="מחק יעד">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        ) : <span />}
      </div>

      {open && (
        <div className="min-w-[40rem]">
          {goal.tasks.map((task) => (
            <div
              key={task.id}
              className="grid items-center gap-x-2 px-3 py-1 hover:bg-ink-50/40"
              style={{ gridTemplateColumns: COLS }}
            >
              <div className="flex items-center gap-1 min-w-0 ps-9">
                <span className="w-1 h-1 rounded-full bg-ink-300 shrink-0" />
                <div className="min-w-0 flex-1">
                  <PlanInlineText value={task.title} disabled={!canEdit} onCommit={(v) => patch(task.id, { title: v })} placeholder="משימה" className="text-ink-700" />
                </div>
              </div>
              <PlanInlineText value={task.plan_time_range ?? ""} disabled={!canEdit} onCommit={(v) => patch(task.id, { plan_time_range: v })} placeholder="—" />
              <PlanInlineText value={task.plan_success_metric ?? ""} disabled={!canEdit} onCommit={(v) => patch(task.id, { plan_success_metric: v })} placeholder="—" />
              <PlanInlineText value={task.plan_quant_target ?? ""} disabled={!canEdit} onCommit={(v) => patch(task.id, { plan_quant_target: v })} placeholder="—" />
              <div className="flex justify-center">
                <PlanStatusChip value={task.plan_status} disabled={!canEdit} onChange={(v) => patch(task.id, { plan_status: v })} />
              </div>
              {canEdit ? (
                <button type="button" onClick={() => deleteRow.mutate({ planId, taskId: task.id })} className="p-1 rounded hover:bg-rose-50 text-ink-300 hover:text-rose-600" title="מחק משימה">
                  <Trash2 className="w-3 h-3" />
                </button>
              ) : <span />}
            </div>
          ))}

          {canEdit && (
            <div className="flex items-center gap-2 px-3 py-1.5 ps-12">
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                placeholder="פרקי למשימה קטנה…"
                className="field text-sm py-1 flex-1 max-w-xs"
              />
              <button type="button" onClick={addTask} disabled={!newTask.trim()} className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 disabled:opacity-40">
                <Plus className="w-3.5 h-3.5" />
                משימה
              </button>
            </div>
          )}
        </div>
      )}
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
