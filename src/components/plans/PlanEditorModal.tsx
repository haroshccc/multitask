import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Lightbulb,
  ListChecks,
  Network,
  Copy,
  CalendarRange,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useOrgScope } from "@/lib/hooks/useOrgScope";
import {
  usePlan,
  usePlanTasks,
  useUpdatePlan,
  useDuplicatePlan,
} from "@/lib/hooks/usePlans";
import {
  buildPlanTree,
  CALENDAR_DISPLAY_META,
  PLAN_HORIZONS,
  type CalendarDisplayMode,
} from "@/lib/types/plans";
import { formatPlanRange, addMonthsToDate, todayIso } from "./plan-format";
import { PlanTasksTable } from "./PlanTasksTable";
import { PlanDecisionsTab } from "./PlanDecisionsTab";
import { PlanImpactMatrix } from "./PlanImpactMatrix";

type Tab = "concept" | "tasks" | "impacts";

export function PlanEditorModal({
  planId,
  onClose,
  onOpenPlan,
}: {
  planId: string | null;
  onClose: () => void;
  onOpenPlan?: (id: string) => void;
}) {
  const { userId } = useOrgScope();
  const { data: plan } = usePlan(planId);
  const { data: tasks = [] } = usePlanTasks(planId);
  const updatePlan = useUpdatePlan();
  const [tab, setTab] = useState<Tab>("concept");
  const [cloneOpen, setCloneOpen] = useState(false);

  const stages = useMemo(
    () => buildPlanTree(tasks as any).map((s) => ({ id: s.id, title: s.title })),
    [tasks]
  );

  const open = !!planId;
  const canEdit = !!plan && plan.owner_id === userId;

  const setField = (patch: Record<string, unknown>) => {
    if (planId) updatePlan.mutate({ planId, patch: patch as any });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          dir="rtl"
          className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto"
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-lift w-full max-w-5xl my-8 overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="px-5 py-3 border-b border-ink-200 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary-600 shrink-0" />
                  <input
                    value={plan?.name ?? ""}
                    disabled={!canEdit}
                    onChange={(e) => setField({ name: e.target.value })}
                    placeholder="שם התוכנית"
                    className="text-lg font-semibold text-ink-900 bg-transparent border-0 outline-none flex-1 min-w-0"
                  />
                </div>
                <div className="text-xs text-ink-500 mt-0.5 ps-7">
                  {formatPlanRange(plan?.plan_start_date ?? null, plan?.plan_end_date ?? null)}
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-100" type="button" aria-label="סגור">
                <X className="w-4 h-4 text-ink-600" />
              </button>
            </div>

            {/* Meta row */}
            <div className="px-5 py-2.5 border-b border-ink-100 bg-ink-50/40 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <label className="inline-flex items-center gap-1.5">
                <span className="text-ink-500 text-xs">מ־</span>
                <input type="date" disabled={!canEdit} value={plan?.plan_start_date ?? ""} onChange={(e) => setField({ plan_start_date: e.target.value || null })} className="field text-xs py-1 w-auto" />
              </label>
              <label className="inline-flex items-center gap-1.5">
                <span className="text-ink-500 text-xs">עד</span>
                <input type="date" disabled={!canEdit} value={plan?.plan_end_date ?? ""} onChange={(e) => setField({ plan_end_date: e.target.value || null })} className="field text-xs py-1 w-auto" />
              </label>

              <label className="inline-flex items-center gap-1.5">
                <CalendarRange className="w-3.5 h-3.5 text-ink-400" />
                <select
                  disabled={!canEdit}
                  value={(plan?.calendar_display_mode as CalendarDisplayMode) ?? "off"}
                  onChange={(e) => setField({ calendar_display_mode: e.target.value })}
                  className="field text-xs py-1 w-auto"
                  title="ויזואליות ביומן"
                >
                  {(Object.keys(CALENDAR_DISPLAY_META) as CalendarDisplayMode[]).map((m) => (
                    <option key={m} value={m}>
                      יומן: {CALENDAR_DISPLAY_META[m].label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                disabled={!canEdit}
                onClick={() => setCloneOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 disabled:opacity-40 ms-auto"
              >
                <Copy className="w-3.5 h-3.5" />
                שכפל לתוכנית קצרה
              </button>
            </div>

            {/* General goal */}
            <div className="px-5 pt-3">
              <textarea
                value={plan?.plan_general_goal ?? ""}
                disabled={!canEdit}
                onChange={(e) => setField({ plan_general_goal: e.target.value })}
                placeholder="🎯 המטרה הכוללת של התוכנית…"
                rows={2}
                className="field text-sm w-full resize-y"
              />
            </div>

            {/* Tabs */}
            <div className="px-5 pt-3 flex items-center gap-1 text-sm">
              <TabBtn active={tab === "concept"} onClick={() => setTab("concept")} icon={<Lightbulb className="w-4 h-4" />}>רעיוני</TabBtn>
              <TabBtn active={tab === "tasks"} onClick={() => setTab("tasks")} icon={<ListChecks className="w-4 h-4" />}>משימות</TabBtn>
              <TabBtn active={tab === "impacts"} onClick={() => setTab("impacts")} icon={<Network className="w-4 h-4" />}>השפעות</TabBtn>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto flex-1">
              {!planId ? null : tab === "tasks" ? (
                <PlanTasksTable planId={planId} tasks={tasks as any} canEdit={canEdit} />
              ) : tab === "concept" ? (
                <PlanDecisionsTab planId={planId} stages={stages} canEdit={canEdit} />
              ) : (
                <PlanImpactMatrix planId={planId} stages={stages} canEdit={canEdit} />
              )}
            </div>
          </motion.div>

          {cloneOpen && plan && (
            <CloneDialog
              sourceName={plan.name}
              onClose={() => setCloneOpen(false)}
              onCloned={(id) => {
                setCloneOpen(false);
                onOpenPlan?.(id);
              }}
              sourcePlanId={plan.id}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg border-b-2 transition-colors",
        active
          ? "border-primary-600 text-primary-700 font-medium"
          : "border-transparent text-ink-500 hover:text-ink-700"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function CloneDialog({
  sourcePlanId,
  sourceName,
  onClose,
  onCloned,
}: {
  sourcePlanId: string;
  sourceName: string;
  onClose: () => void;
  onCloned: (newId: string) => void;
}) {
  const duplicate = useDuplicatePlan();
  const [name, setName] = useState(`${sourceName} — רבעון`);
  const [horizonId, setHorizonId] = useState("quarter");
  const [start, setStart] = useState(todayIso());

  const horizon = PLAN_HORIZONS.find((h) => h.id === horizonId) ?? PLAN_HORIZONS[0];
  const end = horizon.months ? addMonthsToDate(start, horizon.months) : null;

  const submit = () => {
    duplicate.mutate(
      {
        sourcePlanId,
        name: name.trim() || null,
        horizon: horizonId,
        start: start || null,
        end,
      },
      { onSuccess: (newId) => onCloned(newId) }
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
          <Copy className="w-4 h-4 text-primary-600" />
          שכפול לתוכנית קצרה
        </h3>
        <p className="text-xs text-ink-500">
          העתקה מלאה של השלבים, המשימות, ההחלטות והמטריצה. התוכנית החדשה תישאר
          מקושרת למקור אך ניתנת לעריכה מלאה ועצמאית.
        </p>

        <label className="block text-sm">
          <span className="text-ink-600 text-xs">שם</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className="field text-sm w-full mt-1" />
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
            disabled={duplicate.isPending}
            className="btn-primary text-sm disabled:opacity-50"
          >
            {duplicate.isPending ? "משכפל…" : "שכפל"}
          </button>
        </div>
      </div>
    </div>
  );
}
