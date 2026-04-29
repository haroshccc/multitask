import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as service from "@/lib/services/task-custom-fields";
import type {
  TaskCustomField,
  TaskCustomFieldInsert,
  TaskCustomFieldUpdate,
} from "@/lib/types/domain";

const QK = (projectId: string | null | undefined) =>
  ["task_custom_fields", projectId ?? ""] as const;

export function useProjectCustomFields(projectId: string | null | undefined) {
  return useQuery<TaskCustomField[]>({
    queryKey: QK(projectId),
    queryFn: () => service.listProjectCustomFields(projectId!),
    enabled: !!projectId,
  });
}

export function useCreateCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskCustomFieldInsert) => service.createCustomField(input),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: QK(vars.project_id) });
    },
  });
}

export function useUpdateCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      fieldId,
      patch,
    }: {
      fieldId: string;
      patch: TaskCustomFieldUpdate;
    }) => service.updateCustomField(fieldId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task_custom_fields"] });
    },
  });
}

export function useDeleteCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fieldId: string) => service.deleteCustomField(fieldId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task_custom_fields"] });
    },
  });
}
