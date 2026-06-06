import { supabase } from "@/lib/supabase/client";

const db = supabase as any;

export interface ProjectPayment {
  id: string;
  organization_id: string;
  owner_id: string;
  project_id: string;
  title: string;
  direction: string; // 'in' | 'out'
  amount_cents: number;
  currency: string;
  status: string; // 'pending' | 'paid' | 'overdue' | 'cancelled'
  due_date: string | null;
  paid_date: string | null;
  notes: string | null;
  custom_fields: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type ProjectPaymentInsert = {
  organization_id: string;
  owner_id: string;
  project_id: string;
  title?: string;
  direction?: string;
  amount_cents?: number;
  currency?: string;
  status?: string;
  due_date?: string | null;
  paid_date?: string | null;
  notes?: string | null;
  sort_order?: number;
};

export type ProjectPaymentUpdate = Partial<
  Omit<
    ProjectPayment,
    "id" | "organization_id" | "owner_id" | "project_id" | "created_at"
  >
>;

export async function listProjectPayments(
  projectId: string
): Promise<ProjectPayment[]> {
  const { data, error } = await db
    .from("project_payments")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ProjectPayment[];
}

export async function createProjectPayment(
  payload: ProjectPaymentInsert
): Promise<ProjectPayment> {
  const { data, error } = await db
    .from("project_payments")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as ProjectPayment;
}

export async function updateProjectPayment(
  id: string,
  patch: ProjectPaymentUpdate
): Promise<ProjectPayment> {
  const { data, error } = await db
    .from("project_payments")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ProjectPayment;
}

export async function deleteProjectPayment(id: string): Promise<void> {
  const { error } = await db.from("project_payments").delete().eq("id", id);
  if (error) throw error;
}
