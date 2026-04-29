import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import {
  extractQuestionsFromRecording,
} from "@/lib/services/extract-questions";

/**
 * Mutation that calls the `extract-questions` Edge Function. On success it
 * invalidates the project's questions cache so the new rows appear in
 * QuestionsBlock immediately.
 */
export function useExtractQuestions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      recordingId: string;
      projectId?: string | null;
      replace?: boolean;
    }) => extractQuestionsFromRecording(input),
    onSuccess: (_data, vars) => {
      if (vars.projectId) {
        qc.invalidateQueries({
          queryKey: queryKeys.questions(vars.projectId),
        });
      }
    },
  });
}
