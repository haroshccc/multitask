import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import type { TimeEntry } from "@/lib/types/domain";
import { taskKeys } from "./tasks";

const activeTimerKey = (userId: string | null) =>
  ["timer", "active", userId ?? "none"] as const;

export function useActiveTimer(userId: string | null) {
  return useQuery({
    queryKey: activeTimerKey(userId),
    enabled: Boolean(userId),
    refetchInterval: 30_000,
    queryFn: async (): Promise<TimeEntry | null> => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("user_id", userId!)
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useStartTimer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string): Promise<TimeEntry> => {
      const { data, error } = await supabase.rpc("start_timer", {
        p_task_id: taskId,
      });
      if (error) throw error;
      if (!data) throw new Error("start_timer returned no row");
      return data as unknown as TimeEntry;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timer"] });
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}

export function useStopTimer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<TimeEntry | null> => {
      const { data, error } = await supabase.rpc("stop_timer");
      if (error) throw error;
      return (data as unknown as TimeEntry | null) ?? null;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timer"] });
      qc.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
}
