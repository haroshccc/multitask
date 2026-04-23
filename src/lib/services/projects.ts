import { supabase } from "@/lib/supabase/client";
import type {
  Project,
  ProjectInsert,
  ProjectUpdate,
  ProjectExpense,
  ProjectExpenseInsert,
  FilterConfig,
} from "@/lib/types/domain";

export async function listProjects(
  organizationId: string,
  filters: FilterConfig = {},
  includeArchived = false
): Promise<Project[]> {
  let query = supabase
    .from("projects")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
  if (!includeArchived) query = query.eq("is_archived", false);
  if (filters.pricingModes?.length)
    query = query.in("pricing_mode", filters.pricingModes);
  if (filters.tags?.length) query = query.overlaps("tags", filters.tags);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getProject(projectId: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createProject(payload: ProjectInsert): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProject(
  projectId: string,
  patch: ProjectUpdate
): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .update(patch)
    .eq("id", projectId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function archiveProject(projectId: string): Promise<void> {
  const now = new Date();
  const expires = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const { error } = await supabase
    .from("projects")
    .update({
      is_archived: true,
      archived_at: now.toISOString(),
      archive_expires_at: expires.toISOString(),
    })
    .eq("id", projectId);
  if (error) throw error;
}

export async function restoreProject(projectId: string): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .update({
      is_archived: false,
      archived_at: null,
      archive_expires_at: null,
    })
    .eq("id", projectId);
  if (error) throw error;
}

// Project expenses -----------------------------------------------------------

export async function listProjectExpenses(
  projectId: string
): Promise<ProjectExpense[]> {
  const { data, error } = await supabase
    .from("project_expenses")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createProjectExpense(
  payload: ProjectExpenseInsert
): Promise<ProjectExpense> {
  let sortOrder = payload.sort_order;
  if (sortOrder === undefined || sortOrder === null) {
    const { data: last } = await supabase
      .from("project_expenses")
      .select("sort_order")
      .eq("project_id", payload.project_id)
      .order("sort_order", { ascending: false })
      .limit(1);
    sortOrder = (last?.[0]?.sort_order ?? 0) + 1000;
  }
  const { data, error } = await supabase
    .from("project_expenses")
    .insert({ ...payload, sort_order: sortOrder })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProjectExpense(
  expenseId: string,
  patch: Partial<Pick<ProjectExpense, "label" | "amount_cents" | "sort_order">>
): Promise<ProjectExpense> {
  const { data, error } = await supabase
    .from("project_expenses")
    .update(patch)
    .eq("id", expenseId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProjectExpense(expenseId: string): Promise<void> {
  const { error } = await supabase
    .from("project_expenses")
    .delete()
    .eq("id", expenseId);
  if (error) throw error;
}
