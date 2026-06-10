/**
 * React-Query hooks for goal-plans (תוכניות עבודה).
 *
 * Plan tasks are real `tasks` rows, so any mutation that touches them also
 * invalidates the global tasks family (so the Tasks/Calendar screens stay in
 * sync) alongside the plan-scoped caches.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys, queryFamilies } from "@/lib/query-keys";
import * as service from "@/lib/services/plans";
import type { PlanRowPatch } from "@/lib/services/plans";
import type {
  Plan,
  PlanTask,
  PlanDecisionWithImpacts,
  PlanStageImpact,
  PlanStatus,
} from "@/lib/types/plans";
import { useOrgScope, assertOrgScope } from "./useOrgScope";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function usePlans() {
  const scope = useOrgScope();
  return useQuery<Plan[]>({
    queryKey: queryKeys.plans(scope.organizationId ?? ""),
    queryFn: () => service.listPlans(scope.organizationId!),
    enabled: scope.enabled,
  });
}

export function usePlan(planId: string | null | undefined) {
  return useQuery<Plan | null>({
    queryKey: queryKeys.plan(planId ?? ""),
    queryFn: () => service.getPlan(planId!),
    enabled: !!planId,
  });
}

export function usePlanTasks(planId: string | null | undefined) {
  return useQuery<PlanTask[]>({
    queryKey: queryKeys.planTasks(planId ?? ""),
    queryFn: () => service.listPlanTasks(planId!),
    enabled: !!planId,
  });
}

export function usePlanDecisions(planId: string | null | undefined) {
  return useQuery<PlanDecisionWithImpacts[]>({
    queryKey: queryKeys.planDecisions(planId ?? ""),
    queryFn: () => service.listPlanDecisions(planId!),
    enabled: !!planId,
  });
}

export function usePlanStageImpacts(planId: string | null | undefined) {
  return useQuery<PlanStageImpact[]>({
    queryKey: queryKeys.planStageImpacts(planId ?? ""),
    queryFn: () => service.listStageImpacts(planId!),
    enabled: !!planId,
  });
}

// ---------------------------------------------------------------------------
// Plan mutations
// ---------------------------------------------------------------------------

export function useCreatePlan() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: {
      name: string;
      plan_start_date?: string | null;
      plan_end_date?: string | null;
      plan_horizon?: string | null;
      plan_general_goal?: string | null;
      color?: string | null;
    }) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createPlan({
        ...input,
        organization_id: organizationId,
        owner_id: userId,
      });
    },
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({ queryKey: queryFamilies.allPlans(scope.organizationId) });
        qc.invalidateQueries({ queryKey: queryFamilies.allTaskLists(scope.organizationId) });
      }
    },
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({ planId, patch }: { planId: string; patch: Partial<Plan> }) =>
      service.updatePlan(planId, patch),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.plan(vars.planId) });
      if (scope.organizationId) {
        qc.invalidateQueries({ queryKey: queryFamilies.allPlans(scope.organizationId) });
      }
    },
  });
}

export function useArchivePlan() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (planId: string) => service.archivePlan(planId),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({ queryKey: queryFamilies.allPlans(scope.organizationId) });
        qc.invalidateQueries({ queryKey: queryFamilies.allTaskLists(scope.organizationId) });
      }
    },
  });
}

export function useDuplicatePlan() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: {
      sourcePlanId: string;
      name?: string | null;
      horizon?: string | null;
      start?: string | null;
      end?: string | null;
    }) => service.duplicatePlan(input),
    onSuccess: () => {
      if (scope.organizationId) {
        qc.invalidateQueries({ queryKey: queryFamilies.allPlans(scope.organizationId) });
        qc.invalidateQueries({ queryKey: queryFamilies.allTasks(scope.organizationId) });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Stage / task mutations
// ---------------------------------------------------------------------------

function useInvalidatePlanContent() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return (planId: string) => {
    qc.invalidateQueries({ queryKey: queryKeys.planTasks(planId) });
    if (scope.organizationId) {
      qc.invalidateQueries({ queryKey: queryFamilies.allTasks(scope.organizationId) });
    }
  };
}

export function useCreateStage() {
  const scope = useOrgScope();
  const invalidate = useInvalidatePlanContent();
  return useMutation({
    mutationFn: ({ planId, title }: { planId: string; title: string }) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createStage({
        organization_id: organizationId,
        owner_id: userId,
        plan_id: planId,
        title,
      });
    },
    onSuccess: (_d, vars) => invalidate(vars.planId),
  });
}

export function useCreatePlanTask() {
  const scope = useOrgScope();
  const invalidate = useInvalidatePlanContent();
  return useMutation({
    mutationFn: ({
      planId,
      parentId,
      title,
    }: {
      planId: string;
      parentId: string;
      title: string;
    }) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createPlanTask({
        organization_id: organizationId,
        owner_id: userId,
        plan_id: planId,
        parent_id: parentId,
        title,
      });
    },
    onSuccess: (_d, vars) => invalidate(vars.planId),
  });
}

export function useCreateImportantItem() {
  const scope = useOrgScope();
  const invalidate = useInvalidatePlanContent();
  return useMutation({
    mutationFn: ({ planId, title }: { planId: string; title: string }) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createImportantItem({
        organization_id: organizationId,
        owner_id: userId,
        plan_id: planId,
        title,
      });
    },
    onSuccess: (_d, vars) => invalidate(vars.planId),
  });
}

export function useAssignTaskToStage() {
  const invalidate = useInvalidatePlanContent();
  return useMutation({
    mutationFn: ({
      taskId,
      stageId,
    }: {
      planId: string;
      taskId: string;
      stageId: string | null;
    }) => service.setPlanTaskParent(taskId, stageId),
    onSuccess: (_d, vars) => invalidate(vars.planId),
  });
}

export function useUpdatePlanRow() {
  const invalidate = useInvalidatePlanContent();
  return useMutation({
    mutationFn: ({
      taskId,
      patch,
    }: {
      planId: string;
      taskId: string;
      patch: PlanRowPatch;
    }) => service.updatePlanRow(taskId, patch),
    onSuccess: (_d, vars) => invalidate(vars.planId),
  });
}

export function useDeletePlanRow() {
  const invalidate = useInvalidatePlanContent();
  return useMutation({
    mutationFn: ({ taskId }: { planId: string; taskId: string }) =>
      service.deletePlanRow(taskId),
    onSuccess: (_d, vars) => invalidate(vars.planId),
  });
}

// ---------------------------------------------------------------------------
// Decision mutations
// ---------------------------------------------------------------------------

function useInvalidateDecisions() {
  const qc = useQueryClient();
  return (planId: string) =>
    qc.invalidateQueries({ queryKey: queryKeys.planDecisions(planId) });
}

export function useCreatePlanDecision() {
  const scope = useOrgScope();
  const invalidate = useInvalidateDecisions();
  return useMutation({
    mutationFn: ({
      planId,
      stageTaskId,
    }: {
      planId: string;
      stageTaskId: string | null;
    }) => {
      const { organizationId } = assertOrgScope(scope);
      return service.createPlanDecision({
        organization_id: organizationId,
        plan_id: planId,
        stage_task_id: stageTaskId,
      });
    },
    onSuccess: (_d, vars) => invalidate(vars.planId),
  });
}

export function useUpdatePlanDecision() {
  const invalidate = useInvalidateDecisions();
  return useMutation({
    mutationFn: ({
      decisionId,
      patch,
    }: {
      planId: string;
      decisionId: string;
      patch: { question?: string; decision?: string; stage_task_id?: string | null };
    }) => service.updatePlanDecision(decisionId, patch),
    onSuccess: (_d, vars) => invalidate(vars.planId),
  });
}

export function useDeletePlanDecision() {
  const invalidate = useInvalidateDecisions();
  return useMutation({
    mutationFn: ({ decisionId }: { planId: string; decisionId: string }) =>
      service.deletePlanDecision(decisionId),
    onSuccess: (_d, vars) => invalidate(vars.planId),
  });
}

export function useAddDecisionImpact() {
  const scope = useOrgScope();
  const invalidate = useInvalidateDecisions();
  return useMutation({
    mutationFn: ({ decisionId }: { planId: string; decisionId: string }) => {
      const { organizationId } = assertOrgScope(scope);
      return service.addDecisionImpact({
        organization_id: organizationId,
        decision_id: decisionId,
      });
    },
    onSuccess: (_d, vars) => invalidate(vars.planId),
  });
}

export function useUpdateDecisionImpact() {
  const invalidate = useInvalidateDecisions();
  return useMutation({
    mutationFn: ({
      impactId,
      patch,
    }: {
      planId: string;
      impactId: string;
      patch: { note?: string; affected_stage_task_id?: string | null };
    }) => service.updateDecisionImpact(impactId, patch),
    onSuccess: (_d, vars) => invalidate(vars.planId),
  });
}

export function useDeleteDecisionImpact() {
  const invalidate = useInvalidateDecisions();
  return useMutation({
    mutationFn: ({ impactId }: { planId: string; impactId: string }) =>
      service.deleteDecisionImpact(impactId),
    onSuccess: (_d, vars) => invalidate(vars.planId),
  });
}

// ---------------------------------------------------------------------------
// Stage impact matrix mutations
// ---------------------------------------------------------------------------

export function useSetStageImpact() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (input: {
      planId: string;
      sourceStageId: string;
      targetStageId: string;
      level: number | null;
      note?: string;
    }) => {
      const { organizationId } = assertOrgScope(scope);
      if (input.level === null && !input.note) {
        return service.clearStageImpact({
          source_stage_id: input.sourceStageId,
          target_stage_id: input.targetStageId,
        });
      }
      return service.setStageImpact({
        organization_id: organizationId,
        plan_id: input.planId,
        source_stage_id: input.sourceStageId,
        target_stage_id: input.targetStageId,
        impact_level: input.level,
        note: input.note,
      });
    },
    onSuccess: (_d, vars) =>
      qc.invalidateQueries({ queryKey: queryKeys.planStageImpacts(vars.planId) }),
  });
}

export type { PlanStatus };
