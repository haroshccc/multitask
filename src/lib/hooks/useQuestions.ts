import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import * as service from "@/lib/services/questions";
import type { Question, QuestionInsert } from "@/lib/types/domain";
import { useOrgScope, assertOrgScope } from "./useOrgScope";

export function useProjectQuestions(projectId: string | null | undefined) {
  return useQuery<Question[]>({
    queryKey: queryKeys.questions(projectId ?? ""),
    queryFn: () => service.listProjectQuestions(projectId!),
    enabled: !!projectId,
  });
}

export function useCreateQuestion() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: (
      input: Omit<QuestionInsert, "organization_id" | "owner_id">
    ) => {
      const { organizationId, userId } = assertOrgScope(scope);
      return service.createQuestion({
        ...input,
        organization_id: organizationId,
        owner_id: userId,
      });
    },
    onSuccess: (question) => {
      qc.invalidateQueries({ queryKey: queryKeys.questions(question.project_id) });
    },
  });
}

export function useUpdateQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      questionId,
      patch,
    }: {
      questionId: string;
      projectId: string;
      patch: Parameters<typeof service.updateQuestion>[1];
    }) => service.updateQuestion(questionId, patch),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.questions(vars.projectId) });
    },
  });
}

export function useAnswerQuestion() {
  const qc = useQueryClient();
  const scope = useOrgScope();
  return useMutation({
    mutationFn: ({
      questionId,
      answer,
    }: {
      questionId: string;
      projectId: string;
      answer: string;
    }) => {
      const { userId } = assertOrgScope(scope);
      return service.answerQuestion(questionId, answer, userId);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.questions(vars.projectId) });
    },
  });
}

export function useReopenQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId }: { questionId: string; projectId: string }) =>
      service.reopenQuestion(questionId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.questions(vars.projectId) });
    },
  });
}

export function useDeleteQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId }: { questionId: string; projectId: string }) =>
      service.deleteQuestion(questionId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.questions(vars.projectId) });
    },
  });
}
