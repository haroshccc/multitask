import { cn } from "@/lib/utils/cn";
import { usePlanStageImpacts, useSetStageImpact } from "@/lib/hooks/usePlans";

interface StageRef {
  id: string;
  title: string;
}

const LEVEL_CLASS: Record<number, string> = {
  0: "bg-ink-50 text-ink-300",
  1: "bg-blue-100 text-blue-700",
  2: "bg-blue-300 text-blue-900",
  3: "bg-blue-500 text-white",
};

export function PlanImpactMatrix({
  planId,
  stages,
  canEdit,
}: {
  planId: string;
  stages: StageRef[];
  canEdit: boolean;
}) {
  const { data: impacts = [] } = usePlanStageImpacts(planId);
  const setImpact = useSetStageImpact();

  const levelOf = (src: string, tgt: string): number | null => {
    const found = impacts.find(
      (i) => i.source_stage_id === src && i.target_stage_id === tgt
    );
    return found?.impact_level ?? null;
  };

  const cycle = (src: string, tgt: string) => {
    const cur = levelOf(src, tgt) ?? 0;
    const next = cur >= 3 ? null : ((cur + 1) as number);
    setImpact.mutate({
      planId,
      sourceStageId: src,
      targetStageId: tgt,
      level: next,
    });
  };

  if (stages.length < 2) {
    return (
      <div className="card p-6 text-center text-ink-500 text-sm">
        צריך לפחות שני שלבים כדי לבנות מטריצת השפעות.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-500">
        מידת ההשפעה של כל שלב (שורה) על שלב אחר (עמודה). לחיצה מעלה את העוצמה
        (0–3).
      </p>
      <div className="overflow-x-auto">
        <table className="border-collapse text-sm">
          <thead>
            <tr>
              <th className="p-2 text-start text-[11px] text-ink-400 font-medium">
                משפיע ↓ / מושפע →
              </th>
              {stages.map((s) => (
                <th
                  key={s.id}
                  className="p-2 text-[11px] font-medium text-ink-600 align-bottom"
                >
                  <div className="max-w-[6rem] truncate" title={s.title}>
                    {s.title}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stages.map((src) => (
              <tr key={src.id}>
                <th className="p-2 text-start text-xs font-medium text-ink-700 max-w-[8rem] truncate" title={src.title}>
                  {src.title}
                </th>
                {stages.map((tgt) => {
                  if (src.id === tgt.id) {
                    return (
                      <td key={tgt.id} className="p-1">
                        <div className="w-10 h-8 rounded-md bg-ink-100 text-ink-300 flex items-center justify-center">
                          —
                        </div>
                      </td>
                    );
                  }
                  const lvl = levelOf(src.id, tgt.id) ?? 0;
                  return (
                    <td key={tgt.id} className="p-1">
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => cycle(src.id, tgt.id)}
                        className={cn(
                          "w-10 h-8 rounded-md flex items-center justify-center text-xs font-semibold tabular-nums transition-colors",
                          LEVEL_CLASS[lvl],
                          canEdit && "hover:ring-2 hover:ring-blue-300"
                        )}
                        title={`השפעה ${lvl}/3`}
                      >
                        {lvl > 0 ? lvl : ""}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
