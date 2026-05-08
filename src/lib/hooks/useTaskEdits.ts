import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { queryKeys } from "@/lib/query-keys";

export interface TaskEditEntry {
  id: string;
  task_id: string;
  edited_by: string | null;
  edited_at: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  editor_name: string | null;
  editor_avatar: string | null;
}

async function fetchTaskEdits(taskId: string): Promise<TaskEditEntry[]> {
  const db = supabase as any;

  const { data, error } = await db
    .from("task_edits")
    .select(`
      id,
      task_id,
      edited_by,
      edited_at,
      changes,
      profiles!task_edits_edited_by_fkey ( full_name, avatar_url )
    `)
    .eq("task_id", taskId)
    .order("edited_at", { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<{
    id: string;
    task_id: string;
    edited_by: string | null;
    edited_at: string;
    changes: Record<string, { from: unknown; to: unknown }>;
    profiles: { full_name: string | null; avatar_url: string | null } | null;
  }>).map((row) => ({
    id: row.id,
    task_id: row.task_id,
    edited_by: row.edited_by,
    edited_at: row.edited_at,
    changes: row.changes,
    editor_name: row.profiles?.full_name ?? null,
    editor_avatar: row.profiles?.avatar_url ?? null,
  }));
}

export function useTaskEdits(taskId: string | null) {
  return useQuery<TaskEditEntry[]>({
    queryKey: queryKeys.taskEdits(taskId ?? ""),
    queryFn: () => fetchTaskEdits(taskId!),
    enabled: !!taskId,
    staleTime: 30_000,
  });
}
