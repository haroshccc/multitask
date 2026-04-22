import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type {
  Thought,
  ThoughtInsert,
  ThoughtSource,
  ThoughtStatus,
  ThoughtUpdate,
} from "@/lib/types/domain";

export const thoughtKeys = {
  all: ["thoughts"] as const,
  list: (orgId: string, status?: ThoughtStatus) =>
    ["thoughts", orgId, status ?? "all"] as const,
};

interface ListOptions {
  status?: ThoughtStatus;
  limit?: number;
}

export function useThoughts(orgId: string | null, options: ListOptions = {}) {
  const { status, limit } = options;
  return useQuery({
    queryKey: thoughtKeys.list(orgId ?? "none", status),
    enabled: Boolean(orgId),
    queryFn: async (): Promise<Thought[]> => {
      let query = supabase
        .from("thoughts")
        .select("*")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: false });

      if (status) query = query.eq("status", status);
      if (limit) query = query.limit(limit);

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

interface CreateThoughtInput {
  orgId: string;
  ownerId: string;
  text: string;
  source?: ThoughtSource;
}

export function useCreateThought() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orgId,
      ownerId,
      text,
      source = "app_text",
    }: CreateThoughtInput): Promise<Thought> => {
      const insert: ThoughtInsert = {
        organization_id: orgId,
        owner_id: ownerId,
        source,
        text_content: text,
        status: "unprocessed",
      };
      const { data, error } = await supabase
        .from("thoughts")
        .insert(insert)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: thoughtKeys.all });
    },
  });
}

interface UpdateThoughtStatusInput {
  id: string;
  status: ThoughtStatus;
}

export function useUpdateThoughtStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: UpdateThoughtStatusInput) => {
      const patch: ThoughtUpdate = { status };
      if (status === "processed") patch.processed_at = new Date().toISOString();
      if (status === "archived") patch.archived_at = new Date().toISOString();
      const { error } = await supabase.from("thoughts").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: thoughtKeys.all });
    },
  });
}

export function useDeleteThought() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("thoughts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: thoughtKeys.all });
    },
  });
}
