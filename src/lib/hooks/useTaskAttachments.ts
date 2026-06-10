import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listTaskAttachments,
  createTaskAttachment,
  deleteTaskAttachment,
  type CreateTaskAttachmentInput,
} from "@/lib/services/taskAttachments";
import type { TaskAttachment } from "@/lib/types/domain";

const taskAttachmentsKey = (taskId: string) =>
  ["task-attachments", taskId] as const;

export function useTaskAttachments(taskId: string | null | undefined) {
  return useQuery<TaskAttachment[]>({
    queryKey: taskAttachmentsKey(taskId ?? ""),
    queryFn: () => listTaskAttachments(taskId!),
    enabled: !!taskId,
  });
}

export function useCreateTaskAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTaskAttachmentInput) =>
      createTaskAttachment(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: taskAttachmentsKey(vars.taskId) });
    },
  });
}

export function useDeleteTaskAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: string; taskId: string }) =>
      deleteTaskAttachment(vars.id),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: taskAttachmentsKey(vars.taskId) });
    },
  });
}
