import {
  HelpCircle,
  CheckCircle2,
  Link2,
  Plus,
  Trash2,
  Layers,
} from "lucide-react";
import {
  usePlanDecisions,
  useCreatePlanDecision,
  useUpdatePlanDecision,
  useDeletePlanDecision,
  useAddDecisionImpact,
  useUpdateDecisionImpact,
  useDeleteDecisionImpact,
} from "@/lib/hooks/usePlans";
import type { PlanDecisionWithImpacts } from "@/lib/types/plans";
import { PlanInlineText } from "./plan-bits";

interface StageRef {
  id: string;
  title: string;
}

export function PlanDecisionsTab({
  planId,
  stages,
  canEdit,
}: {
  planId: string;
  stages: StageRef[];
  canEdit: boolean;
}) {
  const { data: decisions = [], isLoading } = usePlanDecisions(planId);
  const createDecision = useCreatePlanDecision();

  if (isLoading) {
    return <div className="card p-6 text-center text-ink-500 text-sm">טוען…</div>;
  }

  // A decision always belongs to a stage — group by stage only.
  const byStage = new Map<string, PlanDecisionWithImpacts[]>();
  for (const d of decisions) {
    if (!d.stage_task_id) continue; // defensive: legacy plan-level rows are ignored
    const arr = byStage.get(d.stage_task_id) ?? [];
    arr.push(d);
    byStage.set(d.stage_task_id, arr);
  }

  if (stages.length === 0) {
    return (
      <div className="card p-6 text-center text-ink-500 text-sm space-y-1">
        <Layers className="w-6 h-6 mx-auto text-ink-300" />
        <p className="font-medium text-ink-700">קודם מגדירים שלבים</p>
        <p className="text-xs">החלטה תמיד שייכת לשלב — הוסיפי שלב בטאב "משימות" ואז תוכלי לרשום עליו החלטות.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-500">
        לכל שלב שואלים את השאלות הקשות, רושמים את ההחלטה, ומסמנים על אילו שלבים
        אחרים היא משפיעה.
      </p>

      {stages.map((stage) => {
        const list = byStage.get(stage.id) ?? [];
        return (
          <section key={stage.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary-600" />
              <h3 className="text-sm font-semibold text-ink-800">{stage.title}</h3>
              <span className="text-[11px] bg-ink-100 text-ink-500 rounded-full px-1.5 py-0.5">
                {list.length}
              </span>
              <div className="flex-1 h-px bg-ink-100" />
            </div>

            <div className="space-y-2">
              {list.map((d) => (
                <DecisionCard
                  key={d.id}
                  planId={planId}
                  decision={d}
                  stages={stages}
                  canEdit={canEdit}
                />
              ))}

              {canEdit && (
                <button
                  type="button"
                  onClick={() => createDecision.mutate({ planId, stageTaskId: stage.id })}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary-300 text-primary-600 hover:bg-primary-50 text-sm py-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  הוסף החלטה לשלב זה
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function DecisionCard({
  planId,
  decision,
  stages,
  canEdit,
}: {
  planId: string;
  decision: PlanDecisionWithImpacts;
  stages: StageRef[];
  canEdit: boolean;
}) {
  const updateDecision = useUpdatePlanDecision();
  const deleteDecision = useDeletePlanDecision();
  const addImpact = useAddDecisionImpact();
  const updateImpact = useUpdateDecisionImpact();
  const deleteImpact = useDeleteDecisionImpact();

  // Impacts are on OTHER stages — exclude this decision's own stage.
  const otherStages = stages.filter((s) => s.id !== decision.stage_task_id);

  return (
    <div className="card p-3 space-y-2">
      <div className="flex items-start gap-2">
        <HelpCircle className="w-4 h-4 text-amber-500 mt-1.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <PlanInlineText
            value={decision.question}
            disabled={!canEdit}
            multiline
            placeholder="מה צריך להחליט?"
            onCommit={(v) =>
              updateDecision.mutate({ planId, decisionId: decision.id, patch: { question: v } })
            }
          />
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => deleteDecision.mutate({ planId, decisionId: decision.id })}
            className="p-1 rounded hover:bg-rose-50 text-ink-300 hover:text-rose-600 shrink-0"
            title="מחק החלטה"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-start gap-2">
        <CheckCircle2 className="w-4 h-4 text-success-500 mt-1.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <PlanInlineText
            value={decision.decision}
            disabled={!canEdit}
            multiline
            placeholder="ההחלטה…"
            onCommit={(v) =>
              updateDecision.mutate({ planId, decisionId: decision.id, patch: { decision: v } })
            }
          />
        </div>
      </div>

      {/* Impacts on other stages */}
      <div className="ps-6 space-y-1.5">
        {decision.impacts.map((im) => (
          <div key={im.id} className="flex items-center gap-2">
            <Link2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <select
              value={im.affected_stage_task_id ?? ""}
              disabled={!canEdit}
              onChange={(e) =>
                updateImpact.mutate({
                  planId,
                  impactId: im.id,
                  patch: { affected_stage_task_id: e.target.value || null },
                })
              }
              className="field text-xs py-1 w-auto max-w-[10rem]"
            >
              <option value="">שלב מושפע…</option>
              {otherStages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <div className="flex-1 min-w-0">
              <PlanInlineText
                value={im.note}
                disabled={!canEdit}
                placeholder="תיאור ההשפעה"
                onCommit={(v) =>
                  updateImpact.mutate({ planId, impactId: im.id, patch: { note: v } })
                }
              />
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => deleteImpact.mutate({ planId, impactId: im.id })}
                className="p-1 rounded hover:bg-rose-50 text-ink-300 hover:text-rose-600 shrink-0"
                title="הסר השפעה"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        {canEdit && otherStages.length > 0 && (
          <button
            type="button"
            onClick={() => addImpact.mutate({ planId, decisionId: decision.id })}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            <Plus className="w-3 h-3" />
            הוסף השפעה על שלב אחר
          </button>
        )}
      </div>
    </div>
  );
}
