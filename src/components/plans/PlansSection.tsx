import { useMemo, useState } from "react";
import {
  ClipboardList,
  Plus,
  GitBranch,
  CalendarRange,
  MoreVertical,
  Archive,
} from "lucide-react";
import {
  usePlans,
  useCreatePlan,
  useArchivePlan,
} from "@/lib/hooks/usePlans";
import {
  CALENDAR_DISPLAY_META,
  PLAN_HORIZONS,
  type Plan,
  type CalendarDisplayMode,
} from "@/lib/types/plans";
import { formatPlanRange, addMonthsToDate, todayIso } from "./plan-format";
import { PlanEditorModal } from "./PlanEditorModal";

export function PlansSection() {
  const { data: plans = [], isLoading } = usePlans();
  const [editId, setEditId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of plans) m.set(p.id, p.name);
    return m;
  }, [plans]);

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList className="w-4 h-4 text-ink-600" />
        <h2 className="text-sm font-semibold text-ink-800">תוכניות עבודה</h2>
        {plans.length > 0 && (
          <span className="text-[11px] bg-ink-100 text-ink-500 rounded-full px-1.5 py-0.5">
            {plans.length}
          </span>
        )}
        <div className="flex-1 h-px bg-ink-200" />
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700"
        >
          <Plus className="w-3.5 h-3.5" />
          תוכנית חדשה
        </button>
      </div>

      {isLoading ? (
        <div className="card p-4 text-center text-ink-400 text-sm">טוען…</div>
      ) : plans.length === 0 ? (
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="card card-lift w-full p-5 text-center text-ink-500 text-sm flex flex-col items-center gap-2"
        >
          <ClipboardList className="w-6 h-6 text-ink-300" />
          <span className="font-medium text-ink-700">בנו תוכנית עבודה לעמידה ביעדים</span>
          <span className="text-xs">שלבים, משימות, החלטות ויעדים כמותיים — במקום אחד.</span>
        </button>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              parentName={p.parent_plan_id ? nameById.get(p.parent_plan_id) ?? null : null}
              onOpen={() => setEditId(p.id)}
            />
          ))}
        </div>
      )}

      <PlanEditorModal
        planId={editId}
        onClose={() => setEditId(null)}
        onOpenPlan={(id) => setEditId(id)}
      />

      {createOpen && (
        <CreatePlanDialog
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false);
            setEditId(id);
          }}
        />
      )}
    </section>
  );
}

function PlanCard({
  plan,
  parentName,
  onOpen,
}: {
  plan: Plan;
  parentName: string | null;
  onOpen: () => void;
}) {
  const archivePlan = useArchivePlan();
  const [menuOpen, setMenuOpen] = useState(false);
  const calMode = (plan.calendar_display_mode as CalendarDisplayMode) ?? "off";

  return (
    <article className="card card-lift p-4 relative cursor-pointer" onClick={onOpen}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink-900 truncate flex-1">{plan.name}</h3>
        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="p-1 rounded hover:bg-ink-100 text-ink-400"
            aria-label="תפריט"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute end-0 mt-1 z-20 bg-white rounded-lg shadow-lift border border-ink-100 py-1 w-40">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    if (confirm(`להעביר את "${plan.name}" לארכיון?`)) {
                      archivePlan.mutate(plan.id);
                    }
                  }}
                  className="w-full text-start px-3 py-1.5 text-sm text-ink-600 hover:bg-ink-50 flex items-center gap-2"
                >
                  <Archive className="w-3.5 h-3.5" />
                  העבר לארכיון
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-ink-500 mt-1">
        <CalendarRange className="w-3.5 h-3.5" />
        {formatPlanRange(plan.plan_start_date, plan.plan_end_date)}
      </div>

      {plan.plan_general_goal && (
        <p className="text-xs text-ink-500 mt-2 line-clamp-2">{plan.plan_general_goal}</p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
        {parentName && (
          <span className="inline-flex items-center gap-1 text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
            <GitBranch className="w-3 h-3" />
            נגזר מ־{parentName}
          </span>
        )}
        {calMode !== "off" && (
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-600 bg-ink-50 border border-ink-200 rounded-full px-2 py-0.5">
            <CalendarRange className="w-3 h-3" />
            יומן: {CALENDAR_DISPLAY_META[calMode].label}
          </span>
        )}
      </div>
    </article>
  );
}

function CreatePlanDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const createPlan = useCreatePlan();
  const [name, setName] = useState("");
  const [horizonId, setHorizonId] = useState("1y");
  const [start, setStart] = useState(todayIso());

  const horizon = PLAN_HORIZONS.find((h) => h.id === horizonId) ?? PLAN_HORIZONS[2];
  const end = horizon.months ? addMonthsToDate(start, horizon.months) : null;

  const submit = () => {
    if (!name.trim()) return;
    createPlan.mutate(
      {
        name: name.trim(),
        plan_start_date: start || null,
        plan_end_date: end,
        plan_horizon: horizonId,
      },
      { onSuccess: (p) => onCreated(p.id) }
    );
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-ink-900/40 flex items-center justify-center p-4"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="bg-white rounded-2xl shadow-lift w-full max-w-md p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-ink-900 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary-600" />
          תוכנית עבודה חדשה
        </h3>

        <label className="block text-sm">
          <span className="text-ink-600 text-xs">שם התוכנית</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="למשל: תוכנית עבודה 2026–2028"
            className="field text-sm w-full mt-1"
          />
        </label>

        <div className="flex gap-2">
          <label className="block text-sm flex-1">
            <span className="text-ink-600 text-xs">טווח</span>
            <select value={horizonId} onChange={(e) => setHorizonId(e.target.value)} className="field text-sm w-full mt-1">
              {PLAN_HORIZONS.filter((h) => h.id !== "custom").map((h) => (
                <option key={h.id} value={h.id}>{h.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm flex-1">
            <span className="text-ink-600 text-xs">התחלה</span>
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="field text-sm w-full mt-1" />
          </label>
        </div>
        {end && (
          <p className="text-xs text-ink-400">סיום משוער: {end.split("-").reverse().join("/")}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn-ghost text-sm">ביטול</button>
          <button
            type="button"
            onClick={submit}
            disabled={!name.trim() || createPlan.isPending}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {createPlan.isPending ? "יוצר…" : "צור תוכנית"}
          </button>
        </div>
      </div>
    </div>
  );
}
