import { supabase } from "@/lib/supabase/client";
import type {
  TaskCustomField,
  TaskCustomFieldInsert,
  TaskCustomFieldUpdate,
} from "@/lib/types/domain";

export async function listProjectCustomFields(
  projectId: string
): Promise<TaskCustomField[]> {
  const { data, error } = await supabase
    .from("task_custom_fields")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createCustomField(
  payload: TaskCustomFieldInsert
): Promise<TaskCustomField> {
  let sortOrder = payload.sort_order;
  if (sortOrder === undefined || sortOrder === null) {
    const { data: last } = await supabase
      .from("task_custom_fields")
      .select("sort_order")
      .eq("project_id", payload.project_id)
      .order("sort_order", { ascending: false })
      .limit(1);
    sortOrder = (last?.[0]?.sort_order ?? 0) + 1000;
  }
  const { data, error } = await supabase
    .from("task_custom_fields")
    .insert({ ...payload, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCustomField(
  fieldId: string,
  patch: TaskCustomFieldUpdate
): Promise<TaskCustomField> {
  const { data, error } = await supabase
    .from("task_custom_fields")
    .update(patch)
    .eq("id", fieldId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCustomField(fieldId: string): Promise<void> {
  const { error } = await supabase
    .from("task_custom_fields")
    .delete()
    .eq("id", fieldId);
  if (error) throw error;
}
