import { useEffect, useMemo, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useNavigate,
  useParams,
  useOutletContext,
} from "react-router-dom";
import {
  ChevronRight,
  Loader2,
  Target,
  Lightbulb,
  ListChecks,
  Network,
  Copy,
  CalendarRange,
  Square,
  Columns3,
  Rows3,
  Share2,
} from "lucide-react";
import { ScreenScaffold } from "@/components/layout/ScreenScaffold";
import { cn } from "@/lib/utils/cn";
import { useOrgScope } from "@/lib/hooks/useOrgScope";
import { usePlan, usePlanTasks, useUpdatePlan } from "@/lib/hooks/usePlans";
import {
  buildPlanTree,
  unassignedPlanTasks,
  CALENDAR_DISPLAY_META,
  type Plan,
  type PlanTask,
  type CalendarDisplayMode,
} from "@/lib/types/plans";
import { ClonePlanDialog } from "@/components/plans/ClonePlanDialog";
import { ImportantThingsBanner } from "@/components/plans/ImportantThingsBanner";
import { ShareListModal } from "@/components/tasks/ShareListModal";
import { PlanTasksTable } from "@/components/plans/PlanTasksTable";
import { PlanDecisionsTab } from "@/components/plans/PlanDecisionsTab";
import { PlanImpactMatrix } from "@/components/plans/PlanImpactMatrix";

// ---------------------------------------------------------------------------
// Outlet context handed to each plan sub-screen
// ---------------------------------------------------------------------------

export interface PlanOutletContext {
  plan: Plan;
  planId: string;
  tasks: PlanTask[];
  stages: { id: string; title: string }[];
  canEdit: boolean;
}

export function usePlanContext(): PlanOutletContext {
  return useOutletContext<PlanOutletContext>();
}

const TABS: { to: string; label: string; icon: typeof ListChecks }[] = [
  { to: "concept", label: "רעיוני", icon: Lightbulb },
  { to: "tasks", label: "משימות", icon: ListChecks },
  { to: "impacts", label: "השפעות", icon: Network },
];

type ViewMode = "single" | "columns" | "rows";
const VIEW_KEY = "multitask:plan:viewMode";
function readViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "single" || v === "columns" || v === "rows") return v;
  } catch { /* ignore */ }
  return "single";
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

export function PlanShell() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { data: plan, isLoading, isError } = usePlan(planId);
  const { data: tasks = [] } = usePlanTasks(planId);

  if (isLoading) {
    return (
      <ScreenScaffold title="תוכנית עבודה">
        <div className="card p-10 text-center text-ink-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          טוענת תוכנית…
        </div>
      </ScreenScaffold>
    );
  }

  if (isError || !plan || !planId) {
    return (
      <ScreenScaffold title="תוכנית לא נמצאה">
        <div className="card p-8 text-center">
          <p className="text-sm text-ink-600 mb-3">התוכנית לא נמצאה או שאין לך גישה אליה.</p>
          <button type="button" onClick={() => navigate("/app/goals")} className="btn-primary text-sm">
            חזרה ליעדים
          </button>
        </div>
      </ScreenScaffold>
    );
  }

  return <PlanShellLoaded plan={plan} planId={planId} tasks={tasks as PlanTask[]} />;
}

