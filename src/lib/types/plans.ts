/**
 * Goal-plans domain types (תוכניות עבודה).
 *
 * A "plan" is a task_list with kind='plan'; stages are tasks with
 * is_phase=true and plan tasks are their children. The DB columns these types
 * describe are added in migration 20260606000001_goal_plans.sql — until the
 * generated `database.ts` catches up, services cast through `supabase as any`
 * and read/write these shapes manually.
 */
import type { Task, TaskList } from "./domain";

// ---------------------------------------------------------------------------
// Status (decoupled from the per-user task-status system on purpose)
// ---------------------------------------------------------------------------

export type PlanStatus = "notstarted" | "inprogress" | "done" | "dropped";

export const PLAN_STATUSES: PlanStatus[] = [
  "notstarted",
  "inprogress",
  "done",
  "dropped",
];

export const PLAN_STATUS_META: Record<
  PlanStatus,
  { label: string; symbol: string; className: string }
> = {
  notstarted: { label: "לא התחיל", symbol: "○", className: "text-ink-400 bg-ink-50 border-ink-200" },
  inprogress: { label: "בתהליך", symbol: "◑", className: "text-amber-700 bg-amber-50 border-amber-200" },
  done: { label: "הושלם", symbol: "●", className: "text-success-700 bg-success-50 border-success-200" },
  dropped: { label: "ירד מהפרק", symbol: "✗", className: "text-rose-700 bg-rose-50 border-rose-200" },
};

// ---------------------------------------------------------------------------
// Calendar visualization
// ---------------------------------------------------------------------------

export type CalendarDisplayMode = "off" | "list" | "framework";

export const CALENDAR_DISPLAY_META: Record<
  CalendarDisplayMode,
  { label: string; description: string }
> = {
  off: { label: "לא מוצג", description: "התוכנית לא מופיעה ביומן" },
  list: { label: "כרשימה", description: "המשימות המתוזמנות מופיעות ביומן כרגיל" },
  framework: { label: "כמסגרת", description: "שכבת רקע חוזרת (בקרוב)" },
};

// ---------------------------------------------------------------------------
// Horizons (used by the clone dialog)
// ---------------------------------------------------------------------------

export interface PlanHorizon {
  id: string;
  label: string;
  /** Length in months; null = custom/open-ended. */
  months: number | null;
}

export const PLAN_HORIZONS: PlanHorizon[] = [
  { id: "quarter", label: "רבעון (3 חודשים)", months: 3 },
  { id: "half", label: "חצי שנה", months: 6 },
  { id: "1y", label: "שנה", months: 12 },
  { id: "2y", label: "שנתיים", months: 24 },
  { id: "3y", label: "3 שנים", months: 36 },
  { id: "custom", label: "מותאם אישית", months: null },
];

// ---------------------------------------------------------------------------
// Entity shapes (base row + plan_* columns)
// ---------------------------------------------------------------------------

export interface Plan extends TaskList {
  plan_start_date: string | null;
  plan_end_date: string | null;
  plan_horizon: string | null;
  parent_plan_id: string | null;
  plan_general_goal: string | null;
  calendar_display_mode: CalendarDisplayMode;
}

export interface PlanTask extends Task {
  is_phase: boolean;
  plan_time_range: string | null;
  plan_success_metric: string | null;
  plan_quant_target: string | null;
  plan_status: PlanStatus | null;
}

/** A stage (is_phase) with its child plan-tasks attached. */
export interface PlanStageNode extends PlanTask {
  children: PlanTask[];
}

export interface PlanDecision {
  id: string;
  organization_id: string;
  plan_id: string;
  stage_task_id: string | null;
  question: string;
  decision: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PlanDecisionImpact {
  id: string;
  organization_id: string;
  decision_id: string;
  affected_stage_task_id: string | null;
  note: string;
  sort_order: number;
  created_at: string;
}

export interface PlanDecisionWithImpacts extends PlanDecision {
  impacts: PlanDecisionImpact[];
}

export interface PlanStageImpact {
  id: string;
  organization_id: string;
  plan_id: string;
  source_stage_id: string;
  target_stage_id: string;
  impact_level: number | null;
  note: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Group a flat list of plan tasks into stages → children, preserving
 *  sort_order at both levels. Tasks whose parent is missing are skipped. */
export function buildPlanTree(tasks: PlanTask[]): PlanStageNode[] {
  const stages = tasks
    .filter((t) => t.is_phase)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((s) => ({ ...s, children: [] as PlanTask[] }));
  const byId = new Map(stages.map((s) => [s.id, s]));
  for (const t of tasks) {
    if (t.is_phase || !t.parent_task_id) continue;
    const stage = byId.get(t.parent_task_id);
    if (stage) stage.children.push(t);
  }
  for (const s of stages) s.children.sort((a, b) => a.sort_order - b.sort_order);
  return stages;
}

/** "Things important to us" — loose plan tasks not yet under any stage
 *  (no parent, not a stage). They live only in the banner until assigned. */
export function unassignedPlanTasks(tasks: PlanTask[]): PlanTask[] {
  return tasks
    .filter((t) => !t.is_phase && !t.parent_task_id)
    .sort((a, b) => a.sort_order - b.sort_order);
}

/** Progress 0..1 across a stage's children (done counts as complete). */
export function stageProgress(stage: PlanStageNode): number {
  if (stage.children.length === 0) return stage.plan_status === "done" ? 1 : 0;
  const done = stage.children.filter((c) => c.plan_status === "done").length;
  return done / stage.children.length;
}
