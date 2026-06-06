/**
 * Service layer for goal-plans (תוכניות עבודה).
 *
 * A plan is a task_list with kind='plan'; stages/tasks are real rows in the
 * `tasks` table (is_phase distinguishes a stage). The plan_* columns and the
 * plan_decisions / plan_decision_impacts / plan_stage_impacts tables come from
 * migration 20260606000001. Until typegen catches up we go through `db` (an
 * `any` view of the client) — the documented convention in this codebase.
 */
import { supabase } from "@/lib/supabase/client";
import type {
  Plan,
  PlanTask,
  PlanStatus,
  PlanDecision,
  PlanDecisionImpact,
  PlanDecisionWithImpacts,
  PlanStageImpact,
} from "@/lib/types/plans";

// Typed-lag escape hatch (see CLAUDE.md "Supabase type lag").
const db = supabase as any;

const SORT_STEP = 1000;

// ---------------------------------------------------------------------------
// Plans (task_lists with kind='plan')
// ---------------------------------------------------------------------------

export async function listPlans(organizationId: string): Promise<Plan[]> {
  const { data, error } = await db
    .from("task_lists")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("kind", "plan")
    .eq("is_archived", false)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Plan[];
}

export async function getPlan(planId: string): Promise<Plan | null> {
  const { data, error } = await db
    .from("task_lists")
    .select("*")
    .eq("id", planId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Plan | null;
}

export interface CreatePlanInput {
  organization_id: string;
  owner_id: string;
  name: string;
  plan_start_date?: string | null;
  plan_end_date?: string | null;
  plan_horizon?: string | null;
  plan_general_goal?: string | null;
  color?: string | null;
}

export async function createPlan(input: CreatePlanInput): Promise<Plan> {
  const { data: last } = await db
    .from("task_lists")
    .select("sort_order")
    .eq("organization_id", input.organization_id)
    .order("sort_order", { ascending: false })
    .limit(1);
  const sortOrder = (last?.[0]?.sort_order ?? 0) + SORT_STEP;

  const { data, error } = await db
    .from("task_lists")
    .insert({ ...input, kind: "plan", sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data as Plan;
}

export async function updatePlan(
  planId: string,
  patch: Partial<Plan>
): Promise<Plan> {
  const { data, error } = await db
    .from("task_lists")
    .update(patch)
    .eq("id", planId)
    .select()
    .single();
  if (error) throw error;
  return data as Plan;
}

export async function archivePlan(planId: string): Promise<void> {
  const now = new Date();
  const expires = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const { error } = await db
    .from("task_lists")
    .update({
      is_archived: true,
      archived_at: now.toISOString(),
      archive_expires_at: expires.toISOString(),
    })
    .eq("id", planId);
  if (error) throw error;
}

/** Full copy + parent link, no live sync (duplicate_plan RPC). */
export async function duplicatePlan(input: {
  sourcePlanId: string;
  name?: string | null;
  horizon?: string | null;
  start?: string | null;
  end?: string | null;
}): Promise<string> {
  const { data, error } = await db.rpc("duplicate_plan", {
    p_source_plan_id: input.sourcePlanId,
    p_new_name: input.name ?? null,
    p_horizon: input.horizon ?? null,
    p_start: input.start ?? null,
    p_end: input.end ?? null,
  });
  if (error) throw error;
  return data as string;
}

// ---------------------------------------------------------------------------
// Stages + tasks (rows in `tasks`)
// ---------------------------------------------------------------------------

export async function listPlanTasks(planId: string): Promise<PlanTask[]> {
  const { data, error } = await db
    .from("tasks")
    .select("*")
    .eq("task_list_id", planId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PlanTask[];
}

async function nextSortOrder(
  organizationId: string,
  scope: { parent_task_id: string | null; task_list_id: string }
): Promise<number> {
  let q = db
    .from("tasks")
    .select("sort_order")
    .eq("organization_id", organizationId)
    .eq("task_list_id", scope.task_list_id)
    .order("sort_order", { ascending: false })
    .limit(1);
  q = scope.parent_task_id
    ? q.eq("parent_task_id", scope.parent_task_id)
    : q.is("parent_task_id", null);
  const { data } = await q;
  return (data?.[0]?.sort_order ?? 0) + SORT_STEP;
}

export async function createStage(input: {
  organization_id: string;
  owner_id: string;
  plan_id: string;
  title: string;
}): Promise<PlanTask> {
  const sort_order = await nextSortOrder(input.organization_id, {
    parent_task_id: null,
    task_list_id: input.plan_id,
  });
  const { data, error } = await db
    .from("tasks")
    .insert({
      organization_id: input.organization_id,
      owner_id: input.owner_id,
      task_list_id: input.plan_id,
      parent_task_id: null,
      is_phase: true,
      title: input.title,
      status: "todo",
      plan_status: "notstarted",
      sort_order,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PlanTask;
}

export async function createPlanTask(input: {
  organization_id: string;
  owner_id: string;
  plan_id: string;
  stage_id: string;
  title: string;
}): Promise<PlanTask> {
  const sort_order = await nextSortOrder(input.organization_id, {
    parent_task_id: input.stage_id,
    task_list_id: input.plan_id,
  });
  const { data, error } = await db
    .from("tasks")
    .insert({
      organization_id: input.organization_id,
      owner_id: input.owner_id,
      task_list_id: input.plan_id,
      parent_task_id: input.stage_id,
      is_phase: false,
      title: input.title,
      status: "todo",
      plan_status: "notstarted",
      sort_order,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PlanTask;
}

export interface PlanRowPatch {
  title?: string;
  description?: string | null;
  urgency?: number;
  plan_time_range?: string | null;
  plan_success_metric?: string | null;
  plan_quant_target?: string | null;
  plan_status?: PlanStatus | null;
}

export async function updatePlanRow(
  taskId: string,
  patch: PlanRowPatch
): Promise<PlanTask> {
  const { data, error } = await db
    .from("tasks")
    .update(patch)
    .eq("id", taskId)
    .select()
    .single();
  if (error) throw error;
  return data as PlanTask;
}

export async function deletePlanRow(taskId: string): Promise<void> {
  const { error } = await db.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Decisions (שאלות → החלטות → השפעות)
// ---------------------------------------------------------------------------

export async function listPlanDecisions(
  planId: string
): Promise<PlanDecisionWithImpacts[]> {
  const { data: decisions, error } = await db
    .from("plan_decisions")
    .select("*")
    .eq("plan_id", planId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  const rows = (decisions ?? []) as PlanDecision[];
  if (rows.length === 0) return [];

  const { data: impacts, error: iErr } = await db
    .from("plan_decision_impacts")
    .select("*")
    .in(
      "decision_id",
      rows.map((d) => d.id)
    )
    .order("sort_order", { ascending: true });
  if (iErr) throw iErr;
  const byDecision = new Map<string, PlanDecisionImpact[]>();
  for (const im of (impacts ?? []) as PlanDecisionImpact[]) {
    const arr = byDecision.get(im.decision_id) ?? [];
    arr.push(im);
    byDecision.set(im.decision_id, arr);
  }
  return rows.map((d) => ({ ...d, impacts: byDecision.get(d.id) ?? [] }));
}

export async function createPlanDecision(input: {
  organization_id: string;
  plan_id: string;
  stage_task_id: string | null;
  question?: string;
  decision?: string;
}): Promise<PlanDecision> {
  const { data, error } = await db
    .from("plan_decisions")
    .insert({
      organization_id: input.organization_id,
      plan_id: input.plan_id,
      stage_task_id: input.stage_task_id,
      question: input.question ?? "",
      decision: input.decision ?? "",
    })
    .select()
    .single();
  if (error) throw error;
  return data as PlanDecision;
}

export async function updatePlanDecision(
  decisionId: string,
  patch: Partial<Pick<PlanDecision, "question" | "decision" | "sort_order" | "stage_task_id">>
): Promise<void> {
  const { error } = await db
    .from("plan_decisions")
    .update(patch)
    .eq("id", decisionId);
  if (error) throw error;
}

export async function deletePlanDecision(decisionId: string): Promise<void> {
  const { error } = await db.from("plan_decisions").delete().eq("id", decisionId);
  if (error) throw error;
}

export async function addDecisionImpact(input: {
  organization_id: string;
  decision_id: string;
  affected_stage_task_id?: string | null;
  note?: string;
}): Promise<PlanDecisionImpact> {
  const { data, error } = await db
    .from("plan_decision_impacts")
    .insert({
      organization_id: input.organization_id,
      decision_id: input.decision_id,
      affected_stage_task_id: input.affected_stage_task_id ?? null,
      note: input.note ?? "",
    })
    .select()
    .single();
  if (error) throw error;
  return data as PlanDecisionImpact;
}

export async function updateDecisionImpact(
  impactId: string,
  patch: Partial<Pick<PlanDecisionImpact, "note" | "affected_stage_task_id" | "sort_order">>
): Promise<void> {
  const { error } = await db
    .from("plan_decision_impacts")
    .update(patch)
    .eq("id", impactId);
  if (error) throw error;
}

export async function deleteDecisionImpact(impactId: string): Promise<void> {
  const { error } = await db
    .from("plan_decision_impacts")
    .delete()
    .eq("id", impactId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Stage impact matrix (מטריצת השפעות בין שלבים)
// ---------------------------------------------------------------------------

export async function listStageImpacts(
  planId: string
): Promise<PlanStageImpact[]> {
  const { data, error } = await db
    .from("plan_stage_impacts")
    .select("*")
    .eq("plan_id", planId);
  if (error) throw error;
  return (data ?? []) as PlanStageImpact[];
}

export async function setStageImpact(input: {
  organization_id: string;
  plan_id: string;
  source_stage_id: string;
  target_stage_id: string;
  impact_level: number | null;
  note?: string;
}): Promise<void> {
  const { error } = await db.from("plan_stage_impacts").upsert(
    {
      organization_id: input.organization_id,
      plan_id: input.plan_id,
      source_stage_id: input.source_stage_id,
      target_stage_id: input.target_stage_id,
      impact_level: input.impact_level,
      note: input.note ?? "",
    },
    { onConflict: "source_stage_id,target_stage_id" }
  );
  if (error) throw error;
}

export async function clearStageImpact(input: {
  source_stage_id: string;
  target_stage_id: string;
}): Promise<void> {
  const { error } = await db
    .from("plan_stage_impacts")
    .delete()
    .eq("source_stage_id", input.source_stage_id)
    .eq("target_stage_id", input.target_stage_id);
  if (error) throw error;
}
