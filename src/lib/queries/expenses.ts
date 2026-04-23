import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { ProjectExpense } from "@/lib/types/domain";

const expenseKeys = {
  list: (projectId: string) => ["project_expenses", projectId] as const,
};

export function useProjectExpenses(projectId: string | null) {
  return useQuery({
    queryKey: expenseKeys.list(projectId ?? "none"),
    enabled: Boolean(projectId),
    queryFn: async (): Promise<ProjectExpense[]> => {
      const { data, error } = await supabase
        .from("project_expenses")
        .select("*")
        .eq("project_id", projectId!)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      label: string;
      amountCents: number;
    }): Promise<ProjectExpense> => {
      const { data, error } = await supabase
        .from("project_expenses")
        .insert({
          project_id: input.projectId,
          label: input.label,
          amount_cents: input.amountCents,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (e) => {
      qc.invalidateQueries({ queryKey: expenseKeys.list(e.project_id) });
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      projectId: string;
      label?: string;
      amountCents?: number;
    }) => {
      const patch: { label?: string; amount_cents?: number } = {};
      if (input.label !== undefined) patch.label = input.label;
      if (input.amountCents !== undefined) patch.amount_cents = input.amountCents;
      const { error } = await supabase
        .from("project_expenses")
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: expenseKeys.list(vars.projectId) });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; projectId: string }) => {
      const { error } = await supabase
        .from("project_expenses")
        .delete()
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: expenseKeys.list(vars.projectId) });
    },
  });
}