function PlanShellLoaded({
  plan,
  planId,
  tasks,
}: {
  plan: Plan;
  planId: string;
  tasks: PlanTask[];
}) {
  const { userId } = useOrgScope();
  const navigate = useNavigate();
  const updatePlan = useUpdatePlan();
  const [cloneOpen, setCloneOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(() => readViewMode());
  const setViewModePersist = (v: ViewMode) => {
    setViewMode(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
  };

  const canEdit = plan.owner_id === userId;
  const tree = useMemo(() => buildPlanTree(tasks), [tasks]);
  const stages = useMemo(() => tree.map((s) => ({ id: s.id, title: s.title })), [tree]);
  const assignTree = useMemo(
    () =>
      tree.map((s) => ({
        id: s.id,
        title: s.title,
        goals: s.goals.map((g) => ({ id: g.id, title: g.title })),
      })),
    [tree]
  );
  const importantItems = useMemo(() => unassignedPlanTasks(tasks), [tasks]);

  return (
    <ScreenScaffold
      title=""
      actions={
        <>
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setShareOpen(true)}
            className="btn-ghost text-sm flex items-center gap-1.5 disabled:opacity-40"
          >
            <Share2 className="w-4 h-4" />
            שיתוף
          </button>
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setCloneOpen(true)}
            className="btn-ghost text-sm flex items-center gap-1.5 disabled:opacity-40"
          >
            <Copy className="w-4 h-4" />
            שכפל לתוכנית קצרה
          </button>
        </>
      }
    >
      <PlanHeader plan={plan} planId={planId} canEdit={canEdit} onPatch={(p) => updatePlan.mutate({ planId, patch: p })} />

      <div className="mt-4">
        <ImportantThingsBanner planId={planId} items={importantItems} assignTree={assignTree} canEdit={canEdit} />
      </div>

      <div className="mt-2 flex items-center justify-end">
        <ViewModeToggle mode={viewMode} onChange={setViewModePersist} />
      </div>

      {viewMode === "single" ? (
        <>
          <PlanTabsNav />
          <div className="mt-4">
            <Outlet context={{ plan, planId, tasks, stages, canEdit } satisfies PlanOutletContext} />
          </div>
        </>
      ) : (
        <div
          className={cn(
            "mt-3",
            viewMode === "columns"
              ? "grid grid-cols-1 xl:grid-cols-3 gap-4 items-start"
              : "space-y-4"
          )}
        >
          <SectionPanel icon={<Lightbulb className="w-4 h-4 text-primary-600" />} title="רעיוני">
            <PlanDecisionsTab planId={planId} stages={stages} canEdit={canEdit} />
          </SectionPanel>
          <SectionPanel icon={<ListChecks className="w-4 h-4 text-primary-600" />} title="משימות">
            <PlanTasksTable planId={planId} tasks={tasks} canEdit={canEdit} />
          </SectionPanel>
          <SectionPanel icon={<Network className="w-4 h-4 text-primary-600" />} title="השפעות">
            <PlanImpactMatrix planId={planId} stages={stages} canEdit={canEdit} />
          </SectionPanel>
        </div>
      )}

      {cloneOpen && (
        <ClonePlanDialog
          sourcePlanId={plan.id}
          sourceName={plan.name}
          onClose={() => setCloneOpen(false)}
          onCloned={(id) => {
            setCloneOpen(false);
            navigate(`/app/goals/plan/${id}`);
          }}
        />
      )}

      {shareOpen && <ShareListModal list={plan} onClose={() => setShareOpen(false)} />}
    </ScreenScaffold>
  );
}

function ViewModeToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  const opts: { id: ViewMode; label: string; icon: typeof Square }[] = [
    { id: "single", label: "אחד", icon: Square },
    { id: "columns", label: "זה לצד זה", icon: Columns3 },
    { id: "rows", label: "מתחת", icon: Rows3 },
  ];
  return (
    <div className="inline-flex rounded-lg border border-ink-200 overflow-hidden text-sm">
      {opts.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 transition-colors border-e border-ink-200 last:border-e-0",
            mode === id ? "bg-primary-600 text-white" : "bg-white text-ink-500 hover:bg-ink-50"
          )}
          title={label}
        >
          <Icon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

