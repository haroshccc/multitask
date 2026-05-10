import { supabase } from "@/lib/supabase/client";

const db = supabase as any;

export interface GanttBaseline {
  id: string;
  owner_id: string;
  organization_id: string;
  name: string;
  created_at: string;
}

export interface GanttBaselineTask {
  id: string;
  baseline_id: string;
  task_id: string;
  scheduled_at: string | null;
  duration_minutes: number | null;
}

export async function listBaselines(organizationId: string): Promise<GanttBaseline[]> {
  const { data, error } = await db
    .from("gantt_baselines")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createBaseline(
  organizationId: string,
  name: string,
  tasks: Array<{ task_id: string; scheduled_at: string | null; duration_minutes: number | null }>
): Promise<GanttBaseline> {
  const { data: baseline, error: bErr } = await db
    .from("gantt_baselines")
    .insert({ organization_id: organizationId, name })
    .select()
    .single();
  if (bErr) throw bErr;

  if (tasks.length > 0) {
    const rows = tasks.map((t) => ({ ...t, baseline_id: baseline.id }));
    const { error: tErr } = await db.from("gantt_baseline_tasks").insert(rows);
    if (tErr) throw tErr;
  }

  return baseline;
}

export async function deleteBaseline(baselineId: string): Promise<void> {
  const { error } = await db.from("gantt_baselines").delete().eq("id", baselineId);
  if (error) throw error;
}

export async function getBaselineTasks(baselineId: string): Promise<GanttBaselineTask[]> {
  const { data, error } = await db
    .from("gantt_baseline_tasks")
    .select("*")
    .eq("baseline_id", baselineId);
  if (error) throw error;
  return data ?? [];
}
