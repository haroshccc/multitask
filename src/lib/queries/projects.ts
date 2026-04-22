import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type {
  Project,
  ProjectInsert,
  ProjectPricingMode,
  ProjectUpdate,
} from "@/lib/types/domain";

export const projectKeys = {
  all: ["projects"] as const,
  list: (orgId: string, includeArchived: boolean) =>
    ["projects", orgId, includeArchived] as const,
  detail: (id: string) => ["projects", "detail", id] as const,
};

export function useProjects(orgId: string | null, includeArchived = false) {
  return useQuery({
    queryKey: projectKeys.list(orgId ?? "none", includeArchived),
    enabled: Boolean(orgId),
    queryFn: async (): Promise<Project[]> => {
      let query = supabase
        .from("projects")
        .select("*")
        .eq("organization_id", orgId!)
        .order("updated_at", { ascending: false });
      if (!includeArchived) query = query.eq("is_archived", false);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useProject(id: string | null) {
  return useQuery({
    queryKey: projectKeys.detail(id ?? "none"),
    enabled: Boolean(id),
    queryFn: async (): Promise<Project | null> => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

interface CreateProjectInput {
  orgId: string;
  ownerId: string;
  name: string;
  pricingMode?: ProjectPricingMode;
  hourlyRateCents?: number | null;
  totalPriceCents?: number | null;
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orgId,
      ownerId,
      name,
      pricingMode = "hourly",
      hourlyRateCents,
      totalPriceCents,
    }: CreateProjectInput): Promise<Project> => {
      const insert: ProjectInsert = {
        organization_id: orgId,
        owner_id: ownerId,
        name,
        pricing_mode: pricingMode,
        hourly_rate_cents: hourlyRateCents ?? null,
        total_price_cents: totalPriceCents ?? null,
      };
      const { data, error } = await supabase
        .from("projects")
        .insert(insert)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

interface UpdateProjectInput {
  id: string;
  patch: ProjectUpdate;
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: UpdateProjectInput): Promise<Project> => {
      const { data, error } = await supabase
        .from("projects")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
      qc.invalidateQueries({ queryKey: projectKeys.detail(p.id) });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export function useProjectTasks(projectId: string | null) {
  return useQuery({
    queryKey: ["projects", "tasks", projectId ?? "none"] as const,
    enabled: Boolean(projectId),
    queryFn: async () => {
      const { data: list, error: listErr } = await supabase
        .from("task_lists")
        .select("id")
        .eq("project_id", projectId!)
        .maybeSingle();
      if (listErr) throw listErr;
      if (!list) return [];
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("task_list_id", list.id)
        .order("completed_at", { ascending: true, nullsFirst: true })
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}