function SectionPanel({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-4">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-ink-100">
        {icon}
        <h3 className="text-sm font-semibold text-ink-800">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function PlanTabsNav() {
  return (
    <nav className="mt-4 flex items-center gap-1 border-b border-ink-200 overflow-x-auto scrollbar-thin">
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors",
              isActive
                ? "border-primary-500 text-primary-700"
                : "border-transparent text-ink-500 hover:text-ink-800 hover:border-ink-300"
            )
          }
        >
          <Icon className="w-4 h-4" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Header (editable name / range / general goal / calendar mode)
// ---------------------------------------------------------------------------

function PlanHeader({
  plan,
  canEdit,
  onPatch,
}: {
  plan: Plan;
  planId: string;
  canEdit: boolean;
  onPatch: (patch: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState(plan.name);
  const [goal, setGoal] = useState(plan.plan_general_goal ?? "");

  useEffect(() => {
    setName(plan.name);
    setGoal(plan.plan_general_goal ?? "");
  }, [plan.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const commitName = () => {
    const t = name.trim();
    if (!t || t === plan.name) {
      setName(plan.name);
      return;
    }
    onPatch({ name: t });
  };
  const commitGoal = () => {
    const next = goal.trim() || null;
    if (next === (plan.plan_general_goal ?? null)) return;
    onPatch({ plan_general_goal: next });
  };

  return (
    <header className="space-y-3">
      <Link
        to="/app/goals"
        className="inline-flex items-center gap-1 text-xs text-ink-500 hover:text-ink-800 transition-colors"
      >
        <ChevronRight className="w-3.5 h-3.5" />
        חזרה ליעדים
      </Link>

      <div className="flex items-start gap-3">
        <Target className="w-7 h-7 text-primary-600 shrink-0 mt-1" />
        <div className="min-w-0 flex-1">
          <input
            value={name}
            disabled={!canEdit}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
            className="w-full text-2xl md:text-3xl font-bold text-ink-900 bg-transparent border-0 outline-none focus:ring-2 focus:ring-primary-500/25 rounded px-1 -mx-1"
            placeholder="שם התוכנית…"
          />
          <textarea
            value={goal}
            disabled={!canEdit}
            onChange={(e) => setGoal(e.target.value)}
            onBlur={commitGoal}
            rows={1}
            placeholder="🎯 המטרה הכוללת של התוכנית…"
            className="w-full text-sm text-ink-500 bg-transparent border-0 outline-none focus:ring-2 focus:ring-primary-500/25 rounded px-1 -mx-1 mt-1 resize-y"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="inline-flex items-center gap-1.5">
          <span className="text-ink-500 text-xs">מ־</span>
          <input
            type="date"
            disabled={!canEdit}
            value={plan.plan_start_date ?? ""}
            max={plan.plan_end_date ?? undefined}
            onChange={(e) => {
              const v = e.target.value || null;
              const patch: Record<string, unknown> = { plan_start_date: v };
              // keep end ≥ start
              if (v && plan.plan_end_date && plan.plan_end_date < v) patch.plan_end_date = v;
              onPatch(patch);
            }}
            className="field text-xs py-1 w-auto"
          />
        </label>
        <label className="inline-flex items-center gap-1.5">
          <span className="text-ink-500 text-xs">עד</span>
          <input
            type="date"
            disabled={!canEdit}
            value={plan.plan_end_date ?? ""}
            min={plan.plan_start_date ?? undefined}
            onChange={(e) => {
              let v = e.target.value || null;
              // never let end precede start
              if (v && plan.plan_start_date && v < plan.plan_start_date) v = plan.plan_start_date;
              onPatch({ plan_end_date: v });
            }}
            className="field text-xs py-1 w-auto"
          />
        </label>
        <label className="inline-flex items-center gap-1.5">
          <CalendarRange className="w-3.5 h-3.5 text-ink-400" />
          <select
            disabled={!canEdit}
            value={(plan.calendar_display_mode as CalendarDisplayMode) ?? "off"}
            onChange={(e) => onPatch({ calendar_display_mode: e.target.value })}
            className="field text-xs py-1 w-auto"
            title="ויזואליות ביומן"
          >
            {(Object.keys(CALENDAR_DISPLAY_META) as CalendarDisplayMode[]).map((m) => (
              <option key={m} value={m}>יומן: {CALENDAR_DISPLAY_META[m].label}</option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Routed tab pages (read context from the shell)
// ---------------------------------------------------------------------------

export function PlanConceptPage() {
  const { planId, stages, canEdit } = usePlanContext();
  return <PlanDecisionsTab planId={planId} stages={stages} canEdit={canEdit} />;
}

export function PlanTasksPage() {
  const { planId, tasks, canEdit } = usePlanContext();
  return <PlanTasksTable planId={planId} tasks={tasks} canEdit={canEdit} />;
}

export function PlanImpactsPage() {
  const { planId, stages, canEdit } = usePlanContext();
  return <PlanImpactMatrix planId={planId} stages={stages} canEdit={canEdit} />;
}
