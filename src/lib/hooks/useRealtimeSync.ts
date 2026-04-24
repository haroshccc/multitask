import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { queryFamilies } from "@/lib/query-keys";
import { useOrgScope } from "./useOrgScope";

/**
 * Subscribes to Supabase Realtime on the core tables for the active org
 * and invalidates the matching React Query caches on every change.
 *
 * Strategy: **invalidate, don't patch**. Realtime events tell us *something*
 * changed; React Query will refetch the correct shape with filters applied.
 *
 * Mount this ONCE at the AppShell level — not in every screen.
 */
export function useRealtimeSync() {
  const qc = useQueryClient();
  const { organizationId, userId, enabled } = useOrgScope();

  useEffect(() => {
    if (!enabled || !organizationId) return;

    const orgFilter = `organization_id=eq.${organizationId}`;

    const channel = supabase
      .channel(`org-${organizationId}`)
      // Tasks
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: orgFilter },
        (payload) => {
          qc.invalidateQueries({ queryKey: queryFamilies.allTasks(organizationId) });
          const changedId =
            (payload.new as { id?: string })?.id ??
            (payload.old as { id?: string })?.id;
          if (changedId) {
            qc.invalidateQueries({ queryKey: queryFamilies.taskFamily(changedId) });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_lists", filter: orgFilter },
        () => {
          qc.invalidateQueries({ queryKey: queryFamilies.allTaskLists(organizationId) });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_dependencies" },
        () => {
          qc.invalidateQueries({
            queryKey: ["task-dependencies", organizationId],
          });
        }
      )
      // Projects
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "projects", filter: orgFilter },
        (payload) => {
          qc.invalidateQueries({ queryKey: queryFamilies.allProjects(organizationId) });
          const changedId =
            (payload.new as { id?: string })?.id ??
            (payload.old as { id?: string })?.id;
          if (changedId) {
            qc.invalidateQueries({ queryKey: queryFamilies.projectFamily(changedId) });
          }
        }
      )
      // Events
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events", filter: orgFilter },
        (payload) => {
          qc.invalidateQueries({ queryKey: queryFamilies.allEvents(organizationId) });
          const changedId =
            (payload.new as { id?: string })?.id ??
            (payload.old as { id?: string })?.id;
          if (changedId) {
            qc.invalidateQueries({ queryKey: queryFamilies.eventFamily(changedId) });
          }
        }
      )
      // Recordings
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recordings", filter: orgFilter },
        (payload) => {
          qc.invalidateQueries({ queryKey: queryFamilies.allRecordings(organizationId) });
          const changedId =
            (payload.new as { id?: string })?.id ??
            (payload.old as { id?: string })?.id;
          if (changedId) {
            qc.invalidateQueries({ queryKey: queryFamilies.recordingFamily(changedId) });
          }
        }
      )
      // Thoughts
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "thoughts", filter: orgFilter },
        (payload) => {
          qc.invalidateQueries({ queryKey: queryFamilies.allThoughts(organizationId) });
          const changedId =
            (payload.new as { id?: string })?.id ??
            (payload.old as { id?: string })?.id;
          if (changedId) {
            qc.invalidateQueries({ queryKey: queryFamilies.thoughtFamily(changedId) });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "thought_lists", filter: orgFilter },
        () => {
          qc.invalidateQueries({ queryKey: queryFamilies.allThoughtLists(organizationId) });
        }
      )
      // Time entries — scoped by user to limit noise
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "time_entries",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const taskId =
            (payload.new as { task_id?: string })?.task_id ??
            (payload.old as { task_id?: string })?.task_id;
          if (taskId) {
            qc.invalidateQueries({ queryKey: ["task", taskId, "time-entries"] });
            qc.invalidateQueries({ queryKey: queryFamilies.taskFamily(taskId) });
          }
          qc.invalidateQueries({ queryKey: ["timer", "active"] });
          qc.invalidateQueries({
            queryKey: queryFamilies.allTimeEntriesRange(organizationId),
          });
        }
      )
      // Notifications — scoped by user
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          if (userId) {
            qc.invalidateQueries({ queryKey: ["notifications", userId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, organizationId, userId, enabled]);
}
