import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as service from "@/lib/services/task-custom-fields";
import type { CustomFieldEntity } from "@/lib/services/task-custom-fields";
import type {
  TaskCustomField,
  TaskCustomFieldInsert,
  TaskCustomFieldUpdate,
} from "@/lib/types/domain";

export type { CustomFieldEntity } from "@/lib/services/task-custom-fields";

const QK = (
  projectId: string | null | undefined,
  entityType: CustomFieldEntity = "task"
) => ["task_custom_fields", entityType, projectId ?? ""] as const;

export function useProjectCustomFields(
  projectId: string | null | undefined,
  entityType: CustomFieldEntity = "task"
) {
  return useQuery<TaskCustomField[]>({
    queryKey: QK(projectId, entityType),
    queryFn: () => service.listProjectCustomFields(projectId!, entityType),
    enabled: !!projectId,
  });
}

export function useCreateCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      input: TaskCustomFieldInsert & { entity_type?: CustomFieldEntity }
    ) => service.createCustomField(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task_custom_fields"] });
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
