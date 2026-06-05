import { supabase } from "@/lib/supabase/client";
import type {
  TaskCustomField,
  TaskCustomFieldInsert,
  TaskCustomFieldUpdate,
} from "@/lib/types/domain";

// Custom fields are now entity-scoped (task / meeting / payment). The generated
// types lag behind the entity_type column, so cast to `any` for those queries.
const db = supabase as any;

export type CustomFieldEntity = "task" | "meeting" | "payment";

export async function listProjectCustomFields(
  projectId: string,
  entityType: CustomFieldEntity = "task"
): Promise<TaskCustomField[]> {
  const { data, error } = await db
    .from("task_custom_fields")
    .select("*")
    .eq("project_id", projectId)
    .eq("entity_type", entityType)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as TaskCustomField[];
}

export async function createCustomField(
  payload: TaskCustomFieldInsert & { entity_type?: CustomFieldEntity }
): Promise<TaskCustomField> {
  const entityType = payload.entity_type ?? "task";
  let sortOrder = payload.sort_order;
  if (sortOrder === undefined || sortOrder === null) {
    const { data: last } = await db
      .from("task_custom_fields")
      .select("sort_order")
      .eq("project_id", payload.project_id)
      .eq("entity_type", entityType)
      .order("sort_order", { ascending: false })
      .limit(1);
    sortOrder = (last?.[0]?.sort_order ?? 0) + 1000;
  }
  const { data, error } = await db
    .from("task_custom_fields")
    .insert({ ...payload, entity_type: entityType, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data as TaskCustomField;
}

export async function updateCustomField(
  fieldId: string,
  patch: TaskCustomFieldUpdate
): Promise<TaskCustomField> {
  const { data, error } = await db
    .from("task_custom_fields")
    .update(patch)
    .eq("id", fieldId)
    .select()
    .single();
  if (error) throw error;
  return data as TaskCustomField;
}

export async function deleteCustomField(fieldId: string): Promise<void> {
  const { error } = await db
    .from("task_custom_fields")
    .delete()
    .eq("id", fieldId);
  if (error) throw error;
}
